import asyncio
import os
import ssl
from datetime import UTC, datetime, timedelta
from pathlib import Path

import boto3
import httpx
from botocore.config import Config

from app.config import Settings
from app.models import ToolInput
from app.tools.sanitize import signals


class LiveAdapter:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.aws_config = Config(connect_timeout=2, read_timeout=3, retries={"max_attempts": 1})

    async def call(self, name: str, args: ToolInput) -> dict:
        if name.startswith("kubernetes_"):
            return await self.kubernetes(name, args)
        if name.startswith("github_"):
            return await self.github(name, args)
        if name.startswith("terraform_"):
            return await asyncio.to_thread(self.terraform, name)
        return await asyncio.to_thread(self.aws, name)

    async def kubernetes(self, name: str, args: ToolInput) -> dict:
        sa = Path("/var/run/secrets/kubernetes.io/serviceaccount")
        # In-cluster TLS and rotating service account credentials; no kubeconfig or exec plugins.
        host = os.environ.get("KUBERNETES_SERVICE_HOST", "kubernetes.default.svc")
        port = os.environ.get("KUBERNETES_SERVICE_PORT_HTTPS", "443")
        base = f"https://{host}:{port}"
        ns = args.namespace
        paths = {
            "kubernetes_get_pods": f"/api/v1/namespaces/{ns}/pods",
            "kubernetes_get_events": f"/api/v1/namespaces/{ns}/events",
            "kubernetes_get_deployments": f"/apis/apps/v1/namespaces/{ns}/deployments/{args.resource}",
            "kubernetes_get_ingress": f"/apis/networking.k8s.io/v1/namespaces/{ns}/ingresses",
            "kubernetes_get_resource_usage": f"/apis/metrics.k8s.io/v1beta1/namespaces/{ns}/pods",
            "kubernetes_get_migration_status": f"/apis/batch/v1/namespaces/{ns}/jobs",
        }
        selector = f"app.kubernetes.io/instance={self.settings.deployment.removesuffix('-backend')},app.kubernetes.io/component=backend"
        headers = {"Authorization": "Bearer " + sa.joinpath("token").read_text().strip()}
        async with httpx.AsyncClient(
            verify=ssl.create_default_context(cafile=str(sa / "ca.crt")), timeout=5, trust_env=False
        ) as client:
            if name == "kubernetes_get_pod_logs":
                response = await client.get(
                    base + paths["kubernetes_get_pods"],
                    headers=headers,
                    params={"labelSelector": selector, "limit": 5},
                )
                response.raise_for_status()
                pods = response.json().get("items", [])[:5]
                found: set[str] = set()
                for pod in pods:
                    pod_name = pod["metadata"]["name"]
                    response = await client.get(
                        f"{base}/api/v1/namespaces/{ns}/pods/{pod_name}/log",
                        headers=headers,
                        params={
                            "container": "backend",
                            "tailLines": args.limit,
                            "limitBytes": 16000,
                        },
                    )
                    response.raise_for_status()
                    found.update(signals(response.text))
                return {"signals": sorted(found), "sample_count": len(pods)}
            params: dict = {"limit": args.limit}
            if name in {"kubernetes_get_pods", "kubernetes_get_resource_usage"}:
                params["labelSelector"] = selector
            if name == "kubernetes_get_migration_status":
                params["labelSelector"] = "app.kubernetes.io/component=migration"
            response = await client.get(base + paths[name], headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
        items = data.get("items", [])[: args.limit]
        if name == "kubernetes_get_pods":
            return {
                "pods": [
                    {
                        "name": p["metadata"]["name"],
                        "ready": any(
                            c.get("type") == "Ready" and c.get("status") == "True"
                            for c in p.get("status", {}).get("conditions", [])
                        ),
                        "restarts": sum(
                            c.get("restartCount", 0)
                            for c in p.get("status", {}).get("containerStatuses", [])
                        ),
                        "signals": signals(str(p.get("status", {}))),
                        "image": p["spec"]["containers"][0]["image"],
                    }
                    for p in items
                ]
            }
        if name == "kubernetes_get_deployments":
            return {
                "ready": data.get("status", {}).get("readyReplicas", 0),
                "desired": data["spec"].get("replicas", 1),
                "image": data["spec"]["template"]["spec"]["containers"][0]["image"],
                "signals": signals(str(data.get("status", {}).get("conditions", []))),
            }
        if name == "kubernetes_get_events":
            return {
                "signals": sorted(
                    {
                        s
                        for p in items
                        for s in signals(p.get("reason", "") + " " + p.get("message", ""))
                    }
                )
            }
        if name == "kubernetes_get_migration_status":
            if not items:
                return {"status": "unknown", "signals": []}
            latest = max(items, key=lambda j: j["metadata"].get("creationTimestamp", ""))
            status = latest.get("status", {})
            return {
                "status": "failed"
                if status.get("failed", 0)
                else "succeeded"
                if status.get("succeeded", 0)
                else "pending",
                "signals": ["migration_failed"] if status.get("failed", 0) else [],
            }
        if name == "kubernetes_get_ingress":
            return {
                "ingresses": [
                    {
                        "name": p["metadata"]["name"],
                        "class": p.get("spec", {}).get("ingressClassName", ""),
                    }
                    for p in items
                ]
            }
        return {
            "pods": [
                {
                    "name": p["metadata"]["name"],
                    "containers": [
                        {"name": c["name"], "usage": c["usage"]} for c in p.get("containers", [])
                    ],
                }
                for p in items
            ]
        }

    async def github(self, name: str, args: ToolInput) -> dict:
        repo = self.settings.github_repository
        if not repo or not self.settings.github_token.get_secret_value():
            raise ValueError("GitHub read integration is not configured")
        path = "actions/runs" if name.endswith("runs") else f"actions/runs/{args.run_id}/jobs"
        params: dict = {"per_page": args.limit}
        if name == "github_get_recent_workflow_runs" and args.sha:
            params["head_sha"] = args.sha
        if name == "github_get_deployment_metadata":
            path = "deployments"
            params["sha"] = args.sha
        async with httpx.AsyncClient(timeout=5, trust_env=False) as client:
            response = await client.get(
                f"https://api.github.com/repos/{repo}/{path}",
                headers={
                    "Authorization": "Bearer " + self.settings.github_token.get_secret_value(),
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                params=params,
            )
            response.raise_for_status()
            data = response.json()
        if name == "github_get_deployment_metadata":
            return {
                "deployments": [
                    {
                        "id": d["id"],
                        "sha": d["sha"],
                        "environment": d["environment"],
                        "created_at": d["created_at"],
                    }
                    for d in data[: args.limit]
                ]
            }
        if name.endswith("runs"):
            return {
                "runs": [
                    {
                        "id": r["id"],
                        "sha": r["head_sha"],
                        "status": r["status"],
                        "conclusion": r["conclusion"],
                    }
                    for r in data.get("workflow_runs", [])[: args.limit]
                    if r.get("name") == self.settings.github_workflow_name
                ]
            }
        return {
            "jobs": [
                {"name": j["name"], "conclusion": j["conclusion"]}
                for j in data.get("jobs", [])[: args.limit]
            ]
        }

    def terraform(self, name: str) -> dict:
        import json

        path = (
            self.settings.terraform_plan_path
            if name.endswith("summary")
            else self.settings.terraform_outputs_path
        )
        if not path:
            raise ValueError("Sanitized Terraform artifact not configured")
        file = Path(path)
        if file.stat().st_size > 2_000_000:
            raise ValueError("Terraform artifact exceeds size limit")
        data = json.loads(file.read_text())
        if name.endswith("summary"):
            actions = [
                r.get("change", {}).get("actions", []) for r in data.get("resource_changes", [])
            ]
            return {
                "available": True,
                **{
                    kind: sum(kind in a for a in actions) for kind in ("create", "update", "delete")
                },
            }
        allowed = {"eks_cluster_name", "environment", "aws_region"}
        return {
            k: v["value"]
            for k, v in data.items()
            if k in allowed and not v.get("sensitive", True) and isinstance(v.get("value"), str)
        }

    def client(self, service: str):
        return boto3.client(service, region_name=self.settings.aws_region, config=self.aws_config)

    def metric(self, namespace, metric, dimensions, statistic="Average", start=None, end=None):
        end = end or datetime.now(UTC)
        data = self.client("cloudwatch").get_metric_statistics(
            Namespace=namespace,
            MetricName=metric,
            Dimensions=dimensions,
            StartTime=start or end - timedelta(minutes=15),
            EndTime=end,
            Period=900,
            **(
                {"ExtendedStatistics": [statistic]}
                if statistic.startswith("p")
                else {"Statistics": [statistic]}
            ),
        )
        points = data.get("Datapoints", [])
        values = [
            p.get("ExtendedStatistics", {}).get(statistic)
            if statistic.startswith("p")
            else p.get(statistic)
            for p in points
        ]
        values = [v for v in values if v is not None]
        return sum(values) / len(values) if values else None

    def aws(self, name: str) -> dict:
        s = self.settings
        if name == "cloudwatch_search_logs":
            result = self.client("logs").filter_log_events(
                logGroupName=s.log_group,
                startTime=int((datetime.now(UTC) - timedelta(minutes=15)).timestamp() * 1000),
                limit=30,
            )
            return {
                "signals": sorted(
                    {x for e in result.get("events", []) for x in signals(e.get("message", ""))}
                ),
                "sample_count": len(result.get("events", [])),
            }
        if name == "cloudwatch_get_recent_alarms":
            result = self.client("cloudwatch").describe_alarms(
                AlarmNamePrefix="finance-ai", StateValue="ALARM", MaxRecords=30
            )
            return {
                "alarms": [
                    {"name": a["AlarmName"], "state": a["StateValue"]}
                    for a in result.get("MetricAlarms", [])
                ]
            }
        if name == "cloudwatch_get_metric":
            dims = [{"Name": "Service", "Value": s.deployment}]
            now = datetime.now(UTC)
            now = now.replace(minute=now.minute // 15 * 15, second=0, microsecond=0)
            result = {}
            for period, start, end in [
                ("pre", now - timedelta(minutes=30), now - timedelta(minutes=15)),
                ("post", now - timedelta(minutes=15), now),
            ]:
                result[f"{period}_p95_ms"] = self.metric(
                    s.metric_namespace, "RequestDurationMs", dims, "p95", start, end
                )
                result[f"{period}_error_rate"] = self.metric(
                    s.metric_namespace, "ErrorRate", dims, "Average", start, end
                )
            if s.alb_dimension and s.target_group_dimension:
                result["unhealthy_targets"] = self.metric(
                    "AWS/ApplicationELB",
                    "UnHealthyHostCount",
                    [
                        {"Name": "LoadBalancer", "Value": s.alb_dimension},
                        {"Name": "TargetGroup", "Value": s.target_group_dimension},
                    ],
                    "Maximum",
                )
            return result
        if name == "rds_get_health":
            db = self.client("rds").describe_db_instances(DBInstanceIdentifier=s.rds_identifier)[
                "DBInstances"
            ][0]
            return {"status": db["DBInstanceStatus"]}
        if name == "valkey_get_health":
            group = self.client("elasticache").describe_replication_groups(
                ReplicationGroupId=s.valkey_identifier
            )["ReplicationGroups"][0]
            return {"status": group["Status"]}
        if name in {"rds_get_metrics", "valkey_get_metrics"}:
            rds = name.startswith("rds")
            namespace = "AWS/RDS" if rds else "AWS/ElastiCache"
            dimensions = [
                {
                    "Name": "DBInstanceIdentifier" if rds else "ReplicationGroupId",
                    "Value": s.rds_identifier if rds else s.valkey_identifier,
                }
            ]
            return {
                "connections": self.metric(
                    namespace, "DatabaseConnections" if rds else "CurrConnections", dimensions
                ),
                "cpu_percent": self.metric(namespace, "CPUUtilization", dimensions),
            }
        if name == "cost_get_summary":
            if not s.cost_explorer_enabled or not s.billing_view_arn:
                raise ValueError("Cost Explorer is disabled")
            today = datetime.now(UTC).date()
            result = self.client("ce").get_cost_and_usage(
                TimePeriod={"Start": str(today - timedelta(days=60)), "End": str(today)},
                BillingViewArn=s.billing_view_arn,
                Granularity="DAILY",
                Metrics=["UnblendedCost"],
                GroupBy=[
                    {"Type": "DIMENSION", "Key": "SERVICE"},
                    {"Type": "DIMENSION", "Key": "USAGE_TYPE"},
                ],
            )
            if result.get("NextPageToken"):
                raise ValueError("Cost Explorer response is incomplete; narrow the account scope")
            totals: dict[str, dict] = {}
            currencies = set()
            midpoint = str(today - timedelta(days=30))
            for period in result["ResultsByTime"]:
                for group in period["Groups"]:
                    service = group["Keys"][0]
                    if "NatGateway" in group["Keys"][1]:
                        service = "NAT Gateway"
                    cost = group["Metrics"]["UnblendedCost"]
                    currencies.add(cost["Unit"])
                    entry = totals.setdefault(
                        service, {"service": service, "monthly_usd": 0.0, "previous_usd": 0.0}
                    )
                    entry[
                        "monthly_usd"
                        if period["TimePeriod"]["Start"] >= midpoint
                        else "previous_usd"
                    ] += float(cost["Amount"])
            if currencies != {"USD"}:
                raise ValueError("Only USD cost comparison is supported")
            return {
                "currency": "USD",
                "period": "last 30 complete days vs preceding 30 days",
                "scope": "Configured billing view; verify it contains only FIN-AI resources",
                "services": list(totals.values()),
                "note": "NAT Gateway usage types are separated from EC2 - Other; totals follow the configured billing view.",
            }
        raise ValueError("Unsupported read tool")
