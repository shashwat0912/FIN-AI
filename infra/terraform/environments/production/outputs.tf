output "environment" {
  description = "Validated environment represented by this root."
  value       = var.environment
}

output "name_prefix" {
  description = "Naming prefix used by this environment."
  value       = local.name_prefix
}

output "vpc_id" {
  description = "Production VPC ID."
  value       = module.vpc.vpc_id
}

output "vpc_cidr" {
  description = "Production VPC CIDR."
  value       = module.vpc.vpc_cidr
}

output "public_subnet_ids" {
  description = "Production public subnet IDs keyed by availability zone."
  value       = module.vpc.public_subnet_ids
}

output "private_application_subnet_ids" {
  description = "Production private application subnet IDs keyed by availability zone."
  value       = module.vpc.private_application_subnet_ids
}

output "private_data_subnet_ids" {
  description = "Production private data subnet IDs keyed by availability zone."
  value       = module.vpc.private_data_subnet_ids
}

output "public_route_table_ids" {
  description = "Production public route-table IDs."
  value       = module.vpc.public_route_table_ids
}

output "private_application_route_table_ids" {
  description = "Production private application route-table IDs keyed by availability zone."
  value       = module.vpc.private_application_route_table_ids
}

output "private_data_route_table_ids" {
  description = "Production private data route-table IDs keyed by availability zone."
  value       = module.vpc.private_data_route_table_ids
}

output "nat_gateway_ids" {
  description = "Production NAT Gateway IDs keyed by availability zone."
  value       = module.vpc.nat_gateway_ids
}
