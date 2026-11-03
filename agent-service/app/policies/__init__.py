from app.models import Policy

READ_TOOLS = (
    "kubernetes_get_pods",
    "kubernetes_get_deployments",
    "kubernetes_get_events",
    "kubernetes_get_pod_logs",
    "kubernetes_get_ingress",
    "kubernetes_get_resource_usage",
    "cloudwatch_search_logs",
    "cloudwatch_get_metric",
    "cloudwatch_get_recent_alarms",
    "rds_get_health",
    "rds_get_metrics",
    "valkey_get_health",
    "valkey_get_metrics",
    "github_get_recent_workflow_runs",
    "github_get_workflow_jobs",
    "terraform_get_plan_summary",
    "terraform_get_outputs",
    "cost_get_summary",
    "kubernetes_get_migration_status",
)
WRITE_TOOLS = ("restart_deployment", "rollback_helm_release", "scale_deployment")


def classify(name: str) -> Policy:
    if name in READ_TOOLS:
        return Policy.READ_ONLY
    if name in WRITE_TOOLS:
        return Policy.APPROVAL_REQUIRED
    return Policy.DENIED
