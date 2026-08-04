# State bootstrap

This root creates only the S3 bucket used by the staging and production
Terraform backends. Its initial state is local by necessity; keep the resulting
state file secure and out of Git.

## Run after review

```sh
cp terraform.tfvars.example terraform.tfvars
# Replace the safe examples with an approved region and globally unique name.
terraform init
terraform plan -out=bootstrap.tfplan
terraform apply bootstrap.tfplan
```

The bucket name and region outputs feed the ignored `backend.hcl` files in both
environment roots. The bucket is versioned, encrypted with S3-managed keys,
blocked from public access, and protected by `prevent_destroy`. Native S3
lockfiles are used by environment backends, so no DynamoDB table is required.

`prevent_destroy` is a guardrail, not a backup. Retain the local bootstrap state
and use a separately approved recovery or state-migration procedure before
changing how this root is managed.
