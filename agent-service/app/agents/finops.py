from app.mcp.client import ToolSession
from app.models import AgentStatus


async def analyze(tools: ToolSession) -> tuple[AgentStatus, dict, list[str]]:
    for name in [
        "cost_get_summary",
        "kubernetes_get_resource_usage",
        "rds_get_metrics",
        "valkey_get_metrics",
        "terraform_get_plan_summary",
    ]:
        await tools.call(name)
    cost = tools.evidence[0]
    if cost.error or not cost.data.get("services"):
        return (
            "insufficient_evidence",
            {"estimated_monthly_usd": None, "estimated_savings_usd": None},
            ["Enable scoped Cost Explorer reads or use simulation fixtures"],
        )
    services = sorted(cost.data["services"], key=lambda s: s["monthly_usd"], reverse=True)
    recommendations = []
    for service in services:
        delta = service["monthly_usd"] - service["previous_usd"]
        if delta > 0:
            recommendations.append(
                f"{service['service']} increased by ${delta:.2f} over the comparison period; inspect billing dimensions before changing capacity"
            )
    recommendations.append(
        "Review log retention and idle capacity with an operator; no infrastructure is deleted"
    )
    return (
        "healthy",
        {
            "estimated_monthly_usd": round(sum(s["monthly_usd"] for s in services), 2),
            "largest_drivers": services,
            "estimated_savings_usd": None,
            "savings_basis": "Insufficient utilization and pricing evidence to quantify safe savings",
            "period": cost.data["period"],
            "scope": cost.data.get("scope", "synthetic FIN-AI fixture"),
            "note": cost.data.get("note", ""),
        },
        recommendations,
    )
