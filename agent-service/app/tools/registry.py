import asyncio
import json
import logging
import time
from datetime import UTC, datetime
from uuid import uuid4

from pydantic import ValidationError

from app import telemetry
from app.config import Settings
from app.models import Policy, ToolError, ToolInput, ToolResult
from app.policies import classify
from app.services.store import Store
from app.tools.live import LiveAdapter
from app.tools.normalize import normalize, source_resource
from app.tools.simulation import SimulationAdapter

logger = logging.getLogger("agent.audit")


class ToolRegistry:
    def __init__(self, settings: Settings, store: Store):
        self.settings, self.store = settings, store
        self.adapter = (
            SimulationAdapter() if settings.data_mode == "simulation" else LiveAdapter(settings)
        )
        self.slots = asyncio.Semaphore(8)

    async def execute(self, name: str, arguments: dict) -> ToolResult:
        started = time.monotonic()
        result = ToolResult(
            tool=name,
            correlation_id=uuid4(),
            trace_id=uuid4().hex,
            data_mode=self.settings.data_mode,
        )
        label = name if classify(name) == Policy.READ_ONLY else "denied_tool"
        result.tool = label
        with telemetry.tracer.start_as_current_span(
            label, record_exception=False, set_status_on_exception=False
        ) as span:
            context = span.get_span_context()
            if context.is_valid:
                result.trace_id = format(context.trace_id, "032x")
            try:
                args = ToolInput.model_validate(arguments)
                result.correlation_id = args.correlation_id
                result.source, result.resource = source_resource(name, args, self.settings)
                if classify(name) != Policy.READ_ONLY:
                    result.error = ToolError(
                        code="DENIED", message="Only explicitly permitted read tools are exposed"
                    )
                elif (
                    args.namespace != self.settings.namespace
                    or args.resource != self.settings.deployment
                ):
                    result.error = ToolError(
                        code="DENIED", message="Resource outside configured workload scope"
                    )
                else:
                    async with asyncio.timeout(self.settings.tool_timeout_seconds), self.slots:
                        raw = await self.adapter.call(name, args)
                        if not isinstance(raw, dict):
                            result.error = ToolError(
                                code="MALFORMED", message="Malformed evidence envelope"
                            )
                            raw = {}
                        metadata = raw.get("_meta", {})
                        observed_at = (
                            metadata.get("observed_at") if isinstance(metadata, dict) else None
                        )
                        if name != "cloudwatch_get_metric" and "_meta" not in raw:
                            observed_at = datetime.now(UTC)
                        result = normalize(result, raw, args, self.settings, observed_at)
            except ValidationError:
                result.error = ToolError(code="INVALID_INPUT", message="Invalid tool arguments")
            except TimeoutError:
                result.error = ToolError(code="TIMEOUT", message="Tool execution deadline exceeded")
            except Exception:
                result.error = ToolError(
                    code="UNAVAILABLE", message="Tool unavailable or integration not configured"
                )
            if result.error:
                result.status = "error"
            result.duration_ms = round((time.monotonic() - started) * 1000, 3)
            attributes: dict[str, str | bool] = {
                "tool": label,
                "data_mode": self.settings.data_mode,
                "success": result.error is None,
            }
            span.set_attributes(
                {**attributes, "status": result.status, "result_count": len(result.data)}
            )
            telemetry.tool_calls.add(1, attributes)
            telemetry.tool_duration.record(result.duration_ms / 1000, attributes)
            if result.error:
                telemetry.tool_failures.add(1, {"tool": label, "code": result.error.code})
            audit = {
                "tool": label,
                "correlation_id": str(result.correlation_id),
                "trace_id": result.trace_id,
                "error": result.error.code if result.error else None,
                "duration_ms": result.duration_ms,
            }
            # Persist only metadata; provider errors and raw payloads may contain credentials.
            await self.store.audit("tool_execution", **audit)
            logger.info(json.dumps({"event": "tool_execution", **audit}))
        return result
