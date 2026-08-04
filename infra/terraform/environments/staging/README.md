# Staging Terraform root

This root owns the staging state boundary and AWS provider configuration. It has
no infrastructure resources in Phase 3A.

After the bootstrap bucket exists:

```sh
cp backend.hcl.example backend.hcl
cp terraform.tfvars.example terraform.tfvars
# Replace examples in the two ignored files.
terraform init -backend-config=backend.hcl
terraform plan -out=staging.tfplan
# Apply only a complete, reviewed saved plan after resources are added.
terraform apply staging.tfplan
```

The backend key is fixed to staging, uses S3 encryption, and acquires an S3
native lockfile. Do not copy production backend values or plans into this root.
