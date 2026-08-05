# Production Terraform root

This root owns the production state boundary, AWS provider, and VPC module call.
The example uses `10.20.0.0/16`, two AZs, and one NAT Gateway per AZ.

After the bootstrap bucket exists:

```sh
cp backend.hcl.example backend.hcl
cp terraform.tfvars.example terraform.tfvars
# Replace examples in the two ignored files.
terraform init -backend-config=backend.hcl
terraform plan -out=production.tfplan
# Apply only a complete, reviewed saved plan after resources are added.
terraform apply production.tfplan
```

The backend key is fixed to production, uses S3 encryption, and acquires an S3
native lockfile. Production changes require their own review; do not reuse a
staging backend configuration or plan. The example network values remain
configurable through the ignored `terraform.tfvars`; no infrastructure has been
deployed by this configuration.
