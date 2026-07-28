import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, LogOut, Palette, Save, Shield, User } from "lucide-react";
import { apiClient } from "../lib/api";
import { ThemePreference, useDarkMode } from "../context/DarkModeContext";
import { useLanguage } from "../context/LanguageContext";
import { logger } from "../utils/logger";
import { decodeToken } from "../utils/jwtUtils";
import { dispatchProfileUpdated } from "../lib/appEvents";
import {
  Button,
  Field,
  FolioHeader,
  InlineNotice,
} from "../components/ui/PrivateLedger";
import { ledgerControlClass } from "../styles/tokens";

type SettingsSection = "profile" | "notifications" | "preferences" | "security";

interface ProfileSettings {
  name: string;
  email: string;
  phone: string;
  avatar: string;
}

interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  weeklyReport: boolean;
  budgetAlerts: boolean;
  goalReminders: boolean;
}

interface SecuritySettings {
  twoFactorAuth: boolean;
  lastLogin: string;
  passwordChanged: boolean;
}

interface AppPreferences {
  currency: string;
  language: string;
  theme: ThemePreference;
  dateFormat: string;
  timezone: string;
}

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  email: true,
  push: true,
  sms: false,
  weeklyReport: true,
  budgetAlerts: true,
  goalReminders: true,
};

const isEmailLike = (value?: unknown) =>
  typeof value === "string" && value.includes("@");

const isPhoneLike = (value?: unknown) => {
  if (typeof value !== "string") return false;
  const digits = value.replace(/\D/g, "");
  return (
    digits.length >= 8 &&
    (value.trim().startsWith("+") ||
      digits.length >= value.replace(/\s/g, "").length * 0.7)
  );
};

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === "light" || value === "dark" || value === "auto";

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function Settings() {
  const { preference: theme, setTheme } = useDarkMode();
  const { currentLanguage, setLanguage, t } = useLanguage();
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("profile");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileSettings>({
    name: "User",
    email: "Email unavailable",
    phone: "",
    avatar: "",
  });
  const [notifications, setNotifications] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATIONS,
  );
  const [security, setSecurity] = useState<SecuritySettings>({
    twoFactorAuth: false,
    lastLogin: new Date().toISOString(),
    passwordChanged: false,
  });
  const [preferences, setPreferences] = useState<AppPreferences>({
    currency: "INR",
    language: currentLanguage,
    theme,
    dateFormat: "DD/MM/YYYY",
    timezone: "Asia/Kolkata",
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const passwordDialogRef = useRef<HTMLDivElement>(null);

  const tabs: Array<{
    id: SettingsSection;
    label: string;
    description: string;
    icon: typeof User;
  }> = [
    {
      id: "profile",
      label: t("profile"),
      description: "Personal details",
      icon: User,
    },
    {
      id: "notifications",
      label: t("notifications"),
      description: "Alerts and reports",
      icon: Bell,
    },
    {
      id: "preferences",
      label: t("preferences"),
      description: "Locale and display",
      icon: Palette,
    },
    {
      id: "security",
      label: t("security"),
      description: "Password and access",
      icon: Shield,
    },
  ];

  const getAuthIdentity = useCallback(() => {
    try {
      const token = localStorage.getItem("accessToken");
      if (token) {
        const user = decodeToken(token);
        const candidates = [
          user?.email,
          user?.phone,
          user?.identifier,
          user?.loginId,
          user?.username,
        ];
        const email = candidates.find(isEmailLike) || "";
        const phone = candidates.find(isPhoneLike) || "";
        return {
          id: user?.userId || email || phone || "default",
          email,
          phone,
        };
      }
    } catch {
      logger.warn("Error parsing user identity from token");
    }
    return { id: "default", email: "", phone: "" };
  }, []);

  const getUserKey = useCallback(
    (key: string) => `${key}_${getAuthIdentity().id}`,
    [getAuthIdentity],
  );

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const authIdentity = getAuthIdentity();
      const authEmail = authIdentity.email || "Email unavailable";
      const savedProfile = localStorage.getItem(getUserKey("userProfile"));
      if (savedProfile) {
        const profileData = JSON.parse(
          savedProfile,
        ) as Partial<ProfileSettings>;
        setProfile({
          name: profileData.name || "User",
          email: authEmail,
          phone:
            typeof profileData.phone === "string"
              ? profileData.phone
              : authIdentity.phone,
          avatar: profileData.avatar || "",
        });
      } else {
        setProfile({
          name: "User",
          email: authEmail,
          phone: authIdentity.phone,
          avatar: "",
        });
      }

      const savedPreferences = localStorage.getItem(
        getUserKey("userPreferences"),
      );
      if (savedPreferences) {
        const saved = JSON.parse(savedPreferences) as Partial<AppPreferences>;
        setPreferences({
          currency: saved.currency || "INR",
          language: saved.language || currentLanguage,
          theme: isThemePreference(saved.theme) ? saved.theme : theme,
          dateFormat: saved.dateFormat || "DD/MM/YYYY",
          timezone: saved.timezone || "Asia/Kolkata",
        });
      } else {
        setPreferences({
          currency: "INR",
          language: currentLanguage,
          theme,
          dateFormat: "DD/MM/YYYY",
          timezone: "Asia/Kolkata",
        });
      }

      const savedNotifications = localStorage.getItem(
        getUserKey("userNotifications"),
      );
      if (savedNotifications) {
        const saved = JSON.parse(
          savedNotifications,
        ) as Partial<NotificationPreferences>;
        setNotifications({
          email: saved.email ?? true,
          push: saved.push ?? true,
          sms: saved.sms ?? false,
          weeklyReport: saved.weeklyReport ?? true,
          budgetAlerts: saved.budgetAlerts ?? true,
          goalReminders: saved.goalReminders ?? true,
        });
      } else {
        setNotifications(DEFAULT_NOTIFICATIONS);
      }

      const savedSecurity = localStorage.getItem(getUserKey("userSecurity"));
      if (savedSecurity) {
        const saved = JSON.parse(savedSecurity) as Partial<SecuritySettings>;
        setSecurity({
          twoFactorAuth: saved.twoFactorAuth ?? false,
          lastLogin: saved.lastLogin || new Date().toISOString(),
          passwordChanged: saved.passwordChanged ?? false,
        });
      } else {
        setSecurity({
          twoFactorAuth: false,
          lastLogin: new Date().toISOString(),
          passwordChanged: false,
        });
      }
    } catch (requestError: unknown) {
      logger.error(
        "Error loading settings",
        requestError instanceof Error ? requestError : undefined,
      );
      setError(
        getErrorMessage(
          requestError,
          "Failed to load settings. Please try again.",
        ),
      );
      const identity = getAuthIdentity();
      setProfile({
        name: "User",
        email: identity.email || "Email unavailable",
        phone: identity.phone,
        avatar: "",
      });
    } finally {
      setLoading(false);
    }
  }, [currentLanguage, getAuthIdentity, getUserKey, theme]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!showPasswordModal) return;

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowPasswordModal(false);
        return;
      }
      if (event.key !== "Tab" || !passwordDialogRef.current) return;

      const focusable = Array.from(
        passwordDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", handleDialogKeyDown);
    return () => document.removeEventListener("keydown", handleDialogKeyDown);
  }, [showPasswordModal]);

  const savePreferences = useCallback(
    (updatedPreferences: AppPreferences) => {
      try {
        localStorage.setItem(
          getUserKey("userPreferences"),
          JSON.stringify(updatedPreferences),
        );
        localStorage.setItem(
          "userPreferences",
          JSON.stringify(updatedPreferences),
        );
        setPreferences(updatedPreferences);
        setTheme(updatedPreferences.theme);
      } catch {
        logger.warn("Error saving preferences");
      }
    },
    [getUserKey, setTheme],
  );

  const handleSave = useCallback(
    async (section: SettingsSection) => {
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);

        if (section === "profile") {
          localStorage.setItem(
            getUserKey("userProfile"),
            JSON.stringify({
              name: profile.name,
              phone: profile.phone,
              avatar: profile.avatar,
            }),
          );
          dispatchProfileUpdated();
        } else if (section === "notifications") {
          localStorage.setItem(
            getUserKey("userNotifications"),
            JSON.stringify(notifications),
          );
        } else if (section === "security") {
          localStorage.setItem(
            getUserKey("userSecurity"),
            JSON.stringify(security),
          );
        }

        const sectionLabel =
          section === "profile"
            ? "Profile display"
            : "Notification preferences";
        setSuccess(`${sectionLabel} saved on this device.`);
        window.setTimeout(() => setSuccess(null), 3000);
      } catch (requestError: unknown) {
        logger.error(
          `Error saving ${section} settings`,
          requestError instanceof Error ? requestError : undefined,
        );
        setError(`Failed to save ${section} settings. Please try again.`);
      } finally {
        setLoading(false);
      }
    },
    [getUserKey, notifications, profile, security],
  );

  const handleLogout = async () => {
    if (!window.confirm("Are you sure you want to logout?")) return;

    try {
      await apiClient.logout();
    } catch (requestError: unknown) {
      logger.error(
        "Error logging out",
        requestError instanceof Error ? requestError : undefined,
      );
    } finally {
      localStorage.clear();
      window.location.assign("/");
    }
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordForm({ current: "", new: "", confirm: "" });
    setPasswordError("");
    setPasswordSuccess("");
  };

  const handleChangePassword = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordForm.new.length < 6) {
      setPasswordError(t("password-min-length"));
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError(t("password-mismatch"));
      return;
    }

    try {
      await apiClient.changePassword(passwordForm.current, passwordForm.new);
      setPasswordSuccess(t("password-changed-success"));
      setPasswordForm({ current: "", new: "", confirm: "" });
      window.setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess("");
      }, 2000);
    } catch (requestError: unknown) {
      setPasswordError(
        getErrorMessage(requestError, "Failed to change password"),
      );
    }
  };

  const profileInitial = (profile.name.trim() || profile.email.trim() || "User")
    .charAt(0)
    .toUpperCase();
  const activeTab = tabs.find((tab) => tab.id === activeSection) || tabs[0];
  const notificationItems: Array<{
    key: keyof NotificationPreferences;
    label: string;
    description: string;
  }> = [
    {
      key: "email",
      label: t("email-notifications"),
      description: t("receive-updates-email"),
    },
    {
      key: "push",
      label: t("push-notifications"),
      description: t("get-notified-device"),
    },
    {
      key: "sms",
      label: t("sms-notifications"),
      description: t("receive-text-messages"),
    },
    {
      key: "weeklyReport",
      label: t("weekly-report"),
      description: t("get-weekly-summaries"),
    },
    {
      key: "budgetAlerts",
      label: t("budget-alerts"),
      description: t("notify-budget-limits"),
    },
    {
      key: "goalReminders",
      label: t("goal-reminders"),
      description: t("remind-financial-goals"),
    },
  ];

  return (
    <div className="space-y-8" aria-busy={loading}>
      <FolioHeader
        title="Settings"
        description="Manage the account details and preferences used across FinanceAI."
      />

      {success && (
        <div
          role="status"
          className="border-y border-accent bg-accent-soft px-4 py-3 text-sm text-ink"
        >
          {success}
        </div>
      )}
      {error && <InlineNotice>{error}</InlineNotice>}

      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-0">
        <aside className="min-w-0 lg:border-r lg:border-ledger-border lg:pr-5">
          <nav
            aria-label="Settings sections"
            className="grid grid-cols-2 gap-1 border-b border-ledger-border pb-3 lg:block lg:space-y-1 lg:border-b-0 lg:pb-0"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                aria-current={activeSection === tab.id ? "page" : undefined}
                className={`flex min-h-11 min-w-0 items-center gap-3 rounded-control px-3 text-left text-sm transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none lg:w-full ${
                  activeSection === tab.id
                    ? "bg-accent-soft font-semibold text-accent"
                    : "font-medium text-ink-secondary hover:bg-ledger-surface hover:text-ink"
                }`}
              >
                <tab.icon
                  className="h-4 w-4 shrink-0"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap lg:min-w-0 lg:whitespace-normal">
                  <span className="block">{tab.label}</span>
                  <span className="mt-0.5 hidden text-xs font-normal text-ink-muted lg:block">
                    {tab.description}
                  </span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <section
          className="min-w-0 lg:pl-8"
          aria-labelledby="settings-section-heading"
        >
          <header className="border-b border-ledger-border pb-5">
            <h2
              id="settings-section-heading"
              className="text-xl font-semibold tracking-[-0.02em] text-ink"
            >
              {activeTab.label}
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">
              {activeTab.description}
            </p>
          </header>

          {activeSection === "profile" && (
            <section className="py-6" aria-label="Profile information">
              <div className="flex items-center gap-4 border-b border-ledger-border pb-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-ledger-border bg-accent-soft text-lg font-semibold text-accent">
                  {profileInitial}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {profile.name}
                  </p>
                  <p className="mt-1 truncate text-sm text-ink-secondary">
                    {profile.email}
                  </p>
                </div>
              </div>

              <div className="grid gap-x-5 gap-y-6 py-6 md:grid-cols-2">
                <Field label={t("full-name")} htmlFor="settings-name">
                  <input
                    id="settings-name"
                    type="text"
                    value={profile.name}
                    onChange={(event) =>
                      setProfile({ ...profile, name: event.target.value })
                    }
                    className={ledgerControlClass}
                    autoComplete="name"
                  />
                </Field>
                <Field
                  label={t("email")}
                  htmlFor="settings-email"
                  helper="Email is tied to your sign-in account."
                >
                  <input
                    id="settings-email"
                    type="email"
                    value={profile.email}
                    readOnly
                    aria-describedby="settings-email-message"
                    className={`${ledgerControlClass} cursor-not-allowed bg-ledger-surface text-ink-muted`}
                    autoComplete="email"
                  />
                </Field>
                <Field label={t("phone")} htmlFor="settings-phone">
                  <input
                    id="settings-phone"
                    type="tel"
                    value={profile.phone}
                    onChange={(event) =>
                      setProfile({ ...profile, phone: event.target.value })
                    }
                    className={ledgerControlClass}
                    autoComplete="tel"
                  />
                </Field>
              </div>
            </section>
          )}

          {activeSection === "notifications" && (
            <section aria-label="Notification preferences">
              {notificationItems.map((item) => (
                <div
                  key={item.key}
                  className="flex min-h-20 items-center justify-between gap-6 border-b border-ledger-border py-4"
                >
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-ink">
                      {item.label}
                    </h3>
                    <p className="mt-1 max-w-[56ch] text-sm leading-6 text-ink-secondary">
                      {item.description}
                    </p>
                  </div>
                  <Toggle
                    label={item.label}
                    checked={notifications[item.key]}
                    onChange={(checked) =>
                      setNotifications({
                        ...notifications,
                        [item.key]: checked,
                      })
                    }
                  />
                </div>
              ))}
            </section>
          )}

          {activeSection === "preferences" && (
            <section
              className="grid gap-x-5 gap-y-6 py-6 md:grid-cols-2"
              aria-label="Application preferences"
            >
              <Field label={t("currency")} htmlFor="settings-currency">
                <select
                  id="settings-currency"
                  value={preferences.currency}
                  onChange={(event) =>
                    savePreferences({
                      ...preferences,
                      currency: event.target.value,
                    })
                  }
                  className={ledgerControlClass}
                >
                  <option value="INR">Indian Rupee (₹)</option>
                  <option value="USD">US Dollar ($)</option>
                  <option value="EUR">Euro (€)</option>
                  <option value="GBP">British Pound (£)</option>
                </select>
              </Field>
              <Field label={t("language")} htmlFor="settings-language">
                <select
                  id="settings-language"
                  value={preferences.language}
                  onChange={(event) => {
                    setLanguage(event.target.value);
                    savePreferences({
                      ...preferences,
                      language: event.target.value,
                    });
                  }}
                  className={ledgerControlClass}
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                  <option value="mr">मराठी (Marathi)</option>
                  <option value="kn">ಕನ್ನಡ (Kannada)</option>
                  <option value="ta">தமிழ் (Tamil)</option>
                </select>
              </Field>
              <Field label={t("theme")} htmlFor="settings-theme">
                <select
                  id="settings-theme"
                  value={preferences.theme}
                  onChange={(event) => {
                    const nextTheme = event.target.value;
                    if (isThemePreference(nextTheme)) {
                      savePreferences({ ...preferences, theme: nextTheme });
                    }
                  }}
                  className={ledgerControlClass}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto</option>
                </select>
              </Field>
              <Field label={t("date-format")} htmlFor="settings-date-format">
                <select
                  id="settings-date-format"
                  value={preferences.dateFormat}
                  onChange={(event) =>
                    savePreferences({
                      ...preferences,
                      dateFormat: event.target.value,
                    })
                  }
                  className={ledgerControlClass}
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </Field>
            </section>
          )}

          {activeSection === "security" && (
            <section className="py-6" aria-label="Security settings">
              <div className="flex flex-col gap-4 border-b border-ledger-border pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-medium text-ink">
                    {t("change-password")}
                  </h3>
                  <p className="mt-1 max-w-[56ch] text-sm leading-6 text-ink-secondary">
                    {t("update-password-secure")}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setShowPasswordModal(true)}
                  className="w-full sm:w-auto"
                >
                  {t("change-password")}
                </Button>
              </div>
            </section>
          )}

          <div className="flex min-h-16 items-center justify-end border-t border-ledger-border py-4 pr-14 xl:pr-0">
            {(activeSection === "profile" ||
              activeSection === "notifications") && (
              <Button
                onClick={() => handleSave(activeSection)}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {loading ? "Saving…" : t("save-changes")}
              </Button>
            )}
            {activeSection === "preferences" && (
              <p className="flex items-center gap-2 text-sm text-ink-secondary">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-accent"
                  aria-hidden="true"
                />
                {t("auto-saved")}
              </p>
            )}
          </div>
        </section>
      </div>

      <section
        className="flex flex-col gap-4 border-t border-ledger-border pt-6 pr-14 sm:flex-row sm:items-center sm:justify-between xl:pr-0"
        aria-labelledby="settings-session-heading"
      >
        <div>
          <h2
            id="settings-session-heading"
            className="text-sm font-medium text-ink"
          >
            Current session
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Sign out of FinanceAI on this device.
          </p>
        </div>
        <Button
          variant="danger"
          onClick={handleLogout}
          className="w-full sm:w-auto"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {t("logout")}
        </Button>
      </section>

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
          <div
            ref={passwordDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-dialog-title"
            className="w-full max-w-md rounded-popover border border-border-strong bg-surface-strong p-5 sm:p-6"
          >
            <h2
              id="password-dialog-title"
              className="text-xl font-semibold tracking-[-0.02em] text-ink"
            >
              {t("change-password")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink-secondary">
              Use your current password to confirm this change.
            </p>

            <form onSubmit={handleChangePassword} className="mt-6 space-y-5">
              <Field label={t("current-password")} htmlFor="current-password">
                <input
                  id="current-password"
                  type="password"
                  value={passwordForm.current}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      current: event.target.value,
                    }))
                  }
                  className={ledgerControlClass}
                  autoComplete="current-password"
                  autoFocus
                />
              </Field>
              <Field label={t("new-password")} htmlFor="new-password">
                <input
                  id="new-password"
                  type="password"
                  value={passwordForm.new}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      new: event.target.value,
                    }))
                  }
                  className={ledgerControlClass}
                  autoComplete="new-password"
                />
              </Field>
              <Field label={t("confirm-password")} htmlFor="confirm-password">
                <input
                  id="confirm-password"
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      confirm: event.target.value,
                    }))
                  }
                  className={ledgerControlClass}
                  autoComplete="new-password"
                />
              </Field>

              {passwordError && <InlineNotice>{passwordError}</InlineNotice>}
              {passwordSuccess && (
                <div
                  role="status"
                  className="border-y border-accent bg-accent-soft px-4 py-3 text-sm text-ink"
                >
                  {passwordSuccess}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                <Button
                  variant="secondary"
                  onClick={closePasswordModal}
                  className="w-full sm:w-auto"
                >
                  {t("cancel")}
                </Button>
                <Button type="submit" className="w-full sm:w-auto">
                  {t("change-password")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="relative inline-flex min-h-11 shrink-0 cursor-pointer items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-6 w-11 rounded-full border border-ledger-border bg-ledger-surface transition-colors duration-150 ease-out after:absolute after:left-[2px] after:top-[2px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-ink-muted after:content-[''] after:transition-transform after:duration-150 after:ease-out peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:after:translate-x-5 peer-checked:after:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-canvas motion-reduce:transition-none motion-reduce:after:transition-none"
      />
    </label>
  );
}
