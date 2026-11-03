variable "name" {
  type        = string
  description = "Dedicated agent IAM role name."
}
variable "oidc_provider_arn" {
  type        = string
  description = "Existing EKS OIDC provider ARN."
}
variable "oidc_issuer_url" {
  type        = string
  description = "Existing EKS OIDC issuer URL."
}
variable "namespace" {
  type        = string
  description = "Exact FIN-AI workload namespace."
}
variable "service_account" {
  type        = string
  default     = "finance-ai-agent"
  description = "Dedicated agent ServiceAccount, separate from backend identity."
}
variable "log_group_arn" {
  type        = string
  description = "Existing FIN-AI backend log group ARN without :* suffix."
}
variable "alarm_arn_prefix" {
  type        = string
  description = "FIN-AI alarm ARN prefix, without wildcard suffix."
}
variable "rds_arn" {
  type        = string
  description = "Existing FIN-AI RDS instance ARN."
}
variable "valkey_arn" {
  type        = string
  description = "Existing FIN-AI Valkey replication group ARN."
}
variable "billing_view_arn" {
  type        = string
  default     = null
  description = "Optional existing billing view ARN; null grants no Cost Explorer access."
  validation {
    condition     = var.billing_view_arn == null ? true : can(regex("^arn:[^:]+:billing::[0-9]{12}:billingview/[^*]+$", var.billing_view_arn))
    error_message = "Use one explicit existing billing view ARN without wildcards."
  }
}
variable "tags" {
  type        = map(string)
  default     = {}
  description = "Repository environment tags."
}
