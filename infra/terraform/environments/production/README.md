# Production Terraform root

This root owns the production state boundary, AWS provider, VPC, EKS, ECR, RDS
PostgreSQL, and ElastiCache Valkey module calls. The example uses
`10.20.0.0/16`, two AZs, one NAT Gateway per AZ, two On-Demand managed nodes, a
Multi-AZ `db.m7g.large` database with 100 GiB of gp3 storage and a 500 GiB
autoscaling ceiling, and two `cache.t4g.small` Valkey nodes with automatic
failover. The database and cache sizing are illustrative and have not been
load-tested.

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
a final snapshot, and retains logs for 90 days. Valkey also uses only
private-data subnets, accepts TLS-only TCP/6379 only from the EKS security
group, retains snapshots for seven days, and exports engine and slow logs for
90 days. Its final snapshot identifier must be unique and reviewed immediately
before intentional destruction. The current EC2 Redis and application
configuration remain unchanged; a later cutover must configure and validate
TLS, IAM authentication, reconnect behavior, and the audited Lua paths. No
infrastructure, database, cache, or images have been created or
production-validated.
