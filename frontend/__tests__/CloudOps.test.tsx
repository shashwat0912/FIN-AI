import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CloudOps from '../pages/CloudOps';
import { apiClient } from '../lib/api';

vi.mock('../lib/api', () => ({ apiClient: { post: vi.fn() } }));
describe('Cloud Ops', () => {
  it('labels simulated evidence and displays a grounded assessment', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ success: true, message: '', timestamp: '', data: { investigation_id: 'demo', data_mode: 'simulation', status: 'degraded', likely_root_cause: 'database connection pool saturation', confidence: 0.85, reasoning: 'Cites evidence 0', tools_used: ['rds_get_metrics'], evidence: [{ tool: 'rds_get_metrics', data: { connections: 98 }, error: null, correlation_id: 'c', trace_id: 't' }], recommended_actions: ['Inspect the pool'], actions: [], summary: {} } });
    render(<CloudOps />);
    fireEvent.click(screen.getByRole('button', { name: 'Investigate incident' }));
    expect(await screen.findByText('database connection pool saturation')).toBeInTheDocument();
    expect(screen.getByText('Simulated infrastructure data — no live AWS telemetry')).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledWith('/cloud-ops/investigate', expect.objectContaining({ scenario: 'database_saturation' }));
  });
  it('shows service errors with a retryable form', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('Cloud Ops is disabled.'));
    render(<CloudOps />);
    fireEvent.click(screen.getByRole('button', { name: 'Analyse costs' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cloud Ops is disabled.');
    expect(screen.getByRole('button', { name: 'Analyse costs' })).toBeEnabled();
  });
});
