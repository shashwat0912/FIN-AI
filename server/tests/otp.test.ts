import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OtpService } from '../src/services/otpService';
import { NotificationService } from '../src/services/notificationService';
import prisma from '../src/config/database';

describe('OTP Service', () => {
  let otpService: OtpService;
  let notificationService: NotificationService;

  beforeEach(() => {
    otpService = new OtpService();
    notificationService = new NotificationService();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.otp.deleteMany({});
    await prisma.otpRateLimit.deleteMany({});
  });

  describe('Phone Number Validation', () => {
    it('should validate and normalize Indian phone numbers', () => {
      const testCases = [
        { input: '9876543210', expected: '+919876543210' },
        { input: '+919876543210', expected: '+919876543210' },
        { input: '0919876543210', expected: '+919876543210' },
        { input: '91 9876543210', expected: '+919876543210' },
        { input: '9876-543-210', expected: '+919876543210' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = otpService.validateAndNormalizePhone(input);
        expect(result).toBe(expected);
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidNumbers = [
        '123456789',      // Too short
        '12345678901',    // Too long
        '0123456789',     // Doesn't start with 6-9
        'abcdefghij',     // Not numeric
        '+1234567890',    // Wrong country code
      ];

      invalidNumbers.forEach((number) => {
        const result = otpService.validateAndNormalizePhone(number);
        expect(result).toBeNull();
      });
    });
  });

  describe('Email Validation', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.in',
        'user+tag@example.org',
      ];

      validEmails.forEach((email) => {
        const result = otpService.validateEmail(email);
        expect(result).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
      ];

      invalidEmails.forEach((email) => {
        const result = otpService.validateEmail(email);
        expect(result).toBe(false);
      });
    });
  });

  describe('Identifier Type Detection', () => {
    it('should detect email type', () => {
      const result = otpService.detectIdentifierType('test@example.com');
      expect(result).toBe('email');
    });

    it('should detect phone type', () => {
      const result = otpService.detectIdentifierType('9876543210');
      expect(result).toBe('phone');
    });

    it('should return null for invalid identifiers', () => {
      const result = otpService.detectIdentifierType('invalid');
      expect(result).toBeNull();
    });
  });

  describe('OTP Generation and Storage', () => {
    it('should generate and store OTP for email', async () => {
      const email = 'test@example.com';
      const result = await otpService.generateAndStoreOtp(email);

      expect(result.otp).toMatch(/^\d{4}$/);
      expect(result.type).toBe('email');

      // Verify OTP is stored in database
      const storedOtp = await prisma.otp.findFirst({
        where: { identifier: email.toLowerCase() },
      });

      expect(storedOtp).toBeTruthy();
      expect(storedOtp?.verified).toBe(false);
    });

    it('should generate and store OTP for phone', async () => {
      const phone = '9876543210';
      const result = await otpService.generateAndStoreOtp(phone);

      expect(result.otp).toMatch(/^\d{4}$/);
      expect(result.type).toBe('phone');

      // Verify OTP is stored in database
      const storedOtp = await prisma.otp.findFirst({
        where: { identifier: '+919876543210' },
      });

      expect(storedOtp).toBeTruthy();
    });

    it('should invalidate previous OTPs when generating new one', async () => {
      const email = 'test@example.com';

      // Generate first OTP
      await otpService.generateAndStoreOtp(email);

      // Generate second OTP
      await otpService.generateAndStoreOtp(email);

      // Should only have one OTP in database
      const otps = await prisma.otp.findMany({
        where: { identifier: email.toLowerCase() },
      });

      expect(otps.length).toBe(1);
    });
  });

  describe('OTP Verification', () => {
    it('should verify correct OTP', async () => {
      const email = 'test@example.com';
      const { otp } = await otpService.generateAndStoreOtp(email);

      const result = await otpService.verifyOtp(email, otp);

      expect(result.identifier).toBe(email.toLowerCase());
      expect(result.type).toBe('email');

      // OTP should be deleted after successful verification
      const storedOtp = await prisma.otp.findFirst({
        where: { identifier: email.toLowerCase() },
      });

      expect(storedOtp).toBeNull();
    });

    it('should reject incorrect OTP', async () => {
      const email = 'test@example.com';
      await otpService.generateAndStoreOtp(email);

      await expect(
        otpService.verifyOtp(email, '0000')
      ).rejects.toThrow('Invalid OTP');
    });

    it('should reject expired OTP', async () => {
      const email = 'test@example.com';
      const { otp } = await otpService.generateAndStoreOtp(email);

      // Manually expire the OTP
      await prisma.otp.updateMany({
        where: { identifier: email.toLowerCase() },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await expect(
        otpService.verifyOtp(email, otp)
      ).rejects.toThrow('OTP has expired');
    });

    it('should track failed attempts', async () => {
      const email = 'test@example.com';
      await otpService.generateAndStoreOtp(email);

      // Try with wrong OTP 3 times
      for (let i = 0; i < 3; i++) {
        try {
          await otpService.verifyOtp(email, '0000');
        } catch (error) {
          // Expected to fail
        }
      }

      // OTP should be deleted after max attempts
      const storedOtp = await prisma.otp.findFirst({
        where: { identifier: email.toLowerCase() },
      });

      expect(storedOtp).toBeNull();
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting', async () => {
      const email = 'test@example.com';

      // Generate OTPs up to the limit (5 times)
      for (let i = 0; i < 5; i++) {
        await otpService.generateAndStoreOtp(email);
      }

      // 6th attempt should fail
      await expect(
        otpService.generateAndStoreOtp(email)
      ).rejects.toThrow('Too many OTP requests');
    });
  });

  describe('Notification Service', () => {
    it('should send OTP email (simulated)', async () => {
      const email = 'test@example.com';
      const otp = '1234';

      // This will be simulated in development
      await expect(
        notificationService.sendOtpEmail(email, otp)
      ).resolves.not.toThrow();
    });

    it('should send OTP SMS (simulated)', async () => {
      const phone = '+919876543210';
      const otp = '1234';

      // This will be simulated in development
      await expect(
        notificationService.sendOtpSms(phone, otp)
      ).resolves.not.toThrow();
    });
  });
});

