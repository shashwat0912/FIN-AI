module "vpc" {
  source = "../../modules/vpc"

  project_name                     = var.project_name
  environment                      = var.environment
  vpc_cidr                         = var.vpc_cidr
  availability_zones               = var.availability_zones
  public_subnet_cidrs              = var.public_subnet_cidrs
  private_application_subnet_cidrs = var.private_application_subnet_cidrs
  private_data_subnet_cidrs        = var.private_data_subnet_cidrs
  nat_mode                         = var.nat_mode
  common_tags                      = merge(var.additional_tags, local.default_tags)
}
