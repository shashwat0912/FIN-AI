import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import logger from '../config/logger';

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export class SettingsController {
  // Get user settings
  async getSettings(req: Request, res: Response<ApiResponse>) {
    try {
      void req;

      // For now, return default settings since we don't have a settings table
      // In a real app, you'd have a UserSettings model
      const defaultSettings = {
        profile: {
          name: '',
          email: '',
          avatar: null,
          timezone: 'UTC',
          currency: 'INR',
          language: 'en',
        },
        notifications: {
          email: true,
          push: true,
          sms: false,
          budgetAlerts: true,
          goalReminders: true,
          transactionAlerts: false,
          weeklyReports: true,
          monthlyReports: true,
        },
        preferences: {
          theme: 'system', // 'light', 'dark', 'system'
          defaultTransactionType: 'EXPENSE',
          defaultCurrency: 'INR',
          dateFormat: 'DD/MM/YYYY',
          numberFormat: 'Indian', // 'Indian', 'International'
          autoCategorize: true,
          showTutorials: true,
        },
        privacy: {
          dataSharing: false,
          analytics: true,
          crashReporting: true,
          marketingEmails: false,
        },
        security: {
          twoFactorEnabled: false,
          loginNotifications: true,
          sessionTimeout: 30, // minutes
          passwordExpiry: 90, // days
        },
      };

      res.json({
        success: true,
        message: 'Settings retrieved successfully',
        data: defaultSettings,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve settings',
        error: errorMessage(error, 'Failed to retrieve settings'),
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Update user settings
  async updateSettings(req: Request, res: Response<ApiResponse>) {
    try {
      const { section, settings } = req.body;

      // Debug logging removed for production

      // Validate section
      const validSections = ['profile', 'notifications', 'preferences', 'privacy', 'security'];
      
      if (!section) {
        return res.status(400).json({
          success: false,
          message: 'Missing settings section',
          error: 'Section is required',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      if (!validSections.includes(section)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid settings section',
          error: `Section must be one of: ${validSections.join(', ')}. Received: ${section}`,
          timestamp: new Date().toISOString(),
        });
      return;
      }

      // Validate settings data based on section
      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Invalid settings data',
          error: 'Settings must be a valid object',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      // Additional validation for specific sections
      if (section === 'preferences') {
        const { theme, language, defaultCurrency, dateFormat } = settings;
        
        // Validate theme
        if (theme && !['light', 'dark', 'system'].includes(theme)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid theme value',
            error: 'Theme must be one of: light, dark, system',
            timestamp: new Date().toISOString(),
          });
      return;
        }

        // Validate language
        if (language && !['en', 'hi', 'mr', 'kn', 'ta'].includes(language)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid language value',
            error: 'Language must be one of: en, hi, mr, kn, ta',
            timestamp: new Date().toISOString(),
          });
      return;
        }

        // Validate currency
        if (defaultCurrency && !['INR', 'USD', 'EUR', 'GBP'].includes(defaultCurrency)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid currency value',
            error: 'Currency must be one of: INR, USD, EUR, GBP',
            timestamp: new Date().toISOString(),
          });
      return;
        }

        // Validate date format
        if (dateFormat && !['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(dateFormat)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid date format value',
            error: 'Date format must be one of: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD',
            timestamp: new Date().toISOString(),
          });
      return;
        }
      } else if (section === 'security') {
        const { twoFactorEnabled, lastLogin, passwordChanged } = settings;
        
        // Validate two factor auth
        if (twoFactorEnabled !== undefined && typeof twoFactorEnabled !== 'boolean') {
          return res.status(400).json({
            success: false,
            message: 'Invalid two factor auth value',
            error: 'Two factor auth must be a boolean',
            timestamp: new Date().toISOString(),
          });
      return;
        }
        
        // Validate last login
        if (lastLogin && !Date.parse(lastLogin)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid last login date',
            error: 'Last login must be a valid ISO date string',
            timestamp: new Date().toISOString(),
          });
      return;
        }
        
        // Validate password changed
        if (passwordChanged !== undefined && typeof passwordChanged !== 'boolean') {
          return res.status(400).json({
            success: false,
            message: 'Invalid password changed value',
            error: 'Password changed must be a boolean',
            timestamp: new Date().toISOString(),
          });
      return;
        }
      }

      // Here you would typically save to database
      // await prisma.userSettings.upsert({
      //   where: { userId },
      //   update: { [section]: settings },
      //   create: { userId, [section]: settings },
      // });

      // Log the update for debugging
      logger.info('User settings updated', {
        event: 'user_settings_updated',
        section,
        outcome: 'success',
      });

      res.json({
        success: true,
        message: `${section} settings updated successfully`,
        data: { section, settings },
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: unknown) {
      logger.error('Settings update failed', {
        event: 'user_settings_update_failed',
        outcome: 'failed',
        errorCategory: error instanceof Error ? error.name : 'unknown',
      });
      res.status(500).json({
        success: false,
        message: 'Failed to update settings',
        error: errorMessage(error, 'Failed to update settings'),
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Get preferences
  async getPreferences(req: Request, res: Response<ApiResponse>) {
    try {
      void req;

      const preferences = {
        theme: 'system',
        defaultTransactionType: 'EXPENSE',
        defaultCurrency: 'INR',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: 'Indian',
        autoCategorize: true,
        showTutorials: true,
      };

      res.json({
        success: true,
        message: 'Preferences retrieved successfully',
        data: preferences,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve preferences',
        error: errorMessage(error, 'Failed to retrieve preferences'),
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Update preferences
  async updatePreferences(req: Request, res: Response<ApiResponse>) {
    try {
      const preferences = req.body;

      // Validate preferences
      const validThemes = ['light', 'dark', 'system'];
      const validTransactionTypes = ['INCOME', 'EXPENSE', 'TRANSFER'];
      const validCurrencies = ['INR', 'USD', 'EUR', 'GBP'];
      const validDateFormats = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
      const validNumberFormats = ['Indian', 'International'];

      if (preferences.theme && !validThemes.includes(preferences.theme)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid theme value',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      if (preferences.defaultTransactionType && !validTransactionTypes.includes(preferences.defaultTransactionType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid transaction type',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      if (preferences.defaultCurrency && !validCurrencies.includes(preferences.defaultCurrency)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid currency',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      if (preferences.dateFormat && !validDateFormats.includes(preferences.dateFormat)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      if (preferences.numberFormat && !validNumberFormats.includes(preferences.numberFormat)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid number format',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      res.json({
        success: true,
        message: 'Preferences updated successfully',
        data: preferences,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        message: 'Failed to update preferences',
        error: errorMessage(error, 'Failed to update preferences'),
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Get notification settings
  async getNotificationSettings(req: Request, res: Response<ApiResponse>) {
    try {
      void req;

      const notifications = {
        email: true,
        push: true,
        sms: false,
        budgetAlerts: true,
        goalReminders: true,
        transactionAlerts: false,
        weeklyReports: true,
        monthlyReports: true,
      };

      res.json({
        success: true,
        message: 'Notification settings retrieved successfully',
        data: notifications,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve notification settings',
        error: errorMessage(error, 'Failed to retrieve notification settings'),
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Update notification settings
  async updateNotificationSettings(req: Request, res: Response<ApiResponse>) {
    try {
      const notifications = req.body;

      res.json({
        success: true,
        message: 'Notification settings updated successfully',
        data: notifications,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        message: 'Failed to update notification settings',
        error: errorMessage(error, 'Failed to update notification settings'),
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }
}
