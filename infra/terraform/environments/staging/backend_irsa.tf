locals {
  backend_irsa_role_name           = "${local.name_prefix}-backend"
  backend_kubernetes_namespace     = "finance-ai-staging"
  backend_service_account_name     = "finance-ai-backend"
  eks_oidc_issuer_condition_prefix = trimprefix(module.eks.oidc_issuer_url, "https://")
}

resource "aws_iam_role" "backend" {
  name        = local.backend_irsa_role_name
  description = "Finance AI staging backend workload identity"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = module.eks.oidc_provider_arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${local.eks_oidc_issuer_condition_prefix}:aud" = "sts.amazonaws.com"
          "${local.eks_oidc_issuer_condition_prefix}:sub" = "system:serviceaccount:${local.backend_kubernetes_namespace}:${local.backend_service_account_name}"
        }
      }
    }]
  })

  tags = merge(var.additional_tags, local.default_tags, {
    Name      = local.backend_irsa_role_name
    component = "backend"
  })
}

resource "aws_iam_role_policy" "backend_valkey" {
  name = "${local.backend_irsa_role_name}-valkey-connect"
  role = aws_iam_role.backend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["elasticache:Connect"]
      Resource = [
        module.elasticache_valkey.replication_group_arn,
        module.elasticache_valkey.application_user_arn,
      ]
    }]
  })
}
