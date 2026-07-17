# Database workflow

The application schema is PostgreSQL-only. `prisma db push` is prohibited for
normal development, CI, and deployment because it bypasses reviewed migration
history.

## Current deployment status

The checked-in migration history is not yet authoritative:

- `schema.prisma` uses PostgreSQL.
- `prisma/migrations/migration_lock.toml` still says SQLite.
- the initial SQL migration does not represent the complete current schema.
- the knowledge migration requires pgvector, while the current Prisma schema
  and Docker PostgreSQL image do not.

The local Docker database has application tables but no
`_prisma_migrations` table, so it is classified as a schema-push database.
Production remains unclassified until the read-only EC2 checks below are run.
Do not replace migration history, resolve a baseline, or deploy migrations to
production while its classification is unknown.

## EC2 read-only classification

The CD workflow defaults to a server-maintained `docker-compose.yml`, not the
repository's `docker-compose.prod.yml`, and `DEPLOY_COMMAND` may override that
default. On EC2, first identify the actual compose project:

```bash
cd ~/finance-ai
docker compose ls
find . -maxdepth 1 -name 'docker-compose*.yml' -print
docker compose --env-file .release.env -f docker-compose.yml config --services
docker compose --env-file .release.env -f docker-compose.yml ps
```

If the database service is named `postgres`, these commands reveal the
database name, PostgreSQL version, migration classification, and application
tables without displaying passwords or `DATABASE_URL`:

```bash
docker compose --env-file .release.env -f docker-compose.yml exec -T postgres \
  sh -lc 'printf "database=%s\n" "$POSTGRES_DB"; psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SHOW server_version"'

docker compose --env-file .release.env -f docker-compose.yml exec -T postgres \
  sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT CASE WHEN to_regclass('"'"'public._prisma_migrations'"'"') IS NULL THEN '"'"'absent'"'"' ELSE '"'"'present'"'"' END"'

docker compose --env-file .release.env -f docker-compose.yml exec -T postgres \
  sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT table_name FROM information_schema.tables WHERE table_schema = '"'"'public'"'"' ORDER BY table_name"'
```

Inspect image identities and the PostgreSQL volume without dumping container
environment variables:

```bash
docker compose --env-file .release.env -f docker-compose.yml images
docker inspect "$(docker compose --env-file .release.env -f docker-compose.yml ps -q backend)" \
  --format '{{.Config.Image}} {{.Image}}'
docker inspect "$(docker compose --env-file .release.env -f docker-compose.yml ps -q postgres)" \
  --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}'
```

Classification:

- **A:** `_prisma_migrations` absent — schema-push/manual database.
- **B:** `_prisma_migrations` present — migration-managed; inspect its rows
  before planning any reconciliation.
- **C:** compose/database inaccessible or ambiguous — stop and investigate.

Do not run commands that print `docker inspect ... .Config.Env`, `docker compose
config`, `.env` files, or connection URLs into logs.

## Local development database

`../docker-compose.prod.yml` currently starts PostgreSQL service `postgres` as
container `finance-ai-db`, using database `DB_NAME` (default `financeai`) and
the named `postgres_data` volume. The backend `DATABASE_URL` is assembled by
Compose from `DB_USER`, `DB_PASSWORD`, and `DB_NAME`. The backend container does
not automatically run migrations.

## Backup and verified restore

Run this before any local migration work. The unique timestamp and existence
check prevent overwriting an earlier dump.

```bash
mkdir -p "$HOME/finance-ai-backups"
BACKUP="financeai-$(date -u +%Y%m%dT%H%M%SZ).dump"
test ! -e "$HOME/finance-ai-backups/$BACKUP"

docker exec -e BACKUP_NAME="$BACKUP" finance-ai-db sh -lc \
  'set -eu; umask 077; test ! -e "/tmp/$BACKUP_NAME"; pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "/tmp/$BACKUP_NAME"'

docker exec -e BACKUP_NAME="$BACKUP" finance-ai-db sh -lc \
  'set -eu; pg_restore --list "/tmp/$BACKUP_NAME" >/dev/null'

docker cp "finance-ai-db:/tmp/$BACKUP" "$HOME/finance-ai-backups/$BACKUP"
test -s "$HOME/finance-ai-backups/$BACKUP"
```

Restore only into a new throwaway database. This deliberately fails if the
throwaway name already exists and never targets the running `financeai`
database:

```bash
RESTORE_DB=financeai_restore_test
docker exec -e BACKUP_NAME="$BACKUP" -e RESTORE_DB="$RESTORE_DB" finance-ai-db sh -lc '
  set -eu
  existing=$(psql -U "$POSTGRES_USER" -d postgres -Atc "SELECT count(*) FROM pg_database WHERE datname = '"'"'$RESTORE_DB'"'"'")
  test "$existing" = 0
  createdb -U "$POSTGRES_USER" "$RESTORE_DB"
  pg_restore -U "$POSTGRES_USER" -d "$RESTORE_DB" --exit-on-error "/tmp/$BACKUP_NAME"
'
```

Confirm important row counts in the restored copy:

```bash
docker exec -e RESTORE_DB="$RESTORE_DB" finance-ai-db sh -lc '
  psql -U "$POSTGRES_USER" -d "$RESTORE_DB" -v ON_ERROR_STOP=1 -c \
    '"'"'SELECT (SELECT count(*) FROM users) AS users,
            (SELECT count(*) FROM transactions) AS transactions,
            (SELECT count(*) FROM budgets) AS budgets,
            (SELECT count(*) FROM goals) AS goals;'"'"'
'
```

After verification, remove only the throwaway database:

```bash
docker exec -e RESTORE_DB="$RESTORE_DB" finance-ai-db sh -lc \
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
byte-identical to
`prisma/migrations/0_postgresql_baseline/migration.sql`. Production is
classified as a schema-push/manual database, but the active baseline must not
be marked as applied there until the separately approved production procedure.
