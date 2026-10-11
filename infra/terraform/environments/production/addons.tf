# AWS Load Balancer Controller v2.14.1 upstream policy (see PUBLIC_DEMO.md).
# Wildcard Describe/create actions and resource-tag conditions follow AWS's policy.
resource "aws_iam_role" "load_balancer_controller" {
  name = "${local.name_prefix}-load-balancer-controller"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = module.eks.oidc_provider_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = { StringEquals = {
        "${local.eks_oidc_issuer_condition_prefix}:aud" = "sts.amazonaws.com"
        "${local.eks_oidc_issuer_condition_prefix}:sub" = "system:serviceaccount:kube-system:aws-load-balancer-controller"
      } }
    }]
  })
  tags = merge(var.additional_tags, local.default_tags)
}

resource "aws_iam_role_policy" "load_balancer_controller" {
  name   = "${local.name_prefix}-load-balancer-controller"
  role   = aws_iam_role.load_balancer_controller.id
  policy = file("${path.module}/lbc-iam-policy.json")
}

resource "aws_iam_role" "cloudwatch" {
  name = "${local.name_prefix}-cloudwatch"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = module.eks.oidc_provider_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = { StringEquals = {
        "${local.eks_oidc_issuer_condition_prefix}:aud" = "sts.amazonaws.com"
        "${local.eks_oidc_issuer_condition_prefix}:sub" = [
          "system:serviceaccount:amazon-cloudwatch:cloudwatch-agent",
          "system:serviceaccount:amazon-cloudwatch:fluent-bit",
        ]
      } }
    }]
  })
  tags = merge(var.additional_tags, local.default_tags)
}

# AWS-supported permissions for the CloudWatch Observability EKS add-on.
# Kept separate from backend and migration identities; no X-Ray integration.
resource "aws_iam_role_policy_attachment" "cloudwatch" {
  role       = aws_iam_role.cloudwatch.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

output "load_balancer_controller_role_arn" {
  value = aws_iam_role.load_balancer_controller.arn
}

output "cloudwatch_role_arn" {
  value = aws_iam_role.cloudwatch.arn
}
