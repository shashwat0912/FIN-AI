import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateTransport, mockSendMail, mockLogger } = vi.hoisted(() => ({
  mockCreateTransport: vi.fn(),
  mockSendMail: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}));

vi.mock('../../src/config/logger', () => ({
  default: mockLogger,
}));

import { NotificationService } from '../../src/services/notificationService';

const loggedContent = (): string => JSON.stringify([
  ...mockLogger.info.mock.calls,
  ...mockLogger.warn.mock.calls,
  ...mockLogger.error.mock.calls,
]);

describe('NotificationService OTP logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMS_PROVIDER;
    delete process.env.SMS_API_KEY;
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
  });

  it('simulates delivery in tests without logging OTPs or identifiers', async () => {
    process.env.NODE_ENV = 'test';
    const service = new NotificationService();
    const otp = '2468';
    const email = 'otp-user@example.com';
    const phone = '+919876543210';

    await expect(service.sendOtpEmail(email, otp)).resolves.toBeUndefined();
    await expect(service.sendOtpSms(phone, otp)).resolves.toBeUndefined();

    expect(loggedContent()).not.toContain(otp);
    expect(loggedContent()).not.toContain(email);
    expect(loggedContent()).not.toContain(phone);
    expect(loggedContent()).toContain('simulated');
  });

  it('fails securely in production when the email provider rejects delivery', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SMTP_HOST = 'smtp.invalid';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'not-a-real-user';
    process.env.SMTP_PASS = 'not-a-real-password';
    const otp = '1357';
    const email = 'delivery-failure@example.com';
    mockSendMail.mockRejectedValue(new Error(`Provider rejected ${otp} for ${email}`));
    const service = new NotificationService();

    await expect(service.sendOtpEmail(email, otp)).rejects.toMatchObject({
      statusCode: 503,
      message: 'OTP delivery is currently unavailable',
    });

    expect(loggedContent()).not.toContain(otp);
    expect(loggedContent()).not.toContain(email);
    expect(loggedContent()).toContain('failed');
    expect(loggedContent()).not.toContain('sent');
  });

  it('does not report simulated SMS delivery as success in production', async () => {
    process.env.NODE_ENV = 'production';
    const service = new NotificationService();
    const otp = '8642';
    const phone = '+919123456789';

    await expect(service.sendOtpSms(phone, otp)).rejects.toMatchObject({
      statusCode: 503,
      message: 'OTP delivery is currently unavailable',
    });

    expect(loggedContent()).not.toContain(otp);
    expect(loggedContent()).not.toContain(phone);
    expect(loggedContent()).toContain('unavailable');
    expect(loggedContent()).not.toContain('sent');
  });
});
