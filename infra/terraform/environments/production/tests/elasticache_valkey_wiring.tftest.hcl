mock_provider "aws" {}

variables {
  aws_region   = "us-east-1"
  environment  = "production"
  project_name = "finance-ai"
  vpc_cidr     = "10.20.0.0/16"

  availability_zones = ["us-east-1a", "us-east-1b"]
  public_subnet_cidrs = {
    us-east-1a = "10.20.0.0/24"
    us-east-1b = "10.20.1.0/24"
  }
  private_application_subnet_cidrs = {
    us-east-1a = "10.20.10.0/24"
    us-east-1b = "10.20.11.0/24"
  }
  private_data_subnet_cidrs = {
    us-east-1a = "10.20.20.0/24"
    us-east-1b = "10.20.21.0/24"
  }
  nat_mode = "per_az"

  eks_cluster_name                  = "finance-ai-production"
  eks_kubernetes_version            = "1.35"
  eks_public_endpoint_access        = false
  eks_public_endpoint_allowed_cidrs = []
  eks_control_plane_log_types       = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  eks_node_instance_types           = ["m6i.large"]
  eks_node_capacity_type            = "ON_DEMAND"
  eks_node_disk_size                = 50
  eks_node_min_size                 = 2
  eks_node_desired_size             = 2
  eks_node_max_size                 = 4
  eks_node_labels                   = { workload = "general" }
  eks_node_update_max_unavailable   = 1
}

run "production_valkey_wiring" {
  command = plan

  override_module {
    target          = module.vpc
    override_during = plan
    outputs = {
      vpc_id                              = "vpc-production"
      vpc_cidr                            = "10.20.0.0/16"
      public_subnet_ids                   = { us-east-1a = "subnet-public-a", us-east-1b = "subnet-public-b" }
      private_application_subnet_ids      = { us-east-1a = "subnet-application-a", us-east-1b = "subnet-application-b" }
      private_data_subnet_ids             = { us-east-1a = "subnet-data-a", us-east-1b = "subnet-data-b" }
      public_route_table_ids              = ["rtb-public"]
      private_application_route_table_ids = { us-east-1a = "rtb-application-a", us-east-1b = "rtb-application-b" }
      private_data_route_table_ids        = { us-east-1a = "rtb-data-a", us-east-1b = "rtb-data-b" }
      nat_gateway_ids                     = { us-east-1a = "nat-a", us-east-1b = "nat-b" }
    }
  }

  override_module {
    target          = module.eks
    override_during = plan
    outputs = {
      cluster_name                       = "finance-ai-production"
      cluster_arn                        = "mock-cluster-arn"
      cluster_endpoint                   = "https://mock.eks"
      cluster_certificate_authority_data = "mock-certificate"
      cluster_security_group_id          = "sg-eks-production"
      node_group_name                    = "finance-ai-production-default"
      node_iam_role_arn                  = "mock-node-role-arn"
      cluster_iam_role_arn               = "mock-cluster-role-arn"
      oidc_provider_arn                  = "mock-oidc-provider-arn"
      oidc_issuer_url                    = "https://mock.oidc"
    }
  }

  assert {
    condition = (
      local.valkey_private_data_subnet_ids == module.vpc.private_data_subnet_ids &&
      local.valkey_private_data_subnet_ids != module.vpc.public_subnet_ids &&
      local.valkey_private_data_subnet_ids != module.vpc.private_application_subnet_ids &&
      local.valkey_application_security_group_id == module.eks.cluster_security_group_id
    )
    error_message = "Production Valkey must consume only private-data subnets and the EKS security group."
  }

  assert {
    condition = (
      module.elasticache_valkey.replication_group_id == "finance-ai-production-valkey" &&
      local.valkey_replication_group_id == "finance-ai-production-valkey" &&
      var.valkey_engine_version == "7.2" &&
      var.valkey_node_type == "cache.t4g.small" &&
      local.valkey_environment_config.num_cache_clusters == 2 &&
      local.valkey_environment_config.automatic_failover_enabled &&
      local.valkey_environment_config.multi_az_enabled &&
      local.valkey_environment_config.snapshot_retention_limit == 7 &&
      local.valkey_environment_config.final_snapshot_identifier == "finance-ai-production-valkey-final" &&
      local.valkey_environment_config.cloudwatch_log_retention_days == 90
    )
    error_message = "Production Valkey must use its identifier, Valkey 7.2, two Graviton nodes, Multi-AZ failover, and retained snapshots/logs."
  }
}
