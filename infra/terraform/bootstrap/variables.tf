variable "aws_region" {
  description = "AWS region in which to create the Terraform state bucket."
  type        = string

  validation {
    condition     = can(regex("^[a-z]{2}(-[a-z]+)+-[0-9]+$", var.aws_region))
    error_message = "aws_region must use a valid AWS region format such as us-east-1."
  }
}

variable "state_bucket_name" {
  description = "Globally unique name for the Terraform state bucket."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$", var.state_bucket_name))
    error_message = "state_bucket_name must be 3-63 lowercase letters, numbers, or hyphens and start and end with a letter or number."
  }
}

variable "project_name" {
  description = "Project tag value."
  type        = string
  default     = "finance-ai"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.project_name))
    error_message = "project_name must use lowercase letters, numbers, and hyphens."
  }
}

variable "additional_tags" {
  description = "Optional non-sensitive tags to add to bootstrap resources."
  type        = map(string)
  default     = {}
}
