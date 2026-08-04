# Terraform foundation

This directory establishes the Phase 3A Terraform workflow without provisioning
application infrastructure. It contains one bootstrap root for the remote-state
bucket and separate, currently empty, roots for staging and production.

## Layout

```text
bootstrap/                S3 remote-state bucket only
environments/staging/     staging state boundary and AWS provider
environments/production/  production state boundary and AWS provider
```

The environment roots intentionally contain no VPC, EKS, database, Redis, IAM,
DNS, certificate, secret, observability, or application resources. Those belong
to later phases after the state boundary is reviewed.

## Prerequisites

- Terraform 1.10 or newer (CI uses 1.15.8). Version 1.10 is the minimum
  because these backends depend on native S3 `use_lockfile` support.
- AWS credentials from Terraform's standard AWS credential chain for operations
  that contact AWS
- Permission to create and configure an S3 bucket when running the bootstrap

Local validation does not need AWS credentials and does not contact AWS:

```sh
./scripts/terraform-validate.sh
```

## Bootstrap remote state

The bootstrap root deliberately starts with local state because the remote bucket
does not exist yet. Keep that local state secure, never commit it, and back it up
according to the team's state-recovery procedure.

```sh
cd infra/terraform/bootstrap
cp terraform.tfvars.example terraform.tfvars
# Replace only the example region and globally unique bucket name.
terraform init
terraform plan -out=bootstrap.tfplan
# Review the complete plan before explicitly applying it.
terraform apply bootstrap.tfplan
```

The bucket has versioning, S3-managed encryption, public-access blocking,
bucket-owner-enforced ownership, and Terraform deletion protection. Phase 3A
does not create a DynamoDB lock table: the environment roots use S3's native
lockfile support.

## Initialize an environment

After the bootstrap apply has been reviewed and completed, copy its bucket name
and region into an ignored `backend.hcl` file. Staging and production use distinct
fixed object keys. Backend blocks are initialized before normal input variables
are evaluated, so backend configuration cannot reference Terraform variables.

```sh
cd infra/terraform/environments/staging
cp backend.hcl.example backend.hcl
cp terraform.tfvars.example terraform.tfvars
# Replace the examples in both ignored files.
terraform init -backend-config=backend.hcl
terraform plan -out=staging.tfplan
# Apply only a reviewed saved plan once later phases add resources.
terraform apply staging.tfplan
```

Use the same process under `environments/production`; never reuse one
environment's backend configuration or plan file for the other.

Terraform uses the normal AWS SDK credential chain. Prefer short-lived workload
identity in CI and an approved profile or federated session locally. Do not put
access keys, account IDs, bucket names, credentials, or secret values in tracked
Terraform files or example files. Never commit state, saved plans, real tfvars,
or `backend.hcl` files.

## CI and scope

`.github/workflows/terraform.yml` runs formatting, backend-free initialization,
and validation only when Terraform workflow files change. It cannot plan, apply,
or provision AWS resources.

The existing EC2/Docker Compose deployment remains unchanged. Migrating that
workload, adding reusable modules, configuring the AWS estate, and deciding how
to manage the bootstrap root's state are explicit follow-up work, not Phase 3A.
The next planned infrastructure phase is VPC and networking.
