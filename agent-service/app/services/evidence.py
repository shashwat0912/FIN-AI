from datetime import UTC, datetime, timedelta
from math import ceil

from pydantic import ValidationError

from app.models import Reasoning, ToolResult
from app.models.evidence import Comparison
from app.tools.normalize import usable


def window_issues(
    data: dict, deployed_at=None, baseline_minutes=None, observation_minutes=None
) -> list[str]:
    try:
        comparison = Comparison.model_validate(data)
    except (ValidationError, ValueError):
        return ["invalid_metric_windows"]
    baseline, observation = comparison.baseline, comparison.observation
    issues = []
    if deployed_at and abs((comparison.deployment_at - deployed_at).total_seconds()) > 1:
        issues.append("deployment_timestamp_mismatch")
    if (
        baseline.end > comparison.deployment_at
        or observation.start < comparison.deployment_at
        or observation.start - baseline.end > timedelta(minutes=2)
    ):
        issues.append("unaligned_metric_windows")
    now = datetime.now(UTC)
    if observation.end > now:
        issues.append("observation_window_pending")
    if now - observation.end > timedelta(minutes=20):
        issues.append("stale_metric_windows")
    for label, window, expected in [
        ("baseline", baseline, baseline_minutes),
        ("observation", observation, observation_minutes),
    ]:
        minutes = (window.end - window.start).total_seconds() / 60
        if expected and minutes != expected:
            issues.append(f"{label}_duration_mismatch")
        required = [
            window.p95_ms,
            window.error_rate,
            window.http_5xx_rate,
            window.readiness_failures,
            window.pod_restarts,
        ]
        if (
            minutes < 5
            or window.sample_count < max(3, ceil(minutes * 0.8))
            or window.sample_count > ceil(minutes) + 1
            or any(v is None for v in required)
            or window.observed_at is None
        ):
            issues.append(f"insufficient_{label}_coverage")
    return issues


def supported_signals(evidence: list[ToolResult]) -> dict[str, list[int]]:
    observations: dict[str, list[int]] = {}
    for index, entry in enumerate(evidence):
        if not usable(entry):
            continue
        names = list(entry.data.get("signals", []))
        for pod in entry.data.get("pods", []):
            names.extend(pod.get("signals", []))
        for name in set(names):
            observations.setdefault(name, []).append(index)
    return observations


def abstain() -> Reasoning:
    return Reasoning(
        outcome="insufficient_evidence",
        likely_root_cause="Insufficient evidence to determine a root cause",
        confidence=0,
        evidence_ids=[],
        recommended_actions=[
            "Collect fresh, corroborating infrastructure evidence before remediation"
        ],
    )


def diagnose(evidence: list[ToolResult], causes: dict) -> Reasoning:
    good = {e.tool: (i, e.data) for i, e in enumerate(evidence) if usable(e)}
    signals = supported_signals(evidence)
    pods = good.get("kubernetes_get_pods", (-1, {}))[1].get("pods", [])
    deployment = good.get("kubernetes_get_deployments", (-1, {}))[1]
    unhealthy_pods = bool(pods) and any(not p["ready"] for p in pods)

    def health(tool):
        return good.get(tool, (-1, {}))[1].get("status")

    confirmed: dict[str, set[int]] = {}

    def confirm(signal, tools, condition):
        if condition and all(tool in good for tool in tools):
            confirmed[signal] = set(signals.get(signal, [])) | {good[tool][0] for tool in tools}

    # Log signatures alone are hypotheses; current workload/dependency observations must agree.
    pod_signals = {s for pod in pods for s in pod.get("signals", [])}
    for signal in ("oom", "crash_loop"):
        confirm(
            signal,
            ["kubernetes_get_pods"],
            signal in pod_signals and unhealthy_pods and any(p["restarts"] > 0 for p in pods),
        )
    for signal in ("configuration_expired", "bad_environment"):
        confirm(
            signal,
            ["kubernetes_get_events", "kubernetes_get_pods"],
            signal in good.get("kubernetes_get_events", (-1, {}))[1].get("signals", [])
            and unhealthy_pods,
        )
    confirm(
        "postgres_unavailable",
        ["rds_get_health", "kubernetes_get_pods"],
        "postgres_unavailable" in signals
        and unhealthy_pods
        and health("rds_get_health") in {"unavailable", "failed", "stopped"},
    )
    db = good.get("rds_get_metrics", (-1, {}))[1]
    confirm(
        "database_saturation",
        ["rds_get_metrics", "kubernetes_get_pods"],
        "database_saturation" in signals
        and unhealthy_pods
        and (db.get("max_connections") or 0) > 0
        and (db.get("connections") or 0) >= 0.9 * db["max_connections"],
    )
    confirm(
        "valkey_unavailable",
        ["valkey_get_health", "kubernetes_get_pods"],
        "valkey_unavailable" in signals
        and unhealthy_pods
        and health("valkey_get_health") in {"unavailable", "failed", "stopped"},
    )
    confirm(
        "migration_failed",
        ["kubernetes_get_migration_status"],
        health("kubernetes_get_migration_status") == "failed",
    )
    confirm(
        "bad_deployment",
        ["kubernetes_get_deployments"],
        "bad_deployment" in deployment.get("signals", [])
        and deployment.get("ready", 0) < deployment.get("desired", 0),
    )
    runs = good.get("github_get_recent_workflow_runs", (-1, {}))[1].get("runs", [])
    jobs = good.get("github_get_workflow_jobs", (-1, {}))[1].get("jobs", [])
    confirm(
        "workflow_failure",
        ["github_get_recent_workflow_runs", "github_get_workflow_jobs"],
        bool(runs)
        and runs[0].get("conclusion") == "failure"
        and any(j.get("conclusion") == "failure" for j in jobs),
    )
    metric = good.get("cloudwatch_get_metric", (-1, {}))[1]
    if metric and not window_issues(metric):
        pre, post = metric["baseline"], metric["observation"]
        confirm(
            "high_latency",
            ["cloudwatch_get_metric"],
            post["p95_ms"] > max(pre["p95_ms"] * 1.5, 500),
        )
        confirm(
            "alb_unhealthy",
            ["cloudwatch_get_metric", "kubernetes_get_ingress"],
            (metric.get("unhealthy_targets") or 0) > 0
            and bool(good.get("kubernetes_get_ingress", (-1, {}))[1].get("ingresses")),
        )
    if confirmed:
        roots = [causes[name][0] for name in causes if name in confirmed]
        ids = sorted({i for indices in confirmed.values() for i in indices})
        return Reasoning(
            outcome="diagnosed",
            root_causes=roots,
            likely_root_cause="; ".join(roots),
            confidence=0.8 if len(roots) > 1 else 0.9,
            evidence_ids=ids,
            recommended_actions=[causes[name][1] for name in causes if name in confirmed][:5],
        )
    required = {
        "kubernetes_get_pods",
        "kubernetes_get_deployments",
        "kubernetes_get_events",
        "kubernetes_get_pod_logs",
    }
    if (
        required <= good.keys()
        and pods
        and all(p["ready"] and p["restarts"] == 0 for p in pods)
        and deployment.get("desired", 0) > 0
        and deployment.get("ready") == deployment["desired"]
        and not signals
    ):
        return Reasoning(
            outcome="healthy",
            likely_root_cause="No incident detected in the observed workload",
            confidence=0.9,
            evidence_ids=sorted(good[t][0] for t in required),
            recommended_actions=["No remediation recommended; continue normal monitoring"],
        )
    return abstain()
