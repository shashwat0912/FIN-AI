import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import logger from '../config/logger';

export class OtpService {
  private readonly OTP_LENGTH = 4;
  private readonly OTP_EXPIRY_MINUTES = 5;
  private readonly MAX_ATTEMPTS = 3;
  private readonly RATE_LIMIT_WINDOW_HOURS = 1;
  private readonly MAX_REQUESTS_PER_HOUR = 5;

  /**
   * Generate a 4-digit numeric OTP
   */
  private generateOtp(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Hash the OTP for secure storage
   */
  private async hashOtp(otp: string): Promise<string> {
    return bcrypt.hash(otp, 10);
  }

  /**
   * Verify OTP against stored hash
   */
  private async verifyOtpHash(otp: string, hash: string): Promise<boolean> {
    return bcrypt.compare(otp, hash);
  }

  /**
   * Validate Indian phone number format
   * Accepts: 9876543210, +919876543210, 0919876543210
   * Returns normalized format: +91XXXXXXXXXX
   */
  validateAndNormalizePhone(phone: string): string | null {
    // Remove all spaces and dashes
    const cleaned = phone.replace(/[\s-]/g, '');
    
    // Check for various Indian phone formats
    const patterns = [
      /^(\+91)?([6-9]\d{9})$/, // +91XXXXXXXXXX or XXXXXXXXXX (10 digits starting with 6-9)
      /^(0091)?([6-9]\d{9})$/, // 0091XXXXXXXXXX
      /^(91)?([6-9]\d{9})$/,   // 91XXXXXXXXXX
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        const digits = match[2]; // Extract the 10-digit number
        return `+91${digits}`;
      }
    }

    return null;
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Detect if identifier is email or phone
   */
  detectIdentifierType(identifier: string): 'email' | 'phone' | null {
    // Try phone first
    if (this.validateAndNormalizePhone(identifier)) {
      return 'phone';
    }
    
    // Try email
    if (this.validateEmail(identifier)) {
      return 'email';
    }
    
    return null;
  }

  /**
   * Normalize identifier (phone or email)
   */
  normalizeIdentifier(identifier: string): string {
    const type = this.detectIdentifierType(identifier);
    
    if (type === 'phone') {
      return this.validateAndNormalizePhone(identifier)!;
    }
    
    if (type === 'email') {
      return identifier.toLowerCase().trim();
    }
    
    throw new AppError('Invalid email or phone number format', 400);
  }

  /**
   * Check rate limiting for OTP requests
   */
  async checkRateLimit(identifier: string): Promise<void> {
    const normalizedIdentifier = this.normalizeIdentifier(identifier);
    const windowStart = new Date(Date.now() - this.RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000);

    // Clean up old rate limit records
    await prisma.otpRateLimit.deleteMany({
      where: {
        windowStart: {
          lt: windowStart,
        },
      },
    });

    // Count requests in current window
    const recentRequests = await prisma.otpRateLimit.count({
      where: {
        identifier: normalizedIdentifier,
        windowStart: {
          gte: windowStart,
        },
      },
    });

    if (recentRequests >= this.MAX_REQUESTS_PER_HOUR) {
      throw new AppError(
        `Too many OTP requests. Please try again after ${this.RATE_LIMIT_WINDOW_HOURS} hour(s).`,
        429
      );
    }

    // Record this request
    await prisma.otpRateLimit.create({
      data: {
        identifier: normalizedIdentifier,
        count: 1,
        windowStart: new Date(),
      },
    });
  }

  /**
   * Generate and store OTP
   */
  async generateAndStoreOtp(identifier: string): Promise<{ otp: string; type: 'email' | 'phone' }> {
    const normalizedIdentifier = this.normalizeIdentifier(identifier);
    const type = this.detectIdentifierType(identifier);

    if (!type) {
      throw new AppError('Invalid email or phone number format', 400);
    }

    // Check rate limiting
    await this.checkRateLimit(normalizedIdentifier);

    // Generate OTP
    const otp = this.generateOtp();
    const otpHash = await this.hashOtp(otp);
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate any existing OTPs for this identifier
    await prisma.otp.deleteMany({
      where: {
        identifier: normalizedIdentifier,
      },
    });

    // Store new OTP
    await prisma.otp.create({
      data: {
        identifier: normalizedIdentifier,
        otpHash,
        expiresAt,
        attempts: 0,
        verified: false,
      },
    });

    logger.info('OTP generated', {
      event: 'otp_generated',
      channel: type,
      outcome: 'stored',
    });

    return { otp, type };
  }

  /**
   * Verify OTP
   */
  async verifyOtp(identifier: string, otp: string): Promise<{ identifier: string; type: 'email' | 'phone' }> {
    const normalizedIdentifier = this.normalizeIdentifier(identifier);
    const type = this.detectIdentifierType(identifier);

    if (!type) {
      throw new AppError('Invalid email or phone number format', 400);
    }

    // Find the OTP record
    const otpRecord = await prisma.otp.findFirst({
      where: {
        identifier: normalizedIdentifier,
        verified: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpRecord) {
      throw new AppError('No OTP found. Please request a new one.', 400);
    }

    // Check if OTP is expired
    if (otpRecord.expiresAt < new Date()) {
      await prisma.otp.delete({ where: { id: otpRecord.id } });
      throw new AppError('OTP has expired. Please request a new one.', 400);
    }

    // Check max attempts
    if (otpRecord.attempts >= this.MAX_ATTEMPTS) {
      await prisma.otp.delete({ where: { id: otpRecord.id } });
      throw new AppError('Too many failed attempts. Please request a new OTP.', 400);
    }

    // Verify OTP
    const isValid = await this.verifyOtpHash(otp, otpRecord.otpHash);

    if (!isValid) {
      // Increment attempts
      await prisma.otp.update({
        where: { id: otpRecord.id },
        data: { attempts: otpRecord.attempts + 1 },
      });

      const remainingAttempts = this.MAX_ATTEMPTS - (otpRecord.attempts + 1);
      if (remainingAttempts > 0) {
        throw new AppError(
          `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
          400
        );
      } else {
        await prisma.otp.delete({ where: { id: otpRecord.id } });
        throw new AppError('Invalid OTP. Maximum attempts reached. Please request a new OTP.', 400);
      }
    }

    // Mark as verified and delete
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    // Delete the OTP record after successful verification
    await prisma.otp.delete({ where: { id: otpRecord.id } });

    logger.info('OTP verified', {
      event: 'otp_verified',
      channel: type,
      outcome: 'success',
    });

    return { identifier: normalizedIdentifier, type };
  }

  /**
   * Clean up expired OTPs (can be called periodically)
   */
  async cleanupExpiredOtps(): Promise<void> {
    const result = await prisma.otp.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (result.count > 0) {
      logger.info(`Cleaned up ${result.count} expired OTP(s)`);
    }
  }
}
