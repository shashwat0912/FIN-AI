mock_provider "aws" {}

variables {
  project_name                  = "finance-ai"
  environment                   = "staging"
  vpc_id                        = "vpc-staging"
  private_data_subnet_ids       = { us-east-1a = "subnet-data-a", us-east-1b = "subnet-data-b" }
  application_security_group_id = "sg-eks-applications"
  replication_group_id          = "finance-ai-staging-valkey"
  engine_version                = "7.2"
  node_type                     = "cache.t4g.micro"
  num_cache_clusters            = 1
  automatic_failover_enabled    = false
  multi_az_enabled              = false
  snapshot_retention_limit      = 1
  snapshot_window               = "03:00-04:00"
  final_snapshot_identifier     = null
  maintenance_window            = "sun:04:00-sun:05:00"
  cloudwatch_log_retention_days = 30
  common_tags = {
    project      = "must-not-override"
    environment  = "must-not-override"
    "managed-by" = "must-not-override"
    component    = "must-not-override"
    Name         = "must-not-override"
  }
}

run "private_encrypted_valkey" {
  command = plan

  module {
    source = "../../modules/elasticache-valkey"
  }

  override_resource {
    target          = aws_security_group.this
    override_during = plan
    values = {
      id = "sg-cache"
    }
  }

  override_resource {
    target          = aws_elasticache_replication_group.this
    override_during = plan
    values = {
      arn                      = "mock-valkey-arn"
      primary_endpoint_address = "primary.mock.cache.amazonaws.com"
      reader_endpoint_address  = "reader.mock.cache.amazonaws.com"
    }
  }

  override_resource {
    target          = aws_elasticache_user.application
    override_during = plan
    values = {
      arn = "mock-application-user-arn"
    }
  }

  assert {
    condition = (
      toset(aws_elasticache_subnet_group.this.subnet_ids) == toset(values(var.private_data_subnet_ids)) &&
      !contains(aws_elasticache_subnet_group.this.subnet_ids, "subnet-public-a") &&
      !contains(aws_elasticache_subnet_group.this.subnet_ids, "subnet-application-a")
    )
    error_message = "The cache subnet group must contain only the two supplied private-data subnets."
  }

  assert {
    condition = (
      aws_elasticache_replication_group.this.port == 6379 &&
      toset(aws_elasticache_replication_group.this.security_group_ids) == toset([aws_security_group.this.id]) &&
      length(aws_security_group.this.ingress) == 0 &&
      length(aws_security_group.this.egress) == 0
    )
    error_message = "Valkey must use port 6379 and a standalone ingress-only cache security group."
  }

  assert {
    condition = (
      aws_vpc_security_group_ingress_rule.valkey.ip_protocol == "tcp" &&
      aws_vpc_security_group_ingress_rule.valkey.from_port == 6379 &&
      aws_vpc_security_group_ingress_rule.valkey.to_port == 6379 &&
      aws_vpc_security_group_ingress_rule.valkey.security_group_id == aws_security_group.this.id &&
      aws_vpc_security_group_ingress_rule.valkey.referenced_security_group_id == var.application_security_group_id &&
      aws_vpc_security_group_ingress_rule.valkey.cidr_ipv4 == null &&
      aws_vpc_security_group_ingress_rule.valkey.cidr_ipv6 == null
    )
    error_message = "Cache ingress must be TCP/6379 from only the EKS/application security group, never a CIDR."
  }

  assert {
    condition = (
      aws_elasticache_replication_group.this.engine == "valkey" &&
      aws_elasticache_replication_group.this.engine_version == "7.2" &&
      aws_elasticache_replication_group.this.cluster_mode == "disabled" &&
      aws_elasticache_replication_group.this.auto_minor_version_upgrade &&
      !aws_elasticache_replication_group.this.apply_immediately
    )
    error_message = "The replication group must remain Valkey 7.2, cluster-mode disabled, with scheduled minor updates."
  }

  assert {
    condition = (
      aws_elasticache_replication_group.this.at_rest_encryption_enabled &&
      aws_elasticache_replication_group.this.transit_encryption_enabled &&
      aws_elasticache_replication_group.this.transit_encryption_mode == "required" &&
      aws_elasticache_replication_group.this.kms_key_id == null &&
      aws_elasticache_replication_group.this.auth_token == null
    )
    error_message = "Valkey must require service-managed at-rest encryption and TLS without a static auth token."
  }

  assert {
    condition = (
      aws_elasticache_user.application.user_id == aws_elasticache_user.application.user_name &&
      aws_elasticache_user.application.user_name == "finance-ai-staging-valkey-app" &&
      aws_elasticache_user.application.authentication_mode[0].type == "iam" &&
      aws_elasticache_user.application.passwords == null &&
      aws_elasticache_user.application.authentication_mode[0].passwords == null &&
      aws_elasticache_user.application.access_string == "on ~conv:* ~security:* ~jobs:lease:* -@all +get +set +del +pttl +incr +decr +pexpire +eval +evalsha +script|load +ping +info +quit +client|setinfo" &&
      !strcontains(aws_elasticache_user.application.access_string, "+@all") &&
      !strcontains(aws_elasticache_user.application.access_string, "~*") &&
      length(aws_elasticache_user_group.this.user_ids) == 1 &&
      toset(aws_elasticache_user_group.this.user_ids) == toset([aws_elasticache_user.application.user_id]) &&
      toset(aws_elasticache_replication_group.this.user_group_ids) == toset([aws_elasticache_user_group.this.user_group_id])
    )
    error_message = "Valkey must attach only the identically named, key-scoped, command-scoped IAM application user."
  }

  assert {
    condition = (
      aws_elasticache_replication_group.this.num_cache_clusters == 1 &&
      !aws_elasticache_replication_group.this.automatic_failover_enabled &&
      !aws_elasticache_replication_group.this.multi_az_enabled &&
      aws_elasticache_replication_group.this.snapshot_retention_limit == 1 &&
      aws_elasticache_replication_group.this.snapshot_window == "03:00-04:00" &&
      aws_elasticache_replication_group.this.final_snapshot_identifier == null &&
      aws_elasticache_replication_group.this.maintenance_window == "sun:04:00-sun:05:00"
    )
    error_message = "The staging topology must use one node, no HA, one-day snapshots, and separate snapshot/maintenance windows."
  }

  assert {
    condition = (
      toset([for config in aws_elasticache_replication_group.this.log_delivery_configuration : "${config.log_type}:${config.destination_type}:${config.log_format}:${config.destination}"]) == toset([
        "engine-log:cloudwatch-logs:json:/aws/elasticache/finance-ai-staging-valkey/engine-log",
        "slow-log:cloudwatch-logs:json:/aws/elasticache/finance-ai-staging-valkey/slow-log",
      ]) &&
      alltrue([for log_group in aws_cloudwatch_log_group.this :
        log_group.retention_in_days == 30 && log_group.skip_destroy == null
      ])
    )
    error_message = "Valkey engine and slow logs must use Terraform-owned retained CloudWatch log groups."
  }

  assert {
    condition = (
      output.replication_group_id == "finance-ai-staging-valkey" &&
      output.primary_endpoint_address == "primary.mock.cache.amazonaws.com" &&
      output.reader_endpoint_address == "reader.mock.cache.amazonaws.com" &&
      output.port == 6379 &&
      output.security_group_id == "sg-cache" &&
      output.subnet_group_name == "finance-ai-staging-valkey" &&
      output.replication_group_arn == "mock-valkey-arn" &&
      output.application_user_id == "finance-ai-staging-valkey-app" &&
      output.application_user_arn == "mock-application-user-arn" &&
      output.user_group_id == "finance-ai-staging-valkey"
    )
    error_message = "The module must expose only non-secret cache identifiers and endpoints."
  }

  assert {
    condition = alltrue(concat(
      [for tags in [
        aws_elasticache_replication_group.this.tags,
        aws_elasticache_subnet_group.this.tags,
        aws_security_group.this.tags,
        aws_elasticache_user.application.tags,
        aws_elasticache_user_group.this.tags,
        ] :
        tags.project == var.project_name &&
        tags.environment == var.environment &&
        tags["managed-by"] == "terraform" &&
        tags.component == "cache"
      ],
      [for log_group in aws_cloudwatch_log_group.this :
        log_group.tags.project == var.project_name &&
        log_group.tags.environment == var.environment &&
        log_group.tags["managed-by"] == "terraform" &&
        log_group.tags.component == "cache"
      ],
      [
        aws_vpc_security_group_ingress_rule.valkey.tags.project == var.project_name &&
        aws_vpc_security_group_ingress_rule.valkey.tags.environment == var.environment &&
        aws_vpc_security_group_ingress_rule.valkey.tags["managed-by"] == "terraform" &&
        aws_vpc_security_group_ingress_rule.valkey.tags.component == "cache"
      ],
    ))
    error_message = "common_tags must not override cache ownership tags."
  }
}

run "production_ha_topology" {
  command = plan

  module {
    source = "../../modules/elasticache-valkey"
  }

  variables {
    environment                = "production"
    replication_group_id       = "finance-ai-production-valkey"
    node_type                  = "cache.t4g.small"
    num_cache_clusters         = 2
    automatic_failover_enabled = true
    multi_az_enabled           = true
    snapshot_retention_limit   = 7
    final_snapshot_identifier  = "finance-ai-production-valkey-final"
  }

  assert {
    condition = (
      aws_elasticache_replication_group.this.replication_group_id == "finance-ai-production-valkey" &&
      aws_elasticache_replication_group.this.node_type == "cache.t4g.small" &&
      aws_elasticache_replication_group.this.num_cache_clusters == 2 &&
      aws_elasticache_replication_group.this.automatic_failover_enabled &&
      aws_elasticache_replication_group.this.multi_az_enabled &&
      aws_elasticache_replication_group.this.snapshot_retention_limit == 7 &&
      aws_elasticache_replication_group.this.final_snapshot_identifier == "finance-ai-production-valkey-final"
    )
    error_message = "The production topology must use two Graviton nodes, Multi-AZ failover, and retained snapshots."
  }
}

run "reject_failover_with_one_node" {
  command = plan

  module {
    source = "../../modules/elasticache-valkey"
  }

  variables {
    automatic_failover_enabled = true
  }

  expect_failures = [var.automatic_failover_enabled]
}

run "reject_multi_az_with_one_node" {
  command = plan

  module {
    source = "../../modules/elasticache-valkey"
  }

  variables {
    multi_az_enabled = true
  }

  expect_failures = [var.multi_az_enabled]
}

run "reject_production_with_one_node" {
  command = plan

  module {
    source = "../../modules/elasticache-valkey"
  }

  variables {
    environment          = "production"
    replication_group_id = "finance-ai-production-valkey"
  }

  expect_failures = [var.num_cache_clusters]
}

run "reject_zero_nodes" {
  command = plan

  module {
    source = "../../modules/elasticache-valkey"
  }

  variables {
    num_cache_clusters = 0
  }

  expect_failures = [var.num_cache_clusters]
}

run "reject_invalid_environment" {
  command = plan

  module {
    source = "../../modules/elasticache-valkey"
  }

  variables {
    environment = "development"
  }

  expect_failures = [var.environment]
}

run "reject_non_private_data_shape" {
  command = plan

  module {
    source = "../../modules/elasticache-valkey"
  }

  variables {
    private_data_subnet_ids = { us-east-1a = "subnet-data-a" }
  }

  expect_failures = [var.private_data_subnet_ids]
}
