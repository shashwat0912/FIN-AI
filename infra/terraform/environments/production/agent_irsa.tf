# Opt-in identity only; this does not deploy the agent or enable live data.
variable "agent_enabled" {
  type        = bool
  default     = false
  description = "Create the dedicated read-only agent IRSA identity."
}
variable "agent_log_group_arn" {
  type        = string
  default     = ""
  description = "Existing backend log group ARN; required when agent_enabled."
  validation {
    condition     = !var.agent_enabled || can(regex("^arn:[^:]+:logs:[^:]+:[0-9]{12}:log-group:[^*]+$", var.agent_log_group_arn))
    error_message = "Enabled agent requires one existing log group ARN without wildcards."
  }
}
variable "agent_billing_view_arn" {
  type        = string
  default     = null
  description = "Optional existing billing view; null keeps Cost Explorer access disabled."
}
data "aws_caller_identity" "agent" {
  count = var.agent_enabled ? 1 : 0
}
data "aws_partition" "agent" {
  count = var.agent_enabled ? 1 : 0
}
module "agent_irsa" {
  count             = var.agent_enabled ? 1 : 0
  source            = "../../modules/agent-irsa"
  name              = "${local.name_prefix}-agent"
  oidc_provider_arn = module.eks.oidc_provider_arn
  oidc_issuer_url   = module.eks.oidc_issuer_url
  namespace         = "finance-ai"
  log_group_arn     = var.agent_log_group_arn
  alarm_arn_prefix  = "arn:${data.aws_partition.agent[0].partition}:cloudwatch:${var.aws_region}:${data.aws_caller_identity.agent[0].account_id}:alarm:finance-ai"
  rds_arn           = module.rds_postgres.db_instance_arn
  valkey_arn        = module.elasticache_valkey.replication_group_arn
  billing_view_arn  = var.agent_billing_view_arn
  tags              = merge(var.additional_tags, local.default_tags)
}
output "agent_irsa_role_arn" {
  value       = try(module.agent_irsa[0].role_arn, null)
  description = "Optional agent identity; absent until explicitly enabled."
}
