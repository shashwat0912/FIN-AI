# Public portfolio demo runbook

This release preserves Terraform → EKS → ECR → Helm, PostgreSQL and Valkey.
It is a portfolio demonstration, not a regulated or real-money financial service.
No infrastructure was applied, no domain/certificate was invented, and no release
was pushed to main or automatically deployed.

## Before spending on AWS

Resolve the validation/security blockers in LAUNCH_REPORT.md first. Review the
saved production Terraform plan for cost (two NAT gateways, nodes, Multi-AZ RDS,
Valkey and ALB) and current EKS version/region support. Do not apply an example
unchanged. Use your approved AWS identity and private network access; the default
production EKS API is private. The existing bootstrap root must already have an
approved encrypted S3 state bucket. Never reuse staging state for production.

Application images currently ship the verified ap-south-1 RDS CA. The production
example and generated launch values use that region. Another region requires a
reviewed CA asset/hash and matching image first; do not bypass certificate checks.
The backend state bucket region can differ from the application region.

## Terraform first deployment (manual approval)

From the repository root:

```bash
set -euo pipefail
cp infra/terraform/environments/production/backend.hcl.example infra/terraform/environments/production/backend.hcl
cp infra/terraform/environments/production/terraform.tfvars.example infra/terraform/environments/production/terraform.tfvars
# Edit these ignored files: actual state bucket/region, AZs, CIDRs, cluster access,
# supported EKS version, sizing and tags. No credentials belong in tfvars.
terraform -chdir=infra/terraform/environments/production init -backend-config=backend.hcl
terraform -chdir=infra/terraform/environments/production plan -out=production.tfplan
# Stop here for human plan review and approval.
terraform -chdir=infra/terraform/environments/production apply production.tfplan
umask 077
terraform -chdir=infra/terraform/environments/production output -json > terraform.outputs.json
export AWS_REGION="$(terraform -chdir=infra/terraform/environments/production output -raw aws_region)"
export CLUSTER_NAME="$(terraform -chdir=infra/terraform/environments/production output -raw eks_cluster_name)"
export VPC_ID="$(terraform -chdir=infra/terraform/environments/production output -raw vpc_id)"
aws eks update-kubeconfig --name "$CLUSTER_NAME" --region "$AWS_REGION"
kubectl create namespace finance-ai
```

The output file includes cluster access metadata marked sensitive by Terraform;
keep it private and ignored. It is not a credentials file. Production outputs
include exact Valkey host/user/cache, backend IRSA and add-on IRSA role ARNs.
Backend trust is only `finance-ai/finance-ai-backend`; `elasticache:Connect` is
limited to the production replication group and application user ARNs.

## AWS Load Balancer Controller, ACM and DNS

Prerequisites: AWS VPC CNI provides routable pod IPs; EKS nodes have outbound AWS
API/image access via the existing NAT path; public subnets span two AZs and have
`kubernetes.io/role/elb=1`; node/control-plane security groups permit the controller
webhook on TCP/9443. Use the existing EKS cluster SG on managed nodes and verify
this path rather than opening ports publicly. Give your operator Kubernetes
cluster administration and AWS plan permissions separately from workload roles.

Terraform vendors the official controller v2.14.1 IAM policy with its resource-tag
conditions and scopes OIDC trust to `kube-system/aws-load-balancer-controller`.
The required create/describe wildcard actions are from the upstream AWS policy,
not a blanket `elasticloadbalancing:*` permission. Keep controller/policy versions
paired; review policy changes when upgrading. See the
[AWS installation guide](https://docs.aws.amazon.com/eks/latest/userguide/lbc-helm.html)
and [upstream pinned policy](https://github.com/kubernetes-sigs/aws-load-balancer-controller/blob/v2.14.1/docs/install/iam_policy.json).

```bash
helm repo add eks https://aws.github.io/eks-charts
helm repo update eks
# Select the chart whose appVersion is v2.14.1 and set LBC_CHART_VERSION.
helm search repo eks/aws-load-balancer-controller --versions
helm show chart eks/aws-load-balancer-controller --version "$LBC_CHART_VERSION"
helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  --namespace kube-system --version "$LBC_CHART_VERSION" --wait \
  --set clusterName="$CLUSTER_NAME" --set region="$AWS_REGION" --set vpcId="$VPC_ID" \
  --set serviceAccount.create=true --set serviceAccount.name=aws-load-balancer-controller \
  --set-string "serviceAccount.annotations.eks\.amazonaws\.com/role-arn=$(terraform -chdir=infra/terraform/environments/production output -raw load_balancer_controller_role_arn)"
```

Request and DNS-validate an ACM public certificate in the cluster region yourself;
its subject/SAN must cover PRODUCTION_HOSTNAME. Set ACM_CERTIFICATE_ARN only after
it is ISSUED. No certificate, Route53 record, or DNS provider is provisioned here.
There is no TLS Kubernetes Secret in the ALB/ACM path; `ingress.tls` is retained for
other existing chart consumers. There is no ingress-nginx/cert-manager dependency.

The chart uses an internet-facing ALB, IP targets, listeners 80/443 and a 443 HTTPS
redirect. Prefix `/api` routes unchanged to the backend Service, `/` to frontend.
Per-Service health checks use backend `/readyz` and frontend `/health` with 200
success. ALB terminates TLS, forwards HTTP privately, and sends forwarded HTTPS
headers to the existing Express proxy handling. See
[controller annotations](https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.14/guide/ingress/annotations/).

## Build/publish immutable images

CI publishes to the existing staging/shared ECR repositories; it does not roll
out production. Production repositories belong to the production Terraform root.
After checks pass, build and manually publish to its output URLs (or use an
approved promotion process preserving the image digests). The node example is
amd64; match the build platform to your selected node architecture.

```bash
export FRONTEND_REPOSITORY="$(python3 -c 'import json; print(json.load(open("terraform.outputs.json"))["ecr_repository_urls"]["value"]["frontend"])')"
export BACKEND_REPOSITORY="$(python3 -c 'import json; print(json.load(open("terraform.outputs.json"))["ecr_repository_urls"]["value"]["backend"])')"
export IMAGE_TAG="$(git rev-parse HEAD)"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${FRONTEND_REPOSITORY%%/*}"
docker build --platform linux/amd64 -f Dockerfile.frontend --build-arg VITE_API_BASE_URL=/api/v1 -t "$FRONTEND_REPOSITORY:$IMAGE_TAG" .
docker build --platform linux/amd64 -t "$BACKEND_REPOSITORY:$IMAGE_TAG" backend
trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 "$FRONTEND_REPOSITORY:$IMAGE_TAG"
trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 "$BACKEND_REPOSITORY:$IMAGE_TAG"
docker push "$FRONTEND_REPOSITORY:$IMAGE_TAG"
docker push "$BACKEND_REPOSITORY:$IMAGE_TAG"
export FRONTEND_IMAGE_DIGEST="$(aws ecr describe-images --repository-name "${FRONTEND_REPOSITORY#*/}" --image-ids imageTag="$IMAGE_TAG" --query 'imageDetails[0].imageDigest' --output text)"
export BACKEND_IMAGE_DIGEST="$(aws ecr describe-images --repository-name "${BACKEND_REPOSITORY#*/}" --image-ids imageTag="$IMAGE_TAG" --query 'imageDetails[0].imageDigest' --output text)"
```

## One-time DB bootstrap before Helm

Classify the target DB and verify backup/restore first. An already populated DB
without Prisma migration history requires a separately approved baseline decision;
never run a new baseline blindly. Use the full
[DB identity/bootstrap procedure](../backend/DATABASE_SETUP.md) with production
RDS outputs, verified TLS and the RDS-managed administrator password. Roles:
`financeai_admin` bootstraps; `financeai_migrator` owns schema objects;
`financeai_runtime` has DML only and no migration-history access.

From a controlled private shell with approved SG access to RDS TCP/5432, run the
interactive `roles.sql` and `\password` procedures in DATABASE_SETUP.md. Do not
open RDS publicly. Temporarily grant the migrator database CREATE solely for the
immutable initial baseline; run the pinned backend image's migration command;
then rerun `roles.sql` as admin immediately, even on failure, to revoke that grant.
A short-lived bootstrap host needs explicit temporary DB SG access if it does not
use the approved EKS SG. Remove that access after bootstrap.

```bash
# MIGRATOR_ENV_FILE is an operator-created private file containing DATABASE_URL.
# Run on a host that can reach the private DB, after the temporary CREATE grant.
docker run --rm --env-file "$MIGRATOR_ENV_FILE" \
  --env SSL_CERT_FILE=/app/prisma/certs/finance-ai-ca-bundle.pem \
  "$BACKEND_REPOSITORY@$BACKEND_IMAGE_DIGEST" node node_modules/prisma/build/index.js migrate deploy
# Immediately reconcile roles.sql as admin, verify CREATE=false, ownership,
# runtime table/default grants and runtime denial on _prisma_migrations.
```

Complete and verify reconciliation before the first Helm install. Do not use the
admin or migrator URL in runtime. The production hook uses the exact same backend
image/digest, runs `prisma migrate deploy` pre-install/pre-upgrade, has zero retries
and blocks failed releases. It uses its own unannotated ServiceAccount with token
automount off, no backend IRSA and only DATABASE_URL from the migrator Secret.
Failed Jobs remain for diagnosis. Before retrying, inspect their logs and delete
only the failed `finance-ai-migrate` Job; do not mark migrations applied to bypass
errors. Take DB backups before later migrations; Helm rollback cannot reverse SQL.

## Secrets and deployment inputs (names only)

`finance-ai-backend-secrets`: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET,
SECURITY_STATE_HMAC_SECRET, CSRF_SECRET, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.
`finance-ai-migrator-secrets`: DATABASE_URL (distinct DB role).
JWT/HMAC/CSRF secrets must be independent strong random values. SMTP must be a real
provider, use verified TLS and a verified sending identity; validate the signup
email path before opening DNS. Phone login is rejected in production. SMTP_HOST
and SMTP_PORT are non-secret configuration but can live in the same Secret to
preserve the existing interface. Optional: OPENAI_API_KEY (only for OpenAI mode).
Sentry is not enabled; SENTRY_DSN/VITE_SENTRY_DSN have no effect.
Never put provider credentials in VITE variables or image build args.

Operator inputs: PRODUCTION_HOSTNAME, ACM_CERTIFICATE_ARN, FRONTEND_IMAGE_DIGEST,
BACKEND_IMAGE_DIGEST, AWS_REGION, CLUSTER_NAME, VPC_ID, LBC_CHART_VERSION,
CLOUDWATCH_ADDON_VERSION, EKS_VERSION, RUNTIME_ENV_FILE, MIGRATOR_ENV_FILE.
Generated Helm configuration: REDIS_AUTH_MODE, REDIS_HOST, REDIS_PORT,
REDIS_USERNAME, REDIS_IAM_CACHE_NAME, AWS_REGION, CORS_ORIGIN, JWT_EXPIRES_IN,
JWT_REFRESH_EXPIRES_IN; backend ServiceAccount annotation eks.amazonaws.com/role-arn.
Production uses a 15-minute access token and retains the 30-day refresh lifetime.
Refresh tokens remain database records; the rebuilt backend verifies their JWT
signature before looking them up.

### Mandatory fresh authentication boundary

Historical JWT external use is **C — unknown**, not proven local-only. The new
public demo must use brand-new independent cryptographic JWT_SECRET and
JWT_REFRESH_SECRET, a fresh runtime Secret, and a fresh database without imported
refresh-token/session records. Do not copy old EC2/local env files, Secrets, auth
volumes or database snapshots. Do not route this demo to old accepting processes.
Production startup rejects both known historical values in either JWT role.
That guard supplements fresh generation; it cannot certify an arbitrary supplied
key as new. Old EC2/shared environments remain untrusted pending owner-side
rotation/session revocation or decommissioning; see SECRET_SCAN_REVIEW.md.

For the future operator step, set RUNTIME_ENV_FILE to a new private path outside
this repository. This creates the file exclusively with mode 0600 and writes two
independent 64-byte random keys without printing them; it refuses an existing file:

```bash
export RUNTIME_ENV_FILE=/absolute/private/path/new-demo-runtime.env
python3 - <<'PY'
import os, secrets
fd = os.open(os.environ['RUNTIME_ENV_FILE'], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as output:
    for name in ('JWT_SECRET', 'JWT_REFRESH_SECRET'):
        output.write(f'{name}={secrets.token_hex(64)}\n')
PY
```

Fill the other required runtime names privately, including independently generated
HMAC/CSRF values. Create both Secrets below; creation must fail if an existing
Secret would be reused. After migration, use a private PGSERVICE connection to the
new DB and confirm no refresh records exist before public traffic:

```bash
# Configure PGSERVICE privately for the new demo DB; never put credentials in argv.
psql --no-psqlrc --set=ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.refresh_tokens) THEN
    RAISE EXCEPTION 'New demo contains old refresh sessions';
  END IF;
END; $$;
SQL
```

After rollout, confirm all pods run the rebuilt image/new Secret, old access and
refresh signatures return 401, and a fresh email login/refresh succeeds. Import no
old authentication/session data later. These are deployment requirements, not
steps executed by this repository audit.

Create the two Secrets from private files outside the repository with permission 0600. Do not echo them, commit them or render their values into a public artifact:

```bash
kubectl --namespace finance-ai create secret generic finance-ai-backend-secrets --from-env-file="$RUNTIME_ENV_FILE"
kubectl --namespace finance-ai create secret generic finance-ai-migrator-secrets --from-env-file="$MIGRATOR_ENV_FILE"
# Set PRODUCTION_HOSTNAME and ACM_CERTIFICATE_ARN to your approved values.
python3 scripts/production-values.py terraform.outputs.json > production.generated.json
helm lint deploy/helm/finance-ai -f deploy/helm/finance-ai/values-production.yaml -f production.generated.json
helm template finance-ai deploy/helm/finance-ai --namespace finance-ai -f deploy/helm/finance-ai/values-production.yaml -f production.generated.json > /tmp/finance-ai-reviewed-manifest.yaml
# Review the manifest, DB reconciliation and inputs, then approve the install.
helm upgrade --install finance-ai deploy/helm/finance-ai --namespace finance-ai \
  -f deploy/helm/finance-ai/values-production.yaml -f production.generated.json \
  --wait --atomic --timeout 10m
kubectl --namespace finance-ai get ingress,pods,jobs
kubectl --namespace finance-ai get ingress finance-ai -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

The base production values intentionally keep ingress disabled and conspicuous
REQUIRED inputs so lint/template work without invented identifiers. Do not deploy
that file alone. Enabling publicDemo ingress enforces certificate, CORS/host,
IRSA, immutable digests, separate migration Secret and real Valkey overrides.
The generator rejects missing inputs and unsupported certificate/CA regions.

After the ALB exists and both target groups are healthy, create an operator-managed
DNS CNAME or zone-apex alias to its hostname. Confirm HTTPS chain/hostname,
HTTP→HTTPS redirect, `/`, email login and `/api/v1/health` from outside AWS.
Use the real hostname; an ALB DNS URL does not match your ACM domain certificate.

## Minimal AWS observability

The backend logs structured JSON to stdout/stderr; no OTP values are logged.
Install CloudWatch Observability (CloudWatch Agent + Fluent Bit) with the dedicated
Terraform cloudwatch_role_arn; never give this role to backend/migration pods.
Select a supported add-on version from AWS and inspect its configuration schema.
Disable Application Signals/APM auto instrumentation and accelerated metrics;
keep container logs and enhanced Container Insights. No Prometheus/Grafana stack.
See [AWS CloudWatch installation/configuration](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/install-CloudWatch-Observability-EKS-addon.html).

```bash
aws eks describe-addon-versions --addon-name amazon-cloudwatch-observability --kubernetes-version "$EKS_VERSION"
aws eks describe-addon-configuration --addon-name amazon-cloudwatch-observability --addon-version "$CLOUDWATCH_ADDON_VERSION"
# Prepare a private non-secret cloudwatch.config.json from that version's schema.
# Include containerLogs.enabled=true and manager.applicationSignals.autoMonitor.monitorAllServices=false.
# Override agent.config to collect kubernetes metrics only, with cluster_name=$CLUSTER_NAME,
# enhanced_container_insights=true, accelerated_compute_metrics=false; exclude application_signals/traces.
aws eks create-addon --cluster-name "$CLUSTER_NAME" --addon-name amazon-cloudwatch-observability \
  --addon-version "$CLOUDWATCH_ADDON_VERSION" \
  --service-account-role-arn "$(terraform -chdir=infra/terraform/environments/production output -raw cloudwatch_role_arn)" \
  --configuration-values file://cloudwatch.config.json
kubectl --namespace amazon-cloudwatch get serviceaccounts,pods
```

Verify both collector ServiceAccounts have the expected role annotation and that
logs/metrics arrive. The supplied role trusts cloudwatch-agent and fluent-bit in
amazon-cloudwatch; it attaches AWS CloudWatchAgentServerPolicy. This is broader
than an app writer role and is isolated to the AWS-supported collector workload.
Terraform sets 30-day container log retention. Control-plane audit/authenticator
logs and RDS/Valkey engine logs use the existing Terraform log settings. Sentry was
removed because it was nonfunctional; browser warnings/errors use the console.

Terraform prepares SNS-backed alarms for RDS CPU/free disk, primary Valkey engine
CPU/memory, and failed EKS nodes. Subscribe/confirm a real operator
email on alerts_topic_arn through the AWS console; no email is stored in source.
Check the actual Valkey CacheClusterId and CacheNodeId metric dimensions after
apply (primary normally ends -001). The node alarm uses the documented
cluster_failed_node_count metric with ClusterName; cumulative pod restart counts
are inspected in Container Insights rather than used as a permanent alarm.
Missing data is surfaced as INSUFFICIENT_DATA, not OK.
Use EKS pod status/events and Container Insights to investigate Pending,
CrashLoopBackOff, OOMKilled, node failures and restarts. RDS Enhanced Monitoring is
not added; built-in RDS metrics/logs suffice for this demo. Verify alarm delivery
by an approved alarm state test, then restore its state. Add ALB target/5xx alarms
using the created ALB/target-group dimensions once its identifiers exist.

## Browser smoke and security checks

Local smoke runs the existing development OTP response only against a disposable
PostgreSQL `_test` DB; its launcher forces local deterministic AI/embeddings and
clears SMTP configuration. Prepare the DB before running:

```bash
npm ci
npm --prefix backend ci
npm --prefix backend run db:generate
npm --prefix backend run test:db:up
npm --prefix backend run test:db:prepare
npx playwright install chromium
npm run test:smoke
```

Against staging set SMOKE_BASE_URL to its HTTPS origin (no trailing slash),
SMOKE_EMAIL to an isolated test inbox, and SMOKE_MAILPIT_URL to an operator-only
SMTP sink API. Configure staging SMTP to that sink in a test-only deployment and
use AI_PROVIDER=local/EMBEDDING_PROVIDER=local. Never expose the inbox publicly or
point production mail to it. The test polls mail for the generated code; there is
no fixed OTP or production auth bypass. Staging tests require network access to
both the app and inbox API. CI uses only its PostgreSQL service/local deterministic
providers, with no paid external dependencies.

The smoke checks load, real email OTP login, dashboard, persisted transaction,
goal create/update, deterministic advisor endpoint, session refresh and server
logout/revocation. Transaction/goal fixtures are removed, but a test user and OTP
rate-limit records remain; use only disposable local/staging data. Failure traces
can contain session tokens: keep them private and short-lived. Automated CI has
no production deployment job.

CI scans full Git history with Gitleaks and fails on unreviewed secrets; it audits
runtime npm dependencies at high severity and uses Trivy for filesystem secrets
and fixable high/critical filesystem/image vulnerabilities. No global ignore is
added. Unfixed vulnerabilities and moderate findings require review even when
they do not fail this gate. The scoped @prisma/config → deepmerge-ts override fixes
CVE-2026-40345; remove it when the pinned Prisma release supplies a fixed upstream
dependency. Its major-version behavior change is checked through generate,
migrations and DB tests; no Prisma major upgrade is introduced.
