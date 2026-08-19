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

output "backend_irsa_role_arn" {
  description = "IAM role ARN for the staging backend Kubernetes ServiceAccount."
  value       = aws_iam_role.backend.arn
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

output "rds_db_instance_identifier" {
  description = "Staging RDS PostgreSQL instance identifier."
  value       = module.rds_postgres.db_instance_identifier
}

output "rds_address" {
  description = "Private staging RDS PostgreSQL hostname."
  value       = module.rds_postgres.address
}

output "rds_port" {
  description = "Staging PostgreSQL port."
  value       = module.rds_postgres.port
}

output "rds_database_name" {
  description = "Staging PostgreSQL database name."
  value       = module.rds_postgres.database_name
}

output "rds_security_group_id" {
  description = "Staging database security group ID."
  value       = module.rds_postgres.security_group_id
}

output "rds_db_subnet_group_name" {
  description = "Staging database subnet group name."
  value       = module.rds_postgres.db_subnet_group_name
}

output "rds_db_instance_arn" {
  description = "Staging RDS PostgreSQL instance ARN."
  value       = module.rds_postgres.db_instance_arn
}

output "rds_master_user_secret_arn" {
  description = "ARN of the staging RDS-managed master-user secret."
  value       = module.rds_postgres.master_user_secret_arn
}

output "valkey_replication_group_id" {
  description = "Staging ElastiCache Valkey replication group identifier."
  value       = module.elasticache_valkey.replication_group_id
}

output "valkey_primary_endpoint_address" {
  description = "Private staging Valkey primary endpoint address."
  value       = module.elasticache_valkey.primary_endpoint_address
}

output "valkey_reader_endpoint_address" {
  description = "Private staging Valkey reader endpoint address."
  value       = module.elasticache_valkey.reader_endpoint_address
}

output "valkey_port" {
  description = "Staging Valkey port."
  value       = module.elasticache_valkey.port
}

output "valkey_security_group_id" {
  description = "Staging cache security group ID."
  value       = module.elasticache_valkey.security_group_id
}

output "valkey_subnet_group_name" {
  description = "Staging ElastiCache subnet group name."
  value       = module.elasticache_valkey.subnet_group_name
}

output "valkey_replication_group_arn" {
  description = "Staging ElastiCache Valkey replication group ARN."
  value       = module.elasticache_valkey.replication_group_arn
}

output "valkey_application_user_id" {
  description = "Staging IAM-authenticated ElastiCache application user ID."
  value       = module.elasticache_valkey.application_user_id
}

output "valkey_application_user_arn" {
  description = "ARN of the staging IAM-authenticated ElastiCache application user."
  value       = module.elasticache_valkey.application_user_arn
}

output "valkey_user_group_id" {
  description = "Staging ElastiCache user group ID."
  value       = module.elasticache_valkey.user_group_id
}
