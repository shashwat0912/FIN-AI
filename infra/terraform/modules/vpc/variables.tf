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

variable "vpc_cidr" {
  description = "IPv4 CIDR block for the VPC."
  type        = string

  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "vpc_cidr must be a valid IPv4 CIDR block."
  }
}

variable "availability_zones" {
  description = "Two distinct availability zones used by every subnet tier."
  type        = set(string)

  validation {
    condition = (
      length(var.availability_zones) == 2 &&
      alltrue([for az in var.availability_zones : length(trimspace(az)) > 0])
    )
    error_message = "availability_zones must contain exactly two distinct non-empty values."
  }
}

variable "public_subnet_cidrs" {
  description = "Public subnet IPv4 CIDRs keyed by availability zone."
  type        = map(string)

  validation {
    condition = (
      length(var.public_subnet_cidrs) == 2 &&
      toset(keys(var.public_subnet_cidrs)) == var.availability_zones
    )
    error_message = "public_subnet_cidrs must contain exactly one entry keyed by each availability zone."
  }

  validation {
    condition     = alltrue([for cidr in values(var.public_subnet_cidrs) : can(cidrnetmask(cidr))])
    error_message = "Every public subnet CIDR must be valid IPv4 CIDR syntax."
  }
}

variable "private_application_subnet_cidrs" {
  description = "Private application subnet IPv4 CIDRs keyed by availability zone."
  type        = map(string)

  validation {
    condition = (
      length(var.private_application_subnet_cidrs) == 2 &&
      toset(keys(var.private_application_subnet_cidrs)) == var.availability_zones
    )
    error_message = "private_application_subnet_cidrs must contain exactly one entry keyed by each availability zone."
  }

  validation {
    condition     = alltrue([for cidr in values(var.private_application_subnet_cidrs) : can(cidrnetmask(cidr))])
    error_message = "Every private application subnet CIDR must be valid IPv4 CIDR syntax."
  }
}

variable "private_data_subnet_cidrs" {
  description = "Isolated private data subnet IPv4 CIDRs keyed by availability zone."
  type        = map(string)

  validation {
    condition = (
      length(var.private_data_subnet_cidrs) == 2 &&
      toset(keys(var.private_data_subnet_cidrs)) == var.availability_zones
    )
    error_message = "private_data_subnet_cidrs must contain exactly one entry keyed by each availability zone."
  }

  validation {
    condition     = alltrue([for cidr in values(var.private_data_subnet_cidrs) : can(cidrnetmask(cidr))])
    error_message = "Every private data subnet CIDR must be valid IPv4 CIDR syntax."
  }

  validation {
    condition = length(distinct(concat(
      values(var.public_subnet_cidrs),
      values(var.private_application_subnet_cidrs),
      values(var.private_data_subnet_cidrs),
      ))) == (
      length(var.public_subnet_cidrs) +
      length(var.private_application_subnet_cidrs) +
      length(var.private_data_subnet_cidrs)
    )
    error_message = "Subnet CIDRs must not be duplicated across tiers."
  }
}

variable "nat_mode" {
  description = "NAT Gateway topology: none, single, or one per availability zone."
  type        = string

  validation {
    condition     = contains(["none", "single", "per_az"], var.nat_mode)
    error_message = "nat_mode must be none, single, or per_az."
  }
}

variable "common_tags" {
  description = "Additional non-sensitive tags applied to taggable networking resources."
  type        = map(string)
  default     = {}
}
