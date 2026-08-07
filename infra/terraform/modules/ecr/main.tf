locals {
  repository_components = toset(["frontend", "backend"])
  repository_names = {
    for component in local.repository_components :
    component => "${var.project_name}-${var.environment}/${component}"
  }
  required_tags = {
    project      = var.project_name
    environment  = var.environment
    "managed-by" = "terraform"
  }
}

resource "aws_ecr_repository" "this" {
  for_each = local.repository_names

  name                 = each.value
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = merge(var.common_tags, local.required_tags, {
    Name      = each.value
    component = each.key
  })
}

resource "aws_ecr_lifecycle_policy" "untagged" {
  for_each = aws_ecr_repository.this

  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Expire untagged images older than 14 days"
      selection = {
        tagStatus   = "untagged"
        countType   = "sinceImagePushed"
        countUnit   = "days"
        countNumber = 14
      }
      action = {
        type = "expire"
      }
    }]
  })
}
