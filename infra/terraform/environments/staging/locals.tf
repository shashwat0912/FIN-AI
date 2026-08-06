locals {
  name_prefix                        = "${var.project_name}-${var.environment}"
  eks_private_application_subnet_ids = module.vpc.private_application_subnet_ids
  default_tags = {
    project      = var.project_name
    environment  = var.environment
    "managed-by" = "terraform"
  }
}
