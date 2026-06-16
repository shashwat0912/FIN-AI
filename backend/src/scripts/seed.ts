import prisma from '../config/database';
import { AuthService } from '../services/authService';
import logger from '../config/logger';

const authService = new AuthService();

async function seedDatabase() {
  try {
    logger.info('🌱 Starting database seeding...');

    // Create test user with a strong password that meets requirements
    // Password must have: uppercase, lowercase, number, special character (@$!%*?&)
    const testUser = await authService.register({
      email: 'test@example.com',
      password: 'Test123!@',
      name: 'Test User',
    });

    logger.info(`✅ Test user created: ${testUser.user.email}`);

    // Create sample transactions
    const sampleTransactions = [
      {
        amount: 5000,
        description: 'Salary',
        category: 'Income',
        type: 'INCOME' as const,
        date: new Date('2024-01-01'),
        userId: testUser.user.id,
      },
      {
        amount: 1500,
        description: 'Rent',
        category: 'Housing',
        type: 'EXPENSE' as const,
        date: new Date('2024-01-01'),
        userId: testUser.user.id,
      },
      {
        amount: 300,
        description: 'Groceries',
        category: 'Food',
        type: 'EXPENSE' as const,
        date: new Date('2024-01-02'),
        userId: testUser.user.id,
      },
      {
        amount: 200,
        description: 'Transportation',
        category: 'Transport',
        type: 'EXPENSE' as const,
        date: new Date('2024-01-03'),
        userId: testUser.user.id,
      },
      {
        amount: 1000,
        description: 'Freelance Work',
        category: 'Income',
        type: 'INCOME' as const,
        date: new Date('2024-01-05'),
        userId: testUser.user.id,
      },
      {
        amount: 150,
        description: 'Mangoes from local market',
        category: 'Food',
        type: 'EXPENSE' as const,
        date: new Date('2024-01-06'),
        userId: testUser.user.id,
      },
      {
        amount: 250,
        description: 'Fresh mangoes and vegetables',
        category: 'Food',
        type: 'EXPENSE' as const,
        date: new Date('2024-01-07'),
        userId: testUser.user.id,
      },
    ];

    for (const transaction of sampleTransactions) {
      await prisma.transaction.create({ data: transaction });
    }

    logger.info('✅ Sample transactions created');

    // Create sample budgets
    const sampleBudgets = [
      {
        name: 'Monthly Budget',
        amount: 3000,
        spent: 2000,
        period: 'MONTHLY' as const,
        userId: testUser.user.id,
      },
      {
        name: 'Food Budget',
        amount: 500,
        spent: 300,
        period: 'MONTHLY' as const,
        userId: testUser.user.id,
      },
    ];

    for (const budget of sampleBudgets) {
      await prisma.budget.create({ data: budget });
    }

    logger.info('✅ Sample budgets created');

    // Create sample goals
    const sampleGoals = [
      {
        name: 'Emergency Fund',
        description: 'Build 6 months of expenses',
        targetAmount: 10000,
        currentAmount: 2500,
        targetDate: new Date('2024-12-31'),
        status: 'ACTIVE' as const,
        userId: testUser.user.id,
      },
      {
        name: 'Vacation Fund',
        description: 'Trip to Europe',
        targetAmount: 5000,
        currentAmount: 1500,
        targetDate: new Date('2024-06-30'),
        status: 'ACTIVE' as const,
        userId: testUser.user.id,
      },
    ];

    for (const goal of sampleGoals) {
      await prisma.goal.create({ data: goal });
    }

    logger.info('✅ Sample goals created');

    // Create sample AI sessions
    const sampleAiSessions = [
      {
        query: 'How should I budget my monthly income?',
        response: 'I recommend following the 50/30/20 rule: 50% for needs, 30% for wants, and 20% for savings.',
        category: 'budgeting',
        userId: testUser.user.id,
      },
      {
        query: 'What are good investment options for beginners?',
        response: 'Consider low-cost index funds or ETFs. Start with a diversified portfolio and maintain a long-term perspective.',
        category: 'investment',
        userId: testUser.user.id,
      },
    ];

    for (const session of sampleAiSessions) {
      await prisma.aiSession.create({ data: session });
    }

    logger.info('✅ Sample AI sessions created');

    logger.info('🎉 Database seeding completed successfully!');
    logger.info(`📧 Test user email: ${testUser.user.email}`);
    logger.info('🔑 Test user password: Test123!@');

  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

export default seedDatabase;
