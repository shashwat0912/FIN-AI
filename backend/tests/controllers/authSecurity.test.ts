import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResponse, LoginRequest } from '../../src/types';

const mocks = vi.hoisted(() => ({
  clearLoginFailures: vi.fn(),
  incrementLoginFailure: vi.fn(),
  login: vi.fn(),
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../src/services/authService', () => ({
  AuthService: class {
    login = mocks.login;
  },
}));
vi.mock('../../src/services/otpService', () => ({ OtpService: class {} }));
vi.mock('../../src/services/notificationService', () => ({ NotificationService: class {} }));
vi.mock('../../src/config/logger', () => ({ default: mocks.logger }));
vi.mock('../../src/services/securityStateService', () => ({
  LOGIN_LOCKOUT_MS: 900_000,
  LOGIN_MAX_ATTEMPTS: 5,
  loginSecurityIdentifier: vi.fn(() => 'derived-login-identifier'),
  securityStateService: {
    clearLoginFailures: mocks.clearLoginFailures,
    incrementLoginFailure: mocks.incrementLoginFailure,
  },
}));

import { AuthController } from '../../src/controllers/authController';
import { errorHandler } from '../../src/middleware/errorHandler';

function createResponse() {
  let body: ApiResponse | undefined;
  let status = 200;
  const response = {
    json(payload: ApiResponse) {
      body = payload;
      return response;
    },
    status(code: number) {
      status = code;
      return response;
    },
  } as unknown as Response<ApiResponse>;
  return { body: () => body, response, status: () => status };
}

function loginRequest(): Request<Record<string, never>, ApiResponse, LoginRequest> {
  return {
    body: { email: 'person@example.com', password: 'Password@123' },
    ip: '203.0.113.4',
  } as Request<Record<string, never>, ApiResponse, LoginRequest>;
}

describe('authentication security state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clearLoginFailures.mockResolvedValue(undefined);
    mocks.incrementLoginFailure.mockResolvedValue({ count: 1, retryAfterMs: 0 });
  });

  it('clears shared failures before returning a successful login', async () => {
    mocks.login.mockResolvedValue({ user: { id: 'user-1' }, accessToken: 'token' });
    const result = createResponse();

    await new AuthController().login(loginRequest(), result.response);

    expect(mocks.clearLoginFailures).toHaveBeenCalledWith('derived-login-identifier');
    expect(mocks.incrementLoginFailure).not.toHaveBeenCalled();
    expect(result.status()).toBe(200);
  });

  it('records authentication failures before returning 401', async () => {
    mocks.login.mockRejectedValue(
      Object.assign(new Error('Invalid credentials'), { statusCode: 401 })
    );
    const result = createResponse();

    await new AuthController().login(loginRequest(), result.response);

    expect(mocks.incrementLoginFailure).toHaveBeenCalledWith(
      'derived-login-identifier',
      5,
      900_000
    );
    expect(result.status()).toBe(401);
    expect(result.body()?.message).toBe('Invalid credentials');
  });

  it('fails with a safe 503 when shared failure recording is unavailable', async () => {
    mocks.login.mockRejectedValue(
      Object.assign(new Error('Invalid credentials'), { statusCode: 401 })
    );
    mocks.incrementLoginFailure.mockRejectedValue(
      Object.assign(new Error('Shared state service is temporarily unavailable'), {
        name: 'RedisUnavailableError',
        statusCode: 503,
      })
    );
    const result = createResponse();

    await new AuthController().login(loginRequest(), result.response);

    expect(result.status()).toBe(503);
    expect(result.body()?.message).toBe('Shared state service is temporarily unavailable');
    expect(JSON.stringify(mocks.logger.error.mock.calls)).not.toContain('person@example.com');
    expect(JSON.stringify(mocks.logger.error.mock.calls)).not.toContain('203.0.113.4');
  });

  it('does not expose raw Redis provider errors through the central error handler', () => {
    const sensitiveProviderError = 'redis://user:password@private-host:6379';
    const result = createResponse();
    const request = { method: 'POST', path: '/auth/login' } as Request;
    const error = Object.assign(new Error(sensitiveProviderError), {
      name: 'RedisUnavailableError',
    });

    errorHandler(error, request, result.response, vi.fn());

    expect(result.status()).toBe(503);
    expect(result.body()?.message).toBe('Shared state service is temporarily unavailable');
    expect(JSON.stringify(result.body())).not.toContain(sensitiveProviderError);
    expect(JSON.stringify(mocks.logger.error.mock.calls)).not.toContain(sensitiveProviderError);
  });
});
