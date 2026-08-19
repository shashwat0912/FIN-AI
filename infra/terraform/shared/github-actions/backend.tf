terraform {
  backend "s3" {
    key          = "shared/github-actions/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}
