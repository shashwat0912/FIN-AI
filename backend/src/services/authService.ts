import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { LoginRequest, RegisterRequest, JwtPayload } from '../types';
import logger from '../config/logger';

export class AuthService {
  async register(data: RegisterRequest) {
    const { email, password, name } = data;

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!password || password.length < 8) {
      throw new AppError('Password must be at least 8 characters long', 400);
    }
    if (!passwordRegex.test(password)) {
      throw new AppError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)', 400);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError('User already exists with this email', 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword, // Store the hashed password
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Clean up old refresh tokens for this user (keep only the last 5)
    await this.cleanupOldRefreshTokens(user.id);

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    logger.info(`User registered: ${user.email}`);

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  async login(data: LoginRequest) {
    const { email, password } = data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check if user has a password (for existing users without passwords)
    if (!user.password) {
      throw new AppError('Please set a password for your account', 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Clean up old refresh tokens for this user (keep only the last 5)
    await this.cleanupOldRefreshTokens(user.id);

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    logger.info(`User logged in: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(token: string) {
    // Find refresh token
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!refreshToken || refreshToken.expiresAt < new Date()) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    // Generate new tokens
    const accessToken = this.generateAccessToken(refreshToken.user);
    const newRefreshToken = this.generateRefreshToken(refreshToken.user);

    // Update refresh token
    await prisma.refreshToken.update({
      where: { id: refreshToken.id },
      data: {
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(token: string) {
    await prisma.refreshToken.deleteMany({
      where: { token },
    });

    logger.info('User logged out');
  }

  async logoutAll(userId: string) {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });

    logger.info(`All sessions logged out for user: ${userId}`);
  }

  public generateAccessToken(user: any): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  public generateRefreshToken(user: any): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      // Add unique identifier to prevent duplicate tokens
      jti: `${user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
      expiresIn: config.JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  async setPassword(userId: string, password: string) {
    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!password || password.length < 8) {
      throw new AppError('Password must be at least 8 characters long', 400);
    }
    if (!passwordRegex.test(password)) {
      throw new AppError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)', 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    logger.info(`Password set for user: ${userId}`);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Validate new password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!newPassword || newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters long', 400);
    }
    if (!passwordRegex.test(newPassword)) {
      throw new AppError('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)', 400);
    }

    // If user has a password, verify current password
    if (user.password) {
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        throw new AppError('Current password is incorrect', 401);
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    logger.info(`Password changed for user: ${userId}`);
  }

  private async cleanupOldRefreshTokens(userId: string): Promise<void> {
    // Get all refresh tokens for the user, ordered by creation date
    const tokens = await prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // If there are more than 5 tokens, delete the oldest ones
    if (tokens.length >= 5) {
      const tokensToDelete = tokens.slice(4); // Keep the first 4 (most recent)
      const tokenIds = tokensToDelete.map(token => token.id);
      
      await prisma.refreshToken.deleteMany({
        where: { id: { in: tokenIds } },
      });
    }
  }

  /**
   * Get phone lookup variants so we find user regardless of stored format
   * (e.g. +919876543210, 919876543210, 9876543210, 09876543210)
   */
  private getPhoneLookupVariants(identifier: string): string[] {
    const variants = new Set<string>([identifier]);
    
    // Extract all digits
    const digitsOnly = identifier.replace(/\D/g, '');
    
    // If we have 10-13 digits (could be Indian phone number)
    if (digitsOnly.length >= 10 && digitsOnly.length <= 13) {
      // Extract the last 10 digits (the actual phone number)
      const tenDigits = digitsOnly.slice(-10);
      
      // Only proceed if it's a valid Indian mobile number (starts with 6-9)
      if (/^[6-9]\d{9}$/.test(tenDigits)) {
        variants.add(`+91${tenDigits}`);
        variants.add(`91${tenDigits}`);
        variants.add(tenDigits);
        variants.add(`0${tenDigits}`);
        // Also try with spaces/dashes removed from original
        if (identifier.includes(' ') || identifier.includes('-')) {
          const cleaned = identifier.replace(/[\s-]/g, '');
          variants.add(cleaned);
        }
      }
    }
    
    return [...variants];
  }

  /**
   * Find user by email or phone number.
   * Tries exact match and, for phone-like identifiers, multiple stored formats.
   */
  async findUserByIdentifier(identifier: string): Promise<any | null> {
    logger.info(`Looking up user with identifier: ${identifier}`);
    
    // Exact match first
    let user = await prisma.user.findUnique({
      where: { email: identifier },
    });

    if (user) {
      logger.info(`Found user with exact match: ${identifier}`);
      return user;
    }

    // For phone-like identifiers, try all common stored formats
    const variants = this.getPhoneLookupVariants(identifier);
    logger.info(`Trying phone variants: ${variants.join(', ')}`);
    
    if (variants.length > 1) {
      user = await prisma.user.findFirst({
        where: {
          OR: variants.map((v) => ({ email: v })),
        },
      });
      
      if (user) {
        logger.info(`Found user with variant match. Stored as: ${user.email}`);
      } else {
        logger.info(`No user found with any variant`);
      }
    }

    return user;
  }

  /**
   * Create a new user with OTP authentication
   */
  async createUserWithOtp(identifier: string, name: string, type: 'email' | 'phone'): Promise<any> {
    // For phone-based registration, use the phone number as email
    // In a production system, you might want a separate phone field
    const email = type === 'email' ? identifier : identifier;

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: null, // No password for OTP-based users
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        createdAt: true,
      },
    });

    logger.info(`User created via OTP: ${email}`);

    return user;
  }

  /**
   * Store refresh token
   */
  async storeRefreshToken(token: string, userId: string): Promise<void> {
    // Clean up old refresh tokens for this user (keep only the last 5)
    await this.cleanupOldRefreshTokens(userId);

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });
  }
}
