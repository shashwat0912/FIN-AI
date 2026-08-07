output "db_instance_identifier" {
  description = "RDS DB instance identifier."
  value       = aws_db_instance.this.identifier
}

output "address" {
  description = "Private RDS PostgreSQL hostname."
  value       = aws_db_instance.this.address
}

output "port" {
  description = "PostgreSQL port."
  value       = aws_db_instance.this.port
}

output "database_name" {
  description = "Initial PostgreSQL database name."
  value       = aws_db_instance.this.db_name
}

output "security_group_id" {
  description = "Database security group ID."
  value       = aws_security_group.this.id
}

output "db_subnet_group_name" {
  description = "Database subnet group name."
  value       = aws_db_subnet_group.this.name
}

output "db_instance_arn" {
  description = "RDS DB instance ARN."
  value       = aws_db_instance.this.arn
}

output "master_user_secret_arn" {
  description = "ARN of the RDS-managed master-user secret; this is not the secret value."
  value       = aws_db_instance.this.master_user_secret[0].secret_arn
}
