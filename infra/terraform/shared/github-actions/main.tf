data "aws_caller_identity" "current" {}

locals {
  aws_region       = "ap-south-1"
  github_oidc_url  = "https://token.actions.githubusercontent.com"
  github_oidc_host = "token.actions.githubusercontent.com"
  github_subject   = "repo:shashwat0912/FIN-AI:ref:refs/heads/main"
  ecr_repository_names = [
    "finance-ai-staging/backend",
    "finance-ai-staging/frontend",
  ]
  ecr_repository_arns = [
    for name in local.ecr_repository_names :
    "arn:aws:ecr:${local.aws_region}:${data.aws_caller_identity.current.account_id}:repository/${name}"
  ]
  ecr_push_actions = [
    "ecr:BatchCheckLayerAvailability",
    "ecr:BatchGetImage",
    "ecr:CompleteLayerUpload",
    "ecr:InitiateLayerUpload",
    "ecr:PutImage",
    "ecr:UploadLayerPart",
  ]
  default_tags = {
    project      = "finance-ai"
    environment  = "shared"
    "managed-by" = "terraform"
    component    = "github-actions"
  }
}

resource "aws_iam_openid_connect_provider" "github" {
  url            = local.github_oidc_url
  client_id_list = ["sts.amazonaws.com"]
}

resource "aws_iam_role" "ecr_publisher" {
  name        = "finance-ai-staging-ecr-publisher"
  description = "GitHub Actions publisher for Finance AI staging ECR images"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${local.github_oidc_host}:aud" = "sts.amazonaws.com"
          "${local.github_oidc_host}:sub" = local.github_subject
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "ecr_publisher" {
  name = "finance-ai-staging-ecr-push"
  role = aws_iam_role.ecr_publisher.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AuthorizeEcr"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid      = "PushStagingImages"
        Effect   = "Allow"
        Action   = local.ecr_push_actions
        Resource = local.ecr_repository_arns
      },
    ]
  })
}
