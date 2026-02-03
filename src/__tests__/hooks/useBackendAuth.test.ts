import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBackendAuth } from '../../hooks/useBackendAuth';

// Mock the API client
const mockApiClient = {
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
};

vi.mock('../../lib/api', () => ({
  apiClient: mockApiClient,
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('useBackendAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  describe('login', () => {
    it('should login successfully', async () => {
      const mockAuthResponse = {
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      mockApiClient.login.mockResolvedValue(mockAuthResponse);

      const { result } = renderHook(() => useBackendAuth());

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.user).toEqual(mockAuthResponse.user);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('accessToken', 'access-token');
    });

    it('should handle login error', async () => {
      const errorMessage = 'Invalid credentials';
      mockApiClient.login.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useBackendAuth());

      await act(async () => {
        await result.current.login('test@example.com', 'wrongpassword');
      });

      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe(errorMessage);
    });

    it('should set loading state during login', async () => {
      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise(resolve => {
        resolveLogin = resolve;
      });
      mockApiClient.login.mockReturnValue(loginPromise);

      const { result } = renderHook(() => useBackendAuth());

      act(() => {
        result.current.login('test@example.com', 'password123');
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolveLogin!({
          user: { id: '1', email: 'test@example.com', name: 'Test User', role: 'USER' },
          accessToken: 'token',
          refreshToken: 'refresh',
        });
        await loginPromise;
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('register', () => {
    it('should register successfully', async () => {
      const mockAuthResponse = {
        user: {
          id: '1',
          email: 'newuser@example.com',
          name: 'New User',
          role: 'USER',
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      mockApiClient.register.mockResolvedValue(mockAuthResponse);

      const { result } = renderHook(() => useBackendAuth());

      await act(async () => {
        await result.current.register('newuser@example.com', 'password123', 'New User');
      });

      expect(result.current.user).toEqual(mockAuthResponse.user);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('accessToken', 'access-token');
    });

    it('should handle registration error', async () => {
      const errorMessage = 'Email already exists';
      mockApiClient.register.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useBackendAuth());

      await act(async () => {
        await result.current.register('existing@example.com', 'password123', 'User');
      });

      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe(errorMessage);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      mockApiClient.logout.mockResolvedValue(undefined);

      const { result } = renderHook(() => useBackendAuth());

      // Set initial user state
      act(() => {
        result.current.user = {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
        };
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('accessToken');
    });

    it('should handle logout error gracefully', async () => {
      mockApiClient.logout.mockRejectedValue(new Error('Logout failed'));

      const { result } = renderHook(() => useBackendAuth());

      // Set initial user state
      act(() => {
        result.current.user = {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
        };
      });

      await act(async () => {
        await result.current.logout();
      });

      // Should still clear user state even if API call fails
      expect(result.current.user).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('accessToken');
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useBackendAuth());

      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should load user from localStorage on mount', () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockUser));

      const { result } = renderHook(() => useBackendAuth());

      expect(result.current.user).toEqual(mockUser);
    });

    it('should handle invalid localStorage data', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json');

      const { result } = renderHook(() => useBackendAuth());

      expect(result.current.user).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should clear error on successful operation', async () => {
      // First, set an error
      mockApiClient.login.mockRejectedValueOnce(new Error('Login failed'));

      const { result } = renderHook(() => useBackendAuth());

      await act(async () => {
        await result.current.login('test@example.com', 'wrongpassword');
      });

      expect(result.current.error).toBeInstanceOf(Error);

      // Then, succeed
      mockApiClient.login.mockResolvedValueOnce({
        user: { id: '1', email: 'test@example.com', name: 'Test User', role: 'USER' },
        accessToken: 'token',
        refreshToken: 'refresh',
      });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.error).toBeNull();
    });
  });
});













