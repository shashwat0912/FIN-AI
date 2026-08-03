import type { NextFunction, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { perUserRateLimiter } from '../../src/middleware/security';
import type { AuthenticatedRequest } from '../../src/types';

describe('finance ledger rate limiter', () => {
  it('keys limits by authenticated user instead of shared IP', async () => {
    const limiter = perUserRateLimiter(2, 60_000, 'finance-ledger-test');
    const run = async (userId: string) => {
      let status = 200;
      let nextCalled = false;
      const req = { method: 'GET', path: '/', user: { id: userId } } as AuthenticatedRequest;
      const res = {
        setHeader() {},
        status(code: number) {
          status = code;
          return this;
        },
        json() {
          return this;
        },
      } as unknown as Response;

      await limiter(req, res, (() => {
        nextCalled = true;
      }) as NextFunction);
      return { status, nextCalled };
    };

    await expect(run('one')).resolves.toEqual({ status: 200, nextCalled: true });
    await expect(run('one')).resolves.toEqual({ status: 200, nextCalled: true });
    await expect(run('one')).resolves.toEqual({ status: 429, nextCalled: false });
    await expect(run('two')).resolves.toEqual({ status: 200, nextCalled: true });
  });
});
