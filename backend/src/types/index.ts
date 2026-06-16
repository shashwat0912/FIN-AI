import { Request } from 'express';
import { User } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface SendOtpRequest {
  identifier: string; // email or phone number
}

export interface VerifyOtpRequest {
  identifier: string; // email or phone number
  otp: string;
  name?: string; // optional for new user registration
}

export interface TransactionRequest {
  amount: number;
  description: string;
  category: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  date: string;
}

export interface BudgetRequest {
  name: string;
  amount: number;
  period: 'MONTHLY' | 'YEARLY' | 'WEEKLY';
}

export interface GoalRequest {
  name: string;
  description?: string;
  targetAmount: number;
  targetDate?: string;
}

export interface AiAdviceRequest {
  query: string;
  context?: {
    currentBalance?: number;
    monthlyIncome?: number;
    monthlyExpenses?: number;
    goals?: string[];
  };
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

// ===== CHAT TYPES =====

export const ChatIntentType = {
  LOG_EXPENSE: 'LOG_EXPENSE',
  LOG_INCOME: 'LOG_INCOME',
  QUERY_SPENDING: 'QUERY_SPENDING',
  QUERY_INCOME: 'QUERY_INCOME',
  SET_BUDGET: 'SET_BUDGET',
  QUERY_BUDGET: 'QUERY_BUDGET',
  QUERY_GOAL: 'QUERY_GOAL',
  GET_ADVICE: 'GET_ADVICE',
  GENERAL_CHAT: 'GENERAL_CHAT',
  UNCLEAR: 'UNCLEAR',
} as const;

export type ChatIntentType = (typeof ChatIntentType)[keyof typeof ChatIntentType];

export type ConversationStateType = 'IDLE' | 'PROCESSING' | 'AWAITING_CATEGORY' | 'AWAITING_CONFIRMATION';

export interface TransactionEntities {
  amount: number;
  description: string;
  category: string | null;
  type: 'income' | 'expense';
  date: string | null;
}

export interface QueryEntities {
  category: string | null;
  timeRange: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'custom';
  startDate: string | null;
  endDate: string | null;
  type: 'income' | 'expense' | 'both';
}

export interface BudgetEntities {
  category: string;
  amount: number;
  period: 'monthly' | 'weekly';
}

export interface ParsedIntent {
  intent: ChatIntentType;
  confidence: number;
  entities: TransactionEntities | QueryEntities | BudgetEntities | null;
  fallbackMessage?: string;
  isFallback?: boolean;
}

export interface ConfirmationCard {
  id: string;
  type: 'transaction' | 'budget';
  data: TransactionEntities | BudgetEntities;
  status: 'PENDING' | 'CONFIRMED' | 'EDITED' | 'CANCELLED' | 'EXPIRED';
}

export interface ChartData {
  type: 'bar' | 'pie' | 'line';
  labels: string[];
  values: number[];
  title: string;
}

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: string;
  dailyRemaining: number;
  dailyLimit: number;
}

export interface ChatResponsePayload {
  message: string;
  confirmationCard: ConfirmationCard | null;
  chartData: ChartData | null;
  suggestedChips: string[];
  conversationState: ConversationStateType;
  rateLimitInfo: RateLimitInfo | null;
  isFallbackMode: boolean;
}

export interface ConversationState {
  userId: string;
  state: ConversationStateType;
  pendingConfirmationId: string | null;
  pendingData: TransactionEntities | BudgetEntities | null;
  stateEnteredAt: string;
  clarificationAttempts: number;
  lastIntent: ChatIntentType | null;
}

export interface IdempotencyCheckResult {
  status: 'new' | 'processing' | 'completed';
  cachedResponse: string | null;
  requestHash: string | null;
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
