# Finance AI backend

The backend is a TypeScript/Express API backed by PostgreSQL through Prisma and
Valkey through `ioredis`. It provides OTP and token authentication, transaction,
budget and goal APIs, AI-assisted advice, chat confirmation flows, rate limits,
and Kubernetes health endpoints.

## Local development

Prerequisites: Node.js 20 or newer, npm, Docker, and Docker Compose.

From the repository root:

```sh
npm --prefix backend ci
cp backend/.env.example backend/.env
# Replace the example JWT/HMAC/CSRF values before use.
npm --prefix backend run db:generate
docker compose -f backend/docker-compose.yml up -d postgres redis
npm --prefix backend run db:migrate:deploy
npm --prefix backend run dev
```

The local Compose credentials are intentionally marked as local-only. They are
not deployment credentials and must never be reused outside local development.

Stop the data services with:

```sh
docker compose -f backend/docker-compose.yml down
```

## Commands

```sh
npm --prefix backend run typecheck
npm --prefix backend run build
npm --prefix backend run db:generate
npm --prefix backend run db:migrate:deploy
npm --prefix backend run db:migrate:status
```

Integration tests use an isolated PostgreSQL service on host port 5433:

```sh
npm --prefix backend run test:db:up
npm --prefix backend test
npm --prefix backend run test:db:down
```

## Runtime configuration

`backend/.env.example` is the canonical local template. Required variables are:

- `DATABASE_URL`
- `JWT_SECRET` (minimum 64 characters)
- `JWT_REFRESH_SECRET` (minimum 64 characters)

Production additionally requires an independent
`SECURITY_STATE_HMAC_SECRET`. Redis uses either `REDIS_URL` or the deployed IAM
configuration. OpenAI and SMTP are optional integrations supplied outside
source control.

## Health endpoints

- `GET /livez`: process liveness
- `GET /readyz`: shutdown, PostgreSQL, and required Valkey readiness
- `GET /api/v1/health`: compatibility health endpoint

## Database workflow

The active migration chain is PostgreSQL-only. Do not use `prisma db push` for
normal development or deployment. Review
[DATABASE_SETUP.md](DATABASE_SETUP.md) before creating or applying migrations.

The deployed model uses separate runtime and migrator roles. The runtime role
does not own schema objects or the Prisma migration ledger. The Helm migration
job runs checked-in migrations before rollout.

## Deployment

The runtime image is built by `backend/Dockerfile` and deployed through the Helm
chart under `deploy/helm/finance-ai`. Deployment credentials and database URLs
come from external Kubernetes Secrets; they are not stored in this directory.

The broader platform and release model are documented in the repository
[README](../README.md).
