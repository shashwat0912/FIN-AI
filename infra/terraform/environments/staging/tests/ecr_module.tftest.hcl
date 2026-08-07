mock_provider "aws" {}

variables {
  project_name = "finance-ai"
  environment  = "staging"
  common_tags = {
    project      = "must-not-override"
    environment  = "must-not-override"
    "managed-by" = "must-not-override"
    component    = "must-not-override"
    Name         = "must-not-override"
  }
}

run "secure_repositories" {
  command = plan

  module {
    source = "../../modules/ecr"
  }

  assert {
    condition = (
      toset(keys(aws_ecr_repository.this)) == toset(["frontend", "backend"]) &&
      toset(keys(aws_ecr_lifecycle_policy.untagged)) == toset(["frontend", "backend"]) &&
      aws_ecr_repository.this["frontend"].name == "finance-ai-staging/frontend" &&
      aws_ecr_repository.this["backend"].name == "finance-ai-staging/backend"
    )
    error_message = "Repository and lifecycle identity must be keyed only by frontend and backend."
  }

  assert {
    condition = alltrue([
      for repository in aws_ecr_repository.this :
      repository.image_tag_mutability == "IMMUTABLE" &&
      repository.image_scanning_configuration[0].scan_on_push &&
      repository.encryption_configuration[0].encryption_type == "AES256" &&
      !repository.force_delete
    ])
    error_message = "Every repository must use immutable tags, push scanning, AES256, and safe deletion."
  }

  assert {
    condition = alltrue([
      for component, repository in aws_ecr_repository.this :
      repository.tags.project == var.project_name &&
      repository.tags.environment == var.environment &&
      repository.tags["managed-by"] == "terraform" &&
      repository.tags.component == component &&
      repository.tags.Name == repository.name
    ])
    error_message = "common_tags must not override required repository ownership tags."
  }

  assert {
    condition = alltrue([
      for component, lifecycle in aws_ecr_lifecycle_policy.untagged :
      lifecycle.repository == aws_ecr_repository.this[component].name &&
      length(jsondecode(lifecycle.policy).rules) == 1 &&
      jsondecode(lifecycle.policy).rules[0].rulePriority == 1 &&
      jsondecode(lifecycle.policy).rules[0].selection.tagStatus == "untagged" &&
      jsondecode(lifecycle.policy).rules[0].selection.countType == "sinceImagePushed" &&
      jsondecode(lifecycle.policy).rules[0].selection.countUnit == "days" &&
      jsondecode(lifecycle.policy).rules[0].selection.countNumber == 14 &&
      jsondecode(lifecycle.policy).rules[0].action.type == "expire"
    ])
    error_message = "Each lifecycle policy must expire only untagged images older than 14 days."
  }
}

run "reject_invalid_environment" {
  command = plan

  module {
    source = "../../modules/ecr"
  }

  variables {
    environment = "development"
  }

  expect_failures = [var.environment]
}

run "reject_invalid_project" {
  command = plan

  module {
    source = "../../modules/ecr"
  }

  variables {
    project_name = "Finance-AI"
  }

  expect_failures = [var.project_name]
}

run "reject_overlong_generated_name" {
  command = plan

  module {
    source = "../../modules/ecr"
  }

  variables {
    project_name = join("", [for index in range(237) : "a"])
    environment  = "production"
  }

  expect_failures = [var.project_name]
}
