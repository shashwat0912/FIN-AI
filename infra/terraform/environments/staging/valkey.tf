locals {
  valkey_private_data_subnet_ids       = module.vpc.private_data_subnet_ids
  valkey_application_security_group_id = module.eks.cluster_security_group_id
  valkey_replication_group_id          = "${local.name_prefix}-valkey"
  valkey_environment_config = {
    num_cache_clusters            = 1
    automatic_failover_enabled    = false
    multi_az_enabled              = false
    snapshot_retention_limit      = 1
    snapshot_window               = "03:00-04:00"
    final_snapshot_identifier     = null
    maintenance_window            = "sun:04:00-sun:05:00"
    cloudwatch_log_retention_days = 30
  }
}

module "elasticache_valkey" {
  source = "../../modules/elasticache-valkey"

  project_name                  = var.project_name
  environment                   = var.environment
  vpc_id                        = module.vpc.vpc_id
  private_data_subnet_ids       = local.valkey_private_data_subnet_ids
  application_security_group_id = local.valkey_application_security_group_id
  replication_group_id          = local.valkey_replication_group_id
  engine_version                = var.valkey_engine_version
  node_type                     = var.valkey_node_type
  num_cache_clusters            = local.valkey_environment_config.num_cache_clusters
  automatic_failover_enabled    = local.valkey_environment_config.automatic_failover_enabled
  multi_az_enabled              = local.valkey_environment_config.multi_az_enabled
  snapshot_retention_limit      = local.valkey_environment_config.snapshot_retention_limit
  snapshot_window               = local.valkey_environment_config.snapshot_window
  final_snapshot_identifier     = local.valkey_environment_config.final_snapshot_identifier
  maintenance_window            = local.valkey_environment_config.maintenance_window
  cloudwatch_log_retention_days = local.valkey_environment_config.cloudwatch_log_retention_days
  common_tags                   = merge(var.additional_tags, local.default_tags)
}
