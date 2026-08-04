locals {
  name_prefix = "${var.project_name}-${var.environment}"
  default_tags = {
    project      = var.project_name
    environment  = var.environment
    "managed-by" = "terraform"
  }
}
