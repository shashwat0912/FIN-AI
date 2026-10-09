import { afterAll, expect, it } from 'vitest';
import prisma from '../src/config/database';
import { KnowledgeBaseService } from '../src/services/knowledgeBaseService';

const service = new KnowledgeBaseService();
afterAll(() => prisma.$disconnect());
it('creates and updates knowledge using the actual PostgreSQL TEXT schema', async () => {
  const id = await service.addChunk({ content: 'Budget emergency savings', category: 'budgeting', metadata: { revision: 1 } });
  try {
    const first = await prisma.knowledgeChunk.findUniqueOrThrow({ where: { id } });
    expect(JSON.parse(first.metadata!)).toEqual({ revision: 1 });
    expect(JSON.parse(first.embedding!)).toHaveLength(256);
    await service.updateChunk(id, { content: 'Plan retirement savings', source: '', metadata: { revision: 2 } });
    const updated = await prisma.knowledgeChunk.findUniqueOrThrow({ where: { id } });
    expect(JSON.parse(updated.metadata!)).toEqual({ revision: 2 });
    expect(updated.embedding).not.toBe(first.embedding);
    expect(updated.category).toBe('budgeting');
    expect(updated.source).toBe('');
  } finally {
    await service.deleteChunk(id);
  }
});
