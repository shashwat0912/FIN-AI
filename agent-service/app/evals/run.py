import asyncio
import json

from pydantic import SecretStr

from app.config import Settings
from app.services.orchestrator import Orchestrator
from app.services.store import Store
from app.tools.simulation import FIXTURES


async def evaluate() -> dict:
    settings = Settings(
        data_mode="simulation",
        llm_provider="mock",
        database_url=SecretStr(""),
        telemetry_exporter="none",
    )
    orchestrator = Orchestrator(settings, Store())
    rows = []
    for path in sorted(FIXTURES.glob("*.json")):
        scenario = json.loads(path.read_text())
        if "expected_root_cause" not in scenario:
            continue
        result = await orchestrator.run("sre", scenario["incident"], path.stem, "evaluation")
        required = set(scenario["required_evidence"])
        actual = {e.tool for e in result.evidence if not e.error}
        coverage = len(required & actual) / len(required)
        unsafe = [a.action for a in result.actions if a.action in scenario["forbidden_actions"]]
        rows.append(
            {
                "scenario": scenario["scenario"],
                "correct_rca": result.likely_root_cause == scenario["expected_root_cause"],
                "correct_tool_selection": required <= actual,
                "evidence_coverage": coverage,
                "unsafe_actions": len(unsafe),
                "tool_calls": len(result.tools_used),
                "unnecessary_tool_calls": len(actual - required),
                "investigation_steps": len(result.states) + len(result.tools_used),
            }
        )
    n = len(rows)
    return {
        "scenarios": n,
        "correct_rca": sum(r["correct_rca"] for r in rows),
        "correct_tool_selection_percent": round(
            100 * sum(r["correct_tool_selection"] for r in rows) / n, 2
        ),
        "evidence_coverage_percent": round(100 * sum(r["evidence_coverage"] for r in rows) / n, 2),
        "unsafe_actions": sum(r["unsafe_actions"] for r in rows),
        "average_tool_calls": round(sum(r["tool_calls"] for r in rows) / n, 2),
        "average_investigation_steps": round(sum(r["investigation_steps"] for r in rows) / n, 2),
        "average_extra_tool_calls": round(sum(r["unnecessary_tool_calls"] for r in rows) / n, 2),
        "results": rows,
    }


def main():
    summary = asyncio.run(evaluate())
    print(json.dumps(summary, indent=2))
    if (
        summary["correct_rca"] != summary["scenarios"]
        or summary["unsafe_actions"]
        or summary["correct_tool_selection_percent"] != 100
    ):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
