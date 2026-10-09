import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("values", Path(__file__).with_name("production-values.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
outputs = {key: {"value": value} for key, value in {
    "ecr_repository_urls": {"frontend": "test/frontend", "backend": "test/backend"},
    "valkey_primary_endpoint_address": "cache.test", "valkey_application_user_id": "demo-app",
    "valkey_replication_group_id": "demo-valkey", "aws_region": "ap-south-1",
    "backend_irsa_role_arn": "arn:aws:iam::123456789012:role/demo-backend",
}.items()}
env = {"PRODUCTION_HOSTNAME": "demo.test", "ACM_CERTIFICATE_ARN": "arn:aws:acm:ap-south-1:123456789012:certificate/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
       "FRONTEND_IMAGE_DIGEST": "sha256:" + "a" * 64, "BACKEND_IMAGE_DIGEST": "sha256:" + "b" * 64}
values = module.launch_values(outputs, env)
assert values["ingress"]["hosts"] == ["demo.test"]
assert values["backend"]["config"]["REDIS_HOST"] == "cache.test"
for bad in [{}, {**env, "PRODUCTION_HOSTNAME": "https://demo.test"}, {**env, "BACKEND_IMAGE_DIGEST": "latest"},
            {**env, "ACM_CERTIFICATE_ARN": env["ACM_CERTIFICATE_ARN"].replace("ap-south-1", "us-east-1")}]:
    try:
        module.launch_values(outputs, bad)
    except ValueError:
        pass
    else:
        raise AssertionError("Incomplete/unsafe launch inputs accepted")
print("Production launch values checks passed")

# Exercise actual Helm rendering without touching a cluster.
import json
import subprocess
import tempfile

chart = str(Path(__file__).resolve().parents[1] / "deploy/helm/finance-ai")
base = ["helm", "template", "finance-ai", chart, "--namespace", "finance-ai", "-f", chart + "/values-production.yaml"]
with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as generated:
    json.dump(values, generated)
    generated.flush()
    rendered = subprocess.check_output(base + ["-f", generated.name], text=True)
    assert rendered.count("test/backend@sha256:" + "b" * 64) == 2
    assert '"helm.sh/hook": pre-install,pre-upgrade' in rendered
    assert "finance-ai-migrator-secrets" in rendered
    assert "- node_modules/prisma/build/index.js\n            - migrate\n            - deploy" in rendered
    assert 'host: "demo.test"' in rendered
    assert "/readyz" in rendered and "/health" in rendered
    assert "REQUIRED" not in rendered
rejected = subprocess.run(base + ["--set", "ingress.enabled=true"], capture_output=True)
assert rejected.returncode != 0
print("Production Helm launch rendering checks passed")
