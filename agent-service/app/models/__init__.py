from datetime import UTC, datetime
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

ActionName = Literal["restart_deployment", "rollback_helm_release", "scale_deployment"]
AgentName = Literal["sre", "deployment", "finops"]
AgentStatus = Literal["healthy", "degraded", "failed", "insufficient_evidence"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Policy(StrEnum):
    READ_ONLY = "READ_ONLY"
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"
    DENIED = "DENIED"


class ToolInput(StrictModel):
    requested_at: AwareDatetime = Field(default_factory=lambda: datetime.now(UTC))
    sha: str = Field(default="", pattern=r"^$|^[a-f0-9]{40}$")
    namespace: str = Field(default="finance-ai-staging", pattern=r"^[a-z0-9][a-z0-9-]{0,62}$")
    resource: str = Field(default="finance-ai-backend", pattern=r"^[a-z0-9][a-z0-9-]{0,62}$")
    scenario: str = Field(default="database_saturation", pattern=r"^[a-z_]{1,50}$")
    run_id: int = Field(default=1, ge=1)
    limit: int = Field(default=30, ge=1, le=100)
    deployed_at: AwareDatetime | None = None
    baseline_minutes: int = Field(default=15, ge=5, le=60)
    observation_minutes: int = Field(default=15, ge=5, le=60)
    correlation_id: UUID


class ToolError(StrictModel):
    code: Literal[
        "DENIED", "INVALID_INPUT", "TIMEOUT", "UNAVAILABLE", "BUDGET_EXCEEDED", "MALFORMED"
    ]
    message: str


class ToolResult(StrictModel):
    source: str = "unknown"
    resource: str = ""
    observed_at: AwareDatetime | None = None
    collected_at: AwareDatetime = Field(default_factory=lambda: datetime.now(UTC))
    freshness: Literal["fresh", "stale", "unknown"] = "unknown"
    status: Literal["ok", "error", "truncated"] = "ok"
    trust: Literal["untrusted_evidence"] = "untrusted_evidence"
    warnings: list[str] = Field(default_factory=list)
    tool: str
    correlation_id: UUID
    trace_id: str
    data_mode: Literal["simulation", "live"]
    data: dict[str, Any] = Field(default_factory=dict)
    error: ToolError | None = None
    duration_ms: float = 0


class InvestigationRequest(StrictModel):
    incident: str = Field(min_length=3, max_length=1000)
    scenario: str = Field(default="database_saturation", pattern=r"^[a-z_]{1,50}$")


class DeploymentRequest(StrictModel):
    deployed_at: AwareDatetime | None = None
    baseline_minutes: int = Field(default=15, ge=5, le=60)
    observation_minutes: int = Field(default=15, ge=5, le=60)
    image_digest: str = Field(default="", pattern=r"^$|^sha256:[a-f0-9]{64}$")
    sha: str = Field(default="a" * 40, pattern=r"^[a-f0-9]{40}$")
    scenario: str = Field(default="healthy", pattern=r"^[a-z_]{1,50}$")


class CostRequest(StrictModel):
    question: str = Field(
        default="Why did FIN-AI AWS cost increase?", min_length=3, max_length=1000
    )
    scenario: str = Field(default="healthy", pattern=r"^[a-z_]{1,50}$")


class Reasoning(StrictModel):
    outcome: Literal["diagnosed", "healthy", "insufficient_evidence"] = "diagnosed"
    root_causes: list[str] = Field(default_factory=list, max_length=5)
    likely_root_cause: str = Field(max_length=500)
    confidence: float = Field(ge=0, le=1)
    evidence_ids: list[int] = Field(max_length=20)
    recommended_actions: list[str] = Field(max_length=5)


class ActionRecord(StrictModel):
    payload_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    data_mode: Literal["simulation", "live"]
    id: UUID
    investigation_id: UUID
    action: ActionName
    namespace: str
    deployment: str
    replicas: int | None = Field(default=None, ge=1, le=5)
    requested_by: str
    approved_by: str | None = None
    expires_at: float
    status: Literal["pending", "executing", "simulated", "denied", "failed"] = "pending"
    policy: Policy = Policy.APPROVAL_REQUIRED


class ApprovalRequest(StrictModel):
    action_id: UUID
    payload_hash: str = Field(pattern=r"^[a-f0-9]{64}$")


class AgentResponse(StrictModel):
    investigation_id: UUID
    correlation_id: UUID
    data_mode: Literal["simulation", "live"]
    agent: AgentName
    incident: str
    status: AgentStatus
    likely_root_cause: str
    confidence: float = Field(ge=0, le=1)
    reasoning: str
    evidence: list[ToolResult]
    tools_used: list[str]
    recommended_actions: list[str]
    requires_human_approval: bool = False
    actions: list[ActionRecord] = Field(default_factory=list)
    summary: dict[str, Any] = Field(default_factory=dict)
    states: list[str]
