# Staging Terraform root

This root owns the staging state boundary, AWS provider, VPC, and EKS module
calls. The example uses `10.10.0.0/16`, two AZs, one shared NAT Gateway, and one
small On-Demand managed node.

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
The example uses the documentation-only `192.0.2.0/24` range for restricted
public API access; replace it before any reviewed deployment. Network, endpoint,
Kubernetes version, and node settings remain configurable through the ignored
`terraform.tfvars`. No infrastructure has been deployed by this configuration.
