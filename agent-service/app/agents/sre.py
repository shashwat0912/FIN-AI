from app import telemetry
from app.mcp.client import ToolSession
from app.models import Reasoning
from app.services.providers import Provider


async def investigate(incident: str, tools: ToolSession, provider: Provider) -> Reasoning:
    with telemetry.tracer.start_as_current_span("create_plan"):
        plan = [
            "kubernetes_get_pods",
            "kubernetes_get_deployments",
            "kubernetes_get_events",
            "kubernetes_get_pod_logs",
        ]
    for name in plan:
        await tools.call(name)
    signal_set = {s for e in tools.evidence for s in e.data.get("signals", [])}
    text = incident.lower()
    followups = []
    if signal_set & {"postgres_unavailable", "database_saturation"} or any(
        w in text for w in ["postgres", "database", "readiness"]
    ):
        followups += ["rds_get_health", "rds_get_metrics"]
    if "valkey_unavailable" in signal_set or "valkey" in text:
        followups += ["valkey_get_health", "valkey_get_metrics"]
    if "migration_failed" in signal_set or "migration" in text:
        followups += ["kubernetes_get_migration_status"]
    if signal_set & {"alb_unhealthy", "high_latency"} or any(
        w in text for w in ["503", "slow", "latency"]
    ):
        followups += [
            "kubernetes_get_ingress",
            "cloudwatch_get_metric",
            "cloudwatch_search_logs",
            "cloudwatch_get_recent_alarms",
        ]
    if "workflow_failure" in signal_set or "github" in text:
        runs = await tools.call("github_get_recent_workflow_runs")
        if runs.data.get("runs"):
            await tools.call("github_get_workflow_jobs", run_id=runs.data["runs"][0]["id"])
    for name in dict.fromkeys(followups):
        await tools.call(name)
    with telemetry.tracer.start_as_current_span("correlate_evidence"):
        return await provider.correlate(incident, tools.evidence)
