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

variable "vpc_cidr" {
  description = "IPv4 CIDR block for the production VPC."
  type        = string
}

variable "availability_zones" {
  description = "Two availability zones for production networking."
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
  description = "Production EKS cluster name."
  type        = string
}

variable "eks_kubernetes_version" {
  description = "Production EKS Kubernetes minor version."
  type        = string
}

variable "eks_public_endpoint_access" {
  description = "Whether the production EKS API endpoint is publicly accessible."
  type        = bool
}

variable "eks_public_endpoint_allowed_cidrs" {
  description = "Restricted CIDRs allowed to reach the public production EKS API endpoint."
  type        = set(string)
}

variable "eks_control_plane_log_types" {
  description = "Enabled production EKS control-plane log types."
  type        = set(string)
}

variable "eks_node_instance_types" {
  description = "Allowed production managed node-group instance types."
  type        = set(string)
}

variable "eks_node_capacity_type" {
  description = "Production managed node-group capacity type."
  type        = string
}

variable "eks_node_disk_size" {
  description = "Production managed node root-volume size in GiB."
  type        = number
}

variable "eks_node_min_size" {
  description = "Production managed node-group minimum size."
  type        = number
}

variable "eks_node_desired_size" {
  description = "Production managed node-group desired size."
  type        = number
}

variable "eks_node_max_size" {
  description = "Production managed node-group maximum size."
  type        = number
}

variable "eks_node_labels" {
  description = "Kubernetes labels applied to production managed nodes."
  type        = map(string)
}

variable "eks_node_update_max_unavailable" {
  description = "Maximum unavailable production nodes during updates."
  type        = number
}

variable "rds_engine_version" {
  description = "Production RDS PostgreSQL engine version; recheck before apply."
  type        = string
  default     = "15"
}

variable "rds_instance_class" {
  description = "Production RDS PostgreSQL instance class; example is not load-tested."
  type        = string
  default     = "db.m7g.large"
}

variable "rds_allocated_storage" {
  description = "Initial production RDS gp3 storage in GiB."
  type        = number
  default     = 100
}

variable "rds_max_allocated_storage" {
  description = "Production RDS storage autoscaling ceiling in GiB."
  type        = number
  default     = 500
}
