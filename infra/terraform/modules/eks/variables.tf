variable "project_name" {
  description = "Project name used for resource names and tags."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.project_name))
    error_message = "project_name must use lowercase letters, numbers, and hyphens."
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

variable "cluster_name" {
  description = "Deterministic EKS cluster name."
  type        = string

  validation {
    condition = (
      length(var.cluster_name) >= 1 &&
      length(var.cluster_name) <= 48 &&
      can(regex("^[A-Za-z0-9][A-Za-z0-9_-]*$", var.cluster_name))
    )
    error_message = "cluster_name must be 1-48 letters, numbers, underscores, or hyphens and start with a letter or number."
  }
}

variable "kubernetes_version" {
  description = "Kubernetes minor version supported by EKS at deployment time."
  type        = string

  validation {
    condition     = can(regex("^[0-9]+\\.[0-9]+$", var.kubernetes_version))
    error_message = "kubernetes_version must use major.minor format, such as 1.35."
  }
}

variable "private_application_subnet_ids" {
  description = "Private application subnet IDs keyed by availability zone."
  type        = map(string)

  validation {
    condition = (
      length(var.private_application_subnet_ids) == 2 &&
      length(distinct(values(var.private_application_subnet_ids))) == 2 &&
      alltrue([for subnet_id in values(var.private_application_subnet_ids) : length(trimspace(subnet_id)) > 0])
    )
    error_message = "private_application_subnet_ids must contain two distinct non-empty subnet IDs."
  }
}

variable "cluster_endpoint_public_access" {
  description = "Whether the EKS API endpoint is reachable publicly in addition to privately."
  type        = bool
}

variable "cluster_endpoint_public_access_cidrs" {
  description = "Restricted IPv4 CIDRs allowed to reach the public EKS API endpoint."
  type        = set(string)
  default     = []

  validation {
    condition     = alltrue([for cidr in var.cluster_endpoint_public_access_cidrs : can(cidrnetmask(cidr))])
    error_message = "Every public endpoint CIDR must use valid IPv4 CIDR syntax."
  }

  validation {
    condition     = !contains(var.cluster_endpoint_public_access_cidrs, "0.0.0.0/0")
    error_message = "The unrestricted 0.0.0.0/0 public endpoint CIDR is not allowed."
  }

  validation {
    condition     = !var.cluster_endpoint_public_access || length(var.cluster_endpoint_public_access_cidrs) > 0
    error_message = "Public endpoint access requires at least one restricted allowed CIDR."
  }
}

variable "enabled_cluster_log_types" {
  description = "EKS control-plane log types sent to CloudWatch Logs."
  type        = set(string)

  validation {
    condition = length(setsubtract(
      var.enabled_cluster_log_types,
      toset(["api", "audit", "authenticator", "controllerManager", "scheduler"]),
    )) == 0
    error_message = "enabled_cluster_log_types contains an unsupported EKS control-plane log type."
  }
}

variable "node_instance_types" {
  description = "EC2 instance types allowed for the managed node group."
  type        = set(string)

  validation {
    condition = (
      length(var.node_instance_types) > 0 &&
      alltrue([for instance_type in var.node_instance_types : length(trimspace(instance_type)) > 0])
    )
    error_message = "node_instance_types must contain at least one non-empty instance type."
  }
}

variable "node_capacity_type" {
  description = "Managed node-group capacity type: ON_DEMAND or SPOT."
  type        = string

  validation {
    condition     = contains(["ON_DEMAND", "SPOT"], var.node_capacity_type)
    error_message = "node_capacity_type must be ON_DEMAND or SPOT."
  }
}

variable "node_disk_size" {
  description = "Managed node root-volume size in GiB."
  type        = number

  validation {
    condition     = var.node_disk_size >= 20 && var.node_disk_size <= 1024 && var.node_disk_size == floor(var.node_disk_size)
    error_message = "node_disk_size must be a whole number between 20 and 1024 GiB."
  }
}

variable "node_min_size" {
  description = "Minimum managed node count."
  type        = number

  validation {
    condition     = var.node_min_size >= 0 && var.node_min_size == floor(var.node_min_size)
    error_message = "node_min_size must be a non-negative whole number."
  }
}

variable "node_desired_size" {
  description = "Desired managed node count."
  type        = number

  validation {
    condition = (
      var.node_desired_size >= var.node_min_size &&
      var.node_desired_size == floor(var.node_desired_size)
    )
    error_message = "node_desired_size must be a whole number greater than or equal to node_min_size."
  }
}

variable "node_max_size" {
  description = "Maximum managed node count."
  type        = number

  validation {
    condition = (
      var.node_max_size >= var.node_desired_size &&
      var.node_max_size == floor(var.node_max_size)
    )
    error_message = "node_max_size must be a whole number greater than or equal to node_desired_size."
  }
}

variable "node_labels" {
  description = "Kubernetes labels applied to managed nodes."
  type        = map(string)
  default     = {}
}

variable "node_update_max_unavailable" {
  description = "Maximum unavailable nodes during managed node-group updates."
  type        = number

  validation {
    condition = (
      var.node_update_max_unavailable >= 1 &&
      var.node_update_max_unavailable == floor(var.node_update_max_unavailable)
    )
    error_message = "node_update_max_unavailable must be a positive whole number."
  }
}

variable "common_tags" {
  description = "Additional non-sensitive tags applied to taggable EKS resources."
  type        = map(string)
  default     = {}
}
