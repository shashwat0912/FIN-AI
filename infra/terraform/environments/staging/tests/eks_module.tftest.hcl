mock_provider "aws" {}

variables {
  project_name       = "finance-ai"
  environment        = "staging"
  cluster_name       = "finance-ai-staging"
  kubernetes_version = "1.35"
  private_application_subnet_ids = {
    us-east-1a = "subnet-application-a"
    us-east-1b = "subnet-application-b"
  }
  cluster_endpoint_public_access       = false
  cluster_endpoint_public_access_cidrs = ["192.0.2.0/24"]
  enabled_cluster_log_types            = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  node_instance_types                  = ["t3.medium"]
  node_capacity_type                   = "ON_DEMAND"
  node_disk_size                       = 30
  node_min_size                        = 1
  node_desired_size                    = 1
  node_max_size                        = 2
  node_labels                          = { workload = "general" }
  node_update_max_unavailable          = 1
  common_tags = {
    project      = "must-not-override"
    environment  = "must-not-override"
    "managed-by" = "must-not-override"
    component    = "must-not-override"
    Name         = "must-not-override"
  }
}

run "private_cluster" {
  command = plan

  module {
    source = "../../modules/eks"
  }

  assert {
    condition = (
      toset(aws_eks_cluster.this.vpc_config[0].subnet_ids) == toset(values(var.private_application_subnet_ids)) &&
      toset(aws_eks_node_group.this.subnet_ids) == toset(values(var.private_application_subnet_ids))
    )
    error_message = "The control plane and managed nodes must use only private application subnets."
  }

  assert {
    condition = (
      aws_eks_cluster.this.vpc_config[0].endpoint_private_access &&
      !aws_eks_cluster.this.vpc_config[0].endpoint_public_access &&
      length(aws_eks_cluster.this.vpc_config[0].public_access_cidrs) == 0
    )
    error_message = "Private endpoint access must remain enabled and disabled public access must publish no CIDRs."
  }

  assert {
    condition = (
      aws_eks_cluster.this.access_config[0].authentication_mode == "API" &&
      aws_eks_cluster.this.access_config[0].bootstrap_cluster_creator_admin_permissions
    )
    error_message = "EKS API authentication and bootstrap cluster-creator administration must be explicit."
  }

  assert {
    condition = toset(aws_eks_cluster.this.enabled_cluster_log_types) == toset([
      "api",
      "audit",
      "authenticator",
      "controllerManager",
      "scheduler",
    ])
    error_message = "All required EKS control-plane logs must be configured."
  }

  assert {
    condition = toset([for attachment in aws_iam_role_policy_attachment.cluster : attachment.policy_arn]) == toset([
      "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
    ])
    error_message = "The cluster role must receive only AmazonEKSClusterPolicy."
  }

  assert {
    condition = toset([for attachment in aws_iam_role_policy_attachment.node : attachment.policy_arn]) == toset([
      "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
      "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
      "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPullOnly",
    ])
    error_message = "The node role must receive only the worker, CNI, and pull-only ECR policies."
  }

  assert {
    condition = alltrue(concat(
      [for attachment in aws_iam_role_policy_attachment.cluster : !strcontains(attachment.policy_arn, "AdministratorAccess")],
      [for attachment in aws_iam_role_policy_attachment.node : !strcontains(attachment.policy_arn, "AdministratorAccess")],
    ))
    error_message = "AdministratorAccess must not be attached."
  }

  assert {
    condition = (
      local.tags.project == var.project_name &&
      local.tags.environment == var.environment &&
      local.tags["managed-by"] == "terraform" &&
      local.tags.component == "kubernetes" &&
      aws_eks_cluster.this.tags.Name == var.cluster_name
    )
    error_message = "common_tags must not override required ownership or Name tags."
  }
}

run "restricted_public_endpoint" {
  command = plan

  module {
    source = "../../modules/eks"
  }

  variables {
    cluster_endpoint_public_access = true
  }

  assert {
    condition = (
      aws_eks_cluster.this.vpc_config[0].endpoint_private_access &&
      aws_eks_cluster.this.vpc_config[0].endpoint_public_access &&
      toset(aws_eks_cluster.this.vpc_config[0].public_access_cidrs) == toset(["192.0.2.0/24"])
    )
    error_message = "Enabled public access must retain private access and use only supplied restricted CIDRs."
  }
}

run "reject_public_endpoint_without_cidrs" {
  command = plan

  module {
    source = "../../modules/eks"
  }

  variables {
    cluster_endpoint_public_access       = true
    cluster_endpoint_public_access_cidrs = []
  }

  expect_failures = [var.cluster_endpoint_public_access_cidrs]
}

run "reject_unrestricted_public_endpoint" {
  command = plan

  module {
    source = "../../modules/eks"
  }

  variables {
    cluster_endpoint_public_access       = true
    cluster_endpoint_public_access_cidrs = ["0.0.0.0/0"]
  }

  expect_failures = [var.cluster_endpoint_public_access_cidrs]
}

run "reject_min_above_desired" {
  command = plan

  module {
    source = "../../modules/eks"
  }

  variables {
    node_min_size     = 2
    node_desired_size = 1
    node_max_size     = 3
  }

  expect_failures = [var.node_desired_size]
}

run "reject_desired_above_max" {
  command = plan

  module {
    source = "../../modules/eks"
  }

  variables {
    node_desired_size = 3
    node_max_size     = 2
  }

  expect_failures = [var.node_max_size]
}
