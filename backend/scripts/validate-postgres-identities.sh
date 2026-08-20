#!/usr/bin/env bash
set -euo pipefail

readonly BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly BOOTSTRAP_SQL="$BACKEND_DIR/prisma/bootstrap/roles.sql"
readonly CONTAINER_NAME="finance-ai-postgres-identity-${$}"
readonly POSTGRES_IMAGE="postgres:15-alpine"

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/finance-ai-postgres-identity.XXXXXX")"
readonly FIRST_MIGRATION_LOG="$temp_dir/first-migration.log"
readonly SECOND_MIGRATION_LOG="$temp_dir/second-migration.log"

cleanup() {
  docker rm --force "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -rf "$temp_dir"
  unset VALIDATION_RUNTIME_PASSWORD VALIDATION_MIGRATOR_PASSWORD POSTGRES_PASSWORD
}
trap cleanup EXIT INT TERM

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

for command_name in docker npm openssl; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Missing required command: $command_name"
done
docker info >/dev/null

export POSTGRES_PASSWORD="$(openssl rand -hex 32)"
export VALIDATION_RUNTIME_PASSWORD="$(openssl rand -hex 32)"
export VALIDATION_MIGRATOR_PASSWORD="$(openssl rand -hex 32)"

docker run --detach --rm \
  --name "$CONTAINER_NAME" \
  --publish 127.0.0.1::5432 \
  --env POSTGRES_DB=financeai \
  --env POSTGRES_USER=financeai_admin \
  --env POSTGRES_PASSWORD \
  "$POSTGRES_IMAGE" >/dev/null

for _ in {1..30}; do
  if docker exec "$CONTAINER_NAME" pg_isready -U financeai_admin -d financeai >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$CONTAINER_NAME" pg_isready -U financeai_admin -d financeai >/dev/null

host_port="$(docker port "$CONTAINER_NAME" 5432/tcp | awk -F: 'NR == 1 { print $NF }')"
[[ "$host_port" =~ ^[0-9]+$ ]] || fail "Could not resolve the disposable PostgreSQL port"

run_bootstrap() {
  docker exec --interactive "$CONTAINER_NAME" \
    psql -X -U financeai_admin -d financeai --file - < "$BOOTSTRAP_SQL"
}

echo "Bootstrapping roles twice before migration"
run_bootstrap >/dev/null
run_bootstrap >/dev/null

# Disposable-only password setup. Live bootstrap uses interactive psql
# \password so plaintext is never sent in ALTER ROLE SQL.
docker exec --interactive \
  --env VALIDATION_RUNTIME_PASSWORD \
  --env VALIDATION_MIGRATOR_PASSWORD \
  "$CONTAINER_NAME" psql -X -v ON_ERROR_STOP=1 -U financeai_admin -d financeai <<'SQL'
\getenv runtime_password VALIDATION_RUNTIME_PASSWORD
\getenv migrator_password VALIDATION_MIGRATOR_PASSWORD
SET password_encryption = 'scram-sha-256';
ALTER ROLE financeai_runtime PASSWORD :'runtime_password';
ALTER ROLE financeai_migrator PASSWORD :'migrator_password';
SQL

database_create_state() {
  docker exec "$CONTAINER_NAME" psql -X -At -U financeai_admin -d financeai \
    --command "SELECT has_database_privilege('financeai_migrator', 'financeai', 'CREATE')"
}

assert_database_create() {
  local expected="$1"
  local phase="$2"
  [[ "$(database_create_state)" == "$expected" ]] ||
    fail "Migrator database CREATE was not $expected during $phase"
  echo "Migrator database CREATE=$expected during $phase"
}

assert_database_create f steady_state_before_migration
docker exec "$CONTAINER_NAME" psql -X -v ON_ERROR_STOP=1 \
  -U financeai_admin -d financeai \
  --command 'GRANT CREATE ON DATABASE financeai TO financeai_migrator' >/dev/null
assert_database_create t first_baseline_window

migrator_url="postgresql://financeai_migrator:${VALIDATION_MIGRATOR_PASSWORD}@127.0.0.1:${host_port}/financeai?schema=public"
(
  cd "$BACKEND_DIR"
  DATABASE_URL="$migrator_url" npx prisma migrate deploy
) | tee "$FIRST_MIGRATION_LOG"

echo "Reconciling grants after migration"
run_bootstrap >/dev/null
assert_database_create f steady_state_after_migration

(
  cd "$BACKEND_DIR"
  DATABASE_URL="$migrator_url" npx prisma migrate deploy
) | tee "$SECOND_MIGRATION_LOG"
grep -Fq "No pending migrations to apply." "$SECOND_MIGRATION_LOG" ||
  fail "The second Prisma deployment did not report zero pending migrations"

runtime_psql() {
  PGPASSWORD="$VALIDATION_RUNTIME_PASSWORD" docker exec --interactive --env PGPASSWORD \
    "$CONTAINER_NAME" psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 \
    -U financeai_runtime -d financeai "$@"
}

runtime_psql --command "
  INSERT INTO public.users (id, email, \"updatedAt\")
  VALUES ('identity-validation-user', 'identity-validation@example.invalid', NOW());
  SELECT id FROM public.users WHERE id = 'identity-validation-user';
  UPDATE public.users SET name = 'validated' WHERE id = 'identity-validation-user';
  DELETE FROM public.users WHERE id = 'identity-validation-user';
" >/dev/null
echo "Runtime INSERT/SELECT/UPDATE/DELETE passed"

expect_denied() {
  local label="$1"
  local statement="$2"
  local log_file="$temp_dir/${label}.log"

  if runtime_psql --command "$statement" >"$log_file" 2>&1; then
    fail "Runtime $label unexpectedly succeeded"
  fi
  grep -Eq 'permission denied|must be owner' "$log_file" ||
    fail "Runtime $label failed for an unexpected reason"
  echo "Runtime $label denied"
}

expect_denied create_table 'CREATE TABLE public.runtime_must_not_create (id integer)'
expect_denied alter_table 'ALTER TABLE public.users ADD COLUMN runtime_must_not_alter text'
expect_denied drop_table 'DROP TABLE public.users'
expect_denied truncate 'TRUNCATE TABLE public.users'
expect_denied migration_ledger 'SELECT * FROM public._prisma_migrations'

docker exec --interactive "$CONTAINER_NAME" \
  psql -X -v ON_ERROR_STOP=1 -U financeai_admin -d financeai <<'SQL'
DO $$
DECLARE
  default_table_privileges text[];
BEGIN
  IF EXISTS (
    SELECT FROM pg_roles
    WHERE rolname IN ('financeai_runtime', 'financeai_migrator')
      AND (NOT rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR
           rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'application role attributes are broader than intended';
  END IF;

  IF NOT has_database_privilege('financeai_runtime', 'financeai', 'CONNECT') OR
     has_database_privilege('financeai_runtime', 'financeai', 'CREATE') OR
     has_database_privilege('financeai_runtime', 'financeai', 'TEMPORARY') OR
     NOT has_database_privilege('financeai_migrator', 'financeai', 'CONNECT') OR
     has_database_privilege('financeai_migrator', 'financeai', 'CREATE') OR
     has_database_privilege('financeai_migrator', 'financeai', 'TEMPORARY') THEN
    RAISE EXCEPTION 'database privileges are not exact';
  END IF;

  IF NOT has_schema_privilege('financeai_runtime', 'public', 'USAGE') OR
     has_schema_privilege('financeai_runtime', 'public', 'CREATE') OR
     NOT has_schema_privilege('financeai_migrator', 'public', 'USAGE') OR
     NOT has_schema_privilege('financeai_migrator', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'schema privileges are not exact';
  END IF;

  IF (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = 'public')
     IN ('financeai_runtime', 'financeai_migrator') THEN
    RAISE EXCEPTION 'public schema ownership moved to an application role';
  END IF;

  IF EXISTS (
    SELECT FROM pg_auth_members memberships
    JOIN pg_roles member ON member.oid = memberships.member
    WHERE member.rolname IN ('financeai_runtime', 'financeai_migrator')
  ) THEN
    RAISE EXCEPTION 'application role unexpectedly inherits another role';
  END IF;

  IF EXISTS (
    SELECT FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'i', 'I', 'S', 'v', 'm')
      AND pg_get_userbyid(c.relowner) <> 'financeai_migrator'
  ) THEN
    RAISE EXCEPTION 'Prisma object ownership is not assigned to financeai_migrator';
  END IF;

  IF EXISTS (
    SELECT FROM pg_database d
    CROSS JOIN LATERAL aclexplode(d.datacl) acl
    WHERE d.datname = 'financeai' AND acl.grantee = 0
  ) OR EXISTS (
    SELECT FROM pg_namespace n
    CROSS JOIN LATERAL aclexplode(n.nspacl) acl
    WHERE n.nspname = 'public' AND acl.grantee = 0
  ) OR EXISTS (
    SELECT FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) acl
    WHERE n.nspname = 'public' AND acl.grantee = 0
  ) THEN
    RAISE EXCEPTION 'PUBLIC retains database, schema, table, or sequence privileges';
  END IF;

  IF EXISTS (
    SELECT FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND c.relname <> '_prisma_migrations'
      AND NOT (
        has_table_privilege('financeai_runtime', c.oid, 'SELECT') AND
        has_table_privilege('financeai_runtime', c.oid, 'INSERT') AND
        has_table_privilege('financeai_runtime', c.oid, 'UPDATE') AND
        has_table_privilege('financeai_runtime', c.oid, 'DELETE')
      )
  ) THEN
    RAISE EXCEPTION 'runtime DML privileges are incomplete';
  END IF;

  IF EXISTS (
    SELECT FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND c.relname <> '_prisma_migrations'
      AND (has_table_privilege('financeai_runtime', c.oid, 'TRUNCATE') OR
           has_table_privilege('financeai_runtime', c.oid, 'REFERENCES') OR
           has_table_privilege('financeai_runtime', c.oid, 'TRIGGER'))
  ) THEN
    RAISE EXCEPTION 'runtime table privileges are broader than DML';
  END IF;

  IF to_regclass('public._prisma_migrations') IS NULL OR EXISTS (
    SELECT FROM unnest(
      ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
    ) AS privilege(name)
    WHERE has_table_privilege(
      'financeai_runtime', 'public._prisma_migrations', privilege.name
    )
  ) THEN
    RAISE EXCEPTION 'runtime can access the Prisma migration ledger';
  END IF;

  IF EXISTS (
    SELECT FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S'
      AND (has_sequence_privilege('financeai_runtime', c.oid, 'USAGE') OR
           has_sequence_privilege('financeai_runtime', c.oid, 'SELECT') OR
           has_sequence_privilege('financeai_runtime', c.oid, 'UPDATE'))
  ) THEN
    RAISE EXCEPTION 'runtime unexpectedly has sequence privileges';
  END IF;

  SELECT array_agg(acl.privilege_type::text ORDER BY acl.privilege_type)
  INTO default_table_privileges
  FROM pg_default_acl defaults
  JOIN pg_roles owner ON owner.oid = defaults.defaclrole
  JOIN pg_namespace n ON n.oid = defaults.defaclnamespace
  CROSS JOIN LATERAL aclexplode(defaults.defaclacl) acl
  JOIN pg_roles grantee ON grantee.oid = acl.grantee
  WHERE owner.rolname = 'financeai_migrator'
    AND n.nspname = 'public'
    AND defaults.defaclobjtype = 'r'
    AND grantee.rolname = 'financeai_runtime';

  IF default_table_privileges IS DISTINCT FROM
     ARRAY['DELETE', 'INSERT', 'SELECT', 'UPDATE']::text[] THEN
    RAISE EXCEPTION 'runtime default table privileges are not exact: %',
      default_table_privileges;
  END IF;

  IF EXISTS (
    SELECT FROM pg_default_acl defaults
    JOIN pg_roles owner ON owner.oid = defaults.defaclrole
    LEFT JOIN pg_namespace n ON n.oid = defaults.defaclnamespace
    CROSS JOIN LATERAL aclexplode(defaults.defaclacl) acl
    WHERE owner.rolname = 'financeai_migrator'
      AND (n.nspname = 'public' OR n.nspname IS NULL)
      AND (acl.grantee = 0 OR
           (defaults.defaclobjtype = 'S' AND
            acl.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'financeai_runtime')))
  ) THEN
    RAISE EXCEPTION 'PUBLIC or runtime sequence default privileges remain';
  END IF;

  IF EXISTS (
    SELECT FROM pg_authid
    WHERE rolname IN ('financeai_runtime', 'financeai_migrator')
      AND (rolpassword IS NULL OR rolpassword NOT LIKE 'SCRAM-SHA-256$%')
  ) THEN
    RAISE EXCEPTION 'application role password is not stored as SCRAM-SHA-256';
  END IF;
END
$$;

SELECT 'identity privilege assertions passed' AS result;
SQL

echo "PostgreSQL 15 identity validation passed"
