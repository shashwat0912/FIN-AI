import hmac
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.config import Settings
from app.models import (
    ActionRecord,
    AgentResponse,
    ApprovalRequest,
    CostRequest,
    DeploymentRequest,
    InvestigationRequest,
)
from app.services.orchestrator import Orchestrator
from app.services.store import Store
from app.telemetry import configure
from app.tools.simulation import scenario_data


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    store = Store(settings.database_url.get_secret_value())
    orchestrator = Orchestrator(settings, store)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        providers = configure(settings)
        await store.initialize()
        yield
        if providers:
            for provider in providers:
                provider.shutdown()

    app = FastAPI(
        title="FIN-AI Agentic Cloud Operations",
        lifespan=lifespan,
        docs_url="/docs" if settings.data_mode == "simulation" else None,
        redoc_url=None,
    )
    app.state.orchestrator, app.state.store = orchestrator, store

    @app.middleware("http")
    async def body_limit(request: Request, call_next):
        if request.method == "POST":
            body = bytearray()
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body) > 16000:
                    return JSONResponse(status_code=413, content={"detail": "Request exceeds 16KB"})
            request._body = bytes(body)
        return await call_next(request)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        # Pydantic errors can echo submitted secrets; return locations without input values.
        return JSONResponse(
            status_code=422,
            content={"detail": [{"loc": e["loc"], "type": e["type"]} for e in error.errors()]},
        )

    @app.exception_handler(Exception)
    async def unexpected_error(request, error):
        return JSONResponse(status_code=503, content={"detail": "Agent service unavailable"})

    def verify(value: str | None, expected: str):
        if not expected:
            raise HTTPException(503, "Operator credential is not configured")
        if not value or not hmac.compare_digest(value, "Bearer " + expected):
            raise HTTPException(401, "Operator authentication required")

    def reader(authorization: str | None = Header(default=None)):
        verify(authorization, settings.api_token.get_secret_value())

    def approver(authorization: str | None = Header(default=None)):
        verify(authorization, settings.approval_token.get_secret_value())

    def validate_scenario(scenario: str):
        if settings.data_mode == "simulation":
            try:
                scenario_data(scenario)
            except ValueError as error:
                raise HTTPException(422, "Unknown simulation scenario") from error

    @app.get("/health")
    async def health():
        return {"status": "ok", "data_mode": settings.data_mode}

    @app.get("/ready")
    async def ready():
        try:
            await store.ready()
        except Exception as error:
            raise HTTPException(503, "Agent record store unavailable") from error
        return {
            "status": "ready",
            "data_mode": settings.data_mode,
            "record_store": "postgresql" if store.dsn else "ephemeral simulation",
        }

    @app.post(
        "/api/v1/agent/investigate", response_model=AgentResponse, dependencies=[Depends(reader)]
    )
    async def investigate(body: InvestigationRequest):
        validate_scenario(body.scenario)
        return await orchestrator.run("sre", body.incident, body.scenario, "investigation-operator")

    @app.post(
        "/api/v1/agent/deployment-review",
        response_model=AgentResponse,
        dependencies=[Depends(reader)],
    )
    async def review(body: DeploymentRequest):
        validate_scenario(body.scenario)
        return await orchestrator.run(
            "deployment",
            f"Review deployment {body.sha}",
            body.scenario,
            "investigation-operator",
            body.sha,
            body.image_digest,
        )

    @app.post(
        "/api/v1/agent/cost-analysis", response_model=AgentResponse, dependencies=[Depends(reader)]
    )
    async def costs(body: CostRequest):
        validate_scenario(body.scenario)
        return await orchestrator.run(
            "finops", body.question, body.scenario, "investigation-operator"
        )

    @app.post(
        "/api/v1/agent/remediation/approve",
        response_model=ActionRecord,
        dependencies=[Depends(approver)],
    )
    async def approve(body: ApprovalRequest):
        return await orchestrator.actions.approve(body.action_id)

    return app


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
app = create_app()
