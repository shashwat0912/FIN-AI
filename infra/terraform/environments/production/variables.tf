variable "aws_region" {
  description = "AWS region for production resources."
  type        = string

  validation {
    condition     = can(regex("^[a-z]{2}(-[a-z]+)+-[0-9]+$", var.aws_region))
    error_message = "aws_region must use a valid AWS region format such as us-east-1."
  }
}

variable "environment" {
  description = "Deployment environment; fixed to match this state root."
  type        = string
  default     = "production"

  validation {
    condition     = var.environment == "production"
    error_message = "The production root only supports environment = production."
  }
}

variable "project_name" {
  description = "Project name used for resource names and tags."
  type        = string
  default     = "finance-ai"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.project_name))
    error_message = "project_name must use lowercase letters, numbers, and hyphens."
  }
}

variable "additional_tags" {
  description = "Optional non-sensitive tags applied by the AWS provider."
  type        = map(string)
  default     = {}
}
