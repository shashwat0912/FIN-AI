# Finance AI Helm chart

This chart renders the existing Finance AI frontend and backend containers as Kubernetes Deployments, ClusterIP Services, ConfigMaps, component-specific ServiceAccounts, and an optional Ingress.

## Prerequisites

- Helm 3 or 4
- Kubernetes 1.25 or newer
- External PostgreSQL and Redis services reachable from the cluster
- Built frontend and backend images
- An existing Kubernetes Secret named by `backend.existingSecret`

The production and local URL-auth Secrets must contain these keys by name:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CSRF_SECRET`
- `SECURITY_STATE_HMAC_SECRET`

Add `OPENAI_API_KEY` when OpenAI-backed features are enabled. Optional provider credentials such as `SMTP_USER`, `SMTP_PASS`, Stripe keys, and `SENTRY_DSN` belong in the same existing Secret when used. Never put those values in a chart values file.

Staging uses IAM-authenticated Valkey instead of `REDIS_URL`; its backend Secret must not contain a Redis IAM token or password. The non-secret Redis endpoint, username, cache name, and AWS region live in the backend ConfigMap. The `finance-ai-backend` ServiceAccount is annotated with the staging IRSA role; the frontend has a separate, unannotated ServiceAccount. Kubernetes API token automount remains disabled, while EKS injects the projected web-identity token used by the AWS SDK.

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

When a digest is set, the rendered image uses `repository@sha256:...` and ignores the tag. Use the same two digests with staging and production values to promote exactly the tested images.

## Scope and current limitations

This chart does not provision PostgreSQL, Redis, certificates, DNS, load balancers, AWS resources, monitoring, or secrets. It has only been statically validated unless a deployment is reported separately.

The backend image runs as UID/GID 1001 with a read-only root filesystem. The current official Nginx-based frontend image starts its master process as root to bind port 80, so the chart does not claim frontend non-root execution. A future image can switch to an unprivileged Nginx base and high port before enabling `runAsNonRoot` and a read-only root filesystem.

Production replicas are configurable, but replica count alone does not establish high availability; the external database, Redis, ingress, and cluster architecture must also be resilient.
