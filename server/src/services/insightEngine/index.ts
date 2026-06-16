import { randomUUID } from 'crypto';
import prisma from '../../config/database';
import {
  ConfidenceSignals,
  DetectorContext,
  Insight,
  InsightCandidate,
  InsightDetector,
  InsightTransaction,
} from './types';
import { spendingLeakDetector } from './detectors/spendingLeakDetector';
import { budgetBreachDetector } from './detectors/budgetBreachDetector';
import { behavioralSpikeDetector } from './detectors/behavioralSpikeDetector';
import { scoreInsight, sortInsightsByPriority } from './scoring/priorityScorer';
import { addDays, startOfDay } from './utils/dateUtils';

const LOOKBACK_DAYS = 30;
const MAX_INSIGHTS = 5;

const DETECTORS: InsightDetector[] = [
  spendingLeakDetector,
  budgetBreachDetector,
  behavioralSpikeDetector,
];

function toInsightTransaction(row: {
  id: string;
  category: string;
  amount: unknown;
  date: Date;
}): InsightTransaction {
  return {
    id: row.id,
    category: row.category,
    amount: Number(row.amount),
    date: new Date(row.date),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function deriveConfidence(signals: ConfidenceSignals): number {
  const sampleScore = clamp(signals.sampleSize / 4, 0, 1);
  const ratioScore = clamp(((signals.ratio || 1) - 1) / 1.5, 0, 1);
  const volatilityPenalty = clamp(signals.volatility || 0, 0, 1) * 0.15;

  const confidence = 0.5 + sampleScore * 0.2 + ratioScore * 0.3 - volatilityPenalty;
  return Number(clamp(confidence, 0.5, 1).toFixed(2));
}

function finalizeInsight(candidate: InsightCandidate, createdAt: Date): Insight {
  const confidence = deriveConfidence(candidate.confidenceSignals);

  return {
    id: randomUUID(),
    type: candidate.type,
    category: candidate.category,
    title: candidate.title,
    description: candidate.description,
    impact: candidate.impact,
    confidence,
    priorityScore: scoreInsight(candidate.impact.monthly, confidence),
    suggestedAction: candidate.suggestedAction,
    createdAt,
  };
}

export async function generateInsights(userId: string): Promise<Insight[]> {
  const generatedAt = new Date();
  const lookbackStart = startOfDay(addDays(generatedAt, -(LOOKBACK_DAYS - 1)));

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'EXPENSE',
      date: {
        gte: lookbackStart,
        lte: generatedAt,
      },
    },
    orderBy: {
      date: 'asc',
    },
    select: {
      id: true,
      category: true,
      amount: true,
      date: true,
    },
  });

  if (transactions.length === 0) {
    return [];
  }

  const context: DetectorContext = {
    userId,
    generatedAt,
    transactions: transactions.map(toInsightTransaction),
  };

  const candidates = DETECTORS.flatMap((detector) => detector.detect(context));
  const insights = candidates.map((candidate) => finalizeInsight(candidate, generatedAt));

  return sortInsightsByPriority(insights).slice(0, MAX_INSIGHTS);
}

export * from './types';
