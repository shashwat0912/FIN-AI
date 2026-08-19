mock_provider "aws" {
  override_during = plan

  mock_resource "aws_iam_role" {
    defaults = {
      arn = "arn:aws:iam::123456789012:role/finance-ai-staging-backend"
    }
  }
}

variables {
  aws_region   = "us-east-1"
  environment  = "staging"
  project_name = "finance-ai"
  vpc_cidr     = "10.10.0.0/16"

  availability_zones                = ["us-east-1a", "us-east-1b"]
  public_subnet_cidrs               = { us-east-1a = "10.10.0.0/24", us-east-1b = "10.10.1.0/24" }
  private_application_subnet_cidrs  = { us-east-1a = "10.10.10.0/24", us-east-1b = "10.10.11.0/24" }
  private_data_subnet_cidrs         = { us-east-1a = "10.10.20.0/24", us-east-1b = "10.10.21.0/24" }
  nat_mode                          = "single"
  eks_cluster_name                  = "finance-ai-staging"
  eks_kubernetes_version            = "1.35"
  eks_public_endpoint_access        = true
  eks_public_endpoint_allowed_cidrs = ["192.0.2.0/24"]
  eks_control_plane_log_types       = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  eks_node_instance_types           = ["t3.medium"]
  eks_node_capacity_type            = "ON_DEMAND"
  eks_node_disk_size                = 30
  eks_node_min_size                 = 1
  eks_node_desired_size             = 1
  eks_node_max_size                 = 2
  eks_node_labels                   = { workload = "general" }
  eks_node_update_max_unavailable   = 1
}

run "staging_backend_irsa" {
  command = plan

  override_module {
    target          = module.eks
    override_during = plan
    outputs = {
      cluster_name                       = "finance-ai-staging"
      cluster_arn                        = "arn:aws:eks:us-east-1:123456789012:cluster/finance-ai-staging"
      cluster_endpoint                   = "https://mock.eks"
      cluster_certificate_authority_data = "mock-certificate"
      cluster_security_group_id          = "sg-eks-staging"
      node_group_name                    = "finance-ai-staging-default"
      node_iam_role_arn                  = "arn:aws:iam::123456789012:role/finance-ai-staging-nodes"
      cluster_iam_role_arn               = "arn:aws:iam::123456789012:role/finance-ai-staging-cluster"
      oidc_provider_arn                  = "arn:aws:iam::123456789012:oidc-provider/oidc.eks.us-east-1.amazonaws.com/id/STAGING"
      oidc_issuer_url                    = "https://oidc.eks.us-east-1.amazonaws.com/id/STAGING"
    }
  }

  override_module {
    target          = module.elasticache_valkey
    override_during = plan
    outputs = {
      replication_group_id     = "finance-ai-staging-valkey"
      primary_endpoint_address = "master.mock.cache.amazonaws.com"
      reader_endpoint_address  = "replica.mock.cache.amazonaws.com"
      port                     = 6379
      security_group_id        = "sg-valkey-staging"
      subnet_group_name        = "finance-ai-staging-valkey"
      replication_group_arn    = "arn:aws:elasticache:us-east-1:123456789012:replicationgroup:finance-ai-staging-valkey"
      application_user_id      = "finance-ai-staging-valkey-app"
      application_user_arn     = "arn:aws:elasticache:us-east-1:123456789012:user:finance-ai-staging-valkey-app"
      user_group_id            = "finance-ai-staging-valkey"
    }
  }

  assert {
    condition = (
      aws_iam_role.backend.name == "finance-ai-staging-backend" &&
      aws_iam_role.backend.tags.Name == "finance-ai-staging-backend" &&
      aws_iam_role.backend.tags.component == "backend"
    )
    error_message = "The staging backend role must follow the repository naming and tagging conventions."
  }

  assert {
    condition = (
      length(jsondecode(aws_iam_role.backend.assume_role_policy).Statement) == 1 &&
      jsondecode(aws_iam_role.backend.assume_role_policy).Statement[0].Effect == "Allow" &&
      jsondecode(aws_iam_role.backend.assume_role_policy).Statement[0].Action == "sts:AssumeRoleWithWebIdentity" &&
      length(keys(jsondecode(aws_iam_role.backend.assume_role_policy).Statement[0].Principal)) == 1 &&
      jsondecode(aws_iam_role.backend.assume_role_policy).Statement[0].Principal.Federated == "arn:aws:iam::123456789012:oidc-provider/oidc.eks.us-east-1.amazonaws.com/id/STAGING"
    )
    error_message = "The backend role must trust only the staging EKS OIDC provider through AssumeRoleWithWebIdentity."
  }

  assert {
    condition = (
      length(keys(jsondecode(aws_iam_role.backend.assume_role_policy).Statement[0].Condition)) == 1 &&
      contains(keys(jsondecode(aws_iam_role.backend.assume_role_policy).Statement[0].Condition), "StringEquals") &&
      !contains(keys(jsondecode(aws_iam_role.backend.assume_role_policy).Statement[0].Condition), "StringLike") &&
      length(keys(jsondecode(aws_iam_role.backend.assume_role_policy).Statement[0].Condition.StringEquals)) == 2 &&
      jsondecode(aws_iam_role.backend.assume_role_policy).Statement[0].Condition.StringEquals["oidc.eks.us-east-1.amazonaws.com/id/STAGING:aud"] == "sts.amazonaws.com" &&
      jsondecode(aws_iam_role.backend.assume_role_policy).Statement[0].Condition.StringEquals["oidc.eks.us-east-1.amazonaws.com/id/STAGING:sub"] == "system:serviceaccount:finance-ai-staging:finance-ai-backend" &&
      !strcontains(jsondecode(aws_iam_role.backend.assume_role_policy).Statement[0].Condition.StringEquals["oidc.eks.us-east-1.amazonaws.com/id/STAGING:sub"], "*")
    )
    error_message = "IRSA trust must use exact audience and finance-ai-staging/finance-ai-backend subject matches with no wildcards."
  }

  assert {
    condition = (
      length(jsondecode(aws_iam_role_policy.backend_valkey.policy).Statement) == 1 &&
      jsondecode(aws_iam_role_policy.backend_valkey.policy).Statement[0].Effect == "Allow" &&
      length(jsondecode(aws_iam_role_policy.backend_valkey.policy).Statement[0].Action) == 1 &&
      toset(jsondecode(aws_iam_role_policy.backend_valkey.policy).Statement[0].Action) == toset(["elasticache:Connect"]) &&
      length(jsondecode(aws_iam_role_policy.backend_valkey.policy).Statement[0].Resource) == 2 &&
      toset(jsondecode(aws_iam_role_policy.backend_valkey.policy).Statement[0].Resource) == toset([
        "arn:aws:elasticache:us-east-1:123456789012:replicationgroup:finance-ai-staging-valkey",
        "arn:aws:elasticache:us-east-1:123456789012:user:finance-ai-staging-valkey-app",
      ]) &&
      !contains(jsondecode(aws_iam_role_policy.backend_valkey.policy).Statement[0].Resource, "*") &&
      !contains(jsondecode(aws_iam_role_policy.backend_valkey.policy).Statement[0].Action, "elasticache:*")
    )
    error_message = "The backend policy must grant only elasticache:Connect on the staging replication group and application user."
  }

  assert {
    condition     = output.backend_irsa_role_arn == "arn:aws:iam::123456789012:role/finance-ai-staging-backend"
    error_message = "The staging root must expose only the backend IRSA role ARN needed by Helm."
  }
}
