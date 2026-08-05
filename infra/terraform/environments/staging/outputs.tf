output "environment" {
  description = "Validated environment represented by this root."
  value       = var.environment
}

output "name_prefix" {
  description = "Naming prefix used by this environment."
  value       = local.name_prefix
}

output "vpc_id" {
  description = "Staging VPC ID."
  value       = module.vpc.vpc_id
}

output "vpc_cidr" {
  description = "Staging VPC CIDR."
  value       = module.vpc.vpc_cidr
}

output "public_subnet_ids" {
  description = "Staging public subnet IDs keyed by availability zone."
  value       = module.vpc.public_subnet_ids
}

output "private_application_subnet_ids" {
  description = "Staging private application subnet IDs keyed by availability zone."
  value       = module.vpc.private_application_subnet_ids
}

output "private_data_subnet_ids" {
  description = "Staging private data subnet IDs keyed by availability zone."
  value       = module.vpc.private_data_subnet_ids
}

output "public_route_table_ids" {
  description = "Staging public route-table IDs."
  value       = module.vpc.public_route_table_ids
}

output "private_application_route_table_ids" {
  description = "Staging private application route-table IDs keyed by availability zone."
  value       = module.vpc.private_application_route_table_ids
}

output "private_data_route_table_ids" {
  description = "Staging private data route-table IDs keyed by availability zone."
  value       = module.vpc.private_data_route_table_ids
}

output "nat_gateway_ids" {
  description = "Staging NAT Gateway IDs keyed by availability zone."
  value       = module.vpc.nat_gateway_ids
}
