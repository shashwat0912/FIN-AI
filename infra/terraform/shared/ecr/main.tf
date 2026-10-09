locals {
  aws_region = "ap-south-1"
  default_tags = {
    project      = "finance-ai"
    environment  = "staging"
    "managed-by" = "terraform"
    owner        = "shashwat"
  }
}

module "ecr" {
  source = "../../modules/ecr"

  project_name = "finance-ai"
  environment  = "staging"
  common_tags  = local.default_tags
}
