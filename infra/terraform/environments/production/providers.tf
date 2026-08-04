provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge(var.additional_tags, local.default_tags)
  }
}
