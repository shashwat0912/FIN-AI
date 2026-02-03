import { LucideIcon } from 'lucide-react';

// ===== CORE TYPES =====

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  avatar?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, unknown>;
}

// ===== API RESPONSE TYPES =====

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface SendOtpRequest {
  identifier: string; // email or phone number
}

export interface SendOtpResponse {
  type: 'email' | 'phone';
  identifier: string;
  expiresIn: number; // seconds
}

export interface VerifyOtpRequest {
  identifier: string; // email or phone number
  otp: string;
  name?: string; // optional for new user registration
}

// ===== TRANSACTION TYPES =====

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  type: 'INCOME' | 'EXPENSE';
  date: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionContext {
  monthlyIncome: number;
  monthlySavings: number;
  currentInvestments: number;
  age: number;
  hasHealthInsurance: boolean;
}

// ===== AI TYPES =====

export interface AiAdvice {
  advice: string;
  category: string;
  confidence: number;
}

export interface AiResponse {
  type: 'savings' | 'investment' | 'insurance' | 'budget';
  title: string;
  description: string;
}

// ===== BUDGET TYPES =====

export interface Budget {
  id: string;
  name: string;
  amount: number;
  spent: number;
  period: 'MONTHLY' | 'YEARLY';
  userId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ===== GOAL TYPES =====

export interface Goal {
  id: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// ===== UI TYPES =====

export interface StatData {
  title: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down';
  lastUpdate?: string;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'purple' | 'yellow';
}

export interface Suggestion {
  type: 'savings' | 'investment' | 'insurance' | 'budget';
  title: string;
  description: string;
}

// ===== FORM TYPES =====

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  email: string;
  password: string;
  name: string;
}

export interface TransactionFormData {
  amount: number;
  description: string;
  category: string;
  type: 'INCOME' | 'EXPENSE';
  date: string;
}

// ===== HOOK TYPES =====

export interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  error: ApiError | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

export interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

// ===== ERROR TYPES =====

export type ErrorHandler = (error: ApiError) => void;

export interface ErrorState {
  hasError: boolean;
  error: ApiError | null;
  retry: () => void;
}

// ===== UTILITY TYPES =====

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export type SortOrder = 'asc' | 'desc';

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}