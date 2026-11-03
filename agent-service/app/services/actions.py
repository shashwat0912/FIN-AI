import time
from uuid import UUID, uuid4

from fastapi import HTTPException

from app import telemetry
from app.config import Settings
from app.models import ActionName, ActionRecord, Policy
from app.policies import classify
from app.services.store import Store


class Actions:
    def __init__(self, settings: Settings, store: Store):
        self.settings, self.store = settings, store

    async def propose(
        self, investigation_id: UUID, name: ActionName, requester: str, replicas=None
    ) -> ActionRecord:
        if classify(name) != Policy.APPROVAL_REQUIRED:
            raise ValueError("Action is denied")
        record = ActionRecord(
            id=uuid4(),
            investigation_id=investigation_id,
            action=name,
            namespace=self.settings.namespace,
            deployment=self.settings.deployment,
            requested_by=requester,
            replicas=replicas,
            expires_at=time.time() + 900,
        )
        if name == "scale_deployment" and replicas is None:
            raise ValueError("Scaling requires a bounded replica count")
        await self.store.put(str(record.id), "action", record.model_dump(mode="json"))
        await self.store.audit(
            "action_proposed",
            action_id=str(record.id),
            investigation_id=str(investigation_id),
            requested_by=requester,
        )
        telemetry.approval_requests.add(1, {"action": name})
        return record

    async def approve(self, action_id: UUID) -> ActionRecord:
        data = await self.store.get(str(action_id))
        if not data:
            raise HTTPException(404, "Action not found")
        record = ActionRecord.model_validate(data)
        reason = None
        if record.status != "pending":
            reason = "Action has already been processed"
        elif record.expires_at <= time.time():
            reason = "Action approval window expired"
        elif record.requested_by == self.settings.approver_id:
            reason = "Approval must come from a different operator"
        elif classify(record.action) != Policy.APPROVAL_REQUIRED:
            reason = "Action policy denied execution"
        elif (
            record.namespace != self.settings.namespace
            or record.deployment != self.settings.deployment
        ):
            reason = "Action target outside configured scope"
        elif not self.settings.write_actions_enabled:
            reason = "Write actions are disabled"
        elif self.settings.data_mode != "simulation":
            reason = "Live write executors are intentionally unavailable"
        if reason:
            await self.store.audit("approval_denied", action_id=str(action_id), reason=reason)
            raise HTTPException(409, reason)
        record.status = "executing"
        record.approved_by = self.settings.approver_id
        if not await self.store.transition(
            str(action_id), "pending", record.model_dump(mode="json")
        ):
            raise HTTPException(409, "Action was already claimed")
        # Persist approval before the simulation executor; no production write SDK is present.
        await self.store.audit(
            "approval_accepted", action_id=str(action_id), approved_by=record.approved_by
        )
        telemetry.approval_accepts.add(1, {"action": record.action})
        with telemetry.tracer.start_as_current_span("simulate_remediation"):
            record.status = "simulated"
            await self.store.transition(str(action_id), "executing", record.model_dump(mode="json"))
            await self.store.audit(
                "action_simulated",
                action_id=str(action_id),
                action=record.action,
                namespace=record.namespace,
                deployment=record.deployment,
            )
        return record
