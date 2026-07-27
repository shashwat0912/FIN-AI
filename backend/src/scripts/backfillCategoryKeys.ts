import prisma from '../config/database';
import { normalizeCategory } from '../domain/categoryRegistry';

type BudgetCandidate = {
  id: string;
  userId: string;
  name: string;
  period: string;
  isActive: boolean;
  categoryKey: string | null;
};

const write = process.argv.includes('--write');

function reportUnknowns(label: string, values: string[]): void {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  process.stdout.write(`${label}: ${values.length}\n`);
  for (const [value, count] of [...counts].sort()) process.stdout.write(`  ${JSON.stringify(value)} (${count})\n`);
}

async function run(): Promise<void> {
  const [transactions, budgets] = await Promise.all([
    prisma.transaction.findMany({
      where: { categoryKey: null },
      select: { id: true, category: true, type: true },
    }),
    prisma.budget.findMany({
      select: { id: true, userId: true, name: true, period: true, isActive: true, categoryKey: true },
    }),
  ]);

  const transactionUpdates = transactions.flatMap((transaction) => {
    const type = transaction.type === 'INCOME' ? 'income' : 'expense';
    const category = normalizeCategory(transaction.category, type);
    return category ? [{ id: transaction.id, categoryKey: category.key }] : [];
  });
  const unknownTransactions = transactions
    .filter((transaction) => !normalizeCategory(transaction.category, transaction.type === 'INCOME' ? 'income' : 'expense'))
    .map((transaction) => transaction.category);

  const resolvedBudgets = budgets.map((budget) => ({
    ...budget,
    resolvedCategoryKey: budget.categoryKey || normalizeCategory(budget.name, 'expense')?.key || null,
  }));
  const activeGroups = new Map<string, BudgetCandidate[]>();
  for (const budget of resolvedBudgets) {
    if (!budget.isActive || !budget.resolvedCategoryKey) continue;
    const key = `${budget.userId}:${budget.resolvedCategoryKey}:${budget.period}`;
    activeGroups.set(key, [...(activeGroups.get(key) || []), budget]);
  }
  const conflicts = [...activeGroups.entries()].filter(([, group]) => group.length > 1);
  const conflictIds = new Set(conflicts.flatMap(([, group]) => group.map((budget) => budget.id)));
  const budgetUpdates = resolvedBudgets.flatMap((budget) =>
    !budget.categoryKey && budget.resolvedCategoryKey && !conflictIds.has(budget.id)
      ? [{ id: budget.id, categoryKey: budget.resolvedCategoryKey }]
      : []
  );
  const unknownBudgets = resolvedBudgets
    .filter((budget) => !budget.resolvedCategoryKey)
    .map((budget) => budget.name);

  process.stdout.write(`Mode: ${write ? 'WRITE' : 'DRY RUN'}\n`);
  process.stdout.write(`Recognized transactions: ${transactionUpdates.length}\n`);
  process.stdout.write(`Recognized non-conflicting budgets: ${budgetUpdates.length}\n`);
  reportUnknowns('Unknown transaction categories', unknownTransactions);
  reportUnknowns('Unknown budget names', unknownBudgets);
  process.stdout.write(`Duplicate active-budget conflicts: ${conflicts.length}\n`);
  for (const [key, group] of conflicts) {
    process.stdout.write(`  ${key}: ${group.map((budget) => budget.id).join(', ')}\n`);
  }

  if (!write) {
    process.stdout.write('No changes written. Re-run with --write after reviewing this report.\n');
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const update of transactionUpdates) {
      await tx.transaction.update({ where: { id: update.id }, data: { categoryKey: update.categoryKey } });
    }
    for (const update of budgetUpdates) {
      await tx.budget.update({ where: { id: update.id }, data: { categoryKey: update.categoryKey } });
    }
  });
  process.stdout.write(`Updated ${transactionUpdates.length} transactions and ${budgetUpdates.length} budgets.\n`);
  if (conflicts.length > 0) process.stdout.write('Conflicting budgets were reported and left unchanged.\n');
}

run()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
