variable "project_name" {
  description = "Project name used in ECR repository names and tags."
  type        = string

  validation {
    condition = alltrue([
      for component in ["frontend", "backend"] :
      length("${var.project_name}-${var.environment}/${component}") <= 256 &&
      can(regex(
        "^[a-z0-9]+([._-][a-z0-9]+)*(/[a-z0-9]+([._-][a-z0-9]+)*)*$",
        "${var.project_name}-${var.environment}/${component}",
      ))
    ])
    error_message = "Every generated <project>-<environment>/<component> name must match ECR repository-name syntax and be at most 256 characters."
  }
}

variable "environment" {
  description = "Deployment environment used in ECR repository names and tags."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "common_tags" {
  description = "Additional non-sensitive tags applied to ECR repositories."
  type        = map(string)
  default     = {}
}
