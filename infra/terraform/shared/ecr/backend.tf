terraform {
  backend "s3" {
    key          = "shared/ecr/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}
