# GitHub Actions AWS identity

This account-level root owns the GitHub OIDC provider and the dedicated IAM
role used to publish immutable frontend and backend images to the existing
staging ECR repositories. Its state is isolated at
`shared/github-actions/terraform.tfstate`; it does not read or own staging
environment state.

The role trust is limited to
`repo:shashwat0912/FIN-AI:ref:refs/heads/main` with audience
`sts.amazonaws.com`. Its inline policy can request an ECR authorization token
and push only to `finance-ai-staging/frontend` and
`finance-ai-staging/backend` in `ap-south-1`.

Initialize and plan this root with the existing bootstrap bucket:

```sh
cp backend.hcl.example backend.hcl
# Replace the bucket placeholder; keep the ap-south-1 region.
terraform init -backend-config=backend.hcl
terraform plan -out=github-actions.tfplan
```

After an approved Terraform apply, configure this GitHub Actions repository
variable under **Settings → Secrets and variables → Actions → Variables**:

- `AWS_ECR_PUBLISH_ROLE_ARN`: the exact value of
  `terraform output -raw ecr_publisher_role_arn`

The role ARN is an identifier, not a secret. Do not configure AWS access keys;
the CI workflow exchanges GitHub's OIDC token for short-lived role credentials.
