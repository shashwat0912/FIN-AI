variable "project_name" {
  description = "Project name used for database resource names and tags."
  type        = string

  validation {
    condition = (
      length(var.project_name) <= 32 &&
      can(regex("^[a-z][a-z0-9-]*[a-z0-9]$", var.project_name))
    )
    error_message = "project_name must be 2-32 lowercase letters, numbers, or hyphens and start with a letter."
  }
}

variable "environment" {
  description = "Deployment environment."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "vpc_id" {
  description = "VPC that owns the database security group."
  type        = string

  validation {
    condition     = length(trimspace(var.vpc_id)) > 0
    error_message = "vpc_id must not be empty."
  }
}

variable "private_data_subnet_ids" {
  description = "Exactly two private data subnet IDs keyed by availability zone."
  type        = map(string)

  validation {
    condition = (
      length(var.private_data_subnet_ids) == 2 &&
      length(distinct(values(var.private_data_subnet_ids))) == 2 &&
      alltrue([for id in values(var.private_data_subnet_ids) : length(trimspace(id)) > 0])
    )
    error_message = "private_data_subnet_ids must contain exactly two distinct non-empty subnet IDs."
  }
}

variable "application_security_group_id" {
  description = "EKS/application security group allowed to connect to PostgreSQL."
  type        = string

  validation {
    condition     = length(trimspace(var.application_security_group_id)) > 0
    error_message = "application_security_group_id must not be empty."
  }
}

variable "engine_version" {
  description = "RDS PostgreSQL engine version; recheck regional RDS support before apply."
  type        = string

  validation {
    condition     = can(regex("^[0-9]+(?:\\.[0-9]+){0,2}$", var.engine_version))
    error_message = "engine_version must be a PostgreSQL major or major.minor version."
  }
}

variable "instance_class" {
  description = "RDS DB instance class."
  type        = string

  validation {
    condition     = can(regex("^db\\.[a-z0-9]+\\.[a-z0-9]+$", var.instance_class))
    error_message = "instance_class must be a valid RDS DB instance class such as db.t4g.micro."
  }
}

variable "database_name" {
  description = "Initial PostgreSQL database name."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z][A-Za-z0-9]{0,62}$", var.database_name))
    error_message = "database_name must start with a letter and contain 1-63 alphanumeric characters."
  }
}

variable "master_username" {
  description = "Non-secret PostgreSQL master username."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z][A-Za-z0-9_]{0,62}$", var.master_username))
    error_message = "master_username must start with a letter and contain 1-63 alphanumeric or underscore characters."
  }
}

variable "allocated_storage" {
  description = "Initial gp3 storage in GiB."
  type        = number

  validation {
    condition = (
      var.allocated_storage == floor(var.allocated_storage) &&
      var.allocated_storage >= 20 &&
      var.allocated_storage <= 65536
    )
    error_message = "allocated_storage must be an integer from 20 through 65536 GiB."
  }
}

variable "max_allocated_storage" {
  description = "Storage autoscaling ceiling in GiB; zero disables autoscaling."
  type        = number

  validation {
    condition = (
      var.max_allocated_storage == floor(var.max_allocated_storage) &&
      (var.max_allocated_storage == 0 || (
        var.max_allocated_storage >= ceil(var.allocated_storage * 1.10) &&
        var.max_allocated_storage <= 65536
      ))
    )
    error_message = "max_allocated_storage must be zero or an integer at least 10% greater than allocated_storage and no more than 65536 GiB."
  }
}

variable "multi_az" {
  description = "Whether RDS maintains a synchronous standby in another availability zone."
  type        = bool
}

variable "backup_retention_period" {
  description = "Automated backup retention in days."
  type        = number

  validation {
    condition = (
      var.backup_retention_period == floor(var.backup_retention_period) &&
      var.backup_retention_period >= 0 &&
      var.backup_retention_period <= 35 &&
      (!var.deletion_protection || var.backup_retention_period > 0)
    )
    error_message = "backup_retention_period must be an integer from 0 through 35 and non-zero when deletion protection is enabled."
  }
}

variable "deletion_protection" {
  description = "Whether RDS rejects deletion until protection is explicitly disabled."
  type        = bool
}

variable "skip_final_snapshot" {
  description = "Whether deletion may discard the final database snapshot."
  type        = bool

  validation {
    condition     = !var.deletion_protection || !var.skip_final_snapshot
    error_message = "skip_final_snapshot must be false when deletion_protection is enabled."
  }
}

variable "final_snapshot_identifier" {
  description = "Final snapshot name, required when skip_final_snapshot is false."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition = var.skip_final_snapshot ? var.final_snapshot_identifier == null : try(
      can(regex("^[a-z][a-z0-9-]{0,254}$", var.final_snapshot_identifier)) &&
      !strcontains(var.final_snapshot_identifier, "--") &&
      !endswith(var.final_snapshot_identifier, "-"),
      false
    )
    error_message = "final_snapshot_identifier must be null when skipped, otherwise a valid lowercase RDS snapshot identifier."
  }
}

variable "cloudwatch_log_retention_days" {
  description = "Retention for exported PostgreSQL and upgrade logs."
  type        = number

  validation {
    condition = contains([
      1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731,
      1096, 1827, 2192, 2557, 2922, 3288, 3653,
    ], var.cloudwatch_log_retention_days)
    error_message = "cloudwatch_log_retention_days must be a CloudWatch Logs supported retention value."
  }
}

variable "common_tags" {
  description = "Additional non-sensitive tags; required ownership and Name tags take precedence."
  type        = map(string)
  default     = {}
}
