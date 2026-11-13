import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OtpLoginForm from './OtpLoginForm';
import { apiClient } from '../lib/api';

vi.mock('../lib/api', () => ({ apiClient: { sendOtp: vi.fn().mockResolvedValue({ type: 'email', expiresIn: 300, requiresName: true }) } }));
vi.mock('../services/tokenRefreshService', () => ({ tokenRefreshService: { stopBackgroundRefresh: vi.fn() } }));
afterEach(() => vi.unstubAllEnvs());

const renderForm = () => render(<OtpLoginForm />, { wrapper: MemoryRouter });

it('shows a missing email inline on the field instead of the browser tooltip', () => {
  renderForm();
  const email = screen.getByLabelText('Email or phone number');
  expect(fireEvent.invalid(email)).toBe(false);
  expect(email).toHaveAttribute('aria-invalid', 'true');
  expect(email).toHaveAccessibleDescription('Enter your email or phone number.');
  expect(email).toHaveFocus();

  fireEvent.change(email, { target: { value: 'a' } });
  expect(email).not.toHaveAttribute('aria-invalid');
});

it('puts a server error about the email on the email field', async () => {
  vi.mocked(apiClient.sendOtp).mockRejectedValueOnce(new Error('Invalid email or phone number format'));
  renderForm();
  const email = screen.getByLabelText('Email or phone number');
  fireEvent.change(email, { target: { value: 'not-an-email' } });
  fireEvent.click(screen.getByRole('button', { name: /Send secure code/ }));

  expect(await screen.findByText('Invalid email or phone number format')).toBeInTheDocument();
  expect(email).toHaveAttribute('aria-invalid', 'true');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('keeps errors that are not about a field in the general alert', async () => {
  vi.mocked(apiClient.sendOtp).mockRejectedValueOnce(new Error('Too many requests. Please wait a moment and try again.'));
  renderForm();
  const email = screen.getByLabelText('Email or phone number');
  fireEvent.change(email, { target: { value: 'demo@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: /Send secure code/ }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests');
  expect(email).not.toHaveAttribute('aria-invalid');
});
it('offers email only in a production build and accepts a six-digit code', async () => {
  vi.stubEnv('PROD', true);
  renderForm();
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
