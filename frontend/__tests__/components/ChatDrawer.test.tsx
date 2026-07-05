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

async function sendChatMessage(user: ReturnType<typeof userEvent.setup>, message: string) {
  await user.type(screen.getByPlaceholderText('Type a message...'), `${message}{enter}`);
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

  it('opens the drawer, sends a message, and renders the assistant response without chips', async () => {
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
      await sendChatMessage(user, '60000 salary');
    });

    await waitFor(() => {
      expect(screen.getByText('60000 salary')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Income logged successfully.')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Log another income' })).not.toBeInTheDocument();

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

  it('sends typed Log expense as a capture command instead of a fake sample transaction', async () => {
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
      await sendChatMessage(user, 'Log expense');
    });

    await waitFor(() => {
      expect(screen.getByText('Log expense')).toBeInTheDocument();
      expect(screen.getByText('Sure. What did you spend on?')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

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

  it('keeps the original command and removes the confirmation card after confirming', async () => {
    mockApiClient.post
      .mockResolvedValueOnce({
        success: true,
        message: 'ok',
        data: {
          message: 'Confirm 500 Food (food)?',
          confirmationCard: {
            id: 'pending-500',
            type: 'transaction',
            data: {
              amount: 500,
              description: 'food',
              category: 'Food',
              type: 'expense',
              date: null,
            },
            status: 'PENDING',
          },
          chartData: null,
          suggestedChips: [],
          conversationState: 'AWAITING_CONFIRMATION',
          rateLimitInfo: null,
          isFallbackMode: false,
        },
        timestamp: new Date().toISOString(),
      })
      .mockResolvedValueOnce({
        success: true,
        message: 'ok',
        data: {
          message: 'Logged ₹500 as Food\nfood · Today',
          confirmationCard: null,
          chartData: null,
          suggestedChips: [],
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
      await sendChatMessage(user, 'spent 500 on food');
    });

    await waitFor(() => {
      expect(screen.getByText('spent 500 on food')).toBeInTheDocument();
      expect(screen.getByText('₹500')).toBeInTheDocument();
      expect(screen.getByText('Food')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Type a message...')).toHaveValue('');
    expect(screen.queryByText('Confirm 500 Food (food)?')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(screen.getByText('spent 500 on food')).toBeInTheDocument();
      expect(screen.getByText(/Logged ₹500 as Food/)).toBeInTheDocument();
      expect(screen.getByText(/food · Today/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(screen.queryByText('Confirm 500 Food (food)?')).not.toBeInTheDocument();
  });

  it('shows a bulk confirmation card and keeps only the success summary after confirm all', async () => {
    mockApiClient.post
      .mockResolvedValueOnce({
        success: true,
        message: 'ok',
        data: {
          message: 'Review 3 transaction item(s), total ₹1,300. Confirm all?',
          confirmationCard: {
            id: 'pending-bulk',
            type: 'bulk_transaction',
            data: {
              items: [
                { amount: 500, description: 'chai', category: 'Food', type: 'expense', date: null },
                { amount: 300, description: 'coffee', category: 'Food', type: 'expense', date: null },
                { amount: 500, description: 'uber', category: 'Transport', type: 'expense', date: null },
              ],
              skippedLines: [],
            },
            status: 'PENDING',
          },
          chartData: null,
          suggestedChips: [],
          conversationState: 'AWAITING_CONFIRMATION',
          rateLimitInfo: null,
          isFallbackMode: false,
        },
        timestamp: new Date().toISOString(),
      })
      .mockResolvedValueOnce({
        success: true,
        message: 'ok',
        data: {
          message: 'Logged 3 expense item(s), total ₹1,300. Added in order: 1. chai ₹500 (Food), 2. coffee ₹300 (Food), 3. uber ₹500 (Transport).',
          confirmationCard: null,
          chartData: null,
          suggestedChips: [],
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
      await sendChatMessage(user, '500 chai 300 coffee 500 uber');
    });

    await waitFor(() => {
      expect(screen.getByText('500 chai 300 coffee 500 uber')).toBeInTheDocument();
      expect(screen.getByText('3 items')).toBeInTheDocument();
      expect(screen.getByText('₹1,300 total')).toBeInTheDocument();
    });
    expect(screen.queryByText('Review 3 transaction item(s), total ₹1,300. Confirm all?')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm all' }));

    await waitFor(() => {
      expect(screen.getByText('500 chai 300 coffee 500 uber')).toBeInTheDocument();
      expect(screen.getByText(/Logged 3 expense item/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Confirm all' })).not.toBeInTheDocument();
    expect(screen.queryByText('3 items')).not.toBeInTheDocument();
  });

  it('opens confirmation edit modal and saves without chat edit bubbles', async () => {
    useChatStore.setState({
      isOpen: true,
      historyLoaded: true,
      pendingConfirmation: {
        id: 'pending-1',
        type: 'transaction',
        data: {
          amount: 400,
          description: 'burger',
          category: 'Food',
          type: 'expense',
          date: null,
        },
        status: 'PENDING',
      },
    });
    mockApiClient.post.mockResolvedValue({
      success: true,
      message: 'ok',
      data: {
        message: 'Updated. Please confirm:',
        confirmationCard: {
          id: 'pending-1',
          type: 'transaction',
          data: {
            amount: 300,
            description: 'noodles',
            category: 'Food',
            type: 'expense',
            date: null,
          },
          status: 'PENDING',
        },
        chartData: null,
        suggestedChips: [],
        conversationState: 'AWAITING_CONFIRMATION',
        rateLimitInfo: null,
        isFallbackMode: false,
      },
      timestamp: new Date().toISOString(),
    });

    const user = userEvent.setup();
    render(<ChatFAB />);

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('heading', { name: 'Edit transaction' })).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.queryByLabelText('Category')).not.toBeInTheDocument();
    expect(screen.queryByText('What would you like to edit?')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '300');
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'noodles');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/chat/edit',
        { confirmationId: 'pending-1', data: { amount: 300, description: 'noodles' } },
        {
          headers: {
            'X-Idempotency-Key': 'idem-key-123',
          },
        }
      );
    });
    expect(screen.queryByRole('heading', { name: 'Edit transaction' })).not.toBeInTheDocument();
    expect(screen.queryByText('What would you like to edit?')).not.toBeInTheDocument();
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
      await sendChatMessage(user, '60000 salary');
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
      await sendChatMessage(user, '60000 salary');
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
      await sendChatMessage(user, 'Log expense');
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Request rejected');
      expect(screen.getByRole('alert')).toHaveTextContent('CSRF token missing');
    });
  });
});
