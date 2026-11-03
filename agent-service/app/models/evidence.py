from datetime import timedelta
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.tools.sanitize import SIGNALS

Text = Annotated[str, Field(max_length=512)]
Number = Annotated[float, Field(allow_inf_nan=False)]
Rate = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]
Count = Annotated[int, Field(ge=0)]


class Observation(BaseModel):
    model_config = ConfigDict(extra="ignore", strict=True)


class Signals(Observation):
    signals: list[Text] = Field(max_length=30)

    @field_validator("signals")
    @classmethod
    def known_signals(cls, value):
        if any(s not in SIGNALS for s in value):
            raise ValueError("Unknown diagnostic signal")
        return value


class Pod(Signals):
    name: Text
    ready: bool
    restarts: Count
    image: Text = ""


class Pods(Observation):
    pods: list[Pod] = Field(max_length=50)


class Deployment(Signals):
    ready: Count
    desired: Count
    image: Text


class Logs(Signals):
    messages: list[Text] = Field(default_factory=list, max_length=30)
    sample_count: Count = 0


class Migration(Signals):
    status: Literal["succeeded", "failed", "pending", "unknown"]


class NamedResource(Observation):
    name: Text
    ingress_class: Text = Field(default="", alias="class")


class Ingresses(Observation):
    ingresses: list[NamedResource] = Field(max_length=50)


class Usage(Observation):
    cpu: Text = ""
    memory: Text = ""


class ContainerUsage(Observation):
    name: Text
    usage: Usage


class PodUsage(Usage):
    name: Text
    containers: list[ContainerUsage] = Field(default_factory=list, max_length=30)


class ResourceUsage(Observation):
    pods: list[PodUsage] = Field(max_length=50)
    idle_worker_candidate: bool = False


class MetricWindow(Observation):
    aggregation: Literal["median_of_minute_buckets"] = "median_of_minute_buckets"
    # Datetime strings are the JSON wire format, also in otherwise strict evidence models.
    start: Annotated[AwareDatetime, Field(strict=False)]
    end: Annotated[AwareDatetime, Field(strict=False)]
    observed_at: Annotated[AwareDatetime | None, Field(strict=False)] = None
    sample_count: Count
    p95_ms: Annotated[Number | None, Field(ge=0)] = None
    p99_ms: Annotated[Number | None, Field(ge=0)] = None
    error_rate: Rate | None = None
    http_5xx_rate: Rate | None = None
    readiness_failures: Number | None = None
    pod_restarts: Number | None = None

    @model_validator(mode="after")
    def ordered(self):
        if self.end <= self.start or self.end - self.start > timedelta(hours=2):
            raise ValueError("Invalid metric window")
        if self.observed_at and not self.start <= self.observed_at <= self.end:
            raise ValueError("Observation outside its window")
        return self


class Comparison(Observation):
    deployment_at: Annotated[AwareDatetime, Field(strict=False)]
    comparison_basis: Literal["deployment", "recent"]
    baseline: MetricWindow
    observation: MetricWindow
    unhealthy_targets: Number | None = None


class Alarm(Observation):
    name: Text
    state: Text


class Alarms(Observation):
    alarms: list[Alarm] = Field(max_length=50)


class Health(Observation):
    status: Text


class DependencyMetrics(Observation):
    connections: Number | None
    max_connections: Number | None = None
    cpu_percent: Number | None
    evictions: Number | None = None


class Run(Observation):
    id: Annotated[int, Field(ge=1)]
    sha: Annotated[str, Field(pattern=r"^[a-f0-9]{40}$")]
    status: Text
    conclusion: Text | None


class Runs(Observation):
    runs: list[Run] = Field(max_length=50)


class Job(Observation):
    name: Text
    conclusion: Text | None


class Jobs(Observation):
    jobs: list[Job] = Field(max_length=50)


class GithubDeployment(Observation):
    id: Annotated[int, Field(ge=1)]
    sha: Annotated[str, Field(pattern=r"^[a-f0-9]{40}$")]
    environment: Text
    created_at: Annotated[AwareDatetime, Field(strict=False)]


class GithubDeployments(Observation):
    deployments: list[GithubDeployment] = Field(max_length=50)


class ResourceChange(Observation):
    address: Text
    actions: list[Literal["no-op", "create", "read", "update", "delete", "forget"]] = Field(
        max_length=3
    )


class PlanSummary(Observation):
    available: bool
    create: Count
    update: Count
    delete: Count
    changes: list[ResourceChange] = Field(default_factory=list, max_length=50)


class Outputs(Observation):
    eks_cluster_name: Text | None = None
    environment: Text | None = None
    aws_region: Text | None = None


class ServiceCost(Observation):
    service: Text
    monthly_usd: Number
    previous_usd: Number


class Costs(Observation):
    currency: Literal["USD"]
    period: Text
    scope: Text = "synthetic FIN-AI fixture"
    services: list[ServiceCost] = Field(max_length=50)
    note: Text = ""


DATA_MODELS: dict[str, type[Observation]] = {
    "kubernetes_get_pods": Pods,
    "kubernetes_get_deployments": Deployment,
    "kubernetes_get_events": Signals,
    "kubernetes_get_pod_logs": Logs,
    "kubernetes_get_ingress": Ingresses,
    "kubernetes_get_resource_usage": ResourceUsage,
    "kubernetes_get_migration_status": Migration,
    "cloudwatch_search_logs": Logs,
    "cloudwatch_get_metric": Comparison,
    "cloudwatch_get_recent_alarms": Alarms,
    "rds_get_health": Health,
    "rds_get_metrics": DependencyMetrics,
    "valkey_get_health": Health,
    "valkey_get_metrics": DependencyMetrics,
    "github_get_recent_workflow_runs": Runs,
    "github_get_workflow_jobs": Jobs,
    "github_get_deployment_metadata": GithubDeployments,
    "terraform_get_plan_summary": PlanSummary,
    "terraform_get_outputs": Outputs,
    "cost_get_summary": Costs,
}
