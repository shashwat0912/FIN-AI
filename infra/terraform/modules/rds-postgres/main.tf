locals {
  identifier = "${var.project_name}-${var.environment}-postgres"
  required_tags = {
    project      = var.project_name
    environment  = var.environment
    "managed-by" = "terraform"
    component    = "database"
  }
  tags = merge(var.common_tags, local.required_tags)
}

resource "aws_db_subnet_group" "this" {
  name       = local.identifier
  subnet_ids = values(var.private_data_subnet_ids)

  tags = merge(local.tags, { Name = local.identifier })
}

resource "aws_security_group" "this" {
  name        = local.identifier
  description = "PostgreSQL access from the EKS application security boundary"
  vpc_id      = var.vpc_id

  tags = merge(local.tags, { Name = local.identifier })
}

resource "aws_vpc_security_group_ingress_rule" "postgresql" {
  security_group_id            = aws_security_group.this.id
  referenced_security_group_id = var.application_security_group_id
  description                  = "PostgreSQL from EKS applications"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432

  tags = merge(local.tags, { Name = "${local.identifier}-from-eks" })
}

resource "aws_cloudwatch_log_group" "this" {
  for_each = toset(["postgresql", "upgrade"])

  name              = "/aws/rds/instance/${local.identifier}/${each.key}"
  retention_in_days = var.cloudwatch_log_retention_days

  tags = merge(local.tags, { Name = "${local.identifier}-${each.key}" })
}

resource "aws_db_instance" "this" {
  identifier = local.identifier

  engine                      = "postgres"
  engine_version              = var.engine_version
  engine_lifecycle_support    = "open-source-rds-extended-support-disabled"
  auto_minor_version_upgrade  = true
  allow_major_version_upgrade = false

  instance_class        = var.instance_class
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name                     = var.database_name
  username                    = var.master_username
  manage_master_user_password = true
  port                        = 5432

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.this.id]
  publicly_accessible    = false
  multi_az               = var.multi_az

  backup_retention_period = var.backup_retention_period
  deletion_protection     = var.deletion_protection
  skip_final_snapshot     = var.skip_final_snapshot
  final_snapshot_identifier = (
    var.skip_final_snapshot ? null : var.final_snapshot_identifier
  )
  copy_tags_to_snapshot = true

  iam_database_authentication_enabled   = false
  database_insights_mode                = "standard"
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]

  tags = merge(local.tags, { Name = local.identifier })

  depends_on = [aws_cloudwatch_log_group.this]
}
