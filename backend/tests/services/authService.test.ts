import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../src/services/authService';

const { mockHash, mockCompare, mockSign, mockVerify, mockPrisma } = vi.hoisted(() => ({
  mockHash: vi.fn(),
  mockCompare: vi.fn(),
  mockSign: vi.fn(),
  mockVerify: vi.fn(),
  mockPrisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('../../src/config/database', () => ({
  default: mockPrisma,
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: mockHash,
    compare: mockCompare,
  },
  hash: mockHash,
  compare: mockCompare,
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: mockSign,
    verify: mockVerify,
  },
  sign: mockSign,
  verify: mockVerify,
}));

vi.mock('../../src/config/env', () => ({
  config: {
    JWT_SECRET: 'a'.repeat(64),
    JWT_REFRESH_SECRET: 'b'.repeat(64),
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '30d',
  },
}));

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    vi.clearAllMocks();
    mockSign.mockReturnValue('mock-jwt-token');
    mockVerify.mockReset();
    mockVerify.mockReturnValue({ userId: 'u1' });
    mockPrisma.refreshToken.findMany.mockResolvedValue([]);
  });

  it('uses a 15-minute access token and preserves refresh lifetime', () => {
    service.generateAccessToken({ id: 'u1', email: 'test@example.com', role: 'USER' });
    expect(mockSign).toHaveBeenLastCalledWith(expect.any(Object), 'a'.repeat(64), { expiresIn: '15m' });
    service.generateRefreshToken({ id: 'u1', email: 'test@example.com', role: 'USER' });
    expect(mockSign).toHaveBeenLastCalledWith(expect.any(Object), 'b'.repeat(64), { expiresIn: '30d' });
  });

  it('registers a new user with strong password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockHash.mockResolvedValue('hashed-password');
    mockPrisma.user.create.mockResolvedValue({
      id: 'u1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      createdAt: new Date(),
    });
    mockPrisma.refreshToken.create.mockResolvedValue({
      id: 'rt1',
      token: 'refresh-token',
      userId: 'u1',
      createdAt: new Date(),
      expiresAt: new Date(),
    });

    const result = await service.register({
      email: 'test@example.com',
      password: 'Password@123',
      name: 'Test User',
    });

    expect(result.user.email).toBe('test@example.com');
    expect(result.accessToken).toBe('mock-jwt-token');
    expect(result.refreshToken).toBe('mock-jwt-token');
    expect(mockHash).toHaveBeenCalledWith('Password@123', 12);
    expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
  });

  it('rejects weak password at registration', async () => {
    await expect(
      service.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      })
    ).rejects.toThrow('Password must contain at least one uppercase letter');
  });

  it('logs in with valid credentials', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      avatar: null,
      isActive: true,
      password: 'hashed-password',
    });
    mockCompare.mockResolvedValue(true);
    mockPrisma.refreshToken.create.mockResolvedValue({
      id: 'rt1',
      token: 'refresh-token',
      userId: 'u1',
      createdAt: new Date(),
      expiresAt: new Date(),
    });

    const result = await service.login({
      email: 'test@example.com',
      password: 'Password@123',
    });

    expect(result.user.email).toBe('test@example.com');
    expect(result.accessToken).toBe('mock-jwt-token');
    expect(result.refreshToken).toBe('mock-jwt-token');
  });

  it('rejects login with invalid password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      avatar: null,
      isActive: true,
      password: 'hashed-password',
    });
    mockCompare.mockResolvedValue(false);

    await expect(
      service.login({
        email: 'test@example.com',
        password: 'Wrong@123',
      })
    ).rejects.toThrow('Invalid credentials');
  });

  it('refreshes an active refresh token', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      token: 'old-refresh',
      expiresAt: new Date(Date.now() + 100000),
      user: {
        id: 'u1',
        email: 'test@example.com',
        role: 'USER',
      },
    });
    mockPrisma.refreshToken.update.mockResolvedValue({
      id: 'rt1',
      token: 'new-refresh',
    });

    const result = await service.refreshToken('old-refresh');

    expect(result.accessToken).toBe('mock-jwt-token');
    expect(result.refreshToken).toBe('mock-jwt-token');
    expect(mockPrisma.refreshToken.update).toHaveBeenCalled();
    expect(mockVerify).toHaveBeenCalledWith('old-refresh', 'b'.repeat(64), { algorithms: ['HS256'] });
  });

  it('rejects a retired signing key before consulting stored refresh sessions', async () => {
    mockVerify.mockImplementation(() => { throw new Error('invalid signature'); });
    await expect(service.refreshToken('retired-refresh')).rejects.toMatchObject({ statusCode: 401 });
    expect(mockPrisma.refreshToken.findUnique).not.toHaveBeenCalled();
  });

  it('sets password with strong value', async () => {
    mockHash.mockResolvedValue('new-hashed');
    mockPrisma.user.update.mockResolvedValue({ id: 'u1' });

    await service.setPassword('u1', 'NewPassword@123');

    expect(mockHash).toHaveBeenCalledWith('NewPassword@123', 12);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { password: 'new-hashed' },
    });
  });

  it('rejects weak password in setPassword', async () => {
    await expect(service.setPassword('u1', '123')).rejects.toThrow(
      'Password must be at least 8 characters long'
    );
  });

  it('changes password after validating current one', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      password: 'old-hash',
    });
    mockCompare.mockResolvedValue(true);
    mockHash.mockResolvedValue('new-hash');
    mockPrisma.user.update.mockResolvedValue({ id: 'u1' });

    await service.changePassword('u1', 'OldPassword@123', 'NewPassword@123');

    expect(mockCompare).toHaveBeenCalledWith('OldPassword@123', 'old-hash');
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { password: 'new-hash' },
    });
  });
});
