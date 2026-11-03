from datetime import datetime

from app.mcp.client import ToolSession
from app.models import AgentStatus
from app.services.evidence import window_issues
from app.tools.normalize import usable


async def review(
    sha: str,
    tools: ToolSession,
    image_digest: str = "",
    deployed_at=None,
    baseline_minutes=15,
    observation_minutes=15,
) -> tuple[AgentStatus, dict, list[str]]:
    metadata = await tools.call("github_get_deployment_metadata", sha=sha, deployed_at=deployed_at)
    records = (
        [record for record in metadata.data.get("deployments", []) if record["sha"] == sha]
        if usable(metadata)
        else []
    )
    timestamp_source = "operator" if deployed_at else "github_deployment"
    if deployed_at is None and records:
        deployed_at = max(datetime.fromisoformat(record["created_at"]) for record in records)
    for name in [
        "github_get_recent_workflow_runs",
        "kubernetes_get_deployments",
        "kubernetes_get_pods",
        "kubernetes_get_events",
        "kubernetes_get_migration_status",
        "cloudwatch_search_logs",
    ]:
        await tools.call(name, **({"sha": sha} if name.startswith("github_") else {}))
    metrics = await tools.call(
        "cloudwatch_get_metric",
        deployed_at=deployed_at,
        baseline_minutes=baseline_minutes,
        observation_minutes=observation_minutes,
    )
    data = {entry.tool: entry.data for entry in tools.evidence if usable(entry)}
    runs = [
        run
        for run in data.get("github_get_recent_workflow_runs", {}).get("runs", [])
        if run["sha"] == sha
    ]
    jobs = await tools.call("github_get_workflow_jobs", run_id=runs[0]["id"]) if runs else None
    issues = []
    if deployed_at is None:
        issues.append("missing_deployment_timestamp")
    if not usable(metrics):
        issues.append("unusable_metric_evidence")
    else:
        issues.extend(
            window_issues(metrics.data, deployed_at, baseline_minutes, observation_minutes)
        )
        if metrics.data["comparison_basis"] != "deployment":
            issues.append("metrics_not_aligned_to_deployment")
    required = {
        "github_get_recent_workflow_runs",
        "kubernetes_get_deployments",
        "kubernetes_get_pods",
        "kubernetes_get_events",
        "kubernetes_get_migration_status",
        "cloudwatch_search_logs",
    }
    if (
        not required <= data.keys()
        or not runs
        or not jobs
        or not usable(jobs)
        or not jobs.data.get("jobs")
    ):
        issues.append("missing_deployment_evidence")
    deployment = data.get("kubernetes_get_deployments", {})
    pods = data.get("kubernetes_get_pods", {}).get("pods", [])
    migration = data.get("kubernetes_get_migration_status", {}).get("status", "unknown")
    if migration not in {"succeeded", "failed"}:
        issues.append("missing_migration_result")
    expected_image = "@" + image_digest if image_digest else ":" + sha
    image_matches = deployment.get("image", "").endswith(expected_image)
    pod_health = bool(pods) and all(
        pod["ready"] and pod["image"].endswith(expected_image) for pod in pods
    )
    rollout_ok = deployment.get("desired", 0) > 0 and deployment.get("ready") == deployment.get(
        "desired"
    )
    pre, post = metrics.data.get("baseline", {}), metrics.data.get("observation", {})
    regression = False
    if not issues:
        regression = (
            post["p95_ms"] > max(pre["p95_ms"] * 1.5, 500)
            or (
                pre.get("p99_ms") is not None
                and post.get("p99_ms") is not None
                and post["p99_ms"] > max(pre["p99_ms"] * 2, 1000)
            )
            or post["error_rate"] > max(pre["error_rate"] * 2, 0.01)
            or post["http_5xx_rate"] > max(pre["http_5xx_rate"] * 2, 0.01)
            or post["readiness_failures"] > pre["readiness_failures"]
            or post["pod_restarts"] > pre["pod_restarts"]
        )
    failed = (
        bool(runs and runs[0].get("conclusion") == "failure")
        or migration == "failed"
        or "bad_deployment" in deployment.get("signals", [])
    )
    jobs_ok = (
        jobs is not None
        and usable(jobs)
        and bool(jobs.data.get("jobs"))
        and all(job["conclusion"] == "success" for job in jobs.data["jobs"])
    )
    healthy = (
        not issues
        and jobs_ok
        and image_matches
        and pod_health
        and rollout_ok
        and migration == "succeeded"
        and runs[0]["status"] == "completed"
        and runs[0]["conclusion"] == "success"
        and not regression
        and not data.get("cloudwatch_search_logs", {}).get("signals", [])
    )
    status: AgentStatus = (
        "insufficient_evidence"
        if issues
        else "failed"
        if failed
        else "healthy"
        if healthy
        else "degraded"
    )
    recommendation = (
        "HOLD"
        if issues
        else "PROMOTE"
        if healthy
        else "ROLLBACK_RECOMMENDED"
        if failed or regression
        else "HOLD"
    )
    summary = {
        "deployment": sha,
        "deployment_at": deployed_at.isoformat() if deployed_at else None,
        "timestamp_source": timestamp_source,
        "github_deployments": records,
        "image_digest": image_digest or None,
        "image_provenance": "Caller-supplied digest; SHA-to-digest attestation is not verified"
        if image_digest
        else "Image tag compared with requested commit SHA",
        "recommendation": recommendation,
        "baseline_window": pre or None,
        "observation_window": post or None,
        "pre_p95_ms": pre.get("p95_ms"),
        "post_p95_ms": post.get("p95_ms"),
        "pre_p99_ms": pre.get("p99_ms"),
        "post_p99_ms": post.get("p99_ms"),
        "pre_error_rate": pre.get("error_rate"),
        "post_error_rate": post.get("error_rate"),
        "error_rate_change": post["error_rate"] - pre["error_rate"]
        if pre.get("error_rate") is not None and post.get("error_rate") is not None
        else None,
        "pre_5xx_rate": pre.get("http_5xx_rate"),
        "post_5xx_rate": post.get("http_5xx_rate"),
        "readiness_failures": post.get("readiness_failures"),
        "pod_restarts": post.get("pod_restarts"),
        "total_pod_restarts": sum(p["restarts"] for p in pods),
        "rollout_healthy": rollout_ok,
        "pod_health": pod_health,
        "image_matches": image_matches,
        "migration_status": migration,
        "evidence_issues": sorted(set(issues)),
        "comparison_window": "Deployment-aligned windows; median minute-bucket percentiles, >=80% minute coverage",
    }
    return (
        status,
        summary,
        ["Collect complete deployment-aligned evidence before promotion or rollback"]
        if issues
        else ["Review rollout evidence before approving any rollback"]
        if not healthy
        else ["Deployment evidence meets the configured health checks"],
    )
