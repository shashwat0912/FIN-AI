from mcp import Client

from app.config import Settings
from app.models import ToolError, ToolInput, ToolResult


class ToolSession:
    def __init__(self, client: Client, settings: Settings, arguments: ToolInput):
        self.client, self.settings, self.arguments = client, settings, arguments
        self.evidence: list[ToolResult] = []

    async def call(self, name: str, **updates) -> ToolResult:
        if len(self.evidence) >= self.settings.max_tool_calls:
            raise RuntimeError("Investigation tool budget exhausted")
        arguments = self.arguments.model_copy(update=updates).model_dump(mode="json")
        result = await self.client.call_tool(name, {"arguments": arguments})
        if result.is_error or result.structured_content is None:
            evidence = ToolResult(
                tool=name,
                correlation_id=self.arguments.correlation_id,
                trace_id="",
                data_mode=self.settings.data_mode,
                error=ToolError(code="UNAVAILABLE", message="MCP tool returned a protocol error"),
            )
        else:
            evidence = ToolResult.model_validate(result.structured_content)
        self.evidence.append(evidence)
        return evidence
