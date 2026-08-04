terraform {
  backend "s3" {
    key          = "environments/staging/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}
