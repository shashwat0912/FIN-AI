output "state_bucket_name" {
  description = "Name to place in each environment's ignored backend.hcl file."
  value       = aws_s3_bucket.terraform_state.id
}

output "state_bucket_region" {
  description = "Region to place in each environment's ignored backend.hcl file."
  value       = var.aws_region
}
