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
  jti?: string; // JWT ID for uniqueness
  iat?: number;
  exp?: number;
}
