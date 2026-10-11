import { afterEach, expect, it, vi } from 'vitest';
import { OtpService } from '../src/services/otpService';
import { authSchemas } from '../src/middleware/validation';
import { AuthService } from '../src/services/authService';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import prisma from '../src/config/database';

const service = new OtpService();
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it('generates six-digit codes and rejects four-digit input', () => {
  const insecureRandom = vi.spyOn(Math, 'random');
  for (let i = 0; i < 100; i++) {
    const code = (service as unknown as { generateOtp(): string }).generateOtp();
    expect(code).toMatch(/^[1-9]\d{5}$/);
    expect(authSchemas.verifyOtp.validate({ identifier: 'demo@example.com', otp: code }).error).toBeUndefined();
  }
  expect(insecureRandom).not.toHaveBeenCalled();
  expect(authSchemas.verifyOtp.validate({ identifier: 'demo@example.com', otp: '1234' }).error).toBeDefined();
});

it('blocks production phone generation and verification before DB access', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  await expect(service.generateAndStoreOtp('9876543210')).rejects.toThrow('Use email');
  await expect(service.verifyOtp('9876543210', '123456')).rejects.toThrow('Use email');
  expect(service.normalizeIdentifier('DEMO@example.com')).toBe('demo@example.com');
});

it('issues a 15-minute access token', () => {
  const token = new AuthService().generateAccessToken({ id: 'demo', email: 'demo@example.com', role: 'USER' });
  const payload = jwt.decode(token) as jwt.JwtPayload;
  expect(payload.exp! - payload.iat!).toBe(900);
});

it('rejects old signatures and revoked refresh sessions with real JWT verification', async () => {
  const auth = new AuthService();
  const user = { id: 'demo', email: 'demo@example.com', role: 'USER' } as const;
  const access = auth.generateAccessToken(user);
  expect(() => jwt.verify(access, randomBytes(64).toString('hex'))).toThrow('invalid signature');
  const lookup = vi.spyOn(prisma.refreshToken, 'findUnique').mockResolvedValue(null);
  const retiredRefresh = jwt.sign({ userId: user.id }, randomBytes(64).toString('hex'));
  await expect(auth.refreshToken(retiredRefresh)).rejects.toMatchObject({ statusCode: 401 });
  expect(lookup).not.toHaveBeenCalled();
  await expect(auth.refreshToken(auth.generateRefreshToken(user))).rejects.toMatchObject({ statusCode: 401 });
  expect(lookup).toHaveBeenCalledOnce();
});
