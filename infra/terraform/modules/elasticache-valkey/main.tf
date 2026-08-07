locals {
  identifier = var.replication_group_id
  required_tags = {
    project      = var.project_name
    environment  = var.environment
    "managed-by" = "terraform"
    component    = "cache"
  }
  tags = merge(var.common_tags, local.required_tags)

  application_user_id       = "${local.identifier}-app"
  application_access_string = "on ~conv:* ~security:* ~jobs:lease:* -@all +get +set +del +pttl +incr +decr +pexpire +eval +evalsha +script|load +ping +info +quit +client|setinfo"
}

resource "aws_elasticache_subnet_group" "this" {
  name       = local.identifier
  subnet_ids = values(var.private_data_subnet_ids)

  tags = merge(local.tags, { Name = local.identifier })
}

resource "aws_security_group" "this" {
  name        = local.identifier
  description = "Valkey access from the EKS application security boundary"
  vpc_id      = var.vpc_id

  tags = merge(local.tags, { Name = local.identifier })
}

resource "aws_vpc_security_group_ingress_rule" "valkey" {
  security_group_id            = aws_security_group.this.id
  referenced_security_group_id = var.application_security_group_id
  description                  = "Valkey from EKS applications"
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379

  tags = merge(local.tags, { Name = "${local.identifier}-from-eks" })
}

resource "aws_cloudwatch_log_group" "this" {
  for_each = toset(["engine-log", "slow-log"])

  name              = "/aws/elasticache/${local.identifier}/${each.key}"
  retention_in_days = var.cloudwatch_log_retention_days

  tags = merge(local.tags, { Name = "${local.identifier}-${each.key}" })
}

resource "aws_elasticache_user" "application" {
  user_id       = local.application_user_id
  user_name     = local.application_user_id
  access_string = local.application_access_string
  engine        = "valkey"

  authentication_mode {
    type = "iam"
  }

  tags = merge(local.tags, { Name = "${local.identifier}-app" })
}

resource "aws_elasticache_user_group" "this" {
  user_group_id = local.identifier
  engine        = "valkey"
  user_ids      = [aws_elasticache_user.application.user_id]

  tags = merge(local.tags, { Name = local.identifier })
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id = local.identifier
  description          = "Finance AI ${var.environment} Valkey cache"

  engine         = "valkey"
  engine_version = var.engine_version
  node_type      = var.node_type
  port           = 6379

  cluster_mode               = "disabled"
  num_cache_clusters         = var.num_cache_clusters
  automatic_failover_enabled = var.automatic_failover_enabled
  multi_az_enabled           = var.multi_az_enabled

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [aws_security_group.this.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  transit_encryption_mode    = "required"
  user_group_ids             = [aws_elasticache_user_group.this.user_group_id]

  snapshot_retention_limit  = var.snapshot_retention_limit
  snapshot_window           = var.snapshot_window
  final_snapshot_identifier = var.final_snapshot_identifier
  maintenance_window        = var.maintenance_window

  auto_minor_version_upgrade = true
  apply_immediately          = false

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.this["engine-log"].name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "engine-log"
  }

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.this["slow-log"].name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }

  tags = merge(local.tags, { Name = local.identifier })

  depends_on = [aws_cloudwatch_log_group.this]
}
