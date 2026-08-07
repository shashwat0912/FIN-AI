# Production Terraform root

This root owns the production state boundary, AWS provider, VPC, EKS, ECR, and
RDS PostgreSQL module calls. The example uses `10.20.0.0/16`, two AZs, one NAT
Gateway per AZ, two On-Demand managed nodes, and a Multi-AZ `db.m7g.large`
database with 100 GiB of gp3 storage and a 500 GiB autoscaling ceiling. The
database sizing is illustrative and has not been load-tested.

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
staging backend configuration or plan. The public EKS API endpoint is disabled
in the example. Network, endpoint, Kubernetes version, node settings, and
database capacity remain configurable through the ignored `terraform.tfvars`.
RDS uses only private-data subnets, accepts PostgreSQL only from the EKS
security group, retains backups for 30 days, has deletion protection, requires
a final snapshot, and retains logs for 90 days. No infrastructure, database, or
images have been created or production-validated.
