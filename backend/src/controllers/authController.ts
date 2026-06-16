import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { OtpService } from '../services/otpService';
import { NotificationService } from '../services/notificationService';
import { ApiResponse } from '../types';
import logger from '../config/logger';

const authService = new AuthService();
const otpService = new OtpService();
const notificationService = new NotificationService();

export class AuthController {
  async register(req: Request, res: Response<ApiResponse>) {
    try {
      const result = await authService.register(req.body);
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Registration error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Registration failed',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async login(req: Request, res: Response<ApiResponse>) {
    try {
      const result = await authService.login(req.body);
      
      res.json({
        success: true,
        message: 'Login successful',
        data: result,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Login error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Login failed',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async refreshToken(req: Request, res: Response<ApiResponse>) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      const result = await authService.refreshToken(refreshToken);
      
      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: result,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Token refresh error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Token refresh failed',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async logout(req: Request, res: Response<ApiResponse>) {
    try {
      const { refreshToken } = req.body;
      
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      
      res.json({
        success: true,
        message: 'Logout successful',
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Logout error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Logout failed',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async logoutAll(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      await authService.logoutAll(userId);
      
      res.json({
        success: true,
        message: 'All sessions logged out successfully',
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Logout all error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Logout all failed',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async setPassword(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      await authService.setPassword(userId, password);
      
      res.json({
        success: true,
        message: 'Password set successfully',
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Set password error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Set password failed',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async changePassword(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      await authService.changePassword(userId, currentPassword, newPassword);
      
      res.json({
        success: true,
        message: 'Password changed successfully',
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Change password error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Change password failed',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async sendOtp(req: Request, res: Response<ApiResponse>) {
    try {
      const { identifier } = req.body;

      // Normalize so we can check if user already exists
      const normalizedIdentifier = otpService.normalizeIdentifier(identifier);
      const existingUser = await authService.findUserByIdentifier(normalizedIdentifier);

      // Generate and store OTP
      const { otp, type } = await otpService.generateAndStoreOtp(identifier);

      // Send OTP via email or SMS
      await notificationService.sendOtp(
        type === 'phone' ? identifier : identifier.toLowerCase(),
        otp,
        type
      );

      const responseData: Record<string, unknown> = {
        type,
        identifier: type === 'phone' ? 
          otpService.validateAndNormalizePhone(identifier) : 
          identifier.toLowerCase(),
        expiresIn: 300, // 5 minutes in seconds
        requiresName: !existingUser, // true only for new users
      };
      // In development, include OTP in response so you can see it (SMS/email are simulated)
      if (process.env.NODE_ENV === 'development') {
        responseData.otpForDev = otp;
      }

      res.json({
        success: true,
        message: `OTP sent successfully to your ${type === 'email' ? 'email' : 'phone'}`,
        data: responseData,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Send OTP error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to send OTP',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async verifyOtp(req: Request, res: Response<ApiResponse>) {
    try {
      const { identifier, otp, name } = req.body;

      // Verify OTP
      const verificationResult = await otpService.verifyOtp(identifier, otp);
      const normalizedIdentifier = verificationResult.identifier;
      const type = verificationResult.type;

      // Check if user exists
      let user = await authService.findUserByIdentifier(normalizedIdentifier);

      // If user doesn't exist, create a new one
      if (!user) {
        if (!name) {
          return res.status(400).json({
            success: false,
            message: 'Name is required for new user registration',
            timestamp: new Date().toISOString(),
          });
        }

        user = await authService.createUserWithOtp(normalizedIdentifier, name, type);
        logger.info(`New user created via OTP: ${normalizedIdentifier}`);
      }

      // Generate tokens
      const accessToken = authService.generateAccessToken(user);
      const refreshToken = authService.generateRefreshToken(user);

      // Store refresh token
      await authService.storeRefreshToken(refreshToken, user.id);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            avatar: user.avatar,
          },
          accessToken,
          refreshToken,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Verify OTP error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to verify OTP',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }
}
