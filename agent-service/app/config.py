from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AGENT_", extra="ignore")
    data_mode: Literal["simulation", "live"] = "simulation"
    llm_provider: Literal["mock", "openai"] = "mock"
    api_token: SecretStr = SecretStr("")
    approval_token: SecretStr = SecretStr("")
    approver_id: str = "local-operator"
    write_actions_enabled: bool = False
    namespace: str = Field(default="finance-ai-staging", pattern=r"^[a-z0-9][a-z0-9-]{0,62}$")
    deployment: str = Field(default="finance-ai-backend", pattern=r"^[a-z0-9][a-z0-9-]{0,62}$")
    database_url: SecretStr = SecretStr("")
    aws_region: str = "ap-south-1"
    log_group: str = "/finance-ai/backend"
    rds_identifier: str = "finance-ai-staging-postgres"
    valkey_identifier: str = "finance-ai-staging-valkey"
    metric_namespace: str = "FinanceAI"
    alb_dimension: str = ""
    target_group_dimension: str = ""
    github_repository: str = Field(default="", pattern=r"^$|^[\w.-]+/[\w.-]+$")
    github_workflow_name: str = "CI"
    github_token: SecretStr = SecretStr("")
    terraform_plan_path: str = ""
    terraform_outputs_path: str = ""
    cost_explorer_enabled: bool = False
    billing_view_arn: str = ""
    max_tool_calls: int = Field(default=14, ge=1, le=20)
    tool_timeout_seconds: float = Field(default=8, gt=0, le=30)
    investigation_timeout_seconds: float = Field(default=60, gt=0, le=120)
    llm_max_output_tokens: int = Field(default=800, ge=128, le=2000)
    llm_context_chars: int = Field(default=12000, ge=1000, le=24000)
    openai_model: str = "gpt-4o-mini"
    llm_input_usd_per_million: float = Field(default=0, ge=0)
    llm_output_usd_per_million: float = Field(default=0, ge=0)
    telemetry_exporter: Literal["none", "console", "otlp"] = "none"
    otlp_endpoint: str = "http://localhost:4318"

    @model_validator(mode="after")
    def boundaries(self):
        if self.data_mode == "live" and (
            not self.api_token.get_secret_value() or not self.database_url.get_secret_value()
        ):
            raise ValueError("Live mode requires AGENT_API_TOKEN and AGENT_DATABASE_URL")
        if self.approval_token.get_secret_value() and (self.approval_token == self.api_token):
            raise ValueError("Approval credentials must differ from investigation credentials")
        return self
