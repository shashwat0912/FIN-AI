# Finance AI Helm chart

This chart renders the existing Finance AI frontend and backend containers as Kubernetes Deployments, ClusterIP Services, ConfigMaps, component-specific ServiceAccounts, an optional Prisma migration Job, and an optional Ingress.

## Prerequisites

- Helm 3 or 4
- Kubernetes 1.25 or newer
- External PostgreSQL and Redis services reachable from the cluster
- Built frontend and backend images
- An existing Kubernetes Secret named by `backend.existingSecret`
- When `migration.enabled=true`, an existing Kubernetes Secret named by `migration.existingSecret`

The production and local URL-auth Secrets must contain these keys by name:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CSRF_SECRET`
- `SECURITY_STATE_HMAC_SECRET`

Add `OPENAI_API_KEY` when OpenAI-backed features are enabled. Optional provider credentials such as `SMTP_USER`, `SMTP_PASS`, Stripe keys, and `SENTRY_DSN` belong in the same existing Secret when used. Never put those values in a chart values file.

The migration Secret is separate from the backend Secret and contains only `DATABASE_URL`, using the `financeai_migrator` credentials and the verified RDS TLS parameters documented in `backend/DATABASE_SETUP.md`. The migration Job reads only that key; the backend Deployment continues to read only `backend.existingSecret`.

Staging uses IAM-authenticated Valkey instead of `REDIS_URL`; its backend Secret must not contain a Redis IAM token or password. The non-secret Redis endpoint, username, cache name, and AWS region live in the backend ConfigMap. The `finance-ai-backend` ServiceAccount is annotated with the staging IRSA role; the frontend has a separate, unannotated ServiceAccount. Kubernetes API token automount remains disabled, while EKS injects the projected web-identity token used by the AWS SDK.

## Migration release gate

Staging enables a deterministic `pre-install,pre-upgrade` Helm hook Job. Helm waits for the Job before applying application resources, so a failed migration fails the release before either Deployment is rolled out. The Job runs `npm run db:migrate:deploy` with the exact backend repository/tag/digest and pull policy.

The chart creates a dedicated `finance-ai-staging-migrate` ServiceAccount for the migration Job. Both the ServiceAccount and Pod disable token automount; the ServiceAccount has no IRSA/IAM annotation or RoleBinding, and the Job receives no AWS credential environment. The Pod and container reuse the backend non-root and restricted security contexts.

Hook lifecycle:

- The ServiceAccount is a `pre-install,pre-upgrade` hook with weight `-10`; `before-hook-creation` replaces any previous hook ServiceAccount before an install or upgrade. It deliberately has no `hook-succeeded` policy, so it still exists when the migration Job starts at weight `-5`.
- The Job has `backoffLimit: 0`, `parallelism: 1`, and `completions: 1`. A failed Prisma execution stops immediately, and its deterministic name prevents another migration Job for the same release.
- `hook-succeeded` removes successful Jobs so they cannot block later releases. Failed Jobs and their Pod logs remain until an operator inspects and explicitly deletes the failed Job.
- After success, the unprivileged ServiceAccount remains for the next upgrade. Helm does not manage hook resources during uninstall, so explicitly remove that ServiceAccount and any retained failed migration Job after uninstalling the release.

The first immutable baseline is a special bootstrap operation: complete the temporary database `CREATE` grant, baseline migration, and post-migration `roles.sql` reconciliation from `backend/DATABASE_SETUP.md` before the first Helm install. The first hook then verifies that no migration remains before allowing the Deployments to start; it must not leave the temporary privilege window open during rollout.

Migration is disabled by default and in local and production values. The existing `deploy/local/migrate.yaml` flow remains unchanged.

## Render

Replace the example repositories, hostnames, TLS Secret names, and existing backend Secret names before use.

```sh
helm lint deploy/helm/finance-ai -f deploy/helm/finance-ai/values-staging.yaml
helm template finance-ai-staging deploy/helm/finance-ai \
  --namespace finance-ai-staging \
  -f deploy/helm/finance-ai/values-staging.yaml

helm lint deploy/helm/finance-ai -f deploy/helm/finance-ai/values-production.yaml
helm template finance-ai deploy/helm/finance-ai \
  --namespace finance-ai \
  -f deploy/helm/finance-ai/values-production.yaml

K8S_LOCAL_STATIC_ONLY=true ./scripts/k8s-local-validate.sh
```

## Install, upgrade, and roll back

```sh
helm upgrade --install finance-ai deploy/helm/finance-ai \
  --namespace finance-ai \
  --create-namespace \
  -f deploy/helm/finance-ai/values-production.yaml

helm rollback finance-ai REVISION --namespace finance-ai
```

Supply immutable digests without changing the chart:

```sh
helm upgrade --install finance-ai deploy/helm/finance-ai \
  --namespace finance-ai \
  -f deploy/helm/finance-ai/values-production.yaml \
  --set-string 'backend.image.digest=sha256:BACKEND_DIGEST' \
  --set-string 'frontend.image.digest=sha256:FRONTEND_DIGEST'
```

When a digest is set, the rendered image uses `repository@sha256:...` and ignores the tag. The migration Job automatically uses the backend digest. Use the same two application digests with staging and production values to promote exactly the tested images.

## Scope and current limitations

This chart does not provision PostgreSQL, Redis, certificates, DNS, load balancers, AWS resources, monitoring, or secrets. It has only been statically validated unless a deployment is reported separately.

The backend image runs as UID/GID 1001 with a read-only root filesystem. The current official Nginx-based frontend image starts its master process as root to bind port 80, so the chart does not claim frontend non-root execution. A future image can switch to an unprivileged Nginx base and high port before enabling `runAsNonRoot` and a read-only root filesystem.

Production replicas are configurable, but replica count alone does not establish high availability; the external database, Redis, ingress, and cluster architecture must also be resilient.
