import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiResponse } from '../types';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.details[0].message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    next();
  };
};

// Validation schemas
// Password validation regex: min 8 chars, at least one uppercase, one lowercase, one number, one special char
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const authSchemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string()
      .min(8)
      .pattern(passwordRegex)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
      }),
    name: Joi.string().min(2).max(50).required(),
  }),
  
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  // OTP-based authentication schemas
  sendOtp: Joi.object({
    identifier: Joi.string().required().messages({
      'string.empty': 'Email or phone number is required',
      'any.required': 'Email or phone number is required',
    }),
  }),

  verifyOtp: Joi.object({
    identifier: Joi.string().required().messages({
      'string.empty': 'Email or phone number is required',
      'any.required': 'Email or phone number is required',
    }),
    otp: Joi.string().length(4).pattern(/^\d{4}$/).required().messages({
      'string.empty': 'OTP is required',
      'string.length': 'OTP must be 4 digits',
      'string.pattern.base': 'OTP must be 4 digits',
      'any.required': 'OTP is required',
    }),
    name: Joi.string().min(2).max(50).optional().messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name must not exceed 50 characters',
    }),
  }),
};

export const transactionSchemas = {
  create: Joi.object({
    amount: Joi.number().positive().required(),
    description: Joi.string().min(1).max(255).required(),
    category: Joi.string().min(1).max(50).required(),
    type: Joi.string().valid('INCOME', 'EXPENSE', 'TRANSFER').required(),
    date: Joi.date().iso().required(),
  }),
  
  update: Joi.object({
    amount: Joi.number().positive(),
    description: Joi.string().min(1).max(255),
    category: Joi.string().min(1).max(50),
    type: Joi.string().valid('INCOME', 'EXPENSE', 'TRANSFER'),
    date: Joi.date().iso(),
  }),
};

export const budgetSchemas = {
  create: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    amount: Joi.number().positive().required(),
    period: Joi.string().valid('MONTHLY', 'YEARLY', 'WEEKLY').required(),
    isActive: Joi.boolean().default(true),
  }),
  
  update: Joi.object({
    name: Joi.string().min(1).max(100),
    amount: Joi.number().positive(),
    period: Joi.string().valid('MONTHLY', 'YEARLY', 'WEEKLY'),
    isActive: Joi.boolean(),
  }),
};

export const goalSchemas = {
  create: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().allow('').max(500),
    targetAmount: Joi.number().positive().required(),
    currentAmount: Joi.number().min(0).default(0),
    targetDate: Joi.date().iso(),
    status: Joi.string().valid('ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED').default('ACTIVE'),
  }),
  
  update: Joi.object({
    name: Joi.string().min(1).max(100),
    description: Joi.string().allow('').max(500),
    targetAmount: Joi.number().positive(),
    currentAmount: Joi.number().min(0),
    targetDate: Joi.date().iso(),
    status: Joi.string().valid('ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED'),
  }),
  
  updateProgress: Joi.object({
    currentAmount: Joi.number().min(0).required(),
  }),
};

export const aiSchemas = {
  advice: Joi.object({
    query: Joi.string().min(1).max(1000).required(),
    context: Joi.object({
      currentBalance: Joi.number(),
      monthlyIncome: Joi.number(),
      monthlyExpenses: Joi.number(),
      goals: Joi.array().items(Joi.string()),
    }),
  }),
};

export const userSchemas = {
  updateProfile: Joi.object({
    name: Joi.string().min(2).max(50),
    email: Joi.string().email(),
  }),
  
  uploadAvatar: Joi.object({
    avatarUrl: Joi.string().uri().required(),
  }),
  
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string()
      .min(8)
      .pattern(passwordRegex)
      .required()
      .messages({
        'string.min': 'New password must be at least 8 characters long',
        'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
      }),
  }),
};

export const chatSchemas = {
  message: Joi.object({
    content: Joi.string().min(1).max(2000).required(),
  }),
  confirm: Joi.object({
    confirmationId: Joi.string().required(),
  }),
  edit: Joi.object({
    confirmationId: Joi.string().required(),
    data: Joi.object({
      amount: Joi.number().positive(),
      description: Joi.string().trim().min(1).max(255),
    }).min(1).unknown(false).required(),
  }),
};

export const settingsSchemas = {
  update: Joi.object({
    section: Joi.string().valid('profile', 'notifications', 'preferences', 'privacy', 'security').required(),
    settings: Joi.object().required(),
  }),
  
  preferences: Joi.object({
    theme: Joi.string().valid('light', 'dark', 'system'),
    language: Joi.string().valid('en', 'hi', 'es', 'fr'),
    defaultTransactionType: Joi.string().valid('INCOME', 'EXPENSE', 'TRANSFER'),
    defaultCurrency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP'),
    dateFormat: Joi.string().valid('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'),
    numberFormat: Joi.string().valid('Indian', 'International'),
    autoCategorize: Joi.boolean(),
    showTutorials: Joi.boolean(),
  }),
  
  notifications: Joi.object({
    email: Joi.boolean(),
    push: Joi.boolean(),
    sms: Joi.boolean(),
    budgetAlerts: Joi.boolean(),
    goalReminders: Joi.boolean(),
    transactionAlerts: Joi.boolean(),
    weeklyReports: Joi.boolean(),
    monthlyReports: Joi.boolean(),
  }),
};
