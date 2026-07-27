import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResponse } from '../../src/types';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    budget: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    transaction: { groupBy: vi.fn() },
  },
}));

vi.mock('../../src/config/database', () => ({ default: mockPrisma }));

import { BudgetController } from '../../src/controllers/budgetController';

describe('BudgetController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ timezone: 'Asia/Kolkata' });
    mockPrisma.budget.create.mockImplementation(async ({
      data,
    }: {
      data: Prisma.BudgetUncheckedCreateInput;
    }) => ({
      id: 'budget-unsupported',
      ...data,
      amount: new Prisma.Decimal(data.amount),
      spent: new Prisma.Decimal(0),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  });

  it('creates an unsupported budget with a null categoryKey and no legacy spent write', async () => {
    const json = vi.fn();
    const response = { status: vi.fn(), json };
    response.status.mockReturnValue(response);
    const request = {
      user: { id: 'user-1' },
      body: { name: 'Unsupported New Category', amount: 1000, period: 'MONTHLY' },
    };

    await new BudgetController().createBudget(
      request as unknown as Request,
      response as unknown as Response<ApiResponse>
    );

    expect(mockPrisma.budget.create).toHaveBeenCalledWith({
      data: {
        name: 'Unsupported New Category',
        categoryKey: null,
        amount: 1000,
        period: 'MONTHLY',
        isActive: true,
        userId: 'user-1',
      },
    });
    expect(mockPrisma.transaction.groupBy).not.toHaveBeenCalled();
    expect(json.mock.calls[0][0].data.categoryKey).toBeNull();
    expect(json.mock.calls[0][0].data.spent.toString()).toBe('0');
  });
});
