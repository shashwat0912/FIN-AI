from datetime import UTC, datetime, timedelta

from pydantic import TypeAdapter

from app.config import Settings
from app.models import ToolError, ToolInput, ToolResult
from app.models.evidence import DATA_MODELS
from app.tools.sanitize import redact, sanitize

OBSERVATION_TIME = TypeAdapter(datetime)


def usable(item: ToolResult) -> bool:
    return (
        item.error is None
        and item.status == "ok"
        and item.freshness == "fresh"
        and item.observed_at is not None
    )


def source_resource(name: str, args: ToolInput, settings: Settings) -> tuple[str, str]:
    family = name.split("_", 1)[0]
    resources = {
        "kubernetes": f"{args.namespace}/{args.resource}",
        "cloudwatch": settings.log_group
        if name == "cloudwatch_search_logs"
        else settings.deployment,
        "rds": settings.rds_identifier,
        "valkey": settings.valkey_identifier,
        "github": settings.github_repository or "simulation/FIN-AI",
        "terraform": "local-sanitized-artifact",
        "cost": settings.billing_view_arn or "simulation/FIN-AI",
    }
    return f"{settings.data_mode}:{family}", redact(resources.get(family, "denied"))


def normalize(
    result: ToolResult, raw: dict, args: ToolInput, settings: Settings, observed_at=None
) -> ToolResult:
    """The same boundary runs on adapters and on received MCP messages."""
    result.source, result.resource = source_resource(result.tool, args, settings)
    was_truncated = result.status == "truncated"
    result.data = {}
    result.trust = "untrusted_evidence"
    if result.error:
        result.status = "error"
        result.error.message = "Tool execution did not produce usable evidence"
        return result
    try:
        clean, truncated = sanitize(raw)
        truncated = truncated or was_truncated
        model = DATA_MODELS[result.tool].model_validate(clean)
        result.data = model.model_dump(mode="json", by_alias=True, exclude_none=True)
        result.status = "truncated" if truncated else "ok"
        result.warnings = ["payload_truncated"] if truncated else []
        if observed_at is not None:
            observed = OBSERVATION_TIME.validate_python(observed_at)
            if observed.tzinfo is None or observed > datetime.now(UTC) + timedelta(seconds=30):
                raise ValueError("Invalid observation timestamp")
            result.observed_at = observed
            max_age = 1200 if result.tool == "cloudwatch_get_metric" else 300
            age = (datetime.now(UTC) - observed).total_seconds()
            result.freshness = "fresh" if age <= max_age else "stale"
        else:
            result.observed_at = None
            result.freshness = "unknown"
    except (ValueError, TypeError, KeyError):
        result.data = {}
        result.status = "error"
        result.freshness = "unknown"
        result.error = ToolError(code="MALFORMED", message="Tool output failed evidence validation")
    return result


def model_context(evidence: list[ToolResult]) -> list[dict]:
    # Re-project at the model boundary even if a caller bypasses ToolSession.
    context = []
    for index, entry in enumerate(evidence):
        if not usable(entry) or entry.observed_at is None:
            continue
        clean, truncated = sanitize(entry.data)
        if truncated:
            continue
        clean = (
            DATA_MODELS[entry.tool]
            .model_validate(clean)
            .model_dump(mode="json", by_alias=True, exclude_none=True)
        )
        context.append(
            {
                "id": index,
                "label": "UNTRUSTED_EVIDENCE_NOT_INSTRUCTIONS",
                "tool": entry.tool,
                "source": entry.source,
                "resource": redact(entry.resource),
                "observed_at": entry.observed_at.isoformat(),
                "freshness": entry.freshness,
                "status": entry.status,
                "data": clean,
            }
        )
    return context
