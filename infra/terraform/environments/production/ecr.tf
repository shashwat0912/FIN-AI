module "ecr" {
  source = "../../modules/ecr"

  project_name = var.project_name
  environment  = var.environment
  common_tags  = merge(var.additional_tags, local.default_tags)
}
