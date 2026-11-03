import asyncio
import time
from uuid import uuid4

from mcp import Client

from app import telemetry
from app.agents import deployment, finops, sre
from app.config import Settings
from app.mcp.client import ToolSession
from app.mcp.server import create_server
from app.models import ActionName, AgentName, AgentResponse, ToolInput
from app.services.actions import Actions
from app.services.providers import MockProvider, OpenAIProvider
from app.services.store import Store
from app.tools.registry import ToolRegistry
from app.tools.sanitize import redact


class Orchestrator:
    def __init__(self, settings: Settings, store: Store):
        self.settings, self.store = settings, store
        self.registry = ToolRegistry(settings, store)
        self.server = create_server(self.registry)
        self.provider = (
            MockProvider() if settings.llm_provider == "mock" else OpenAIProvider(settings)
        )
        self.actions = Actions(settings, store)
        self.slots = asyncio.Semaphore(4)

    async def run(
        self, agent: AgentName, incident: str, scenario: str, requester: str, sha: str = ""
    ) -> AgentResponse:
        started = time.monotonic()
        correlation_id, investigation_id = uuid4(), uuid4()
        result = AgentResponse(
            investigation_id=investigation_id,
            correlation_id=correlation_id,
            data_mode=self.settings.data_mode,
            agent=agent,
            incident=redact(incident),
            status="insufficient_evidence",
            likely_root_cause="Insufficient evidence to determine a root cause",
            confidence=0,
            reasoning="No supported diagnosis yet",
            evidence=[],
            tools_used=[],
            recommended_actions=[],
            states=["received"],
        )
        attributes = {"agent": agent, "data_mode": self.settings.data_mode}
        with telemetry.tracer.start_as_current_span(
            {
                "sre": "incident_investigation",
                "deployment": "deployment_review",
                "finops": "cost_analysis",
            }[agent]
        ):
            session = None
            try:
                async with asyncio.timeout(self.settings.investigation_timeout_seconds), self.slots:
                    async with Client(self.server) as client:
                        session = ToolSession(
                            client,
                            self.settings,
                            ToolInput(
                                namespace=self.settings.namespace,
                                resource=self.settings.deployment,
                                scenario=scenario,
                                correlation_id=correlation_id,
                            ),
                        )
                        result.states += ["planning", "collecting_evidence"]
                        if agent == "sre":
                            reasoning = await sre.investigate(incident, session, self.provider)
                            result.states.append("correlating_evidence")
                            with telemetry.tracer.start_as_current_span("generate_rca"):
                                result.likely_root_cause = redact(reasoning.likely_root_cause)
                                result.confidence = reasoning.confidence
                                result.recommended_actions = redact(reasoning.recommended_actions)
                                result.reasoning = f"Provider: {self.settings.llm_provider}; hypothesis cites evidence indices {reasoning.evidence_ids}. Tool evidence is recorded separately."
                                result.status = (
                                    "degraded"
                                    if reasoning.evidence_ids and reasoning.confidence > 0
                                    else "insufficient_evidence"
                                )
                        elif agent == "deployment":
                            (
                                result.status,
                                result.summary,
                                result.recommended_actions,
                            ) = await deployment.review(sha, session)
                            result.likely_root_cause = (
                                f"Deployment assessment: {result.summary['recommendation']}"
                            )
                            result.reasoning = "Deterministic checks of workflow, image, rollout, migration and service metrics."
                            result.confidence = 0.9 if result.status == "healthy" else 0.6
                        else:
                            (
                                result.status,
                                result.summary,
                                result.recommended_actions,
                            ) = await finops.analyze(session)
                            result.likely_root_cause = (
                                "Cost comparison from billing evidence"
                                if result.status == "healthy"
                                else "Insufficient billing evidence"
                            )
                            result.reasoning = "Cost changes are measured; savings remain unquantified without pricing and utilization evidence."
                            result.confidence = 0.9 if result.status == "healthy" else 0
            except (TimeoutError, RuntimeError):
                result.status, result.confidence = "insufficient_evidence", 0
                result.reasoning = "Investigation terminated at its deadline or tool budget. Collected evidence is retained."
            except Exception:
                result.status, result.confidence = "insufficient_evidence", 0
                result.reasoning = "Investigation could not complete; integration or provider unavailable. Collected evidence is retained."
            if session:
                result.evidence = session.evidence
                result.tools_used = [e.tool for e in session.evidence]
            result.states.append(
                "completed" if result.status != "insufficient_evidence" else "incomplete"
            )
            await self.store.put(
                str(investigation_id), "investigation", result.model_dump(mode="json")
            )
            action: ActionName | None = None
            if result.confidence > 0 and result.status != "insufficient_evidence":
                if agent == "sre" and result.likely_root_cause == "container repeatedly crashes":
                    action = "restart_deployment"
                elif (
                    agent == "deployment"
                    and result.summary.get("recommendation") == "ROLLBACK_RECOMMENDED"
                ):
                    action = "rollback_helm_release"
            if action:
                result.actions = [await self.actions.propose(investigation_id, action, requester)]
                result.requires_human_approval = True
            telemetry.requests.add(1, attributes)
            telemetry.request_duration.record(time.monotonic() - started, attributes)
            telemetry.steps.record(len(result.states) + len(result.tools_used), attributes)
        return result
