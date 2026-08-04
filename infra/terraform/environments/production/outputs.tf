output "environment" {
  description = "Validated environment represented by this root."
  value       = var.environment
}

output "name_prefix" {
  description = "Naming prefix available to resources added in later phases."
  value       = local.name_prefix
}
