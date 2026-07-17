# Reviewed PostgreSQL baseline

`current-schema-baseline.sql` is the reviewed source for the active
`prisma/migrations/0_postgresql_baseline/migration.sql`. The two files must
remain byte-identical. Production was classified as a schema-push/manual
PostgreSQL database with no `_prisma_migrations` table; do not mark the
baseline as applied there until the production baselining procedure receives
separate approval.

It was generated from an empty PostgreSQL schema with:

```bash
DATABASE_URL=postgresql://review@localhost/review_test \
  npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script \
  --output prisma/review/current-schema-baseline.sql
```

Validation performed on 2026-07-17:

- applied successfully to a new `finance_ai_baseline_test` PostgreSQL 15
  database;
- diff from that database back to `schema.prisma` was empty;
- diff from the running local `financeai` database to `schema.prisma` was
  empty;
- contains no application data, pgvector extension, or vector column.

The incompatible SQLite history is preserved under
`prisma/legacy-sqlite-migrations` for audit. Known differences between that
legacy chain and this baseline include:

- missing `User.timezone` and `Transaction.source` in the initial migration;
- missing OTP, RAG, chat, pending-confirmation, conversation-summary,
  idempotency, and category-mapping tables;
- obsolete standalone Transaction indexes in the initial migration that are
  not declared by the current Prisma schema;
- a pgvector `knowledge_chunks.embedding vector(1536) NOT NULL` column and
  JSONB metadata in the old knowledge migration, versus nullable text fields
  in the current schema.
