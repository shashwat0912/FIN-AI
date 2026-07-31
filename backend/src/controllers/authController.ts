import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { OtpService } from '../services/otpService';
import { NotificationService } from '../services/notificationService';
import {
  ApiError,
  ApiResponse,
  AuthenticatedRequest,
  LoginRequest,
  RegisterRequest,
  SendOtpRequest,
  VerifyOtpRequest,
} from '../types';
import logger from '../config/logger';

type BodyRequest<T> = Request<Record<string, never>, ApiResponse, T>;
type RefreshTokenBody = { refreshToken?: string };
type SetPasswordBody = { password?: string };
type ChangePasswordBody = { currentPassword?: string; newPassword?: string };

const authService = new AuthService();
const otpService = new OtpService();
const notificationService = new NotificationService();

const logAuthError = (event: string, error: unknown): void => {
  logger.error('Authentication request failed', {
    event,
    outcome: 'failed',
    errorCategory: error instanceof Error ? error.name : 'unknown',
  });
};

const getApiError = (error: unknown): ApiError | undefined =>
  error instanceof Error ? error as ApiError : undefined;

export class AuthController {
  async register(req: BodyRequest<RegisterRequest>, res: Response<ApiResponse>) {
    try {
      const result = await authService.register(req.body);
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: unknown) {
      logAuthError('registration_failed', error);
      const apiError = getApiError(error);
      res.status(apiError?.statusCode || 500).json({
        success: false,
        message: apiError?.message || 'Registration failed',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async login(req: BodyRequest<LoginRequest>, res: Response<ApiResponse>) {
    try {
      const result = await authService.login(req.body);
      
      res.json({
        success: true,
        message: 'Login successful',
        data: result,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: unknown) {
      logAuthError('login_failed', error);
      const apiError = getApiError(error);
      res.status(apiError?.statusCode || 500).json({
        success: false,
        message: apiError?.message || 'Login failed',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async refreshToken(req: BodyRequest<RefreshTokenBody>, res: Response<ApiResponse>) {
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
    } catch (error: unknown) {
      logAuthError('token_refresh_failed', error);
      const apiError = getApiError(error);
      res.status(apiError?.statusCode || 500).json({
        success: false,
        message: apiError?.message || 'Token refresh failed',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async logout(req: BodyRequest<RefreshTokenBody>, res: Response<ApiResponse>) {
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
    } catch (error: unknown) {
      logAuthError('logout_failed', error);
      const apiError = getApiError(error);
      res.status(apiError?.statusCode || 500).json({
        success: false,
        message: apiError?.message || 'Logout failed',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async logoutAll(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
      await authService.logoutAll(userId);
      
      res.json({
        success: true,
        message: 'All sessions logged out successfully',
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: unknown) {
      logAuthError('logout_all_failed', error);
      const apiError = getApiError(error);
      res.status(apiError?.statusCode || 500).json({
        success: false,
        message: apiError?.message || 'Logout all failed',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async setPassword(req: BodyRequest<SetPasswordBody>, res: Response<ApiResponse>) {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
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
    } catch (error: unknown) {
      logAuthError('password_set_failed', error);
      const apiError = getApiError(error);
      res.status(apiError?.statusCode || 500).json({
        success: false,
        message: apiError?.message || 'Set password failed',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async changePassword(req: BodyRequest<ChangePasswordBody>, res: Response<ApiResponse>) {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
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
    } catch (error: unknown) {
      logAuthError('password_change_failed', error);
      const apiError = getApiError(error);
      res.status(apiError?.statusCode || 500).json({
        success: false,
        message: apiError?.message || 'Change password failed',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async sendOtp(req: BodyRequest<SendOtpRequest>, res: Response<ApiResponse>) {
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
    } catch (error: unknown) {
      logAuthError('otp_send_failed', error);
      const apiError = getApiError(error);
      res.status(apiError?.statusCode || 500).json({
        success: false,
        message: apiError?.message || 'Failed to send OTP',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async verifyOtp(req: BodyRequest<VerifyOtpRequest>, res: Response<ApiResponse>) {
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
        logger.info('New user created via OTP', {
          event: 'otp_user_created',
          channel: type,
          outcome: 'success',
        });
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
    } catch (error: unknown) {
      logAuthError('otp_verify_failed', error);
      const apiError = getApiError(error);
      res.status(apiError?.statusCode || 500).json({
        success: false,
        message: apiError?.message || 'Failed to verify OTP',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }
}
