import cron from 'node-cron';
import prisma from '../config/database';
import logger from '../config/logger';
import OpenAI from 'openai';
import { config } from '../config/env';

const SUMMARIZATION_THRESHOLD = 20;

export function startSummarizationJob(): void {
  cron.schedule('* * * * *', async () => {
    if (!config.OPENAI_API_KEY) return;

    try {
      const allSummaries = await prisma.conversationSummary.findMany({
        select: { userId: true, messageCountAtSummary: true, summary: true },
      });

      const summaryMap = new Map(allSummaries.map((s) => [s.userId, s]));

      const userCounts = await prisma.chatMessage.groupBy({
        by: ['userId'],
        _count: { id: true },
      });

      for (const uc of userCounts) {
        const existing = summaryMap.get(uc.userId);
        const lastCount = existing?.messageCountAtSummary || 0;
        const currentCount = uc._count.id;

        if (currentCount - lastCount < SUMMARIZATION_THRESHOLD) continue;

        try {
          const unsummarized = await prisma.chatMessage.findMany({
            where: { userId: uc.userId, role: { not: 'SYSTEM' } },
            orderBy: { createdAt: 'asc' },
            skip: lastCount,
            take: SUMMARIZATION_THRESHOLD + 10,
            select: { role: true, content: true },
          });

          if (unsummarized.length === 0) continue;

          const conversationText = unsummarized
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n');

          const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
          const existingSummary = existing?.summary || '';

          const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: 'Summarize the following conversation between a user and a finance assistant in 2-3 sentences. Focus on key financial actions taken (transactions logged, budgets set, queries made).',
              },
              {
                role: 'user',
                content: existingSummary
                  ? `Previous summary: ${existingSummary}\n\nNew messages:\n${conversationText}`
                  : conversationText,
              },
            ],
            max_tokens: 200,
            temperature: 0.3,
          });

          const newSummary = completion.choices[0]?.message?.content || existingSummary;
          const tokenCount = Math.ceil(newSummary.split(/\s+/).length / 0.75);

          await prisma.conversationSummary.upsert({
            where: { userId: uc.userId },
            update: { summary: newSummary, messageCountAtSummary: currentCount, tokenCount },
            create: { userId: uc.userId, summary: newSummary, messageCountAtSummary: currentCount, tokenCount },
          });

          logger.info(`Summarized conversation for user ${uc.userId} (${currentCount} messages)`);
        } catch (err) {
          logger.error(`Summarization failed for user ${uc.userId}:`, err);
        }
      }
    } catch (err) {
      logger.error('Summarization job error:', err);
    }
  });

  logger.info('Summarization job scheduled (every 60s)');
}
