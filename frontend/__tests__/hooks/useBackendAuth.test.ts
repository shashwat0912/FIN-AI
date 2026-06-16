import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBackendAuth } from '../../hooks/useBackendAuth';

const {
  mockApiClient,
  mockTokenRefreshService,
  mockGetUserFromToken,
} = vi.hoisted(() => ({
  mockApiClient: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    setRefreshToken: vi.fn(),
    clearTokens: vi.fn(),
    healthCheck: vi.fn(),
  },
  mockTokenRefreshService: {
    ensureTokenValid: vi.fn(),
  },
  mockGetUserFromToken: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  apiClient: mockApiClient,
}));

vi.mock('../../services/tokenRefreshService', () => ({
  tokenRefreshService: mockTokenRefreshService,
}));

vi.mock('../../utils/jwtUtils', () => ({
  getUserFromToken: mockGetUserFromToken,
}));

describe('useBackendAuth', () => {
  const user = {
    id: 'u1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it('starts unauthenticated when no token exists', async () => {
    const { result } = renderHook(() => useBackendAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('logs in and stores refresh token', async () => {
    mockApiClient.login.mockResolvedValue({
      user,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const { result } = renderHook(() => useBackendAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login('test@example.com', 'Password@123');
    });

    expect(result.current.user).toEqual(user);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockApiClient.setRefreshToken).toHaveBeenCalledWith('refresh-token');
  });

  it('surfaces login errors', async () => {
    mockApiClient.login.mockRejectedValue(new Error('Invalid credentials'));

    const { result } = renderHook(() => useBackendAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.login('test@example.com', 'wrong')).rejects.toThrow('Invalid credentials');
    });

    expect(result.current.user).toBeNull();
    await waitFor(() => {
      expect(result.current.error?.message).toBe('Invalid credentials');
    });
  });

  it('registers and stores refresh token', async () => {
    mockApiClient.register.mockResolvedValue({
      user,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const { result } = renderHook(() => useBackendAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.register('test@example.com', 'Password@123', 'Test User');
    });

    expect(result.current.user).toEqual(user);
    expect(mockApiClient.setRefreshToken).toHaveBeenCalledWith('refresh-token');
  });

  it('logs out and clears auth state even on API failure', async () => {
    mockApiClient.login.mockResolvedValue({
      user,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    mockApiClient.logout.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useBackendAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login('test@example.com', 'Password@123');
    });
    expect(result.current.user).toEqual(user);

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
