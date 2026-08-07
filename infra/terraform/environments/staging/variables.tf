variable "aws_region" {
  description = "AWS region for staging resources."
  type        = string

  validation {
    condition     = can(regex("^[a-z]{2}(-[a-z]+)+-[0-9]+$", var.aws_region))
    error_message = "aws_region must use a valid AWS region format such as us-east-1."
  }
}

variable "environment" {
  description = "Deployment environment; fixed to match this state root."
  type        = string
  default     = "staging"

  validation {
    condition     = var.environment == "staging"
    error_message = "The staging root only supports environment = staging."
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

variable "vpc_cidr" {
  description = "IPv4 CIDR block for the staging VPC."
  type        = string
}

variable "availability_zones" {
  description = "Two availability zones for staging networking."
  type        = set(string)
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDRs keyed by availability zone."
  type        = map(string)
}

variable "private_application_subnet_cidrs" {
  description = "Private application subnet CIDRs keyed by availability zone."
  type        = map(string)
}

variable "private_data_subnet_cidrs" {
  description = "Private data subnet CIDRs keyed by availability zone."
  type        = map(string)
}

variable "nat_mode" {
  description = "NAT topology passed to the VPC module."
  type        = string
}

variable "eks_cluster_name" {
  description = "Staging EKS cluster name."
  type        = string
}

variable "eks_kubernetes_version" {
  description = "Staging EKS Kubernetes minor version."
  type        = string
}

variable "eks_public_endpoint_access" {
  description = "Whether the staging EKS API endpoint is publicly accessible."
  type        = bool
}

variable "eks_public_endpoint_allowed_cidrs" {
  description = "Restricted CIDRs allowed to reach the public staging EKS API endpoint."
  type        = set(string)
}

variable "eks_control_plane_log_types" {
  description = "Enabled staging EKS control-plane log types."
  type        = set(string)
}

variable "eks_node_instance_types" {
  description = "Allowed staging managed node-group instance types."
  type        = set(string)
}

variable "eks_node_capacity_type" {
  description = "Staging managed node-group capacity type."
  type        = string
}

variable "eks_node_disk_size" {
  description = "Staging managed node root-volume size in GiB."
  type        = number
}

variable "eks_node_min_size" {
  description = "Staging managed node-group minimum size."
  type        = number
}

variable "eks_node_desired_size" {
  description = "Staging managed node-group desired size."
  type        = number
}

variable "eks_node_max_size" {
  description = "Staging managed node-group maximum size."
  type        = number
}

variable "eks_node_labels" {
  description = "Kubernetes labels applied to staging managed nodes."
  type        = map(string)
}

variable "eks_node_update_max_unavailable" {
  description = "Maximum unavailable staging nodes during updates."
  type        = number
}

variable "rds_engine_version" {
  description = "Staging RDS PostgreSQL engine version; recheck before apply."
  type        = string
  default     = "15"
}

variable "rds_instance_class" {
  description = "Staging RDS PostgreSQL instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "rds_allocated_storage" {
  description = "Initial staging RDS gp3 storage in GiB."
  type        = number
  default     = 20
}

variable "rds_max_allocated_storage" {
  description = "Staging RDS storage autoscaling ceiling in GiB."
  type        = number
  default     = 100
}
