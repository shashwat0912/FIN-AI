import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import prisma from '../../src/config/database';
import { config } from '../../src/config/env';
import advisorRoutes from '../../src/routes/advisor';
import { ScopedFinanceTools } from '../../src/advisor/tools';
const integration = process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;
integration('Advisor authenticated PostgreSQL isolation', () => {
  const app = express();
  app.use(express.json());
  app.use('/advisor', advisorRoutes);
  let own = '',
    foreign = '',
    foreignGoal = '',
    token = '';
  beforeAll(async () => {
    own = (await prisma.user.create({ data: { email: `advisor-own-${Date.now()}@example.com` } }))
      .id;
    foreign = (
      await prisma.user.create({ data: { email: `advisor-foreign-${Date.now()}@example.com` } })
    ).id;
    token = jwt.sign({ userId: own }, config.JWT_SECRET, { expiresIn: '5m' });
    for (const userId of [own, foreign]) {
      for (const month of ['2026-09', '2026-10', '2026-11']) {
        await prisma.transaction.createMany({
          data: [
            {
              userId,
              amount: userId === own ? 100000 : 9876543,
              category: 'Salary',
              categoryKey: 'salary-wages',
              type: 'INCOME',
              date: new Date(`${month}-01T01:00:00Z`),
              description: 'private transaction narrative',
            },
            {
              userId,
              amount: 20000,
              category: 'Food & Dining',
              categoryKey: 'food-dining',
              type: 'EXPENSE',
              date: new Date(`${month}-01T02:00:00Z`),
              description: 'private transaction narrative',
            },
            {
              userId,
              amount: 10000,
              category: 'Subscriptions',
              type: 'EXPENSE',
              date: new Date(`${month}-02T02:00:00Z`),
              description: 'private transaction narrative',
            },
          ],
        });
      }
      await prisma.budget.create({
        data: {
          userId,
          name: userId === own ? 'Food' : 'FOREIGN_BUDGET',
          categoryKey: 'food-dining',
          amount: 10000,
          period: 'MONTHLY',
        },
      });
      const goal = await prisma.goal.create({
        data: {
          userId,
          name: userId === own ? 'Emergency' : 'FOREIGN_GOAL',
          targetAmount: 300000,
          currentAmount: 60000,
          targetDate: new Date('2027-11-03'),
        },
      });
      if (userId === foreign) foreignGoal = goal.id;
    }
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [own, foreign].filter(Boolean) } } });
    await prisma.$disconnect();
  });
  it('requires authentication and rejects client-supplied identity', async () => {
    await request(app).post('/advisor').send({ question: 'How are my finances?' }).expect(401);
    await request(app)
      .post('/advisor')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'How are my finances?', userId: foreign })
      .expect(400);
  });
  it('reads only the authenticated owner across all personal tools and strips narratives', async () => {
    const tools = new ScopedFinanceTools(own, new Date('2026-11-03T12:00:00Z'));
    const signal = new AbortController().signal;
    const results = await Promise.all(
      [
        'get_financial_summary',
        'get_budget_status',
        'get_goal_progress',
        'get_spending_trends',
        'get_category_breakdown',
        'get_recurring_expenses',
        'get_recent_transactions',
      ].map(name => tools.call(name as Parameters<typeof tools.call>[0], {}, signal))
    );
    expect(results[0]).toMatchObject({
      totalIncome: 100000,
      totalExpenses: 30000,
      netAmount: 70000,
    });
    expect(results[5]).toMatchObject({ total: 10000, inferred: true });
    expect(JSON.stringify(results)).not.toMatch(/9876543|FOREIGN_|private transaction narrative/);
    const snapshots = await prisma.transaction.count({ where: { userId: own } });
    await expect(
      tools.call(
        'simulate_savings_plan',
        { simulation: { kind: 'increase_savings', amount: 3000, goalId: foreignGoal } },
        signal
      )
    ).rejects.toThrow('NOT_FOUND');
    const result = await tools.call(
      'simulate_savings_plan',
      { simulation: { kind: 'reduce_category', category: 'food-dining', percent: 25 } },
      signal
    );
    expect(result).toMatchObject({
      monthlyChange: 5000,
      baselineMonthlySavings: 70000,
      scenarioMonthlySavings: 75000,
    });
    expect(await prisma.transaction.count({ where: { userId: own } })).toBe(snapshots);
  });
  it('returns evidence-backed advice through the actual authenticated route', async () => {
    const response = await request(app)
      .post('/advisor')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'Summarize my finances' })
      .expect(200);
    expect(response.body.data.provider).toBe('mock');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.data.evidence.length).toBeGreaterThan(0);
    expect(JSON.stringify(response.body)).not.toMatch(
      /9876543|FOREIGN_|private transaction narrative/
    );
  });
});
