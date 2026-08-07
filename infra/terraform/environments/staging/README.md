# Staging Terraform root

This root owns the staging state boundary, AWS provider, VPC, EKS, ECR, and RDS
PostgreSQL module calls. The example uses `10.10.0.0/16`, two AZs, one shared
NAT Gateway, one small On-Demand managed node, and a single-AZ `db.t4g.micro`
database with 20 GiB of gp3 storage and a 100 GiB autoscaling ceiling.

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
Kubernetes version, node settings, and database capacity remain configurable
through the ignored `terraform.tfvars`. RDS uses only private-data subnets and
accepts PostgreSQL only from the EKS security group. Staging keeps seven days
of backups, skips the final snapshot when intentionally destroyed, and uses
30-day log retention. No infrastructure, database, or images have been created.
