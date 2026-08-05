# VPC module

This module defines the two-AZ Finance AI network only: one VPC, public
subnets, private application subnets, isolated private data subnets, explicit
route tables, and optional NAT Gateways.

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

Private data subnets: VPC-local routes only; no default internet route
```

Public subnets are reserved for future internet-facing load balancers and NAT
Gateways. Private application subnets are intended for future EKS workers and
workloads. Private data subnets are intended for future RDS PostgreSQL and
ElastiCache Redis and deliberately have no NAT or Internet Gateway route.

## NAT modes

| Mode     | Gateways | Application egress                                                 |
| -------- | -------: | ------------------------------------------------------------------ |
| `none`   |        0 | No default route                                                   |
| `single` |        1 | Both AZs share the lexicographically first configured AZ's gateway |
| `per_az` |        2 | Each AZ uses its aligned public subnet's gateway                   |

NAT Gateways incur hourly and data-processing charges. `single` costs less but
creates an AZ dependency; `per_az` costs more and avoids that cross-AZ egress
dependency. The module does not calculate subnet overlap or VPC containment;
AWS rejects invalid overlap or containment during planning or application.

Availability zones are a set, and every subnet CIDR map is keyed by AZ. All
AZ-specific resources use those keys for stable Terraform identity, so merely
reordering configuration cannot reassign an AZ or replace another AZ's resources.

All taggable resources receive project, environment, managed-by, component,
and deterministic `Name` tags. Public and private application subnets include
the standard Kubernetes load-balancer discovery tags. Cluster-specific tags
are deferred until an EKS cluster exists.

This module does not create EKS, databases, caches, endpoints, security groups,
load balancers, DNS, certificates, IAM, flow logs, IPv6, or Kubernetes objects.
No infrastructure has been deployed by adding this configuration.
