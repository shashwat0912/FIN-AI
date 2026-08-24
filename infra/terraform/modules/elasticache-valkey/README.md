# ElastiCache Valkey module

This module creates a private, node-based, cluster-mode-disabled ElastiCache
Valkey replication group for Finance AI. It deliberately does not create
serverless cache, Memcached, sharding, a global datastore, cross-region
replication, a custom parameter group, or a customer-managed KMS key.

ElastiCache keeps cache node replacement, patching, replication, and failover
outside the EKS workload lifecycle; running Redis in EKS would couple this
shared coordination layer to application pod and cluster operations.

## Compatibility and cutover boundary

The legacy deployment ran Redis 7 in Docker Compose on EC2. The backend uses
`ioredis` 5.10.0 and `rate-limit-redis` 4.3.1 for conversation state, security
rate limits and lockouts, and distributed job leases. The audited operations
are compatible with Valkey 7.2: `GET`, `SET`, `DEL`, `PTTL`, `INCR`, `DECR`,
`PEXPIRE`, `EVAL`, `EVALSHA`, `SCRIPT LOAD`, `PING`, `INFO`, `QUIT`, and
`CLIENT SETINFO` (sent by `ioredis` during connection setup).
Valkey 7.2 stays close to the existing Redis 7 behavior while providing a
current AWS-managed open-source cache engine. Regional engine and node-type
availability must still be confirmed before a reviewed deployment.

This module creates the AWS cache foundation. Application integration uses TLS,
IAM authentication, and the managed primary endpoint. The real client and Lua
scripts still require validation against Valkey before serving production
traffic.

## Resources and network boundary

The module owns:

- one subnet group containing exactly the two supplied private-data subnets;
- one standalone security group with no inline ingress or egress rules;
- one referenced-security-group ingress rule allowing only TCP/6379 from the
  EKS cluster security group;
- Terraform-managed CloudWatch log groups for engine and slow logs;
- one IAM-authenticated application user and one user group; and
- one node-based Valkey replication group.

The module therefore creates eight concrete resources per environment.

There is no public or CIDR-based cache ingress. At-rest encryption uses the
ElastiCache service-managed KMS key. Transit encryption is enabled in
`required` mode, so application integration must configure and validate TLS in
`ioredis`; legacy plain `redis://` settings cannot be copied unchanged.

## Authentication and least privilege

Valkey user groups do not require a default user; attaching the group
automatically disables default access, so the group contains only the Finance
AI application user. No static cache password or auth token is stored in
Terraform state. The application user uses ElastiCache IAM authentication and
is restricted to the audited key prefixes `conv:*`, `security:*`, and
`jobs:lease:*` plus only the audited commands listed above. It does not receive
`+@all` or `~*`.

This module does not grant an EKS identity permission to connect. The staging
environment root adds a backend IRSA role with `elasticache:Connect` restricted
to this replication group and application user. The client must generate IAM
authentication tokens, use the IAM user name and TLS endpoint, and the ACL must
be re-audited if runtime commands or key prefixes change.

## Availability, persistence, and operations

Staging uses one cost-conscious Graviton node without automatic failover or
Multi-AZ, so node maintenance or failure causes cache downtime. Production uses
one primary and one replica across availability zones with automatic failover;
clients must use the primary endpoint and tolerate reconnects during promotion.
Cluster mode remains disabled in both environments.

Automatic snapshots are retained for one day in staging and seven days in
production. Cache data remains disposable acceleration and coordination state,
not a system of record. Losing or failing over cache state can temporarily
affect rate limits, locks, leases, and cached conversation state. Snapshots
reduce operational recovery time but are not a database backup, zero-data-loss
recovery, or cross-region disaster-recovery design; restoring creates a cache
from the captured point in time. Production uses a static final snapshot
identifier. It must be unique at intentional destruction time and reviewed
before destroying a replacement cache; Terraform does not generate timestamps.

The daily snapshot window is `03:00-04:00` UTC and the weekly maintenance
window is `sun:04:00-sun:05:00` UTC. Automatic minor upgrades are enabled,
`apply_immediately` is false, and engine/slow logs have explicit 30-day staging
and 90-day production retention. The log groups remain Terraform-owned and do
not use `skip_destroy`. AWS requires apply-immediately when modifying
ElastiCache log-delivery configuration; any future exception to the normal
setting must be intentional and reviewed.

The example node sizes (`cache.t4g.micro` staging and `cache.t4g.small`
production) are cost-conscious starting points, not load-tested capacity.
Production adds the cost of a replica, longer snapshots, and longer log
retention. AWS currently positions node-based Valkey below equivalent Redis OSS
node pricing, but node count/type, backups, data transfer, and logging remain
cost drivers. Verify Region-specific pricing and revisit node size and retention
with observed load before launch.
