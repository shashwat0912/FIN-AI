terraform {
  backend "s3" {
    key          = "environments/production/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}
