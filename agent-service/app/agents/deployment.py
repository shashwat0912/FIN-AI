from app.mcp.client import ToolSession
from app.models import AgentStatus


async def review(
    sha: str, tools: ToolSession, image_digest: str = ""
) -> tuple[AgentStatus, dict, list[str]]:
    for name in [
        "github_get_recent_workflow_runs",
        "kubernetes_get_deployments",
        "kubernetes_get_pods",
        "kubernetes_get_events",
        "kubernetes_get_migration_status",
        "cloudwatch_search_logs",
        "cloudwatch_get_metric",
    ]:
        await tools.call(
            name, **({"sha": sha} if name == "github_get_recent_workflow_runs" else {})
        )
    await tools.call("github_get_deployment_metadata", sha=sha)
    data = {e.tool: e.data for e in tools.evidence if not e.error}
    runs = [
        r
        for r in data.get("github_get_recent_workflow_runs", {}).get("runs", [])
        if r.get("sha") == sha
    ]
    jobs = None
    if runs:
        jobs = await tools.call("github_get_workflow_jobs", run_id=runs[0]["id"])
    deployment = data.get("kubernetes_get_deployments", {})
    pods = data.get("kubernetes_get_pods", {}).get("pods", [])
    metric = data.get("cloudwatch_get_metric", {})
    migration = data.get("kubernetes_get_migration_status", {}).get("status", "unknown")
    expected_image = "@" + image_digest if image_digest else ":" + sha
    image_matches = deployment.get("image", "").endswith(expected_image)
    pod_health = bool(pods) and all(
        p.get("ready") and p.get("image", "").endswith(expected_image) for p in pods
    )
    rollout_ok = deployment.get("desired", 0) > 0 and deployment.get("ready") == deployment.get(
        "desired"
    )
    failed = (
        bool(runs and runs[0].get("conclusion") == "failure")
        or migration == "failed"
        or "bad_deployment" in deployment.get("signals", [])
    )
    pre, post = metric.get("pre_p95_ms"), metric.get("post_p95_ms")
    pre_err, post_err = metric.get("pre_error_rate"), metric.get("post_error_rate")
    regression = (pre is not None and post is not None and post > max(pre * 1.5, 500)) or (
        pre_err is not None and post_err is not None and post_err > max(pre_err * 2, 0.01)
    )
    errors = data.get("cloudwatch_search_logs", {}).get("signals", [])
    complete = (
        all(not e.error for e in tools.evidence)
        and all(v is not None for v in [pre, post, pre_err, post_err])
        and bool(runs)
        and jobs is not None
        and bool(jobs.data.get("jobs"))
    )
    jobs_ok = jobs is not None and all(
        j.get("conclusion") == "success" for j in jobs.data.get("jobs", [])
    )
    healthy = (
        complete
        and jobs_ok
        and image_matches
        and pod_health
        and rollout_ok
        and migration == "succeeded"
        and runs[0].get("conclusion") == "success"
        and not regression
        and not errors
    )
    status: AgentStatus = "failed" if failed else "healthy" if healthy else "degraded"
    recommendation = (
        "PROMOTE" if healthy else "ROLLBACK_RECOMMENDED" if failed or regression else "HOLD"
    )
    summary = {
        "deployment": sha,
        "github_deployments": data.get("github_get_deployment_metadata", {}).get("deployments", []),
        "image_digest": image_digest or None,
        "image_provenance": "Caller-supplied CI digest; SHA-to-digest attestation is not verified"
        if image_digest
        else "Image tag matches requested commit SHA",
        "recommendation": recommendation,
        "pre_p95_ms": pre,
        "post_p95_ms": post,
        "pre_error_rate": pre_err,
        "post_error_rate": post_err,
        "error_rate_change": post_err - pre_err
        if pre_err is not None and post_err is not None
        else None,
        "pod_health": pod_health,
        "image_matches": image_matches,
        "migration_status": migration,
        "comparison_window": "preceding 15 minutes vs latest 15 minutes; verify alignment with rollout time",
    }
    return (
        status,
        summary,
        ["Review rollout evidence before approving any rollback"]
        if not healthy
        else ["Deployment evidence meets the configured health checks"],
    )
