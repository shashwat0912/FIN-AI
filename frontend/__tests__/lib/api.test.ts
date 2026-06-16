import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/tokenRefreshService', () => ({
  tokenRefreshService: {
    ensureTokenValid: vi.fn(),
    refreshToken: vi.fn(),
  },
}));

vi.mock('../../services/sessionSyncService', () => ({
  sessionSyncService: {
    broadcastLogin: vi.fn(),
    broadcastLogout: vi.fn(),
    broadcastTokenUpdate: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('apiClient CSRF handling', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.cookie = 'csrf-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('bootstraps a CSRF token before the first mutating request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'ok',
            data: { token: 'bootstrap-token' },
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': 'bootstrap-token',
            },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'created',
            data: { id: 'tx-1' },
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      );

    vi.stubGlobal('fetch', fetchMock);

    const { apiClient } = await import('../../lib/api');

    const response = await apiClient.post<{ id: string }>('/transactions', { amount: 500 });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/v1/csrf-token',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/v1/transactions',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'bootstrap-token',
        }),
      })
    );
    expect(response.data?.id).toBe('tx-1');
  });

  it('recovers from an invalid CSRF token by refreshing and retrying once', async () => {
    document.cookie = 'csrf-token=stale-token; path=/';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            message: 'Invalid CSRF token',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': 'fresh-from-error',
            },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'ok',
            data: { token: 'fresh-bootstrap' },
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': 'fresh-bootstrap',
            },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'updated',
            data: { id: 'budget-1' },
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      );

    vi.stubGlobal('fetch', fetchMock);

    const { apiClient } = await import('../../lib/api');

    const response = await apiClient.post<{ id: string }>('/budgets', { amount: 1000 });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/v1/budgets',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-CSRF-Token': 'stale-token',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/v1/csrf-token',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/api/v1/budgets',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-CSRF-Token': 'fresh-bootstrap',
        }),
      })
    );
    expect(response.data?.id).toBe('budget-1');
  });
});
