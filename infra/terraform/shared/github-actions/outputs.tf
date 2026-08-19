output "github_oidc_provider_arn" {
  description = "Account-level GitHub Actions OIDC provider ARN."
  value       = aws_iam_openid_connect_provider.github.arn
}

output "ecr_publisher_role_arn" {
  description = "Role ARN to configure as the AWS_ECR_PUBLISH_ROLE_ARN GitHub Actions repository variable."
  value       = aws_iam_role.ecr_publisher.arn
}
