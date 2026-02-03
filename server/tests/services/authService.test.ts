import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthService } from '../../src/services/authService';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock Prisma
const mockPrisma = {
  user: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  refreshToken: {
    create: vi.fn(),
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
  $disconnect: vi.fn(),
} as unknown as PrismaClient;

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  hash: vi.fn(),
  compare: vi.fn(),
}));

// Mock jwt
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
  sign: vi.fn(),
  verify: vi.fn(),
}));

// Mock config
vi.mock('../../src/config/env', () => ({
  config: {
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '7d',
  },
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const hashedPassword = 'hashed-password';
      const mockUser = {
        id: '1',
        email: userData.email,
        name: userData.name,
        role: 'USER',
        createdAt: new Date(),
      };

      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword as never);
      vi.mocked(mockPrisma.user.create).mockResolvedValue(mockUser);
      vi.mocked(jwt.sign).mockReturnValue('access-token' as never);
      vi.mocked(mockPrisma.refreshToken.create).mockResolvedValue({
        id: '1',
        token: 'refresh-token',
        userId: '1',
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      const result = await authService.register(userData);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: userData.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 12);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: userData.email,
          password: hashedPassword,
          name: userData.name,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });
      expect(result.user.email).toBe(userData.email);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('should throw error if user already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const existingUser = {
        id: '1',
        email: userData.email,
        name: 'Existing User',
        role: 'USER',
        createdAt: new Date(),
      };

      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(existingUser);

      await expect(authService.register(userData))
        .rejects
        .toThrow('User already exists with this email');
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: '1',
        email: loginData.email,
        name: 'Test User',
        password: 'hashed-password',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(jwt.sign).mockReturnValue('access-token' as never);
      vi.mocked(mockPrisma.refreshToken.create).mockResolvedValue({
        id: '1',
        token: 'refresh-token',
        userId: '1',
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      const result = await authService.login(loginData);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginData.email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(loginData.password, mockUser.password);
      expect(result.user.email).toBe(loginData.email);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('should throw error for invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      const mockUser = {
        id: '1',
        email: loginData.email,
        name: 'Test User',
        password: 'hashed-password',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(authService.login(loginData))
        .rejects
        .toThrow('Invalid credentials');
    });

    it('should throw error if user not found', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(null);

      await expect(authService.login(loginData))
        .rejects
        .toThrow('Invalid credentials');
    });

    it('should throw error if user is inactive', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: '1',
        email: loginData.email,
        name: 'Test User',
        password: 'hashed-password',
        role: 'USER',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(mockUser);

      await expect(authService.login(loginData))
        .rejects
        .toThrow('Account is deactivated');
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockRefreshToken = {
        id: '1',
        token: refreshToken,
        userId: '1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        createdAt: new Date(),
      };

      vi.mocked(jwt.verify).mockReturnValue({ userId: '1' } as never);
      vi.mocked(mockPrisma.refreshToken.findFirst).mockResolvedValue(mockRefreshToken);
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(jwt.sign).mockReturnValue('new-access-token' as never);

      const result = await authService.refreshToken(refreshToken);

      expect(jwt.verify).toHaveBeenCalledWith(refreshToken, 'test-refresh-secret');
      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBe('new-access-token');
    });

    it('should throw error for invalid refresh token', async () => {
      const refreshToken = 'invalid-refresh-token';

      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.refreshToken(refreshToken))
        .rejects
        .toThrow('Invalid refresh token');
    });

    it('should throw error for expired refresh token', async () => {
      const refreshToken = 'expired-refresh-token';
      const mockRefreshToken = {
        id: '1',
        token: refreshToken,
        userId: '1',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        createdAt: new Date(),
      };

      vi.mocked(jwt.verify).mockReturnValue({ userId: '1' } as never);
      vi.mocked(mockPrisma.refreshToken.findFirst).mockResolvedValue(mockRefreshToken);

      await expect(authService.refreshToken(refreshToken))
        .rejects
        .toThrow('Refresh token has expired');
    });
  });

  describe('setPassword', () => {
    it('should set password successfully', async () => {
      const userId = '1';
      const password = 'newpassword123';
      const hashedPassword = 'hashed-new-password';

      vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword as never);
      vi.mocked(mockPrisma.user.update).mockResolvedValue({
        id: userId,
        password: hashedPassword,
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await authService.setPassword(userId, password);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: hashedPassword },
      });
    });

    it('should throw error for weak password', async () => {
      const userId = '1';
      const weakPassword = '123';

      await expect(authService.setPassword(userId, weakPassword))
        .rejects
        .toThrow('Password must be at least 6 characters long');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const userId = '1';
      const currentPassword = 'oldpassword';
      const newPassword = 'newpassword123';
      const hashedOldPassword = 'hashed-old-password';
      const hashedNewPassword = 'hashed-new-password';

      const mockUser = {
        id: userId,
        password: hashedOldPassword,
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(bcrypt.hash).mockResolvedValue(hashedNewPassword as never);
      vi.mocked(mockPrisma.user.update).mockResolvedValue({
        ...mockUser,
        password: hashedNewPassword,
      });

      await authService.changePassword(userId, currentPassword, newPassword);

      expect(bcrypt.compare).toHaveBeenCalledWith(currentPassword, hashedOldPassword);
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });
    });

    it('should throw error for incorrect current password', async () => {
      const userId = '1';
      const currentPassword = 'wrongpassword';
      const newPassword = 'newpassword123';

      const mockUser = {
        id: userId,
        password: 'hashed-old-password',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(authService.changePassword(userId, currentPassword, newPassword))
        .rejects
        .toThrow('Current password is incorrect');
    });
  });
});
