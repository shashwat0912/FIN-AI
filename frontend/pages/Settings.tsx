import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Bell, Palette, Shield, LogOut, Save, Edit3, Camera } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useDarkMode } from '../context/DarkModeContext';
import { useLanguage } from '../context/LanguageContext';
import { logger } from '../utils/logger';

export default function Settings() {
  const { isDarkMode, toggleDarkMode, theme } = useDarkMode();
  const { currentLanguage, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Get current user ID for user-specific storage
  const getUserId = () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId || payload.id || 'default';
      }
    } catch (error) {
      logger.warn('Error parsing user ID from token');
    }
    return 'default';
  };

  // Helper function to get user-specific localStorage key
  const getUserKey = (key: string) => `${key}_${getUserId()}`;

  // Profile settings
  const [profile, setProfile] = useState({
    name: 'Shashwat Shrivastava',
    email: 'test@example.com',
    phone: '+91 98765 43210',
    avatar: '',
  });

  // Notification settings
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    weeklyReport: true,
    budgetAlerts: true,
    goalReminders: true,
  });

  // Security settings
  const [security, setSecurity] = useState({
    twoFactorAuth: false,
    lastLogin: new Date().toISOString(),
    passwordChanged: false,
  });

  // Preference settings
  const [preferences, setPreferences] = useState({
    currency: 'INR',
    language: currentLanguage,
    theme: theme, // Sync with dark mode context
    dateFormat: 'DD/MM/YYYY',
    timezone: 'Asia/Kolkata',
  });
  
  // Password change modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const tabs = [
    { id: 'profile', label: t('profile'), icon: User },
    { id: 'notifications', label: t('notifications'), icon: Bell },
    { id: 'preferences', label: t('preferences'), icon: Palette },
    { id: 'security', label: t('security'), icon: Shield },
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  // Note: Theme and language sync is handled in the onChange handlers
  // to prevent render loops and ensure immediate updates

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load settings instantly from localStorage
      
      // Load settings from localStorage with fallbacks
      // This makes the settings page load instantly
      
      // Load profile data (user-specific)
      const savedProfile = localStorage.getItem(getUserKey('userProfile'));
      if (savedProfile) {
        const profileData = JSON.parse(savedProfile);
        setProfile({
          name: profileData.name || 'User',
          email: profileData.email || 'user@example.com',
          phone: profileData.phone || '+91 98765 43210',
          avatar: profileData.avatar || '',
        });
      } else {
        setProfile({
          name: 'User',
          email: 'user@example.com',
          phone: '+91 98765 43210',
          avatar: '',
        });
      }
      
      // Load preferences (user-specific)
      const savedPreferences = localStorage.getItem(getUserKey('userPreferences'));
      if (savedPreferences) {
        const prefData = JSON.parse(savedPreferences);
        setPreferences({
          currency: prefData.currency || 'INR',
          language: prefData.language || currentLanguage,
          theme: prefData.theme || theme,
          dateFormat: prefData.dateFormat || 'DD/MM/YYYY',
          timezone: prefData.timezone || 'Asia/Kolkata',
        });
      } else {
        setPreferences({
          currency: 'INR',
          language: currentLanguage,
          theme: theme,
          dateFormat: 'DD/MM/YYYY',
          timezone: 'Asia/Kolkata',
        });
      }
      
      // Load notifications (user-specific)
      const savedNotifications = localStorage.getItem(getUserKey('userNotifications'));
      if (savedNotifications) {
        const notifData = JSON.parse(savedNotifications);
        setNotifications({
          email: notifData.email ?? true,
          push: notifData.push ?? true,
          sms: notifData.sms ?? false,
          weeklyReport: notifData.weeklyReport ?? true,
          budgetAlerts: notifData.budgetAlerts ?? true,
          goalReminders: notifData.goalReminders ?? true,
        });
      } else {
        setNotifications({
          email: true,
          push: true,
          sms: false,
          weeklyReport: true,
          budgetAlerts: true,
          goalReminders: true,
        });
      }
      
      // Load security (user-specific)
      const savedSecurity = localStorage.getItem(getUserKey('userSecurity'));
      if (savedSecurity) {
        const secData = JSON.parse(savedSecurity);
        setSecurity({
          twoFactorAuth: secData.twoFactorAuth ?? false,
          lastLogin: secData.lastLogin || new Date().toISOString(),
          passwordChanged: secData.passwordChanged ?? false,
        });
      } else {
        setSecurity({
          twoFactorAuth: false,
          lastLogin: new Date().toISOString(),
          passwordChanged: false,
        });
      }
      
    } catch (error: any) {
      logger.error('Error loading settings', error);
      setError(error?.message || 'Failed to load settings. Please try again.');
      
      // Set default values on error to prevent UI crashes
      setProfile({
        name: 'User',
        email: 'user@example.com',
        phone: '+91 98765 43210',
        avatar: '',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = useCallback(async (section: string) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      // Save to localStorage instantly
      
      if (section === 'profile') {
        // Save profile to localStorage (user-specific)
        localStorage.setItem(getUserKey('userProfile'), JSON.stringify({
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          avatar: profile.avatar,
        }));
      } else if (section === 'preferences') {
        // Preferences auto-save in onChange handlers, no need to save here
        // This section is kept for backward compatibility but shouldn't be reached
      } else if (section === 'notifications') {
        // Save notifications to localStorage (user-specific)
        localStorage.setItem(getUserKey('userNotifications'), JSON.stringify({
          email: notifications.email,
          push: notifications.push,
          sms: notifications.sms,
          weeklyReport: notifications.weeklyReport,
          budgetAlerts: notifications.budgetAlerts,
          goalReminders: notifications.goalReminders,
        }));
      } else if (section === 'security') {
        // Save security settings to localStorage (user-specific)
        localStorage.setItem(getUserKey('userSecurity'), JSON.stringify({
          twoFactorAuth: security.twoFactorAuth,
          lastLogin: security.lastLogin,
          passwordChanged: security.passwordChanged,
        }));
      }
      
      setSuccess(`${section.charAt(0).toUpperCase() + section.slice(1)} settings saved successfully!`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      logger.error(`Error saving ${section} settings`, error);
      setError(`Failed to save ${section} settings. Please try again.`);
    } finally {
      setLoading(false);
    }
  }, [profile, preferences, notifications, security, isDarkMode, toggleDarkMode, theme]);

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      try {
        await apiClient.logout();
        localStorage.clear();
        window.location.assign('/');
      } catch (error: any) {
        logger.error('Error logging out', error);
        // Force logout even if API fails
        localStorage.clear();
        window.location.assign('/');
      }
    }
  };

  // Password change handler
  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    // Validation
    if (passwordForm.new.length < 6) {
      setPasswordError(t('password-min-length'));
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError(t('password-mismatch'));
      return;
    }

    try {
      await apiClient.changePassword(passwordForm.current, passwordForm.new);
      setPasswordSuccess(t('password-changed-success'));
      setPasswordForm({ current: '', new: '', confirm: '' });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (error: any) {
      setPasswordError(error.message || 'Failed to change password');
    }
  };

  const renderProfileSettings = useMemo(() => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('profile-information')}</h3>
        
        {/* Avatar */}
        <div className="flex items-center space-x-6 mb-6">
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {profile.name.charAt(0)}
            </div>
            <button className="absolute bottom-0 right-0 p-2 bg-white dark:bg-dark-900 rounded-full shadow-md hover:shadow-lg transition-shadow">
              <Camera className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">{profile.name}</h4>
            <p className="text-gray-500">{profile.email}</p>
            <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">
              {t('change-avatar')}
            </button>
          </div>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('full-name')}</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('email')}</label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('phone')}</label>
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
            />
          </div>
        </div>
      </div>
    </div>
  ), [profile]);

  const renderNotificationSettings = useMemo(() => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('notification-preferences')}</h3>
        
        <div className="space-y-4">
          {[
            { key: 'email', label: t('email-notifications'), description: t('receive-updates-email') },
            { key: 'push', label: t('push-notifications'), description: t('get-notified-device') },
            { key: 'sms', label: t('sms-notifications'), description: t('receive-text-messages') },
            { key: 'weeklyReport', label: t('weekly-reports'), description: t('get-weekly-summaries') },
            { key: 'budgetAlerts', label: t('budget-alerts'), description: t('notify-budget-limits') },
            { key: 'goalReminders', label: t('goal-reminders'), description: t('remind-financial-goals') },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-dark-700 last:border-b-0">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications[item.key as keyof typeof notifications]}
                  onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 dark:bg-dark-900"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  ), [notifications]);

  const renderPreferenceSettings = useMemo(() => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('app-preferences')}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('currency')}</label>
            <select
              value={preferences.currency}
              onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
            >
              <option value="INR">Indian Rupee (₹)</option>
              <option value="USD">US Dollar ($)</option>
              <option value="EUR">Euro (€)</option>
              <option value="GBP">British Pound (£)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('language')}</label>
            <select
              value={preferences.language}
              onChange={(e) => {
                const newLanguage = e.target.value;
                setPreferences({ ...preferences, language: newLanguage });
                setLanguage(newLanguage); // Update language context immediately
                
                // Save language preference immediately with updated state
                try {
                  const updatedPreferences = {
                    ...preferences,
                    language: newLanguage,
                  };
                  localStorage.setItem(getUserKey('userPreferences'), JSON.stringify(updatedPreferences));
                  // Update local state to match what we saved
                  setPreferences(updatedPreferences);
                  
                  // Trigger storage event to notify other components
                  window.dispatchEvent(new StorageEvent('storage', {
                    key: 'userPreferences',
                    newValue: JSON.stringify(updatedPreferences),
                    oldValue: JSON.stringify(preferences)
                  }));
                } catch (error) {
                  logger.warn('Error saving language preference');
                }
              }}
              className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
              <option value="mr">मराठी (Marathi)</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
              <option value="ta">தமிழ் (Tamil)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('theme')}</label>
            <select
              value={preferences.theme}
              onChange={(e) => {
                const newTheme = e.target.value;
                setPreferences({ ...preferences, theme: newTheme });
                
                // Apply theme change immediately and save to localStorage
                try {
                  const updatedPreferences = {
                    ...preferences,
                    theme: newTheme,
                  };
                  
                  localStorage.setItem(getUserKey('userPreferences'), JSON.stringify(updatedPreferences));
                  // Update local state to match what we saved
                  setPreferences(updatedPreferences);
                  
                  // Trigger storage event to notify DarkModeContext
                  window.dispatchEvent(new StorageEvent('storage', {
                    key: 'userPreferences',
                    newValue: JSON.stringify(updatedPreferences),
                    oldValue: JSON.stringify(preferences)
                  }));
                  
                  // Also update the old darkMode key for backward compatibility
                  if (newTheme === 'auto') {
                    // For auto, use system preference
                    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    localStorage.setItem('darkMode', systemPrefersDark.toString());
                  } else {
                    localStorage.setItem('darkMode', (newTheme === 'dark').toString());
                  }
                  
                  // DarkModeContext will automatically pick up the theme change via storage event
                } catch (error) {
                  logger.warn('Error saving theme preference');
                }
              }}
              className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('date-format')}</label>
            <select
              value={preferences.dateFormat}
              onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  ), [preferences, isDarkMode, toggleDarkMode, theme, currentLanguage, setLanguage]);

  const renderSecuritySettings = useMemo(() => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('security-privacy')}</h3>
        
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">{t('change-password')}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('update-password-secure')}</p>
            <button 
              onClick={() => setShowPasswordModal(true)}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              {t('change-password')}
            </button>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">{t('two-factor-auth')}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('add-extra-security')}</p>
            <button className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors">
              {t('enable-2fa')}
            </button>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">{t('data-export')}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('download-financial-data')}</p>
            <button className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors">
              {t('export-data')}
            </button>
          </div>
        </div>
      </div>
    </div>
  ), [security]);

  // Settings load instantly from localStorage, no loading spinner needed

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('settings')}</h1>
        <p className="text-gray-600 mt-1">{t('manage-account-settings')}</p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-600">{success}</p>
        </div>
      )}
      
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 dark:bg-dark-900">
        {/* Tab Navigation */}
        <div className="overflow-x-auto border-b border-gray-200 dark:border-dark-700">
          <nav className="flex gap-4 px-4 sm:gap-8 sm:px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'profile' && renderProfileSettings}
          {activeTab === 'notifications' && renderNotificationSettings}
          {activeTab === 'preferences' && renderPreferenceSettings}
          {activeTab === 'security' && renderSecuritySettings}
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-dark-800 border-t border-gray-200 dark:border-dark-700 rounded-b-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={handleLogout}
              className="flex items-center justify-center px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors sm:justify-start"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t('logout')}
            </button>
            
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              {/* Only show save button for tabs that need it (not preferences) */}
              {activeTab !== 'preferences' && (
                <button
                  onClick={() => handleSave(activeTab)}
                  disabled={loading}
                  className="flex items-center justify-center px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {t('save-changes')}
                </button>
              )}
              {/* Show auto-save indicator for preferences */}
              {activeTab === 'preferences' && (
                <div className="flex items-center justify-center text-sm text-green-600 dark:text-green-400 sm:justify-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  {t('auto-saved')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('change-password')}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('current-password')}
                </label>
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-dark-700 dark:text-white"
                  placeholder={t('current-password')}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('new-password')}
                </label>
                <input
                  type="password"
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-dark-700 dark:text-white"
                  placeholder={t('new-password')}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('confirm-password')}
                </label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-dark-700 dark:text-white"
                  placeholder={t('confirm-password')}
                />
              </div>
            </div>

            {passwordError && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
              </div>
            )}

            {passwordSuccess && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400">{passwordSuccess}</p>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordForm({ current: '', new: '', confirm: '' });
                  setPasswordError('');
                  setPasswordSuccess('');
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleChangePassword}
                className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                {t('change-password')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
