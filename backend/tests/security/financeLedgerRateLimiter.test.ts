import type { NextFunction, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { perUserRateLimiter } from '../../src/middleware/security';
import type { AuthenticatedRequest } from '../../src/types';

describe('finance ledger rate limiter', () => {
  it('keys limits by authenticated user instead of shared IP', async () => {
    const limiter = perUserRateLimiter(2, 60_000, 'finance-ledger-test');
    const run = (userId: string) => {
      let status = 200;
      let nextCalled = false;
      const req = { user: { id: userId } } as AuthenticatedRequest;
      const res = {
        status(code: number) {
          status = code;
          return this;
        },
        json() {
          return this;
        },
      } as unknown as Response;

      limiter(req, res, (() => {
        nextCalled = true;
      }) as NextFunction);
      return { status, nextCalled };
    };

    expect(run('one')).toEqual({ status: 200, nextCalled: true });
    expect(run('one')).toEqual({ status: 200, nextCalled: true });
    expect(run('one')).toEqual({ status: 429, nextCalled: false });
    expect(run('two')).toEqual({ status: 200, nextCalled: true });
  });
});
