# Disposable local Kubernetes validation

This directory supports Phase 2B validation of Finance AI in the development-only `finance-ai-local` kind cluster. It does not deploy to AWS, EKS, EC2, or any shared environment.

## Prerequisites

Docker, kind, kubectl, Helm, OpenSSL, and curl must already be installed and available. The scripts never install software or modify Docker Desktop.

## Files and architecture

- `kind-config.yaml` creates one kind control-plane node.
- `postgres.yaml` runs PostgreSQL with runtime credentials and disposable `emptyDir` data.
- `redis.yaml` runs password-protected Redis without persistent storage.
- `migrate.yaml` runs `npm run db:migrate:deploy` from the backend image.
- `../helm/finance-ai/values-local.yaml` selects locally loaded immutable image tags and an existing runtime Secret.
- `../../scripts/k8s-local-validate.sh` runs the complete validation.
- `../../scripts/k8s-local-cleanup.sh` removes only the fixed local cluster.

```text
host Docker images → kind node
                       └─ finance-ai-local namespace
                          ├─ disposable PostgreSQL Service
                          ├─ disposable Redis Service
                          ├─ Prisma migration Job
                          └─ Helm release
                             ├─ frontend Service/Deployment
                             └─ backend Service/Deployment
```

PostgreSQL and Redis in this directory are disposable test dependencies, not production architecture. The production chart continues to require external PostgreSQL and Redis.

## Run the complete validation

From the repository root:

```sh
./scripts/k8s-local-validate.sh
```

The script:

1. checks prerequisites and rejects an existing `finance-ai-local` cluster;
2. lints and renders the local Helm values;
3. builds `finance-ai-frontend:phase-2b` and `finance-ai-backend:phase-2b` without pushing them;
4. creates the kind cluster using a temporary kubeconfig and loads both images;
5. generates PostgreSQL, Redis, JWT, CSRF, and HMAC material in memory and creates runtime-only Kubernetes Secrets without printing values;
6. waits for PostgreSQL and Redis;
7. runs and safely reports the Prisma migration Job;
8. installs the chart and checks `/livez`, `/readyz`, frontend `/health`, and frontend `/api/v1/health` proxy routing;
9. performs an expected-to-fail Helm upgrade with unreachable Redis, proving liveness remains healthy while readiness blocks rollout;
10. rolls back with Helm and repeats the health checks;
11. restarts the backend and captures graceful-shutdown events where observable;
12. deletes the disposable cluster after a successful run.

The backend image starts Node directly as PID 1 so Kubernetes SIGTERM reaches the existing graceful-shutdown coordinator.

Helm rollback creates a new revision; it does not remove the intentionally failed revision from release history.

Safe timeout overrides are available when a slower machine needs them:

```sh
K8S_LOCAL_TIMEOUT=300s K8S_LOCAL_BROKEN_TIMEOUT=60s ./scripts/k8s-local-validate.sh
```

## Cleanup

If validation is interrupted or fails, inspect the stage output and then run:

```sh
./scripts/k8s-local-cleanup.sh
```

Cleanup stops recorded validation port-forwards and deletes only the `finance-ai-local` kind cluster. It is idempotent and does not remove the two local Docker images.

## Troubleshooting

- **ImagePullBackOff:** confirm both `phase-2b` images exist in Docker, clean up, and rerun so the script can load them into kind. Local values use `imagePullPolicy: Never`.
- **Readiness failure:** inspect the PostgreSQL and Redis Deployment status and safe backend readiness events. Secret contents should never be printed.
- **Migration failure:** inspect the migration Job status and its redacted logs. The completed Job is retained until cluster deletion.
- **Occupied ports 13000, 13001, 13002, or 18080:** stop the local process using the port, run cleanup, and rerun validation.
- **Interrupted run:** use the cleanup command before rerunning; validation deliberately refuses to reuse an existing fixed-name cluster.

This workflow is local, disposable, and static/reproducible. It makes no production or cloud deployment claim.
