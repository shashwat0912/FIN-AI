import { Prisma } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/config/database';
import { projectBudgets } from '../../src/services/budgetProjectionService';
import { TransactionService } from '../../src/services/transactionService';

const describeIntegration =
  process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeIntegration('transaction-derived budget integration', () => {
  const transactionService = new TransactionService();
  let userId: string;

  beforeEach(async () => {
    await prisma.transaction.deleteMany();
    await prisma.budget.deleteMany();
    await prisma.user.deleteMany();
    const user = await prisma.user.create({
      data: {
        email: `budget.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`,
        timezone: 'Asia/Kolkata',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany();
    await prisma.budget.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it('projects exact ledger changes after create, edit, and delete', async () => {
    const now = new Date();
    const foodBudget = await prisma.budget.create({
      data: {
        name: 'Food & Dining',
        categoryKey: 'food-dining',
        amount: new Prisma.Decimal('10.00'),
        period: 'MONTHLY',
        userId,
      },
    });
    const transportBudget = await prisma.budget.create({
      data: {
        name: 'Transportation',
        categoryKey: 'transportation',
        amount: new Prisma.Decimal('10.00'),
        period: 'MONTHLY',
        userId,
      },
    });
    const created = await transactionService.createTransaction(userId, {
      amount: 0.1,
      description: 'Tea',
      category: 'Food & Dining',
      type: 'EXPENSE',
      date: now,
    });
    await transactionService.createTransaction(userId, {
      amount: 0.2,
      description: 'Snack',
      category: 'Food & Dining',
      type: 'EXPENSE',
      date: now,
    });
    await transactionService.createTransaction(userId, {
      amount: 500,
      description: 'Refund',
      category: 'Food & Dining',
      type: 'INCOME',
      date: now,
    });

    let projections = await projectBudgets(userId, [foodBudget, transportBudget], { asOf: now });
    expect(projections.map((item) => item.spent.toString())).toEqual(['0.3', '0']);

    await transactionService.updateTransaction(userId, created.id, {
      amount: 1.25,
      category: 'Transportation',
    });
    projections = await projectBudgets(userId, [foodBudget, transportBudget], { asOf: now });
    expect(projections.map((item) => item.spent.toString())).toEqual(['0.2', '1.25']);

    await transactionService.deleteTransaction(userId, created.id);
    projections = await projectBudgets(userId, [foodBudget, transportBudget], { asOf: now });
    expect(projections.map((item) => item.spent.toString())).toEqual(['0.2', '0']);
  });

  it('rejects duplicate active canonical budgets but permits inactive history', async () => {
    const data = {
      name: 'Food & Dining',
      categoryKey: 'food-dining',
      amount: new Prisma.Decimal('1000'),
      period: 'MONTHLY',
      userId,
    };
    await prisma.budget.create({ data });

    await expect(prisma.budget.create({ data })).rejects.toMatchObject({ code: 'P2002' });
    await expect(prisma.budget.create({ data: { ...data, isActive: false } })).resolves.toBeTruthy();
  });
});
