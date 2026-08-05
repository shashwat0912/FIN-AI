# Terraform foundation

This directory contains the remote-state bootstrap, isolated staging and
production roots, and the repository-owned VPC module used by both environments.

## Layout

```text
bootstrap/                S3 remote-state bucket only
environments/staging/     staging state boundary, provider, and VPC call
environments/production/  production state boundary, provider, and VPC call
modules/vpc/              reusable two-AZ network
```

## Network architecture

Each environment defines two public, two private application, and two private
data subnets across two availability zones:

```text
Internet
   |
Internet Gateway
   |
Public subnets
   |
NAT Gateway(s)
   |
Private application subnets

Private data subnets: isolated from default internet routing
```

Public subnets are intended for future internet-facing load balancers and NAT
Gateways. Private application subnets are intended for future EKS workers and
workloads. Private data subnets are intended for future RDS PostgreSQL and
ElastiCache Redis; they have explicit route tables with no default route to an
Internet or NAT Gateway.

Staging examples use `10.10.0.0/16` and one shared NAT Gateway. Production
examples use the non-overlapping `10.20.0.0/16` range and one NAT Gateway per AZ.
NAT Gateways incur ongoing hourly and processing charges: `single` costs less
but depends on one AZ, while `per_az` costs more and aligns egress by AZ. `none`
creates no NAT or application default route.

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
validation, and mocked NAT-mode tests only when Terraform workflow files change.
It cannot contact AWS, apply, or provision AWS resources.

The existing EC2/Docker Compose deployment remains unchanged. EKS, ECR, RDS,
Redis, IAM workload roles, load balancers, endpoints, DNS, certificates,
security groups, flow logs, IPv6, Kubernetes resources, and Helm releases remain
deferred. This configuration has only been statically validated; no AWS
infrastructure has been deployed and no production-readiness claim is made.
