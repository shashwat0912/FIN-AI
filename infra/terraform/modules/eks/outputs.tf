output "cluster_name" {
  description = "EKS cluster name."
  value       = aws_eks_cluster.this.name
}

output "cluster_arn" {
  description = "EKS cluster ARN."
  value       = aws_eks_cluster.this.arn
}

output "cluster_endpoint" {
  description = "EKS API endpoint."
  value       = aws_eks_cluster.this.endpoint
  sensitive   = true
}

output "cluster_certificate_authority_data" {
  description = "Base64-encoded EKS cluster certificate authority data."
  value       = aws_eks_cluster.this.certificate_authority[0].data
  sensitive   = true
}

output "cluster_security_group_id" {
  description = "Security group created by EKS for the cluster control plane."
  value       = aws_eks_cluster.this.vpc_config[0].cluster_security_group_id
}

output "node_group_name" {
  description = "Managed node-group name."
  value       = aws_eks_node_group.this.node_group_name
}

output "node_iam_role_arn" {
  description = "Managed node-group IAM role ARN."
  value       = aws_iam_role.node.arn
}

output "cluster_iam_role_arn" {
  description = "EKS control-plane IAM role ARN."
  value       = aws_iam_role.cluster.arn
}

output "oidc_provider_arn" {
  description = "IAM OIDC provider ARN for future IRSA roles."
  value       = aws_iam_openid_connect_provider.this.arn
}

output "oidc_issuer_url" {
  description = "EKS OIDC issuer URL."
  value       = aws_eks_cluster.this.identity[0].oidc[0].issuer
}
