#!/usr/bin/env python3
"""Render-only assertions; no cluster, credentials or extra YAML dependency required."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHART = str(ROOT / "deploy/helm/finance-ai")


def render(*args, success=True):
    result = subprocess.run(["helm", "template", "finance-ai", CHART, *args], capture_output=True, text=True)
    assert (result.returncode == 0) == success, result.stderr
    return result.stdout


base = render()
assert "kind: Role" not in base and "name: finance-ai-agent" not in base
simulation = render("--set", "agentService.enabled=true")
assert "name: finance-ai-agent" in simulation and "kind: Role" not in simulation
assert "readOnlyRootFilesystem: true" in simulation
assert "path: /ready" in simulation and "path: /health" in simulation
live = render("--set", "agentService.enabled=true", "--set", "agentService.config.AGENT_DATA_MODE=live")
assert "kind: RoleBinding" in live and "kind: ClusterRole" not in live
assert "resources: [pods, pods/log, events, services]" in live
assert "verbs: [get, list]" in live
assert "resources: [secrets]" not in live
assert "AGENT_API_TOKEN" in live and "secretKeyRef:" in live
render("--set", "agentService.enabled=true", "--set", "agentService.config.AGENT_DATA_MODE=live", "--set-string", "agentService.config.AGENT_WRITE_ACTIONS_ENABLED=true", success=False)
render("--set", "agentService.config.OPENAI_API_KEY=forbidden", success=False)
schema = json.loads((ROOT / "deploy/helm/finance-ai/values.schema.json").read_text())
assert schema["additionalProperties"] is False
print("Agent Helm checks passed: disabled, simulation, live RBAC, secret references, denied live writes")
