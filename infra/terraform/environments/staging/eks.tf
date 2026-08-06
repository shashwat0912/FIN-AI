module "eks" {
  source = "../../modules/eks"

  project_name                         = var.project_name
  environment                          = var.environment
  cluster_name                         = var.eks_cluster_name
  kubernetes_version                   = var.eks_kubernetes_version
  private_application_subnet_ids       = local.eks_private_application_subnet_ids
  cluster_endpoint_public_access       = var.eks_public_endpoint_access
  cluster_endpoint_public_access_cidrs = var.eks_public_endpoint_allowed_cidrs
  enabled_cluster_log_types            = var.eks_control_plane_log_types
  node_instance_types                  = var.eks_node_instance_types
  node_capacity_type                   = var.eks_node_capacity_type
  node_disk_size                       = var.eks_node_disk_size
  node_min_size                        = var.eks_node_min_size
  node_desired_size                    = var.eks_node_desired_size
  node_max_size                        = var.eks_node_max_size
  node_labels                          = var.eks_node_labels
  node_update_max_unavailable          = var.eks_node_update_max_unavailable
  common_tags                          = merge(var.additional_tags, local.default_tags)
}
