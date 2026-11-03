import json
from pathlib import Path

from app.models import ToolInput

FIXTURES = Path(__file__).parents[1] / "evals" / "fixtures"


def scenario_data(scenario: str) -> dict:
    path = FIXTURES / f"{scenario}.json"
    if path.parent != FIXTURES or not path.is_file():
        raise ValueError("Unknown simulation scenario")
    return json.loads(path.read_text())["tools"]


class SimulationAdapter:
    async def call(self, name: str, arguments: ToolInput) -> dict:
        return scenario_data(arguments.scenario)[name]
