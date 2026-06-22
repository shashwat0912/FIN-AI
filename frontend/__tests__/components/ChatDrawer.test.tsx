import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatFAB from '../../components/chat/ChatFAB';
import { useChatStore } from '../../hooks/useChatStore';

const { mockApiClient, mockRandomUuid } = vi.hoisted(() => ({
  mockApiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  mockRandomUuid: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  apiClient: mockApiClient,
}));

function resetChatStore() {
  useChatStore.setState({
    messages: [],
    isLoading: false,
    isOpen: false,
    pendingConfirmation: null,
    suggestedChips: [],
    conversationState: 'IDLE',
    rateLimitInfo: null,
    isRateLimited: false,
    isFallbackMode: false,
    historyLoaded: false,
    toast: null,
    lastAction: null,
  });
}

describe('ChatDrawer integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRandomUuid.mockReturnValue('idem-key-123');
    vi.stubGlobal('crypto', {
      randomUUID: mockRandomUuid,
    });
    mockApiClient.get.mockResolvedValue({
      success: true,
      message: 'ok',
      data: [],
      timestamp: new Date().toISOString(),
    });
    resetChatStore();
  });

  afterEach(() => {
    resetChatStore();
  });

  it('opens the drawer, sends a quick action, and renders the assistant response', async () => {
    mockApiClient.post.mockResolvedValue({
      success: true,
      message: 'ok',
      data: {
        message: 'Income logged successfully.',
        confirmationCard: null,
        chartData: null,
        suggestedChips: ['Log another income'],
        conversationState: 'IDLE',
        rateLimitInfo: null,
        isFallbackMode: false,
      },
      timestamp: new Date().toISOString(),
    });

    const user = userEvent.setup();
    render(<ChatFAB />);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /open chat/i }));
    });
    await waitFor(() => expect(mockApiClient.get).toHaveBeenCalled());
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Log income' }));
    });

    await waitFor(() => {
      expect(screen.getByText('60000 salary')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Income logged successfully.')).toBeInTheDocument();
    });

    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/chat/message',
      { content: '60000 salary' },
      {
        headers: {
          'X-Idempotency-Key': 'idem-key-123',
        },
      }
    );
  });

  it('sends Log expense as a capture command instead of a fake sample transaction', async () => {
    mockApiClient.post.mockResolvedValue({
      success: true,
      message: 'ok',
      data: {
        message: 'Sure. What did you spend on?',
        confirmationCard: null,
        chartData: null,
        suggestedChips: ['Cancel'],
        conversationState: 'AWAITING_EXPENSE_DETAILS',
        rateLimitInfo: null,
        isFallbackMode: false,
      },
      timestamp: new Date().toISOString(),
    });

    const user = userEvent.setup();
    render(<ChatFAB />);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /open chat/i }));
    });
    await waitFor(() => expect(mockApiClient.get).toHaveBeenCalled());
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Log expense' }));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Log expense').length).toBeGreaterThan(0);
      expect(screen.getByText('Sure. What did you spend on?')).toBeInTheDocument();
    });

    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/chat/message',
      { content: 'Log expense' },
      {
        headers: {
          'X-Idempotency-Key': 'idem-key-123',
        },
      }
    );
  });

  it('shows a backend-unavailable toast after retries are exhausted', async () => {
    const networkError = Object.assign(
      new Error('Cannot connect to backend server. Please make sure the backend is running on http://localhost:3000'),
      { isNetworkError: true }
    );

    mockApiClient.post.mockRejectedValue(networkError);

    const user = userEvent.setup();
    render(<ChatFAB />);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /open chat/i }));
    });
    await waitFor(() => expect(mockApiClient.get).toHaveBeenCalled());
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Log income' }));
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Backend unavailable');
      expect(screen.getByRole('alert')).toHaveTextContent('could not reach the backend');
    }, { timeout: 2500 });

    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('distinguishes an expired session from validation failures', async () => {
    const authError = Object.assign(new Error('Your session has expired. Please login again.'), {
      isAuthError: true,
      status: 401,
    });

    mockApiClient.post.mockRejectedValueOnce(authError);

    const user = userEvent.setup();
    render(<ChatFAB />);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /open chat/i }));
    });
    await waitFor(() => expect(mockApiClient.get).toHaveBeenCalled());
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Log income' }));
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Session expired');
      expect(screen.getByRole('alert')).toHaveTextContent('Sign in again and retry');
    });

    mockApiClient.post.mockRejectedValueOnce(
      Object.assign(new Error('CSRF token missing'), { status: 403 })
    );

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Dismiss chat toast' }));
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Log expense' }));
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Request rejected');
      expect(screen.getByRole('alert')).toHaveTextContent('CSRF token missing');
    });
  });
});
