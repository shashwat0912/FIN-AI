mock_provider "aws" {}

run "shared_ecr_wiring" {
  command = plan
  module { source = "../../shared/ecr" }
  assert {
    condition = module.ecr.repository_names == {
      frontend = "finance-ai-staging/frontend"
      backend  = "finance-ai-staging/backend"
    }
    error_message = "Shared ECR must retain the deployed repository names."
  }
}
