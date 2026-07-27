-- Add canonical category keys without removing legacy display columns.
ALTER TABLE "transactions" ADD COLUMN "categoryKey" TEXT;
ALTER TABLE "budgets" ADD COLUMN "categoryKey" TEXT;

-- Supports batched expense aggregation for a user's category and period.
CREATE INDEX "transactions_userId_type_categoryKey_date_idx"
ON "transactions"("userId", "type", "categoryKey", "date");

-- Prisma cannot model this partial uniqueness constraint.
CREATE UNIQUE INDEX "budgets_active_categoryKey_period_key"
ON "budgets"("userId", "categoryKey", "period")
WHERE "isActive" = true AND "categoryKey" IS NOT NULL;
