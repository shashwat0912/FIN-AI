import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Bell, Palette, Shield, LogOut, Save } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useDarkMode } from '../context/DarkModeContext';
import { useLanguage } from '../context/LanguageContext';
import { logger } from '../utils/logger';
import { decodeToken } from '../utils/jwtUtils';
import { dispatchProfileUpdated } from '../lib/appEvents';

const isEmailLike = (value?: unknown) => typeof value === 'string' && value.includes('@');

const isPhoneLike = (value?: unknown) => {
  if (typeof value !== 'string') return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 && (value.trim().startsWith('+') || digits.length >= value.replace(/\s/g, '').length * 0.7);
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function Settings() {
  const { theme } = useDarkMode();
  const { currentLanguage, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const getAuthIdentity = useCallback(() => {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        const user = decodeToken(token);
        const candidates = [user?.email, user?.phone, user?.identifier, user?.loginId, user?.username];
        const email = candidates.find(isEmailLike) || '';
        const phone = candidates.find(isPhoneLike) || '';
        const id = user?.userId || email || phone || 'default';
        return {
          id,
          email,
          phone,
        };
      }
    } catch (error) {
      logger.warn('Error parsing user identity from token');
    }
    return { id: 'default', email: '', phone: '' };
  }, []);

  // Helper function to get user-specific localStorage key
  const getUserKey = useCallback((key: string) => `${key}_${getAuthIdentity().id}`, [getAuthIdentity]);

  // Profile settings
  const [profile, setProfile] = useState({
    name: 'User',
    email: 'Email unavailable',
    phone: '',
    avatar: '',
  });
  const getProfileInitial = useCallback(() => {
    const source = profile.name.trim() || profile.email.trim() || 'User';
    return source.charAt(0).toUpperCase();
  }, [profile.email, profile.name]);

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

  // Note: Theme and language sync is handled in the onChange handlers
  // to prevent render loops and ensure immediate updates

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load settings instantly from localStorage
      
      // Load settings from localStorage with fallbacks
      // This makes the settings page load instantly
      
      // Load profile data (user-specific)
      const authIdentity = getAuthIdentity();
      const authEmail = authIdentity.email || 'Email unavailable';
      const savedProfile = localStorage.getItem(getUserKey('userProfile'));
      if (savedProfile) {
        const profileData = JSON.parse(savedProfile);
        setProfile({
          name: profileData.name || 'User',
          email: authEmail,
          phone: typeof profileData.phone === 'string' ? profileData.phone : authIdentity.phone,
          avatar: profileData.avatar || '',
        });
      } else {
        setProfile({
          name: 'User',
          email: authEmail,
          phone: authIdentity.phone,
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
      
    } catch (error: unknown) {
      logger.error('Error loading settings', error);
      setError(getErrorMessage(error, 'Failed to load settings. Please try again.'));
      
      // Set default values on error to prevent UI crashes
      setProfile({
        name: 'User',
        email: getAuthIdentity().email || 'Email unavailable',
        phone: getAuthIdentity().phone,
        avatar: '',
      });
    } finally {
      setLoading(false);
    }
  }, [currentLanguage, getAuthIdentity, getUserKey, theme]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const savePreferences = useCallback((updatedPreferences: typeof preferences) => {
    try {
      localStorage.setItem(getUserKey('userPreferences'), JSON.stringify(updatedPreferences));
      localStorage.setItem('userPreferences', JSON.stringify(updatedPreferences));
      setPreferences(updatedPreferences);
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'userPreferences',
        newValue: JSON.stringify(updatedPreferences),
        oldValue: JSON.stringify(preferences)
      }));
    } catch (error) {
      logger.warn('Error saving preferences');
    }
  }, [getUserKey, preferences]);

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
          phone: profile.phone,
          avatar: profile.avatar,
        }));
        dispatchProfileUpdated();
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
      
      const sectionLabel = section === 'profile' ? 'Profile display' : 'Notification preferences';
      setSuccess(`${sectionLabel} saved on this device.`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: unknown) {
      logger.error(`Error saving ${section} settings`, error);
      setError(`Failed to save ${section} settings. Please try again.`);
    } finally {
      setLoading(false);
    }
  }, [getUserKey, profile, notifications, security]);

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      try {
        await apiClient.logout();
        localStorage.clear();
        window.location.assign('/');
      } catch (error: unknown) {
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
    } catch (error: unknown) {
      setPasswordError(getErrorMessage(error, 'Failed to change password'));
    }
  };

  const renderProfileSettings = useMemo(() => (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-semibold text-white">{t('profile-information')}</h3>
        
        {/* Avatar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10 text-2xl font-bold text-emerald-200">
              {getProfileInitial()}
            </div>
          </div>
          <div>
            <h4 className="text-lg font-medium text-white">{profile.name}</h4>
            <p className="text-sm text-zinc-400">{profile.email}</p>
          </div>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('full-name')}</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('email')}</label>
            <input
              type="email"
              value={profile.email}
              readOnly
              className="h-11 w-full cursor-not-allowed rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-400 placeholder:text-zinc-500"
            />
            <p className="mt-1.5 text-xs text-zinc-500">Email is tied to your sign-in account.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('phone')}</label>
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
            />
          </div>
        </div>
      </div>
    </div>
  ), [getProfileInitial, profile, t]);

  const renderNotificationSettings = useMemo(() => (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-semibold text-white">{t('notification-preferences')}</h3>
        
        <div className="space-y-4">
          {[
            { key: 'email', label: t('email-notifications'), description: t('receive-updates-email') },
            { key: 'push', label: t('push-notifications'), description: t('get-notified-device') },
            { key: 'sms', label: t('sms-notifications'), description: t('receive-text-messages') },
            { key: 'weeklyReport', label: t('weekly-reports'), description: t('get-weekly-summaries') },
            { key: 'budgetAlerts', label: t('budget-alerts'), description: t('notify-budget-limits') },
            { key: 'goalReminders', label: t('goal-reminders'), description: t('remind-financial-goals') },
          ].map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-4 border-b border-zinc-800 py-4 last:border-b-0">
              <div className="min-w-0">
                <h4 className="text-sm font-medium text-zinc-100">{item.label}</h4>
                <p className="mt-1 text-sm text-zinc-500">{item.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications[item.key as keyof typeof notifications]}
                  onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="peer h-6 w-11 rounded-full bg-zinc-800 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-zinc-700 after:bg-zinc-300 after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-checked:after:border-emerald-200 peer-checked:after:bg-zinc-950 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-400/20"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  ), [notifications, t]);

  const renderPreferenceSettings = useMemo(() => (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-semibold text-white">{t('app-preferences')}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('currency')}</label>
            <select
              value={preferences.currency}
              onChange={(e) => savePreferences({ ...preferences, currency: e.target.value })}
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
            >
              <option value="INR">Indian Rupee (₹)</option>
              <option value="USD">US Dollar ($)</option>
              <option value="EUR">Euro (€)</option>
              <option value="GBP">British Pound (£)</option>
            </select>
          </div>
          
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('language')}</label>
            <select
              value={preferences.language}
              onChange={(e) => {
                const newLanguage = e.target.value;
                setLanguage(newLanguage); // Update language context immediately
                savePreferences({ ...preferences, language: newLanguage });
              }}
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
              <option value="mr">मराठी (Marathi)</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
              <option value="ta">தமிழ் (Tamil)</option>
            </select>
          </div>
          
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('theme')}</label>
            <select
              value={preferences.theme}
              onChange={(e) => {
                const newTheme = e.target.value;
                savePreferences({ ...preferences, theme: newTheme });

                // Also update the old darkMode key for backward compatibility
                if (newTheme === 'auto') {
                  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  localStorage.setItem('darkMode', systemPrefersDark.toString());
                } else {
                  localStorage.setItem('darkMode', (newTheme === 'dark').toString());
                }
              }}
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto</option>
            </select>
          </div>
          
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('date-format')}</label>
            <select
              value={preferences.dateFormat}
              onChange={(e) => savePreferences({ ...preferences, dateFormat: e.target.value })}
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  ), [preferences, savePreferences, setLanguage, t]);

  const renderSecuritySettings = useMemo(() => (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-semibold text-white">{t('security-privacy')}</h3>
        
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h4 className="mb-2 text-sm font-medium text-zinc-100">{t('change-password')}</h4>
            <p className="mb-3 text-sm text-zinc-500">{t('update-password-secure')}</p>
            <button 
              onClick={() => setShowPasswordModal(true)}
              className="inline-flex h-10 w-full items-center justify-center rounded-full bg-emerald-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 sm:w-auto"
            >
              {t('change-password')}
            </button>
          </div>
        </div>
      </div>
    </div>
  ), [t]);

  // Settings load instantly from localStorage, no loading spinner needed

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 text-white">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">Settings</h1>
        <p className="mt-2 text-sm text-zinc-400 sm:text-base">Manage your account, preferences, and security.</p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
          <p className="text-sm text-emerald-200">{success}</p>
        </div>
      )}
      
      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60">
        {/* Tab Navigation */}
        <div className="overflow-x-auto border-b border-zinc-800">
          <nav className="flex min-w-max gap-1 px-3 py-2 sm:min-w-0 sm:flex-wrap sm:px-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400/20 ${
                  activeTab === tab.id
                    ? 'bg-emerald-500/10 text-emerald-200'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          {activeTab === 'profile' && renderProfileSettings}
          {activeTab === 'notifications' && renderNotificationSettings}
          {activeTab === 'preferences' && renderPreferenceSettings}
          {activeTab === 'security' && renderSecuritySettings}
        </div>

        {/* Action Buttons */}
        <div className="border-t border-zinc-800 bg-zinc-900/60 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={handleLogout}
              className="inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200 focus:outline-none focus:ring-2 focus:ring-red-400/20 sm:justify-start"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t('logout')}
            </button>
            
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              {/* Only show save button for tabs with local settings to save. */}
              {(activeTab === 'profile' || activeTab === 'notifications') && (
                <button
                  onClick={() => handleSave(activeTab)}
                  disabled={loading}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-500 px-6 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-zinc-950"></div>
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {t('save-changes')}
                </button>
              )}
              {/* Show auto-save indicator for preferences */}
              {activeTab === 'preferences' && (
                <div className="flex h-11 items-center justify-center text-sm text-emerald-300 sm:justify-start">
                  <div className="mr-2 h-2 w-2 rounded-full bg-emerald-400"></div>
                  {t('auto-saved')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">
              {t('change-password')}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  {t('current-password')}
                </label>
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                  placeholder={t('current-password')}
                />
              </div>
              
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  {t('new-password')}
                </label>
                <input
                  type="password"
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                  placeholder={t('new-password')}
                />
              </div>
              
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  {t('confirm-password')}
                </label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                  placeholder={t('confirm-password')}
                />
              </div>
            </div>

            {passwordError && (
              <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3">
                <p className="text-sm text-red-200">{passwordError}</p>
              </div>
            )}

            {passwordSuccess && (
              <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                <p className="text-sm text-emerald-200">{passwordSuccess}</p>
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordForm({ current: '', new: '', confirm: '' });
                  setPasswordError('');
                  setPasswordSuccess('');
                }}
                className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 px-4 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500/40"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleChangePassword}
                className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
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
