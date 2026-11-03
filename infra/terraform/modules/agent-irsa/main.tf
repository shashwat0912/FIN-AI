locals {
  issuer = trimprefix(var.oidc_issuer_url, "https://")
  read_statements = concat([
    {
      Sid      = "BackendLogSignals"
      Effect   = "Allow"
      Action   = ["logs:FilterLogEvents"]
      Resource = ["${var.log_group_arn}:*"]
    },
    {
      Sid      = "WorkloadMetrics"
      Effect   = "Allow"
      Action   = ["cloudwatch:GetMetricStatistics"]
      Resource = ["*"] # AWS does not support resource-level authorization for this action.
    },
    {
      Sid      = "WorkloadAlarms"
      Effect   = "Allow"
      Action   = ["cloudwatch:DescribeAlarms"]
      Resource = ["${var.alarm_arn_prefix}*"]
    },
    {
      Sid      = "DatabaseHealth"
      Effect   = "Allow"
      Action   = ["rds:DescribeDBInstances"]
      Resource = [var.rds_arn]
    },
    {
      Sid      = "CacheHealth"
      Effect   = "Allow"
      Action   = ["elasticache:DescribeReplicationGroups"]
      Resource = [var.valkey_arn]
    }
    ], var.billing_view_arn == null ? [] : [{
      Sid      = "OptionalBillingView"
      Effect   = "Allow"
      Action   = ["ce:GetCostAndUsage"]
      Resource = [var.billing_view_arn]
  }])
}

resource "aws_iam_role" "agent" {
  name        = var.name
  description = "FIN-AI operations evidence reader; no infrastructure writes or secret reads"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = var.oidc_provider_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = { StringEquals = {
        "${local.issuer}:aud" = "sts.amazonaws.com"
        "${local.issuer}:sub" = "system:serviceaccount:${var.namespace}:${var.service_account}"
      } }
    }]
  })
  tags = merge(var.tags, { component = "agent" })
}

resource "aws_iam_role_policy" "reader" {
  name = "${var.name}-reader"
  role = aws_iam_role.agent.id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = local.read_statements
  })
}
