output "repository_names" {
  description = "Staging ECR repository names keyed by image component."
  value       = module.ecr.repository_names
}

output "repository_arns" {
  description = "Staging ECR repository ARNs keyed by image component."
  value       = module.ecr.repository_arns
}

output "repository_urls" {
  description = "Staging ECR repository URLs keyed by image component."
  value       = module.ecr.repository_urls
}
