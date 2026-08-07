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

output "eks_cluster_name" {
  description = "Staging EKS cluster name."
  value       = module.eks.cluster_name
}

output "eks_cluster_arn" {
  description = "Staging EKS cluster ARN."
  value       = module.eks.cluster_arn
}

output "eks_cluster_endpoint" {
  description = "Staging EKS API endpoint."
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "eks_cluster_certificate_authority_data" {
  description = "Staging EKS certificate authority data."
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "eks_cluster_security_group_id" {
  description = "Staging EKS cluster security group ID."
  value       = module.eks.cluster_security_group_id
}

output "eks_node_group_name" {
  description = "Staging EKS managed node-group name."
  value       = module.eks.node_group_name
}

output "eks_node_iam_role_arn" {
  description = "Staging EKS node IAM role ARN."
  value       = module.eks.node_iam_role_arn
}

output "eks_cluster_iam_role_arn" {
  description = "Staging EKS cluster IAM role ARN."
  value       = module.eks.cluster_iam_role_arn
}

output "eks_oidc_provider_arn" {
  description = "Staging EKS IAM OIDC provider ARN."
  value       = module.eks.oidc_provider_arn
}

output "eks_oidc_issuer_url" {
  description = "Staging EKS OIDC issuer URL."
  value       = module.eks.oidc_issuer_url
}

output "ecr_repository_names" {
  description = "Staging ECR repository names keyed by image component."
  value       = module.ecr.repository_names
}

output "ecr_repository_arns" {
  description = "Staging ECR repository ARNs keyed by image component."
  value       = module.ecr.repository_arns
}

output "ecr_repository_urls" {
  description = "Staging ECR repository URLs keyed by image component."
  value       = module.ecr.repository_urls
}
