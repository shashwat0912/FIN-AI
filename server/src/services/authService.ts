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
   * Find user by email or phone number
   */
  async findUserByIdentifier(identifier: string): Promise<any | null> {
    // Try to find by email first
    let user = await prisma.user.findUnique({
      where: { email: identifier },
    });

    // If not found and identifier looks like a phone, try to find by email with phone format
    // (In case we store phone numbers in the email field)
    if (!user && identifier.startsWith('+91')) {
      user = await prisma.user.findUnique({
        where: { email: identifier },
      });
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
