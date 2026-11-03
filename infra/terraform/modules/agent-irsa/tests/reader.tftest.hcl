mock_provider "aws" {}
variables {
  name              = "finance-ai-staging-agent"
  oidc_provider_arn = "arn:aws:iam::123456789012:oidc-provider/oidc.eks.us-east-1.amazonaws.com/id/TEST"
  oidc_issuer_url   = "https://oidc.eks.us-east-1.amazonaws.com/id/TEST"
  namespace         = "finance-ai-staging"
  log_group_arn     = "arn:aws:logs:us-east-1:123456789012:log-group:/finance-ai/backend"
  alarm_arn_prefix  = "arn:aws:cloudwatch:us-east-1:123456789012:alarm:finance-ai"
  rds_arn           = "arn:aws:rds:us-east-1:123456789012:db:finance-ai"
  valkey_arn        = "arn:aws:elasticache:us-east-1:123456789012:replicationgroup:finance-ai"
}
run "reader_only" {
  command = plan
  assert {
    condition     = length(jsondecode(aws_iam_role_policy.reader.policy).Statement) == 5
    error_message = "Cost Explorer must be absent by default."
  }
  assert {
    condition     = jsondecode(aws_iam_role.agent.assume_role_policy).Statement[0].Condition.StringEquals["oidc.eks.us-east-1.amazonaws.com/id/TEST:sub"] == "system:serviceaccount:finance-ai-staging:finance-ai-agent"
    error_message = "Trust must bind the exact namespace and agent account."
  }
  assert {
    condition = alltrue([
      for s in jsondecode(aws_iam_role_policy.reader.policy).Statement :
      !contains(s.Action, "*") && (s.Resource != ["*"] || s.Action == ["cloudwatch:GetMetricStatistics"])
    ])
    error_message = "Only GetMetricStatistics may use wildcard resources."
  }
}
run "scoped_optional_costs" {
  command = plan
  variables {
    billing_view_arn = "arn:aws:billing::123456789012:billingview/example"
  }
  assert {
    condition     = jsondecode(aws_iam_role_policy.reader.policy).Statement[5].Resource == ["arn:aws:billing::123456789012:billingview/example"]
    error_message = "Billing access must be scoped to the supplied view."
  }
}
