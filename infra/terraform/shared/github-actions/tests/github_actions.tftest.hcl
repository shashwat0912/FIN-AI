mock_provider "aws" {
  override_during = plan

  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "123456789012"
    }
  }

  mock_resource "aws_iam_openid_connect_provider" {
    defaults = {
      arn = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
    }
  }
}

run "main_branch_ecr_publisher" {
  command = plan

  assert {
    condition = (
      aws_iam_openid_connect_provider.github.url == "https://token.actions.githubusercontent.com" &&
      length(aws_iam_openid_connect_provider.github.client_id_list) == 1 &&
      one(aws_iam_openid_connect_provider.github.client_id_list) == "sts.amazonaws.com"
    )
    error_message = "GitHub OIDC must use the official provider URL and only the AWS STS audience."
  }

  assert {
    condition = (
      length(jsondecode(aws_iam_role.ecr_publisher.assume_role_policy).Statement) == 1 &&
      jsondecode(aws_iam_role.ecr_publisher.assume_role_policy).Statement[0].Effect == "Allow" &&
      jsondecode(aws_iam_role.ecr_publisher.assume_role_policy).Statement[0].Action == "sts:AssumeRoleWithWebIdentity" &&
      jsondecode(aws_iam_role.ecr_publisher.assume_role_policy).Statement[0].Principal.Federated == "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com" &&
      jsondecode(aws_iam_role.ecr_publisher.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com" &&
      jsondecode(aws_iam_role.ecr_publisher.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == "repo:shashwat0912/FIN-AI:ref:refs/heads/main" &&
      length(keys(jsondecode(aws_iam_role.ecr_publisher.assume_role_policy).Statement[0].Condition.StringEquals)) == 2 &&
      !contains(keys(jsondecode(aws_iam_role.ecr_publisher.assume_role_policy).Statement[0].Condition), "StringLike") &&
      !strcontains(jsondecode(aws_iam_role.ecr_publisher.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"], "*")
    )
    error_message = "The publisher trust must allow only shashwat0912/FIN-AI main with the AWS STS audience and no wildcard trust."
  }

  assert {
    condition = (
      length(jsondecode(aws_iam_role_policy.ecr_publisher.policy).Statement) == 2 &&
      toset(jsondecode(aws_iam_role_policy.ecr_publisher.policy).Statement[0].Action) == toset(["ecr:GetAuthorizationToken"]) &&
      jsondecode(aws_iam_role_policy.ecr_publisher.policy).Statement[0].Resource == "*" &&
      toset(jsondecode(aws_iam_role_policy.ecr_publisher.policy).Statement[1].Action) == toset([
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:CompleteLayerUpload",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart",
      ]) &&
      toset(jsondecode(aws_iam_role_policy.ecr_publisher.policy).Statement[1].Resource) == toset([
        "arn:aws:ecr:ap-south-1:123456789012:repository/finance-ai-staging/backend",
        "arn:aws:ecr:ap-south-1:123456789012:repository/finance-ai-staging/frontend",
      ]) &&
      !contains(flatten([for statement in jsondecode(aws_iam_role_policy.ecr_publisher.policy).Statement : statement.Action]), "ecr:*")
    )
    error_message = "The publisher policy must grant only the documented ECR push actions on the two staging repositories plus registry authentication."
  }
}
