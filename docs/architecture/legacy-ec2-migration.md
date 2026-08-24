# Migration from EC2 to EKS

## Initial architecture

Finance AI initially ran as a host-oriented deployment:

```text
EC2
└── Docker Compose
    ├── Frontend
    ├── Backend
    ├── PostgreSQL
    └── Redis
```

GitHub Actions built images in GHCR and an optional workflow copied a Compose
manifest to the host and deployed over SSH.

## Problems identified

The repository showed several limits in that model:

- deployment depended on host paths, SSH credentials, and server-maintained state;
- the application, PostgreSQL, and Redis shared one container-host lifecycle;
- rollback depended on replacing Compose image references on that host;
- health checks did not provide Kubernetes dependency-aware traffic gating; and
- infrastructure and application release concerns were only partly represented
  as reviewed code.

## Target architecture

```text
Terraform → AWS VPC → ECR → EKS → Kubernetes → Helm
                         ├──────────────→ RDS PostgreSQL
                         └──────────────→ Valkey

GitHub Actions → OIDC → AWS
Backend pods  → IRSA → AWS services
```

Terraform defines isolated networking, EKS, immutable ECR repositories, private
RDS and Valkey services, IAM, and S3-backed state. Helm defines the frontend,
backend, dedicated Prisma migration job, probes, security contexts, and resource
budgets.

## Migration strategy

The EC2 deployment remained available while the AWS foundation, application
images, Helm chart, workload identity, database identities, TLS trust, and local
upgrade/rollback validation were developed incrementally. Database migration
was separated from application runtime before cutover so the runtime identity
does not own schema changes.

## Result

The current repository demonstrates Infrastructure as Code, immutable container
publishing, keyless GitHub-to-AWS authentication, pod workload identity, managed
data services, a pre-release migration gate, dependency-aware readiness, and a
controlled Helm upgrade and rollback path. Applying environment-specific Helm
releases remains an explicit operator action rather than an automated workflow.
