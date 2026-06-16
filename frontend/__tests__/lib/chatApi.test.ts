import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatApi } from '../../lib/chatApi';

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

describe('chatApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockRandomUuid.mockReturnValue('idem-key-123');
    vi.stubGlobal('crypto', {
      randomUUID: mockRandomUuid,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the shared api client for sending messages with an idempotency key', async () => {
    mockApiClient.post.mockResolvedValue({
      success: true,
      message: 'ok',
      data: {
        message: 'Done',
        confirmationCard: null,
        chartData: null,
        suggestedChips: [],
        conversationState: 'IDLE',
        rateLimitInfo: null,
        isFallbackMode: false,
      },
      timestamp: new Date().toISOString(),
    });

    const result = await chatApi.sendMessage('60000 salary');

    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/chat/message',
      { content: '60000 salary' },
      {
        headers: {
          'X-Idempotency-Key': 'idem-key-123',
        },
      }
    );
    expect(result.message).toBe('Done');
  });

  it('loads history through the shared api client transport', async () => {
    mockApiClient.get.mockResolvedValue({
      success: true,
      message: 'ok',
      data: [
        {
          id: 'm1',
          role: 'USER',
          content: 'hello',
          createdAt: new Date().toISOString(),
        },
      ],
      timestamp: new Date().toISOString(),
    });

    const history = await chatApi.getHistory(25, 10);

    expect(mockApiClient.get).toHaveBeenCalledWith('/chat/history?limit=25&offset=10');
    expect(history).toHaveLength(1);
  });

  it('preserves normalized network errors from the shared api client', async () => {
    mockApiClient.post.mockRejectedValue(
      new Error('Cannot connect to backend server. Please make sure the backend is running on http://localhost:3000')
    );

    const errorAssertion = expect(chatApi.sendMessage('Log income')).rejects.toThrow(
      'Cannot connect to backend server. Please make sure the backend is running on http://localhost:3000'
    );
    await vi.runAllTimersAsync();
    await errorAssertion;
  });

  it('retries transient network failures before succeeding', async () => {
    const networkError = Object.assign(
      new Error('Cannot connect to backend server. Please make sure the backend is running on http://localhost:3000'),
      { isNetworkError: true }
    );

    mockApiClient.post
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({
        success: true,
        message: 'ok',
        data: {
          message: 'Retried successfully',
          confirmationCard: null,
          chartData: null,
          suggestedChips: [],
          conversationState: 'IDLE',
          rateLimitInfo: null,
          isFallbackMode: false,
        },
        timestamp: new Date().toISOString(),
      });

    const responsePromise = chatApi.sendMessage('60000 salary');
    await vi.runAllTimersAsync();
    const response = await responsePromise;

    expect(mockApiClient.post).toHaveBeenCalledTimes(3);
    expect(response.message).toBe('Retried successfully');
  });
});
