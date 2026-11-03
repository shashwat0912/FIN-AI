output "role_arn" {
  description = "Set as eks.amazonaws.com/role-arn on the dedicated agent ServiceAccount."
  value       = aws_iam_role.agent.arn
}
output "read_policy" {
  description = "Non-secret IAM policy for review and mocked assertions."
  value       = aws_iam_role_policy.reader.policy
}
