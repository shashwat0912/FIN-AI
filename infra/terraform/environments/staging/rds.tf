locals {
  rds_private_data_subnet_ids       = module.vpc.private_data_subnet_ids
  rds_application_security_group_id = module.eks.cluster_security_group_id
  rds_environment_config = {
    multi_az                      = false
    backup_retention_period       = 7
    deletion_protection           = false
    skip_final_snapshot           = true
    final_snapshot_identifier     = null
    cloudwatch_log_retention_days = 30
  }
}

module "rds_postgres" {
  source = "../../modules/rds-postgres"

  project_name                  = var.project_name
  environment                   = var.environment
  vpc_id                        = module.vpc.vpc_id
  private_data_subnet_ids       = local.rds_private_data_subnet_ids
  application_security_group_id = local.rds_application_security_group_id
  engine_version                = var.rds_engine_version
  instance_class                = var.rds_instance_class
  database_name                 = "financeai"
  master_username               = "financeai_admin"
  allocated_storage             = var.rds_allocated_storage
  max_allocated_storage         = var.rds_max_allocated_storage
  multi_az                      = local.rds_environment_config.multi_az
  backup_retention_period       = local.rds_environment_config.backup_retention_period
  deletion_protection           = local.rds_environment_config.deletion_protection
  skip_final_snapshot           = local.rds_environment_config.skip_final_snapshot
  final_snapshot_identifier     = local.rds_environment_config.final_snapshot_identifier
  cloudwatch_log_retention_days = local.rds_environment_config.cloudwatch_log_retention_days
  common_tags                   = merge(var.additional_tags, local.default_tags)
}
