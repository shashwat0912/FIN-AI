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

run "production_uses_vpc_application_subnets" {
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

  assert {
    condition = (
      local.eks_private_application_subnet_ids == module.vpc.private_application_subnet_ids &&
      local.eks_private_application_subnet_ids != module.vpc.public_subnet_ids &&
      local.eks_private_application_subnet_ids != module.vpc.private_data_subnet_ids
    )
    error_message = "Production EKS must consume only the VPC private application subnet output."
  }

  assert {
    condition     = module.eks.cluster_name == var.eks_cluster_name
    error_message = "Production must instantiate the configured EKS cluster."
  }
}
