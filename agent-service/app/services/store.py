import asyncio
import json
from pathlib import Path
from typing import Any
from uuid import uuid4

import psycopg


class Store:
    def __init__(self, dsn: str = ""):
        self.dsn = dsn
        self.records: dict[str, dict[str, Any]] = {}
        self.lock = asyncio.Lock()

    async def initialize(self):
        if self.dsn:
            await asyncio.to_thread(self._initialize)

    def _initialize(self):
        with psycopg.connect(
            self.dsn, connect_timeout=5, options="-c statement_timeout=5000 -c lock_timeout=3000"
        ) as conn:
            conn.execute(Path(__file__).with_name("schema.sql").read_text())

    async def ready(self):
        if self.dsn:
            await asyncio.to_thread(self._ping)

    def _ping(self):
        with psycopg.connect(
            self.dsn, connect_timeout=3, options="-c statement_timeout=3000"
        ) as conn:
            conn.execute("SELECT 1")

    async def put(self, record_id: str, kind: str, payload: dict):
        if self.dsn:
            await asyncio.to_thread(self._put, record_id, kind, payload)
        else:
            self.records[record_id] = {
                "kind": kind,
                "payload": json.loads(json.dumps(payload, default=str)),
            }

    def _put(self, record_id, kind, payload):
        with psycopg.connect(
            self.dsn, connect_timeout=5, options="-c statement_timeout=5000 -c lock_timeout=3000"
        ) as conn:
            conn.execute(
                "INSERT INTO agent_ops.records(id,kind,payload) VALUES (%s,%s,%s::jsonb)",
                (record_id, kind, json.dumps(payload, default=str)),
            )

    async def get(self, record_id: str):
        if self.dsn:
            return await asyncio.to_thread(self._get, record_id)
        return self.records.get(record_id, {}).get("payload")

    def _get(self, record_id):
        with psycopg.connect(
            self.dsn, connect_timeout=5, options="-c statement_timeout=5000 -c lock_timeout=3000"
        ) as conn:
            row = conn.execute(
                "SELECT payload FROM agent_ops.records WHERE id=%s", (record_id,)
            ).fetchone()
            return row[0] if row else None

    async def transition(self, record_id: str, expected: str, payload: dict) -> bool:
        if self.dsn:
            return await asyncio.to_thread(self._transition, record_id, expected, payload)
        async with self.lock:
            row = self.records.get(record_id)
            if not row or row["payload"]["status"] != expected:
                return False
            row["payload"] = json.loads(json.dumps(payload, default=str))
            return True

    def _transition(self, record_id, expected, payload):
        with psycopg.connect(
            self.dsn, connect_timeout=5, options="-c statement_timeout=5000 -c lock_timeout=3000"
        ) as conn:
            cursor = conn.execute(
                "UPDATE agent_ops.records SET payload=%s::jsonb WHERE id=%s AND kind='action' AND payload->>'status'=%s",
                (json.dumps(payload, default=str), record_id, expected),
            )
            return cursor.rowcount == 1

    async def audit(self, event: str, **fields):
        await self.put(str(uuid4()), "audit", {"event": event, **fields})
