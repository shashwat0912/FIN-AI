import asyncio
import json
from datetime import timedelta
from pathlib import Path

from app.models import ToolInput

FIXTURES = Path(__file__).parents[1] / "evals" / "fixtures"


def scenario_definition(scenario: str) -> dict:
    path = FIXTURES / f"{scenario}.json"
    if path.parent != FIXTURES or not path.is_file():
        raise ValueError("Unknown simulation scenario")
    return json.loads(path.read_text())


def scenario_data(scenario: str) -> dict:
    baseline = scenario_definition("healthy")["tools"]
    baseline.update(scenario_definition(scenario)["tools"])
    return baseline


class SimulationAdapter:
    async def call(self, name: str, arguments: ToolInput) -> dict:
        definition = scenario_definition(arguments.scenario)
        fault = definition.get("faults", {}).get(name, {})
        if fault.get("kind") == "timeout":
            await asyncio.sleep(1)
            raise TimeoutError("Synthetic timeout")
        if fault.get("kind") == "error":
            raise RuntimeError("Synthetic unavailable integration")
        if fault.get("kind") == "malformed":
            return {"unexpected": ["invalid typed telemetry"], "password": "must-be-redacted"}
        result = scenario_data(arguments.scenario)[name]
        now = arguments.requested_at
        observed_at = now - timedelta(seconds=fault.get("age_seconds", 0))
        deployed_at = arguments.deployed_at or now - timedelta(minutes=20)
        if name == "github_get_deployment_metadata":
            for deployment in result.get("deployments", []):
                deployment["created_at"] = deployed_at.isoformat()
        if name == "cloudwatch_get_metric":
            baseline_start = deployed_at - timedelta(minutes=arguments.baseline_minutes)
            observation_end = deployed_at + timedelta(minutes=arguments.observation_minutes)
            result.update(
                deployment_at=deployed_at.isoformat(),
                comparison_basis="deployment" if arguments.deployed_at else "recent",
            )
            for key, start, end in [
                ("baseline", baseline_start, deployed_at),
                ("observation", deployed_at, observation_end),
            ]:
                window = result[key]
                age = timedelta(seconds=fault.get("age_seconds", 0))
                window["sample_count"] = min(
                    window["sample_count"], int((end - start).total_seconds() / 60)
                )
                window.update(
                    start=(start - age).isoformat(),
                    end=(end - age).isoformat(),
                    observed_at=(end - age - timedelta(seconds=30)).isoformat(),
                )
            observed_at = observation_end - timedelta(seconds=30 + fault.get("age_seconds", 0))
        result["_meta"] = {"observed_at": observed_at.isoformat()}
        return result
