import nodemailer from 'nodemailer';
import logger from '../config/logger';
import { AppError } from '../middleware/errorHandler';

export class NotificationService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeEmailTransporter();
  }

  /**
   * Initialize email transporter
   */
  private initializeEmailTransporter(): void {
    if (process.env.NODE_ENV === 'test') {
      // Keep tests deterministic and fast: never attempt external SMTP during automated runs.
      logger.info('OTP delivery provider configured', {
        event: 'otp_delivery_provider',
        channel: 'email',
        provider: 'smtp',
        outcome: 'simulated',
        environment: 'test',
      });
      this.transporter = null;
      return;
    }

    // Check if SMTP credentials are configured
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpPort && smtpUser && smtpPass) {
      try {
        this.transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort),
          secure: parseInt(smtpPort) === 465, // true for 465, false for other ports
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });
        logger.info('OTP delivery provider configured', {
          event: 'otp_delivery_provider',
          channel: 'email',
          provider: 'smtp',
          outcome: 'available',
          environment: process.env.NODE_ENV || 'development',
        });
      } catch (error) {
        logger.error('OTP delivery provider unavailable', {
          event: 'otp_delivery_provider',
          channel: 'email',
          provider: 'smtp',
          outcome: 'unavailable',
          environment: process.env.NODE_ENV || 'development',
          errorCategory: error instanceof Error ? error.name : 'unknown',
        });
      }
    } else {
      logger.warn('OTP delivery provider unavailable', {
        event: 'otp_delivery_provider',
        channel: 'email',
        provider: 'smtp',
        outcome: process.env.NODE_ENV === 'production' ? 'unavailable' : 'simulated',
        environment: process.env.NODE_ENV || 'development',
      });
    }
  }

  /**
   * Send OTP via email
   */
  async sendOtpEmail(email: string, otp: string): Promise<void> {
    const subject = 'Your Finance AI Login OTP';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your OTP Code</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 16px;
            padding: 40px;
            text-align: center;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
          }
          .logo {
            width: 64px;
            height: 64px;
            background: white;
            border-radius: 16px;
            margin: 0 auto 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
          }
          h1 {
            color: white;
            margin: 0 0 16px;
            font-size: 28px;
            font-weight: 700;
          }
          .subtitle {
            color: rgba(255, 255, 255, 0.9);
            font-size: 16px;
            margin-bottom: 32px;
          }
          .otp-box {
            background: white;
            border-radius: 12px;
            padding: 32px;
            margin: 32px 0;
          }
          .otp-label {
            color: #666;
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 12px;
          }
          .otp-code {
            font-size: 48px;
            font-weight: 700;
            color: #667eea;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
          }
          .info-box {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 20px;
            color: white;
            font-size: 14px;
            margin-top: 24px;
          }
          .warning {
            color: rgba(255, 255, 255, 0.9);
            font-size: 12px;
            margin-top: 24px;
          }
          .footer {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            color: rgba(255, 255, 255, 0.7);
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">📊</div>
          <h1>Finance AI</h1>
          <p class="subtitle">Your One-Time Password</p>
          
          <div class="otp-box">
            <div class="otp-label">Your OTP Code</div>
            <div class="otp-code">${otp}</div>
          </div>
          
          <div class="info-box">
            ⏰ This code will expire in <strong>5 minutes</strong>
          </div>
          
          <p class="warning">
            🔒 Never share this code with anyone. Finance AI will never ask for your OTP.
          </p>
          
          <div class="footer">
            <p>If you didn't request this code, please ignore this email.</p>
            <p>© ${new Date().getFullYear()} Finance AI. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: `"Finance AI" <${process.env.SMTP_USER}>`,
          to: email,
          subject,
          html,
        });
        logger.info('OTP delivery attempt', {
          event: 'otp_delivery_attempt',
          channel: 'email',
          provider: 'smtp',
          outcome: 'sent',
          environment: process.env.NODE_ENV || 'development',
        });
        return; // Successfully sent, exit early
      } catch (error) {
        logger.error('OTP delivery attempt', {
          event: 'otp_delivery_attempt',
          channel: 'email',
          provider: 'smtp',
          outcome: 'failed',
          environment: process.env.NODE_ENV || 'development',
          errorCategory: error instanceof Error ? error.name : 'unknown',
        });
        if (process.env.NODE_ENV === 'production') {
          throw new AppError('OTP delivery is currently unavailable', 503);
        }
      }
    }

    if (process.env.NODE_ENV === 'production') {
      logger.error('OTP delivery attempt', {
        event: 'otp_delivery_attempt',
        channel: 'email',
        provider: 'smtp',
        outcome: 'unavailable',
        environment: 'production',
      });
      throw new AppError('OTP delivery is currently unavailable', 503);
    }

    logger.info('OTP delivery attempt', {
      event: 'otp_delivery_attempt',
      channel: 'email',
      provider: 'smtp',
      outcome: 'simulated',
      environment: process.env.NODE_ENV || 'development',
    });
  }

  /**
   * Send OTP via SMS
   * Note: This is a placeholder. Integrate with actual SMS provider (Twilio, AWS SNS, etc.)
   */
  async sendOtpSms(phone: string, otp: string): Promise<void> {
    void phone;
    void otp;
    const provider = process.env.SMS_PROVIDER || 'unconfigured';

    if (process.env.NODE_ENV === 'production') {
      logger.error('OTP delivery attempt', {
        event: 'otp_delivery_attempt',
        channel: 'sms',
        provider,
        outcome: 'unavailable',
        environment: 'production',
      });
      throw new AppError('OTP delivery is currently unavailable', 503);
    }

    logger.info('OTP delivery attempt', {
      event: 'otp_delivery_attempt',
      channel: 'sms',
      provider,
      outcome: 'simulated',
      environment: process.env.NODE_ENV || 'development',
    });

    // For actual implementation, you would use something like:
    /*
    // Example with Twilio:
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });
    
    // Example with AWS SNS:
    const AWS = require('aws-sdk');
    const sns = new AWS.SNS();
    
    await sns.publish({
      Message: message,
      PhoneNumber: phone,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional'
        }
      }
    }).promise();
    
    // Example with MSG91 (popular in India):
    const axios = require('axios');
    
    await axios.get('https://api.msg91.com/api/v5/flow/', {
      params: {
        authkey: process.env.MSG91_AUTH_KEY,
        mobile: phone.replace('+91', ''),
        otp: otp,
        template_id: process.env.MSG91_TEMPLATE_ID
      }
    });
    */
  }

  /**
   * Send OTP based on type (email or SMS)
   */
  async sendOtp(identifier: string, otp: string, type: 'email' | 'phone'): Promise<void> {
    if (type === 'email') {
      await this.sendOtpEmail(identifier, otp);
    } else {
      await this.sendOtpSms(identifier, otp);
    }
  }
}
