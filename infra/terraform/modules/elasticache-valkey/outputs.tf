output "replication_group_id" {
  description = "ElastiCache Valkey replication group identifier."
  value       = aws_elasticache_replication_group.this.replication_group_id
}

output "primary_endpoint_address" {
  description = "Private primary Valkey endpoint address."
  value       = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "reader_endpoint_address" {
  description = "Private reader Valkey endpoint address."
  value       = aws_elasticache_replication_group.this.reader_endpoint_address
}

output "port" {
  description = "Valkey port."
  value       = aws_elasticache_replication_group.this.port
}

output "security_group_id" {
  description = "Cache security group ID."
  value       = aws_security_group.this.id
}

output "subnet_group_name" {
  description = "ElastiCache subnet group name."
  value       = aws_elasticache_subnet_group.this.name
}

output "replication_group_arn" {
  description = "ElastiCache Valkey replication group ARN."
  value       = aws_elasticache_replication_group.this.arn
}

output "application_user_id" {
  description = "IAM-authenticated ElastiCache application user ID; this is not a credential."
  value       = aws_elasticache_user.application.user_id
}

output "application_user_arn" {
  description = "ARN of the IAM-authenticated ElastiCache application user."
  value       = aws_elasticache_user.application.arn
}

output "user_group_id" {
  description = "ElastiCache user group ID."
  value       = aws_elasticache_user_group.this.user_group_id
}
