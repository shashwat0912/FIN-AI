#!/usr/bin/env bash
set -euo pipefail

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly CLUSTER_NAME="finance-ai-local"
readonly CONTEXT="kind-finance-ai-local"
readonly NAMESPACE="finance-ai-local"
readonly RELEASE="finance-ai-local"
readonly BACKEND_IMAGE="finance-ai-backend:phase-2b"
readonly FRONTEND_IMAGE="finance-ai-frontend:phase-2b"
readonly BACKEND_SECRET="finance-ai-local-backend-secrets"
readonly BROKEN_BACKEND_SECRET="finance-ai-local-backend-secrets-broken"
readonly POSTGRES_SECRET="finance-ai-local-postgres"
readonly REDIS_SECRET="finance-ai-local-redis"
readonly MIGRATION_JOB="finance-ai-local-migrate"
readonly APP_TIMEOUT="${K8S_LOCAL_TIMEOUT:-180s}"
readonly BROKEN_ROLLOUT_TIMEOUT="${K8S_LOCAL_BROKEN_TIMEOUT:-45s}"
readonly BACKEND_PORT="13000"
readonly FRONTEND_PORT="18080"
readonly BROKEN_BACKEND_PORT="13001"
readonly TERMINATING_BACKEND_PORT="13002"
readonly CHART_DIR="$ROOT_DIR/deploy/helm/finance-ai"
readonly LOCAL_VALUES="$CHART_DIR/values-local.yaml"
readonly STAGING_VALUES="$CHART_DIR/values-staging.yaml"
readonly PRODUCTION_VALUES="$CHART_DIR/values-production.yaml"
readonly LOCAL_DIR="$ROOT_DIR/deploy/local"
readonly PID_FILE="${TMPDIR:-/tmp}/finance-ai-local-port-forwards.pids"
readonly STATIC_ONLY="${K8S_LOCAL_STATIC_ONLY:-false}"

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/finance-ai-local-validation.XXXXXX")"
readonly KUBECONFIG_FILE="$temp_dir/kubeconfig"
readonly MIGRATION_LOG="$temp_dir/migration.log"
readonly TERMINATION_LOG="$temp_dir/termination.log"
background_pids=()

stage() {
  echo
  echo "[phase-2b] $1"
}

fail() {
  echo "[phase-2b] ERROR: $1" >&2
  exit 1
}

assert_contains() {
  local file="$1"
  local value="$2"
  grep -Fq -- "$value" "$file" || fail "Expected rendered manifest to contain: $value"
}

assert_not_contains() {
  local file="$1"
  local value="$2"
  if grep -Fq -- "$value" "$file"; then
    fail "Rendered manifest must not contain: $value"
  fi
}

register_pid() {
  background_pids+=("$1")
  printf '%s\n' "$1" >> "$PID_FILE"
}

stop_pid() {
  local pid="$1"
  [[ -n "$pid" ]] || return 0
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
}

cleanup_runtime() {
  local pid
  for pid in "${background_pids[@]:-}"; do
    stop_pid "$pid"
  done
  if [[ "$STATIC_ONLY" != "true" ]]; then
    rm -f "$PID_FILE"
  fi
  rm -rf "$temp_dir"
}
trap cleanup_runtime EXIT INT TERM

k() {
  kubectl --kubeconfig "$KUBECONFIG_FILE" --context "$CONTEXT" "$@"
}

h() {
  helm --kubeconfig "$KUBECONFIG_FILE" --kube-context "$CONTEXT" "$@"
}

apply_secret() {
  local name="$1"
  shift
  k -n "$NAMESPACE" create secret generic "$name" "$@" --dry-run=client -o yaml |
    k -n "$NAMESPACE" apply -f - >/dev/null
}

wait_http() {
  local url="$1"
  local expected_status="$2"
  local attempt status
  for ((attempt = 1; attempt <= 30; attempt++)); do
    status="$(curl --silent --output /dev/null --write-out '%{http_code}' "$url" || true)"
    if [[ "$status" == "$expected_status" ]]; then
      return 0
    fi
    sleep 1
  done
  fail "HTTP check failed for local port ${url%%/*} (expected $expected_status, got ${status:-none})"
}

start_forward() {
  local resource="$1"
  local ports="$2"
  local log_file="$3"
  k -n "$NAMESPACE" port-forward "$resource" "$ports" >"$log_file" 2>&1 &
  FORWARD_PID=$!
  register_pid "$FORWARD_PID"
}

check_healthy_services() {
  local backend_pid frontend_pid
  start_forward "service/${RELEASE}-backend" "$BACKEND_PORT:3000" "$temp_dir/backend-forward.log"
  backend_pid="$FORWARD_PID"
  start_forward "service/${RELEASE}-frontend" "$FRONTEND_PORT:80" "$temp_dir/frontend-forward.log"
  frontend_pid="$FORWARD_PID"

  wait_http "http://127.0.0.1:$BACKEND_PORT/livez" 200
  wait_http "http://127.0.0.1:$BACKEND_PORT/readyz" 200
  wait_http "http://127.0.0.1:$FRONTEND_PORT/health" 200
  wait_http "http://127.0.0.1:$FRONTEND_PORT/api/v1/health" 200

  stop_pid "$backend_pid"
  stop_pid "$frontend_pid"
  echo "Service checks passed: backend live/ready, frontend health, frontend-to-backend proxy"
}

safe_migration_logs() {
  local secret_value
  k -n "$NAMESPACE" logs "job/$MIGRATION_JOB" > "$MIGRATION_LOG"
  for secret_value in "$POSTGRES_PASSWORD" "$REDIS_PASSWORD" "$JWT_SECRET" \
    "$JWT_REFRESH_SECRET" "$CSRF_SECRET" "$SECURITY_STATE_HMAC_SECRET"; do
    if grep -Fq "$secret_value" "$MIGRATION_LOG"; then
      fail "Migration logs contained generated secret material"
    fi
  done
  sed -E 's#(postgresql|redis)://[^[:space:]]+#[redacted connection string]#g' "$MIGRATION_LOG"
}

stage "Preflight"
command -v helm >/dev/null 2>&1 || fail "Missing required command: helm"
helm version --short

if [[ "$STATIC_ONLY" != "true" ]]; then
  for command_name in docker kind kubectl openssl curl; do
    command -v "$command_name" >/dev/null 2>&1 || fail "Missing required command: $command_name"
  done
  docker info >/dev/null
  docker version --format 'Docker client={{.Client.Version}} server={{.Server.Version}}'
  kind version
  kubectl version --client=true --output=yaml | grep 'gitVersion:' | head -n 1
fi

stage "Static chart validation"
default_render="$temp_dir/default.yaml"
staging_render="$temp_dir/staging.yaml"
staging_backend_sa="$temp_dir/staging-backend-serviceaccount.yaml"
staging_frontend_sa="$temp_dir/staging-frontend-serviceaccount.yaml"
staging_backend_deployment="$temp_dir/staging-backend-deployment.yaml"
staging_frontend_deployment="$temp_dir/staging-frontend-deployment.yaml"
staging_backend_config="$temp_dir/staging-backend-configmap.yaml"
staging_migration_sa="$temp_dir/staging-migration-serviceaccount.yaml"
staging_migration_job="$temp_dir/staging-migration-job.yaml"
staging_digest_backend="$temp_dir/staging-digest-backend.yaml"
staging_digest_migration="$temp_dir/staging-digest-migration.yaml"
local_render="$temp_dir/local.yaml"
production_render="$temp_dir/production.yaml"

helm lint "$CHART_DIR"
helm lint "$CHART_DIR" -f "$STAGING_VALUES"
helm lint "$CHART_DIR" -f "$LOCAL_VALUES"
helm lint "$CHART_DIR" -f "$PRODUCTION_VALUES"
if helm lint "$CHART_DIR" --set migration.enabled=true > "$temp_dir/missing-migration-secret.log" 2>&1; then
  fail "Schema accepted an enabled migration without migration.existingSecret"
fi
if helm lint "$CHART_DIR" --set migration.backoffLimit=-1 > "$temp_dir/invalid-migration-backoff.log" 2>&1; then
  fail "Schema accepted a negative migration.backoffLimit"
fi

helm template finance-ai "$CHART_DIR" --namespace finance-ai > "$default_render"
helm template finance-ai-staging "$CHART_DIR" --namespace finance-ai-staging -f "$STAGING_VALUES" > "$staging_render"
helm template finance-ai-staging "$CHART_DIR" --namespace finance-ai-staging -f "$STAGING_VALUES" \
  --show-only templates/serviceaccount.yaml --set frontend.serviceAccount.create=false > "$staging_backend_sa"
helm template finance-ai-staging "$CHART_DIR" --namespace finance-ai-staging -f "$STAGING_VALUES" \
  --show-only templates/serviceaccount.yaml --set backend.serviceAccount.create=false > "$staging_frontend_sa"
helm template finance-ai-staging "$CHART_DIR" --namespace finance-ai-staging -f "$STAGING_VALUES" \
  --show-only templates/backend-deployment.yaml > "$staging_backend_deployment"
helm template finance-ai-staging "$CHART_DIR" --namespace finance-ai-staging -f "$STAGING_VALUES" \
  --show-only templates/frontend-deployment.yaml > "$staging_frontend_deployment"
helm template finance-ai-staging "$CHART_DIR" --namespace finance-ai-staging -f "$STAGING_VALUES" \
  --show-only templates/backend-configmap.yaml > "$staging_backend_config"
helm template finance-ai-staging "$CHART_DIR" --namespace finance-ai-staging -f "$STAGING_VALUES" \
  --show-only templates/serviceaccount.yaml \
  --set backend.serviceAccount.create=false --set frontend.serviceAccount.create=false > "$staging_migration_sa"
helm template finance-ai-staging "$CHART_DIR" --namespace finance-ai-staging -f "$STAGING_VALUES" \
  --show-only templates/migration-job.yaml > "$staging_migration_job"
readonly TEST_BACKEND_DIGEST="sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
helm template finance-ai-staging "$CHART_DIR" --namespace finance-ai-staging -f "$STAGING_VALUES" \
  --set-string "backend.image.digest=$TEST_BACKEND_DIGEST" \
  --show-only templates/backend-deployment.yaml > "$staging_digest_backend"
helm template finance-ai-staging "$CHART_DIR" --namespace finance-ai-staging -f "$STAGING_VALUES" \
  --set-string "backend.image.digest=$TEST_BACKEND_DIGEST" \
  --show-only templates/migration-job.yaml > "$staging_digest_migration"
helm template "$RELEASE" "$CHART_DIR" --namespace "$NAMESPACE" -f "$LOCAL_VALUES" > "$local_render"
helm template finance-ai "$CHART_DIR" --namespace finance-ai -f "$PRODUCTION_VALUES" > "$production_render"

assert_contains "$staging_backend_sa" "name: finance-ai-backend"
assert_contains "$staging_backend_sa" "eks.amazonaws.com/role-arn: arn:aws:iam::765417709923:role/finance-ai-staging-backend"
assert_contains "$staging_backend_sa" "automountServiceAccountToken: false"
assert_contains "$staging_backend_deployment" "serviceAccountName: finance-ai-backend"
assert_contains "$staging_backend_deployment" "automountServiceAccountToken: false"
assert_contains "$staging_backend_deployment" "configMapRef:"
assert_contains "$staging_frontend_deployment" "serviceAccountName: finance-ai-staging-frontend"
assert_contains "$staging_frontend_deployment" "automountServiceAccountToken: false"
assert_not_contains "$staging_frontend_deployment" "serviceAccountName: finance-ai-backend"
assert_contains "$staging_frontend_sa" "name: finance-ai-staging-frontend"
assert_contains "$staging_frontend_sa" "automountServiceAccountToken: false"
assert_not_contains "$staging_frontend_sa" "eks.amazonaws.com/role-arn"

for value in \
  "kind: ServiceAccount" \
  "name: finance-ai-staging-migrate" \
  "app.kubernetes.io/component: migration" \
  '"helm.sh/hook": pre-install,pre-upgrade' \
  '"helm.sh/hook-weight": "-10"' \
  '"helm.sh/hook-delete-policy": before-hook-creation' \
  "automountServiceAccountToken: false"; do
  assert_contains "$staging_migration_sa" "$value"
done
assert_not_contains "$staging_migration_sa" "hook-succeeded"
assert_not_contains "$staging_migration_sa" "eks.amazonaws.com/role-arn"
assert_not_contains "$staging_migration_sa" "arn:aws:iam"

for value in \
  "kind: Job" \
  "name: finance-ai-staging-migrate" \
  '"helm.sh/hook": pre-install,pre-upgrade' \
  '"helm.sh/hook-weight": "-5"' \
  '"helm.sh/hook-delete-policy": hook-succeeded' \
  "backoffLimit: 0" \
  "completions: 1" \
  "parallelism: 1" \
  "serviceAccountName: finance-ai-staging-migrate" \
  "automountServiceAccountToken: false" \
  "restartPolicy: Never" \
  "runAsNonRoot: true" \
  "runAsUser: 1001" \
  'image: "finance-ai-backend:0.1.0"' \
  "- npm" \
  "- run" \
  "- db:migrate:deploy" \
  "name: SSL_CERT_FILE" \
  'value: "/app/prisma/certs/finance-ai-ca-bundle.pem"' \
  "name: DATABASE_URL" \
  "name: finance-ai-migrator-secrets-staging" \
  "key: DATABASE_URL"; do
  assert_contains "$staging_migration_job" "$value"
done

assert_not_contains "$staging_migration_job" "finance-ai-backend-secrets-staging"
assert_not_contains "$staging_migration_job" "serviceAccountName: default"
assert_not_contains "$staging_migration_job" "serviceAccountName: finance-ai-backend"
assert_not_contains "$staging_migration_job" "eks.amazonaws.com/role-arn"
assert_not_contains "$staging_migration_job" "arn:aws:iam"
assert_not_contains "$staging_migration_job" "hook-failed"
assert_not_contains "$staging_migration_job" "before-hook-creation"
assert_not_contains "$staging_migration_job" "postgresql://"
assert_not_contains "$staging_migration_job" "postgres://"
for value in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_ROLE_ARN AWS_WEB_IDENTITY_TOKEN_FILE AWS_CONTAINER_CREDENTIALS_FULL_URI AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE; do
  assert_not_contains "$staging_migration_job" "$value"
done

assert_contains "$staging_backend_deployment" "name: finance-ai-backend-secrets-staging"
assert_not_contains "$staging_backend_deployment" "finance-ai-migrator-secrets-staging"
assert_contains "$staging_digest_backend" "image: \"finance-ai-backend@$TEST_BACKEND_DIGEST\""
assert_contains "$staging_digest_migration" "image: \"finance-ai-backend@$TEST_BACKEND_DIGEST\""

for value in \
  'SSL_CERT_FILE: "/app/prisma/certs/finance-ai-ca-bundle.pem"' \
  'REDIS_AUTH_MODE: "iam"' \
  'REDIS_HOST: "master.finance-ai-staging-valkey.zdzskp.aps1.cache.amazonaws.com"' \
  'REDIS_PORT: "6379"' \
  'REDIS_USERNAME: "finance-ai-staging-valkey-app"' \
  'REDIS_IAM_CACHE_NAME: "finance-ai-staging-valkey"' \
  'AWS_REGION: "ap-south-1"'; do
  assert_contains "$staging_backend_config" "$value"
done

for value in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_ROLE_ARN AWS_WEB_IDENTITY_TOKEN_FILE REDIS_IAM_TOKEN REDIS_PASSWORD REDIS_URL; do
  assert_not_contains "$staging_render" "$value"
done
assert_not_contains "$local_render" "eks.amazonaws.com/role-arn"
assert_not_contains "$local_render" 'REDIS_AUTH_MODE: "iam"'
assert_not_contains "$local_render" "kind: Job"
assert_not_contains "$local_render" "app.kubernetes.io/component: migration"
assert_not_contains "$local_render" "finance-ai-migrator-secrets-staging"
assert_not_contains "$production_render" "eks.amazonaws.com/role-arn"
assert_not_contains "$production_render" 'REDIS_AUTH_MODE: "iam"'
assert_not_contains "$production_render" "kind: Job"
assert_not_contains "$production_render" "app.kubernetes.io/component: migration"
assert_not_contains "$production_render" "finance-ai-migrator-secrets-staging"
assert_not_contains "$default_render" "kind: Job"
assert_not_contains "$default_render" "app.kubernetes.io/component: migration"

if [[ "$STATIC_ONLY" == "true" ]]; then
  echo
  echo "[phase-2b] Static Helm validation passed"
  exit 0
fi

if kind get clusters | grep -Fxq "$CLUSTER_NAME"; then
  fail "kind cluster $CLUSTER_NAME already exists; run scripts/k8s-local-cleanup.sh first"
fi

stage "Build local application images"
docker build --file "$ROOT_DIR/Dockerfile.frontend" --tag "$FRONTEND_IMAGE" "$ROOT_DIR"
docker build --file "$ROOT_DIR/backend/Dockerfile" --tag "$BACKEND_IMAGE" "$ROOT_DIR/backend"

stage "Validate backend CA trust bundle"
docker run --rm --entrypoint sh "$BACKEND_IMAGE" -c '
  set -eu
  system=/etc/ssl/certs/ca-certificates.crt
  rds=/app/prisma/certs/ap-south-1-bundle.pem
  combined=/app/prisma/certs/finance-ai-ca-bundle.pem
  test "$(id -u)" = 1001
  test -r "$combined"
  echo "ca4a9dc14e06c3f84274eff3ffed0e5d4d3463141593e1159eb4a0904df6cd74  $rds" | sha256sum -c -
  system_size="$(wc -c < "$system")"
  rds_size="$(wc -c < "$rds")"
  test "$(wc -c < "$combined")" -eq "$((system_size + rds_size))"
  test "$(head -c "$system_size" "$combined" | sha256sum | cut -d " " -f 1)" = "$(sha256sum "$system" | cut -d " " -f 1)"
  test "$(tail -c "$rds_size" "$combined" | sha256sum | cut -d " " -f 1)" = "$(sha256sum "$rds" | cut -d " " -f 1)"
'

stage "Create disposable kind cluster"
kind create cluster \
  --name "$CLUSTER_NAME" \
  --config "$LOCAL_DIR/kind-config.yaml" \
  --kubeconfig "$KUBECONFIG_FILE" \
  --wait "$APP_TIMEOUT"
k cluster-info >/dev/null

stage "Load and confirm application images"
kind load docker-image "$FRONTEND_IMAGE" "$BACKEND_IMAGE" --name "$CLUSTER_NAME"
kind_node="$(kind get nodes --name "$CLUSTER_NAME")"
docker exec "$kind_node" crictl images -o json | grep -Fq "$FRONTEND_IMAGE" || fail "Frontend image missing from kind node"
docker exec "$kind_node" crictl images -o json | grep -Fq "$BACKEND_IMAGE" || fail "Backend image missing from kind node"
echo "Loaded $FRONTEND_IMAGE and $BACKEND_IMAGE"

stage "Create namespace and runtime-only Secrets"
k create namespace "$NAMESPACE" >/dev/null
: > "$PID_FILE"

POSTGRES_USER="financeai"
POSTGRES_DB="financeai"
POSTGRES_PASSWORD="$(openssl rand -hex 24)"
REDIS_PASSWORD="$(openssl rand -hex 24)"
JWT_SECRET="$(openssl rand -hex 64)"
JWT_REFRESH_SECRET="$(openssl rand -hex 64)"
CSRF_SECRET="$(openssl rand -hex 64)"
SECURITY_STATE_HMAC_SECRET="$(openssl rand -hex 64)"
DATABASE_SCHEME="postgresql"
REDIS_SCHEME="redis"
DATABASE_URL="${DATABASE_SCHEME}://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public"
REDIS_URL="${REDIS_SCHEME}://:${REDIS_PASSWORD}@redis:6379"

apply_secret "$POSTGRES_SECRET" \
  --from-literal=POSTGRES_USER="$POSTGRES_USER" \
  --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  --from-literal=POSTGRES_DB="$POSTGRES_DB"
apply_secret "$REDIS_SECRET" --from-literal=REDIS_PASSWORD="$REDIS_PASSWORD"
apply_secret "$BACKEND_SECRET" \
  --from-literal=DATABASE_URL="$DATABASE_URL" \
  --from-literal=REDIS_URL="$REDIS_URL" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
  --from-literal=CSRF_SECRET="$CSRF_SECRET" \
  --from-literal=SECURITY_STATE_HMAC_SECRET="$SECURITY_STATE_HMAC_SECRET"
echo "Runtime Secrets created without printing values"

stage "Deploy disposable PostgreSQL and Redis"
k apply -f "$LOCAL_DIR/postgres.yaml"
k apply -f "$LOCAL_DIR/redis.yaml"
k -n "$NAMESPACE" rollout status deployment/postgres --timeout="$APP_TIMEOUT"
k -n "$NAMESPACE" rollout status deployment/redis --timeout="$APP_TIMEOUT"

stage "Run Prisma migration Job"
k -n "$NAMESPACE" delete job "$MIGRATION_JOB" --ignore-not-found >/dev/null
k apply -f "$LOCAL_DIR/migrate.yaml"
if ! k -n "$NAMESPACE" wait --for=condition=complete "job/$MIGRATION_JOB" --timeout="$APP_TIMEOUT"; then
  safe_migration_logs
  fail "Migration Job failed"
fi
safe_migration_logs
k -n "$NAMESPACE" get job "$MIGRATION_JOB"

stage "Install Helm release"
h upgrade --install "$RELEASE" "$CHART_DIR" \
  --namespace "$NAMESPACE" \
  --values "$LOCAL_VALUES" \
  --wait \
  --timeout "$APP_TIMEOUT"
h status "$RELEASE" --namespace "$NAMESPACE"
k -n "$NAMESPACE" rollout status "deployment/${RELEASE}-backend" --timeout="$APP_TIMEOUT"
k -n "$NAMESPACE" rollout status "deployment/${RELEASE}-frontend" --timeout="$APP_TIMEOUT"
k -n "$NAMESPACE" get pods
check_healthy_services

HEALTHY_REVISION="$(h history "$RELEASE" --namespace "$NAMESPACE" --max 1 | awk 'NR == 2 { print $1 }')"
[[ "$HEALTHY_REVISION" =~ ^[0-9]+$ ]] || fail "Could not identify healthy Helm revision"

stage "Prove readiness-based failed rollout"
BROKEN_REDIS_URL="${REDIS_SCHEME}://redis-unreachable:6379"
apply_secret "$BROKEN_BACKEND_SECRET" \
  --from-literal=DATABASE_URL="$DATABASE_URL" \
  --from-literal=REDIS_URL="$BROKEN_REDIS_URL" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
  --from-literal=CSRF_SECRET="$CSRF_SECRET" \
  --from-literal=SECURITY_STATE_HMAC_SECRET="$SECURITY_STATE_HMAC_SECRET"

if h upgrade "$RELEASE" "$CHART_DIR" \
  --namespace "$NAMESPACE" \
  --values "$LOCAL_VALUES" \
  --set-string "backend.existingSecret=$BROKEN_BACKEND_SECRET" \
  --wait \
  --timeout "$BROKEN_ROLLOUT_TIMEOUT"; then
  fail "Broken Redis rollout unexpectedly succeeded"
else
  echo "Broken Redis rollout failed as expected"
fi

h status "$RELEASE" --namespace "$NAMESPACE" || true
h history "$RELEASE" --namespace "$NAMESPACE"
BROKEN_POD="$(k -n "$NAMESPACE" get pods \
  -l 'app.kubernetes.io/component=backend' \
  --sort-by=.metadata.creationTimestamp \
  -o jsonpath='{.items[-1].metadata.name}')"
k -n "$NAMESPACE" wait --for=jsonpath='{.status.phase}'=Running "pod/$BROKEN_POD" --timeout="$APP_TIMEOUT"

start_forward "pod/$BROKEN_POD" "$BROKEN_BACKEND_PORT:3000" "$temp_dir/broken-forward.log"
broken_forward_pid="$FORWARD_PID"
wait_http "http://127.0.0.1:$BROKEN_BACKEND_PORT/livez" 200
wait_http "http://127.0.0.1:$BROKEN_BACKEND_PORT/readyz" 503
broken_ready="$(k -n "$NAMESPACE" get pod "$BROKEN_POD" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')"
[[ "$broken_ready" == "False" ]] || fail "Broken backend pod unexpectedly became Ready"
ready_replicas="$(k -n "$NAMESPACE" get deployment "${RELEASE}-backend" -o jsonpath='{.status.readyReplicas}')"
[[ "${ready_replicas:-0}" -ge 1 ]] || fail "Healthy backend replica was not preserved"
stop_pid "$broken_forward_pid"

if k -n "$NAMESPACE" logs "$BROKEN_POD" | grep -q '"outcome":"fallback"'; then
  fail "Production backend used local Redis fallback"
fi
k -n "$NAMESPACE" logs "$BROKEN_POD" |
  grep -E 'redis_state_changed|readiness_check|distributed_job' |
  tail -n 20 || true
echo "Broken pod evidence: livez=200 readyz=503 Ready=False; healthy replica preserved"
check_healthy_services

stage "Rollback to healthy Helm revision $HEALTHY_REVISION"
h history "$RELEASE" --namespace "$NAMESPACE"
h rollback "$RELEASE" "$HEALTHY_REVISION" \
  --namespace "$NAMESPACE" \
  --wait \
  --timeout "$APP_TIMEOUT"
h status "$RELEASE" --namespace "$NAMESPACE"
h history "$RELEASE" --namespace "$NAMESPACE"
k -n "$NAMESPACE" rollout status "deployment/${RELEASE}-backend" --timeout="$APP_TIMEOUT"
restored_secret="$(k -n "$NAMESPACE" get deployment "${RELEASE}-backend" \
  -o jsonpath='{.spec.template.spec.containers[0].envFrom[1].secretRef.name}')"
[[ "$restored_secret" == "$BACKEND_SECRET" ]] || fail "Rollback did not restore the healthy Secret reference"
check_healthy_services

stage "Verify graceful backend replacement"
OLD_POD="$(k -n "$NAMESPACE" get pods \
  -l 'app.kubernetes.io/component=backend' \
  -o custom-columns='NAME:.metadata.name,READY:.status.containerStatuses[0].ready' \
  --no-headers | awk '$2 == "true" { print $1; exit }')"
[[ -n "$OLD_POD" ]] || fail "Could not identify the Ready backend pod"
k -n "$NAMESPACE" logs --follow "$OLD_POD" > "$TERMINATION_LOG" 2>&1 &
termination_log_pid=$!
register_pid "$termination_log_pid"
start_forward "pod/$OLD_POD" "$TERMINATING_BACKEND_PORT:3000" "$temp_dir/terminating-forward.log"
terminating_forward_pid="$FORWARD_PID"
wait_http "http://127.0.0.1:$TERMINATING_BACKEND_PORT/livez" 200
k -n "$NAMESPACE" rollout restart "deployment/${RELEASE}-backend"

deletion_started=""
for ((attempt = 1; attempt <= 90; attempt++)); do
  deletion_timestamp="$(k -n "$NAMESPACE" get pod "$OLD_POD" -o jsonpath='{.metadata.deletionTimestamp}' 2>/dev/null || true)"
  if [[ -n "$deletion_timestamp" ]]; then
    deletion_started="$(date +%s)"
    break
  fi
  sleep 1
done
[[ -n "$deletion_started" ]] || fail "Old backend pod never entered termination"

shutdown_ready_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  "http://127.0.0.1:$TERMINATING_BACKEND_PORT/readyz" || true)"

termination_seconds=""
for ((attempt = 1; attempt <= 32; attempt++)); do
  if ! k -n "$NAMESPACE" get pod "$OLD_POD" >/dev/null 2>&1; then
    termination_seconds="$(( $(date +%s) - deletion_started ))"
    break
  fi
  sleep 1
done
[[ -n "$termination_seconds" ]] || fail "Old backend pod exceeded the 30-second termination grace period"
k -n "$NAMESPACE" rollout status "deployment/${RELEASE}-backend" --timeout="$APP_TIMEOUT"
stop_pid "$terminating_forward_pid"
stop_pid "$termination_log_pid"

if grep -E 'shutdown_started|background_jobs_stopped|shutdown_dependencies_closed|shutdown_completed' "$TERMINATION_LOG"; then
  echo "Structured graceful-shutdown events captured"
else
  echo "Structured shutdown logs were unavailable after pod deletion; continuing with Kubernetes timing evidence"
fi
echo "Old backend pod terminated in ${termination_seconds}s; shutdown readiness observation=${shutdown_ready_status:-unavailable}"
check_healthy_services

stage "Delete disposable cluster"
cleanup_runtime
trap - EXIT INT TERM
"$ROOT_DIR/scripts/k8s-local-cleanup.sh"
if kind get clusters | grep -Fxq "$CLUSTER_NAME"; then
  fail "Disposable cluster still exists"
fi

echo
echo "[phase-2b] Validation passed and kind cluster $CLUSTER_NAME was removed"
