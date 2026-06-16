import crypto from 'crypto';
import prisma from '../config/database';
import logger from '../config/logger';
import { EmbeddingService } from './embeddingService';

export interface RetrievedChunk {
  id: string;
  content: string;
  category: string;
  source?: string;
  similarity: number;
  documentTitle?: string;
  sourceType?: string;
}

export interface RAGConfig {
  topK?: number;
  similarityThreshold?: number;
  candidatePool?: number;
  categories?: string[];
  sourceTypes?: string[];
  jurisdiction?: string;
}

export interface RagDocumentInput {
  title: string;
  content: string;
  sourceType: string;
  sourceUri?: string;
  jurisdiction?: string;
  language?: string;
  category?: string;
  metadata?: Record<string, unknown>;
  overwriteExisting?: boolean;
}

export interface RagIndexResult {
  documentId: string;
  chunkCount: number;
  skipped: boolean;
}

interface RetrievalCandidate {
  id: string;
  content: string;
  category: string;
  embedding: string | null;
  document: {
    title: string;
    sourceUri: string | null;
    sourceType: string;
  };
}

export class RAGService {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  async indexDocument(input: RagDocumentInput): Promise<RagIndexResult> {
    const cleanContent = input.content.trim();
    if (!cleanContent) {
      throw new Error('Cannot index empty document content');
    }

    const chunks = this.chunkText(cleanContent);
    const checksum = this.computeChecksum(cleanContent);
    const category = input.category || 'general';
    const metadata = JSON.stringify(input.metadata || {});
    const jurisdiction = input.jurisdiction || 'india';
    const language = input.language || 'en';

    const existing = await prisma.ragDocument.findUnique({
      where: { checksum },
      select: { id: true, chunkCount: true },
    });

    if (existing && !input.overwriteExisting) {
      return {
        documentId: existing.id,
        chunkCount: existing.chunkCount,
        skipped: true,
      };
    }

    const embeddings = await this.embeddingService.generateEmbeddingsSafely(chunks);
    const documentId = existing?.id || crypto.randomUUID();

    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.ragChunk.deleteMany({ where: { documentId } });
        await tx.ragDocument.update({
          where: { id: documentId },
          data: {
            title: input.title,
            sourceType: input.sourceType,
            sourceUri: input.sourceUri,
            jurisdiction,
            language,
            metadata,
            chunkCount: chunks.length,
          },
        });
      } else {
        await tx.ragDocument.create({
          data: {
            id: documentId,
            title: input.title,
            sourceType: input.sourceType,
            sourceUri: input.sourceUri,
            jurisdiction,
            language,
            checksum,
            metadata,
            chunkCount: chunks.length,
          },
        });
      }

      for (let i = 0; i < chunks.length; i++) {
        await tx.ragChunk.create({
          data: {
            documentId,
            chunkIndex: i,
            category,
            content: chunks[i],
            tokenCount: this.estimateTokenCount(chunks[i]),
            embedding: embeddings[i] ? JSON.stringify(embeddings[i]) : null,
            metadata,
          },
        });
      }
    });

    logger.info('RAG document indexed', {
      documentId,
      title: input.title,
      sourceType: input.sourceType,
      chunkCount: chunks.length,
      embeddingMode: this.embeddingService.getMode(),
    });

    return { documentId, chunkCount: chunks.length, skipped: false };
  }

  async bulkIndexDocuments(inputs: RagDocumentInput[]): Promise<RagIndexResult[]> {
    const results: RagIndexResult[] = [];
    for (const input of inputs) {
      try {
        const result = await this.indexDocument(input);
        results.push(result);
      } catch (error: any) {
        logger.error('Failed to index RAG document', {
          title: input.title,
          error: error?.message || 'unknown',
        });
      }
    }
    return results;
  }

  async retrieveContext(query: string, config?: RAGConfig): Promise<RetrievedChunk[]> {
    const topK = config?.topK ?? 5;
    const similarityThreshold = config?.similarityThreshold ?? 0.3;
    const candidatePool = config?.candidatePool ?? 250;

    const where: Record<string, unknown> = {};
    if (config?.categories && config.categories.length > 0) {
      where.category = { in: config.categories };
    }

    const documentFilter: Record<string, unknown> = {};
    if (config?.jurisdiction) {
      documentFilter.jurisdiction = config.jurisdiction;
    }
    if (config?.sourceTypes && config.sourceTypes.length > 0) {
      documentFilter.sourceType = { in: config.sourceTypes };
    }
    if (Object.keys(documentFilter).length > 0) {
      where.document = documentFilter;
    }

    const candidates = await prisma.ragChunk.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: candidatePool,
      select: {
        id: true,
        content: true,
        category: true,
        embedding: true,
        document: {
          select: {
            title: true,
            sourceUri: true,
            sourceType: true,
          },
        },
      },
    }) as RetrievalCandidate[];

    if (candidates.length === 0) {
      return [];
    }

    const queryKeywords = this.extractKeywords(query);
    const hintedCategories = this.inferCategoryHints(query);
    let queryEmbedding: number[] | null = null;
    if (this.embeddingService.isConfigured()) {
      try {
        queryEmbedding = await this.embeddingService.generateEmbedding(query);
      } catch (error: any) {
        logger.warn('RAG embedding generation failed. Falling back to keyword retrieval.', {
          error: error?.message || 'unknown',
        });
      }
    }

    const scored: { candidate: RetrievalCandidate; similarity: number }[] = [];
    for (const candidate of candidates) {
      const keywordScore = this.computeKeywordScore(queryKeywords, candidate.content);
      let vectorScore = 0;

      if (queryEmbedding) {
        let candidateEmbedding = candidate.embedding
          ? this.safeParseEmbedding(candidate.embedding)
          : null;

        // If chunks were indexed without embeddings, compute deterministic local vectors on-the-fly
        // so retrieval quality remains strong even without an OpenAI key.
        if (!candidateEmbedding && !this.embeddingService.isUsingOpenAI()) {
          candidateEmbedding = await this.embeddingService.generateEmbedding(candidate.content);
        }

        if (candidateEmbedding) {
          vectorScore = this.embeddingService.cosineSimilarity(queryEmbedding, candidateEmbedding);
        }
      }

      const baseSimilarity = queryEmbedding ? (vectorScore * 0.85 + keywordScore * 0.15) : keywordScore;
      const categoryBoost = hintedCategories.has(candidate.category.toLowerCase()) ? 0.14 : 0;
      const similarity = Math.min(1, baseSimilarity + categoryBoost);
      scored.push({ candidate, similarity });
    }

    const threshold = queryEmbedding ? similarityThreshold : Math.min(similarityThreshold, 0.12);

    return scored
      .filter((item) => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map((item) => ({
        id: item.candidate.id,
        content: item.candidate.content,
        category: item.candidate.category,
        source: item.candidate.document.sourceUri || item.candidate.document.title,
        similarity: Number(item.similarity.toFixed(4)),
        documentTitle: item.candidate.document.title,
        sourceType: item.candidate.document.sourceType,
      }));
  }

  async hybridSearch(query: string, config?: RAGConfig): Promise<RetrievedChunk[]> {
    return this.retrieveContext(query, config);
  }

  formatContextForPrompt(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) {
      return '';
    }

    const lines = chunks.map((chunk, index) => {
      const source = chunk.source ? ` [Source: ${chunk.source}]` : '';
      return `${index + 1}. (${chunk.category}) ${chunk.content}${source}`;
    });

    return `Relevant Knowledge Base Context:\n${lines.join('\n')}\n`;
  }

  buildGroundedAdvicePrompt(query: string, userContext: Record<string, unknown> | undefined, chunks: RetrievedChunk[]): string {
    const contextSection = this.formatContextForPrompt(chunks);
    const userContextSection = userContext
      ? `User Financial Context:\n${JSON.stringify(userContext, null, 2)}\n`
      : 'User Financial Context: Not provided\n';

    return [
      `User Query: ${query}`,
      userContextSection,
      contextSection || 'Relevant Knowledge Base Context: none\n',
      'Instructions:',
      '1) Give practical India-focused financial guidance.',
      '2) If context is insufficient, say exactly what additional info is needed.',
      '3) Avoid guaranteed-return language.',
      '4) Keep advice concise and actionable.',
    ].join('\n');
  }

  chunkText(text: string, chunkSizeWords: number = 140, overlapWords: number = 25): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const chunks: string[] = [];
    const step = Math.max(1, chunkSizeWords - overlapWords);
    for (let i = 0; i < words.length; i += step) {
      const chunkWords = words.slice(i, i + chunkSizeWords);
      if (chunkWords.length === 0) continue;
      chunks.push(chunkWords.join(' '));
    }
    return chunks;
  }

  private estimateTokenCount(text: string): number {
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 0.75));
  }

  private computeChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private safeParseEmbedding(raw: string): number[] | null {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v));
    } catch {
      return null;
    }
  }

  private extractKeywords(query: string): string[] {
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as',
      'by', 'about', 'how', 'what', 'when', 'where', 'why', 'should', 'can', 'could', 'will', 'would',
      'this', 'that', 'month', 'year',
    ]);

    return query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 2 && !stopWords.has(word))
      .slice(0, 12);
  }

  private computeKeywordScore(keywords: string[], content: string): number {
    if (keywords.length === 0) return 0;
    const normalized = content.toLowerCase();
    let hits = 0;
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) hits += 1;
    }
    return hits / keywords.length;
  }

  private inferCategoryHints(query: string): Set<string> {
    const text = query.toLowerCase();
    const hints = new Set<string>();

    if (/\b(tax|80c|80d|deduction|itr)\b/.test(text)) hints.add('tax_planning');
    if (/\b(retire|retirement|pension|nps|epf)\b/.test(text)) hints.add('retirement');
    if (/\b(insurance|term plan|health cover|ulip)\b/.test(text)) hints.add('insurance');
    if (/\b(credit|loan|debt|emi|interest card)\b/.test(text)) hints.add('debt_management');
    if (/\b(invest|sip|mutual fund|equity|ppf|elss|index)\b/.test(text)) hints.add('investment');
    if (/\b(budget|spend|expenses|save|saving|emergency fund)\b/.test(text)) hints.add('budgeting');

    return hints;
  }
}
