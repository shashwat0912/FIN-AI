export interface Insight {
  id: string;
  type: string;
  category?: string;
  title: string;
  description: string;
  impact: {
    monthly: number;
    yearly: number;
  };
  confidence: number;
  priorityScore: number;
  suggestedAction?: {
    type: string;
    payload: any;
  };
  createdAt: Date;
}

export interface InsightTransaction {
  id: string;
  category: string;
  amount: number;
  date: Date;
}

export interface TimeWindow {
  label: string;
  start: Date;
  end: Date;
}

export interface ConfidenceSignals {
  sampleSize: number;
  ratio?: number;
  volatility?: number;
}

export interface InsightCandidate {
  type: string;
  category?: string;
  title: string;
  description: string;
  impact: {
    monthly: number;
    yearly: number;
  };
  suggestedAction?: {
    type: string;
    payload: any;
  };
  confidenceSignals: ConfidenceSignals;
}

export interface DetectorContext {
  userId: string;
  generatedAt: Date;
  transactions: InsightTransaction[];
}

export interface InsightDetector {
  detect(context: DetectorContext): InsightCandidate[];
}

export type CategoryTotals = Record<string, number>;
