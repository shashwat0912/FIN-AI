variable "project_name" {
  description = "Project name used for cache resource names and tags."
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
  description = "VPC that owns the cache security group."
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
  description = "EKS/application security group allowed to connect to Valkey."
  type        = string

  validation {
    condition     = length(trimspace(var.application_security_group_id)) > 0
    error_message = "application_security_group_id must not be empty."
  }
}

variable "replication_group_id" {
  description = "Unique ElastiCache replication group identifier."
  type        = string

  validation {
    condition = (
      length(var.replication_group_id) <= 32 &&
      can(regex("^[a-z][a-z0-9-]*[a-z0-9]$", var.replication_group_id)) &&
      !strcontains(var.replication_group_id, "--")
    )
    error_message = "replication_group_id must be 2-32 lowercase letters, numbers, or single hyphens and start with a letter."
  }
}

variable "engine_version" {
  description = "ElastiCache Valkey major.minor version; recheck regional support before apply."
  type        = string

  validation {
    condition     = can(regex("^[0-9]+[.][0-9]+$", var.engine_version))
    error_message = "engine_version must be a Valkey major.minor version such as 7.2."
  }
}

variable "node_type" {
  description = "ElastiCache node type."
  type        = string

  validation {
    condition     = can(regex("^cache[.][a-z0-9]+[.][a-z0-9]+$", var.node_type))
    error_message = "node_type must be a valid ElastiCache node type such as cache.t4g.micro."
  }
}

variable "num_cache_clusters" {
  description = "Number of cache nodes in the cluster-mode-disabled replication group."
  type        = number

  validation {
    condition = (
      var.num_cache_clusters == floor(var.num_cache_clusters) &&
      var.num_cache_clusters >= 1 &&
      var.num_cache_clusters <= 6
    )
    error_message = "num_cache_clusters must be an integer from 1 through 6."
  }

  validation {
    condition     = var.environment != "production" || var.num_cache_clusters >= 2
    error_message = "production requires at least two cache nodes."
  }
}

variable "automatic_failover_enabled" {
  description = "Whether ElastiCache promotes a replica after primary failure."
  type        = bool

  validation {
    condition     = !var.automatic_failover_enabled || var.num_cache_clusters >= 2
    error_message = "automatic_failover_enabled requires at least two cache nodes."
  }
}

variable "multi_az_enabled" {
  description = "Whether nodes span availability zones with automatic failover."
  type        = bool

  validation {
    condition = (
      !var.multi_az_enabled ||
      (var.automatic_failover_enabled && var.num_cache_clusters >= 2)
    )
    error_message = "multi_az_enabled requires automatic failover and at least two cache nodes."
  }
}

variable "snapshot_retention_limit" {
  description = "Number of days to retain automatic cache snapshots."
  type        = number

  validation {
    condition = (
      var.snapshot_retention_limit == floor(var.snapshot_retention_limit) &&
      var.snapshot_retention_limit >= 1 &&
      var.snapshot_retention_limit <= 35
    )
    error_message = "snapshot_retention_limit must be an integer from 1 through 35 days."
  }
}

variable "snapshot_window" {
  description = "Daily UTC window for automatic snapshots."
  type        = string

  validation {
    condition     = can(regex("^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]-(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$", var.snapshot_window))
    error_message = "snapshot_window must use HH:MM-HH:MM UTC format."
  }
}

variable "final_snapshot_identifier" {
  description = "Optional final snapshot identifier used during intentional destruction."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition = var.final_snapshot_identifier == null || try(
      can(regex("^[a-z][a-z0-9-]{0,254}$", var.final_snapshot_identifier)) &&
      !strcontains(var.final_snapshot_identifier, "--") &&
      !endswith(var.final_snapshot_identifier, "-"),
      false
    )
    error_message = "final_snapshot_identifier must be null or a valid lowercase ElastiCache snapshot identifier."
  }
}

variable "maintenance_window" {
  description = "Weekly UTC maintenance window."
  type        = string

  validation {
    condition     = can(regex("^(sun|mon|tue|wed|thu|fri|sat):(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]-(sun|mon|tue|wed|thu|fri|sat):(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$", var.maintenance_window))
    error_message = "maintenance_window must use ddd:HH:MM-ddd:HH:MM UTC format."
  }
}

variable "cloudwatch_log_retention_days" {
  description = "Retention for exported Valkey engine and slow logs."
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
