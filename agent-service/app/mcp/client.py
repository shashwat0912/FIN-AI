import asyncio

from mcp import Client
from pydantic import ValidationError

from app.config import Settings
from app.models import ToolError, ToolInput, ToolResult
from app.tools.normalize import normalize


class ToolSession:
    def __init__(self, client: Client, settings: Settings, arguments: ToolInput):
        self.client, self.settings, self.arguments = client, settings, arguments
        self.evidence: list[ToolResult] = []

    async def call(self, name: str, **updates) -> ToolResult:
        if len(self.evidence) >= self.settings.max_tool_calls:
            raise RuntimeError("Investigation tool budget exhausted")
        evidence = ToolResult(
            tool=name,
            correlation_id=self.arguments.correlation_id,
            trace_id="",
            data_mode=self.settings.data_mode,
        )
        args = self.arguments
        try:
            args = ToolInput.model_validate(self.arguments.model_dump(mode="json") | updates)
            async with asyncio.timeout(self.settings.tool_timeout_seconds + 1):
                result = await self.client.call_tool(
                    name, {"arguments": args.model_dump(mode="json")}
                )
            if result.is_error or result.structured_content is None:
                evidence.error = ToolError(
                    code="UNAVAILABLE", message="MCP tool returned a protocol error"
                )
            else:
                received = ToolResult.model_validate(result.structured_content)
                if (
                    received.tool != name
                    or received.correlation_id != args.correlation_id
                    or received.data_mode != self.settings.data_mode
                ):
                    raise ValueError("MCP evidence identity mismatch")
                evidence = normalize(
                    received, received.data, args, self.settings, received.observed_at
                )
        except TimeoutError:
            evidence.error = ToolError(code="TIMEOUT", message="MCP call deadline exceeded")
        except (ValidationError, ValueError, TypeError):
            evidence.error = ToolError(
                code="MALFORMED", message="MCP result failed evidence validation"
            )
        except Exception:
            evidence.error = ToolError(code="UNAVAILABLE", message="MCP transport unavailable")
        if evidence.error:
            evidence = normalize(evidence, {}, args, self.settings)
        self.evidence.append(evidence)
        return evidence
