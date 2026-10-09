import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import OtpLoginForm from './OtpLoginForm';

vi.mock('../lib/api', () => ({ apiClient: { sendOtp: vi.fn().mockResolvedValue({ type: 'email', expiresIn: 300, requiresName: true }) } }));
vi.mock('../services/tokenRefreshService', () => ({ tokenRefreshService: { stopBackgroundRefresh: vi.fn() } }));
afterEach(() => vi.unstubAllEnvs());
it('offers email only in a production build and accepts a six-digit code', async () => {
  vi.stubEnv('PROD', true);
  render(<OtpLoginForm />);
  const email = screen.getByLabelText('Email address');
  expect(email).toHaveAttribute('type', 'email');
  expect(screen.queryByText('Email or phone number')).toBeNull();
  fireEvent.change(email, { target: { value: 'demo@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: /Send secure code/ }));
  const code = await screen.findByLabelText('6-digit code');
  expect(code).toHaveAttribute('maxlength', '6');
  expect(code).toHaveAttribute('pattern', '[0-9]{6}');
  const name = screen.getByLabelText('Your name');
  expect(name).toHaveAttribute('type', 'text');
  fireEvent.change(name, { target: { value: 'Demo User' } });
  expect((name as HTMLInputElement).checkValidity()).toBe(true);
});
