# RDS PostgreSQL module

This module creates one private Amazon RDS PostgreSQL DB instance. RDS is used
instead of PostgreSQL on EKS so AWS owns host replacement, engine patching,
backups, and Multi-AZ failover while EKS remains focused on application
workloads.

## Architecture and security

- The DB subnet group receives exactly two VPC private-data subnets. Public and
  private-application subnets are not module inputs.
- The DB instance is never publicly accessible. Its security group has no
  egress rules and one standalone ingress rule: TCP/5432 from the supplied EKS
  application security group. There is no CIDR or administrative ingress.
- Storage uses encrypted gp3 volumes with the AWS-managed RDS key. This phase
  does not create a customer KMS key.
- RDS generates and rotates the administrative/bootstrap master credential in
  Secrets Manager. Terraform accepts only the non-secret username and exports
  only the managed secret ARN. Finance-AI runtime workloads must not use the
  master DB user: a later database-access phase will define least-privilege
  runtime credentials, and Prisma migrations may use a separately controlled
  migration identity. This phase grants EKS no permission to read the master
  secret.

## Engine, availability, and recovery

The engine is PostgreSQL and its version is an input. Major upgrades are
disabled; automatic minor upgrades are enabled. Recheck the selected engine
version, extension needs, and regional RDS support immediately before a real
plan or apply. RDS Extended Support enrollment is explicitly disabled, so
deployment must fail instead of silently entering paid Extended Support when
the configured major version is no longer normally supported. No custom
parameter group is created.

RDS PostgreSQL 15 and later require SSL/TLS by default. The later
`DATABASE_URL`/cutover phase must explicitly configure and validate Prisma TLS
rather than assume the current EC2 connection settings transfer unchanged.

Multi-AZ is configurable. An RDS Multi-AZ DB instance maintains a synchronous
standby for availability and failover; it is not a read-scaling replica.
Automated-backup retention is configurable. A protected configuration must
retain backups and require a final snapshot. To destroy it, first review a
fresh plan, disable deletion protection, provide a unique final snapshot
identifier, and apply that reviewed change before destroying the instance.
Before destroying a replacement database, review that identifier and make it unique.
There is no `prevent_destroy`, so disposable staging remains destroyable.

## Observability

Database Insights uses Standard mode. AWS/provider compatibility still requires
the legacy-named `performance_insights_enabled` setting with the Standard-mode
seven-day retention; Advanced mode is not enabled. PostgreSQL and engine-upgrade
logs are exported to Terraform-owned CloudWatch log groups with explicit
retention. The DB instance explicitly depends on both log groups, whose names
match the RDS export paths, and the groups use normal Terraform destruction
rather than `skip_destroy`.

## Cost and phase boundaries

Primary costs are instance-hours, gp3 storage and autoscaled growth, backup and
snapshot storage beyond included allowances, CloudWatch Logs ingestion/storage,
and the production Multi-AZ standby. The committed sizes are examples and have
not been load-tested.

This phase is static infrastructure definition only: nothing has been deployed.
The existing EC2 PostgreSQL deployment is unchanged. Application cutover,
`DATABASE_URL` changes, Prisma migration execution, databases created by hand,
RDS Proxy, replicas, Aurora, Redis, IAM database authentication, dashboards,
and alarms are outside this phase.
