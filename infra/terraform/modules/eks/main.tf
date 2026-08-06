locals {
  node_group_name = "${var.cluster_name}-default"
  required_tags = {
    project      = var.project_name
    environment  = var.environment
    "managed-by" = "terraform"
    component    = "kubernetes"
  }
  tags = merge(var.common_tags, local.required_tags)

  cluster_policy_arns = {
    cluster = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  }
  node_policy_arns = {
    worker = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
    cni    = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
    ecr    = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPullOnly"
  }
}

resource "aws_iam_role" "cluster" {
  name = "${var.cluster_name}-cluster"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "eks.amazonaws.com" }
    }]
  })

  tags = merge(local.tags, {
    Name = "${var.cluster_name}-cluster"
  })
}

resource "aws_iam_role_policy_attachment" "cluster" {
  for_each = local.cluster_policy_arns

  role       = aws_iam_role.cluster.name
  policy_arn = each.value
}

resource "aws_eks_cluster" "this" {
  name                      = var.cluster_name
  role_arn                  = aws_iam_role.cluster.arn
  version                   = var.kubernetes_version
  enabled_cluster_log_types = sort(tolist(var.enabled_cluster_log_types))

  access_config {
    authentication_mode                         = "API"
    bootstrap_cluster_creator_admin_permissions = true
  }

  vpc_config {
    subnet_ids              = values(var.private_application_subnet_ids)
    endpoint_private_access = true
    endpoint_public_access  = var.cluster_endpoint_public_access
    public_access_cidrs     = var.cluster_endpoint_public_access ? sort(tolist(var.cluster_endpoint_public_access_cidrs)) : []
  }

  tags = merge(local.tags, {
    Name = var.cluster_name
  })

  depends_on = [aws_iam_role_policy_attachment.cluster]
}

resource "aws_iam_role" "node" {
  name = "${var.cluster_name}-nodes"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })

  tags = merge(local.tags, {
    Name = "${var.cluster_name}-nodes"
  })
}

resource "aws_iam_role_policy_attachment" "node" {
  for_each = local.node_policy_arns

  role       = aws_iam_role.node.name
  policy_arn = each.value
}

resource "aws_eks_node_group" "this" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = local.node_group_name
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = values(var.private_application_subnet_ids)
  version         = var.kubernetes_version
  instance_types  = sort(tolist(var.node_instance_types))
  capacity_type   = var.node_capacity_type
  disk_size       = var.node_disk_size
  labels          = var.node_labels

  scaling_config {
    min_size     = var.node_min_size
    desired_size = var.node_desired_size
    max_size     = var.node_max_size
  }

  update_config {
    max_unavailable = var.node_update_max_unavailable
  }

  tags = merge(local.tags, {
    Name = local.node_group_name
  })

  depends_on = [aws_iam_role_policy_attachment.node]
}

resource "aws_iam_openid_connect_provider" "this" {
  url            = aws_eks_cluster.this.identity[0].oidc[0].issuer
  client_id_list = ["sts.amazonaws.com"]

  tags = merge(local.tags, {
    Name = "${var.cluster_name}-oidc"
  })
}
