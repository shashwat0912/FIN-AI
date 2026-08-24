# Database workflow

The application schema is PostgreSQL-only. `prisma db push` is prohibited for
normal development, CI, and deployment because it bypasses reviewed migration
history.

## Current deployment status

The active Prisma schema and migration lock are PostgreSQL. The checked-in
history starts with `prisma/migrations/0_postgresql_baseline` and represents the
current Prisma schema; its reviewed copy is under `prisma/review`.

The local Docker database may contain application tables without a
`_prisma_migrations` table, so classify it before migration work. Treat
baselining any existing environment as a separate, explicitly approved
operation. Do not replace migration history or resolve a baseline against an
unclassified database.

## Staging PostgreSQL identities

`financeai_admin` is the RDS master and database owner, with `LOGIN`, `CREATEDB`,
and `CREATEROLE`, and is used only for bootstrap and break-glass
administration. It is not a true PostgreSQL superuser. The application
identities are:

- `financeai_runtime`: login, database `CONNECT`, schema `USAGE`, and
  `SELECT`, `INSERT`, `UPDATE`, `DELETE` on application tables. It owns no
  objects, inherits no roles, has no sequence privileges, cannot create schema
  objects, and cannot access `_prisma_migrations`.
- `financeai_migrator`: login, database `CONNECT`, schema `USAGE` and `CREATE`.
  It owns all Prisma-created tables, indexes, constraints, and
  `_prisma_migrations`. It is not a superuser and cannot create roles or
  databases.

The administrator-owned `public` schema keeps its owner. Bootstrap revokes
database and schema privileges from `PUBLIC`, grants each application role
only its required access, and defines future table grants as
`financeai_migrator` so new Prisma tables automatically receive runtime DML.
Sequences deliberately receive no runtime default grant because the current
schema does not use them.

### Bootstrap and password handling

`prisma/bootstrap/roles.sql` creates or reconciles roles, attributes,
memberships, grants, ownership, and default privileges. It never receives,
interpolates, changes, or verifies passwords.

Connect from a short-lived, controlled shell using verified TLS. Let `psql`
prompt for the RDS-managed administrator password rather than putting it in a
URL, command argument, environment variable, or shell history:

```bash
cd backend

export PGHOST='<private-rds-address>'
export PGPORT=5432
export PGDATABASE=financeai
export PGUSER=financeai_admin
export PGSSLMODE=verify-full
export PGSSLROOTCERT="$PWD/prisma/certs/ap-south-1-bundle.pem"

psql -X
```

Inside that interactive session, create/reconcile the roles, require SCRAM,
and set distinct password-manager-generated passwords of at least 32
characters:

```psql
\i prisma/bootstrap/roles.sql
SET password_encryption = 'scram-sha-256';
\password financeai_runtime
\password financeai_migrator
```

`\password` prompts without echo and performs password encryption in the psql
client before sending `ALTER ROLE`; the plaintext password is not sent in SQL
and cannot appear in PostgreSQL statement logs. Use the same interactive
procedure for later password rotation. Do not replace it with
`ALTER ROLE ... PASSWORD '<plaintext>'`.

The script is repeatable: it queries `pg_roles` and uses `\gexec` for missing
roles because PostgreSQL has no `CREATE ROLE IF NOT EXISTS`, then uses
`ALTER ROLE`, revoke-and-grant reconciliation, and `ALTER DEFAULT PRIVILEGES`
on every run without modifying the existing password verifier.

Because the RDS master is not a PostgreSQL superuser, `roles.sql` does not try
to alter the `SUPERUSER`, `REPLICATION`, or `BYPASSRLS` attributes. New roles
receive PostgreSQL's safe false defaults for those attributes; existing roles
are checked before reconciliation. Bootstrap fails closed if either role has
one of those dangerous attributes, then verifies both roles are login-enabled
and have none of `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, or
`BYPASSRLS` after reconciling the attributes the RDS master can safely manage.

### First staging baseline only

The immutable baseline contains `CREATE SCHEMA IF NOT EXISTS "public"`, which
requires database `CREATE` even though bootstrap preserves the existing
administrator-owned schema. Use this one-time sequence:

1. Run `roles.sql`; verify its privilege output shows
   `financeai_migrator` database `CREATE = false`.
2. Immediately before the first baseline migration, as `financeai_admin`, run:

   ```sql
   GRANT CREATE ON DATABASE financeai TO financeai_migrator;
   ```

3. Run `prisma migrate deploy` using the `financeai_migrator` URL.
4. Immediately rerun `roles.sql` as `financeai_admin`. It revokes all database
   privileges from the migrator, restores only `CONNECT`, reconciles existing
   table DML, and removes runtime access to `_prisma_migrations`.
5. Verify database `CREATE = false`, object ownership, table grants, and the
   default ACL output before starting the backend.

Never leave database `CREATE` granted after the first migration attempt,
whether that attempt succeeds or fails. Later migrations run with the normal
CONNECT-only database privilege and schema `USAGE, CREATE`.

Complete this one-time baseline and the final `roles.sql` reconciliation before
the first Helm install. The Helm pre-install migration hook then acts as a
no-pending-migrations gate; it must not roll out the backend while the temporary
database `CREATE` grant is still active.

Do not execute this staging procedure until a separately reviewed live staging
step explicitly authorizes RDS access, credential creation, Kubernetes Secrets,
and migrations.

## RDS TLS

The backend image contains the official AWS RDS `ap-south-1` bundle at:

```text
/app/prisma/certs/ap-south-1-bundle.pem
```

Prisma resolves certificate paths relative to its `prisma` directory, so both
runtime and migration URLs must use:

```text
postgresql://<role>:<url-encoded-password>@<private-rds-address>:5432/financeai?schema=public&sslmode=require&sslrootcert=certs/ap-south-1-bundle.pem&sslaccept=strict
```

The deployed Prisma migrate/schema engine also requires the RDS CA in its OpenSSL
trust store, even with `sslrootcert` in `DATABASE_URL`. Finance-AI therefore builds
`/app/prisma/certs/finance-ai-ca-bundle.pem` by appending the regional RDS bundle
to the normal Linux CA bundle and sets `SSL_CERT_FILE` to that combined file for
both the runtime Deployment and Helm migration Job. This preserves public HTTPS
trust while adding RDS trust. This requirement reflects the behavior proven by
this deployed Prisma/RDS environment; it is not a claim about every version.

The Docker build fails if the pinned RDS bundle hash changes, and the non-root
runtime user can read the combined bundle. Keep `sslrootcert` in `DATABASE_URL`.
Never use `rejectUnauthorized=false`, `sslaccept=accept_invalid_certs`, disable
certificate verification, or use any equivalent bypass.

Bundle source:
`https://truststore.pki.rds.amazonaws.com/ap-south-1/ap-south-1-bundle.pem`

Pinned SHA-256:
`ca4a9dc14e06c3f84274eff3ffed0e5d4d3463141593e1159eb4a0904df6cd74`

Review and update the committed bundle deliberately when AWS changes the
regional trust bundle; do not download it during application startup.

## PostgreSQL identity validation

The focused validation creates and removes one disposable PostgreSQL 15
container. Its initial `postgres` superuser creates a separate
`financeai_admin` role with the RDS boundary: `rolsuper=false`,
`rolcreatedb=true`, and `rolcreaterole=true`, plus a database owned by that
role. Every `roles.sql` execution then runs as `financeai_admin`, never as the
local superuser. Local-only SQL assigns generated ephemeral passwords;
production bootstrap never uses that automation. The test then proves database
`CREATE` is false before the one-time grant, true during the first-baseline
window, and false after post-migration reconciliation:

```bash
cd backend
./scripts/validate-postgres-identities.sh
```

It proves the non-superuser bootstrap succeeds twice, application logins use
SCRAM-only host authentication, runtime CRUD, migrator ownership, exact
role/database/schema/table and default privileges, zero pending migrations on
the second deployment, and denial of runtime `CREATE TABLE`, `ALTER TABLE`,
`DROP TABLE`, `TRUNCATE`, and `_prisma_migrations` access.

## Known knowledge-base mismatch

`knowledgeBaseService.ts` casts `metadata` to `jsonb` and `embedding` to
`vector`, while the active Prisma schema and baseline define those columns as
`TEXT`. The controller constructs this service during module loading, but its
constructor performs no database query; none of the startup background jobs
invoke it. The mismatch therefore does not block backend startup or the first
staging release, but knowledge-chunk create/update endpoints can fail when
called. Fix and migrate those column types in a separately reviewed phase.

## Local development database

`docker-compose.yml` starts PostgreSQL service `postgres` as container
`finance-ai-postgres`, using database `finance_ai_db` and the named
`postgres_data` volume. Its credentials are intentionally local-only. The
backend container does not automatically run migrations.

## Backup and verified restore

Run this before any local migration work. The unique timestamp and existence
check prevent overwriting an earlier dump.

```bash
mkdir -p "$HOME/finance-ai-backups"
BACKUP="financeai-$(date -u +%Y%m%dT%H%M%SZ).dump"
test ! -e "$HOME/finance-ai-backups/$BACKUP"

docker exec -e BACKUP_NAME="$BACKUP" finance-ai-postgres sh -lc \
  'set -eu; umask 077; test ! -e "/tmp/$BACKUP_NAME"; pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "/tmp/$BACKUP_NAME"'

docker exec -e BACKUP_NAME="$BACKUP" finance-ai-postgres sh -lc \
  'set -eu; pg_restore --list "/tmp/$BACKUP_NAME" >/dev/null'

docker cp "finance-ai-postgres:/tmp/$BACKUP" "$HOME/finance-ai-backups/$BACKUP"
test -s "$HOME/finance-ai-backups/$BACKUP"
```

Restore only into a new throwaway database. This deliberately fails if the
throwaway name already exists and never targets the running `financeai`
database:

```bash
RESTORE_DB=financeai_restore_test
docker exec -e BACKUP_NAME="$BACKUP" -e RESTORE_DB="$RESTORE_DB" finance-ai-postgres sh -lc '
  set -eu
  existing=$(psql -U "$POSTGRES_USER" -d postgres -Atc "SELECT count(*) FROM pg_database WHERE datname = '"'"'$RESTORE_DB'"'"'")
  test "$existing" = 0
  createdb -U "$POSTGRES_USER" "$RESTORE_DB"
  pg_restore -U "$POSTGRES_USER" -d "$RESTORE_DB" --exit-on-error "/tmp/$BACKUP_NAME"
'
```

Confirm important row counts in the restored copy:

```bash
docker exec -e RESTORE_DB="$RESTORE_DB" finance-ai-postgres sh -lc '
  psql -U "$POSTGRES_USER" -d "$RESTORE_DB" -v ON_ERROR_STOP=1 -c \
    '"'"'SELECT (SELECT count(*) FROM users) AS users,
            (SELECT count(*) FROM transactions) AS transactions,
            (SELECT count(*) FROM budgets) AS budgets,
            (SELECT count(*) FROM goals) AS goals;'"'"'
'
```

After verification, remove only the throwaway database:

```bash
docker exec -e RESTORE_DB="$RESTORE_DB" finance-ai-postgres sh -lc \
  'dropdb -U "$POSTGRES_USER" --if-exists "$RESTORE_DB"'
```

Keep the copied dump outside the container and Docker volume. Recovery from a
failed migration is restore into a new database, verify it, then deliberately
switch the application connection; never overwrite the running database in
place.

## Isolated PostgreSQL tests

The test service uses `finance_ai_test` on host port 5433, a tmpfs data
directory, and no development volume:

```bash
npm run test:db:up
npm run test:db:prepare
npm run test:db:reset
npm test
npm run test:db:down
```

`test:db:prepare` and `test:db:reset` require `NODE_ENV=test`, PostgreSQL, and
a database name ending in `_test`. They explicitly reject `financeai` and
`finance_ai_db`. `TEST_DATABASE_URL` may override the local test URL in CI.

The active PostgreSQL history begins with
`prisma/migrations/0_postgresql_baseline`. The incompatible SQLite history is
preserved under `prisma/legacy-sqlite-migrations` for audit.

## Migration creation and deployment

After production history is classified and reconciled:

1. Back up and verify restore.
2. Create migrations on an isolated development database with
   `prisma migrate dev --create-only`.
3. Review generated SQL and a `prisma migrate diff` before applying it.
4. Apply checked-in migrations to isolated tests.
5. Use `prisma migrate deploy` only against an explicitly approved deployment
   database.
6. Run `prisma migrate status` after deployment.

The reviewed source at `prisma/review/current-schema-baseline.sql` is
byte-identical to `prisma/migrations/0_postgresql_baseline/migration.sql`.
Staging or production baselining requires a separately approved procedure and
must never be inferred from local database state.
