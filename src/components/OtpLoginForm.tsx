import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import { useDarkMode } from '../context/DarkModeContext';
import DarkModeToggle from './common/DarkModeToggle';
import { tokenRefreshService } from '../services/tokenRefreshService';

type Step = 'identifier' | 'otp';

export default function OtpLoginForm() {
  const { isDarkMode } = useDarkMode();
  const [step, setStep] = useState<Step>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [identifierType, setIdentifierType] = useState<'email' | 'phone' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes in seconds
  const [isNewUser, setIsNewUser] = useState(false);

  // Clear any existing error when component mounts
  useEffect(() => {
    tokenRefreshService.stopBackgroundRefresh();
    setError(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }, []);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (otpSent && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [otpSent, timeRemaining]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.sendOtp(identifier);
      setIdentifierType(response.type);
      setOtpSent(true);
      setStep('otp');
      setTimeRemaining(response.expiresIn);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // If it's a new user and name is required, pass it
      const nameToSend = isNewUser && name ? name : undefined;
      await apiClient.verifyOtp(identifier, otp, nameToSend);
      // Reload page to trigger authentication check
      window.location.reload();
    } catch (error: any) {
      setError(error.message);
      // If error mentions name is required, show name field
      if (error.message.includes('Name is required')) {
        setIsNewUser(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtp('');
    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.sendOtp(identifier);
      setTimeRemaining(response.expiresIn);
      setError(null);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('identifier');
    setOtp('');
    setName('');
    setOtpSent(false);
    setIsNewUser(false);
    setError(null);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-dark-950 dark:via-purple-900/20 dark:to-blue-900/20" />
      
      {/* Floating orbs/shapes for depth */}
      <div className="absolute top-20 left-10 w-48 h-48 sm:w-72 sm:h-72 bg-purple-300/30 dark:bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-64 h-64 sm:w-96 sm:h-96 bg-blue-300/30 dark:bg-blue-300/10 rounded-full blur-3xl animate-pulse delay-1000" />
      
      {/* Dark Mode Toggle - Top Right */}
      <div className="absolute top-4 right-4 z-20">
        <DarkModeToggle size="md" />
      </div>
      
      {/* Content container */}
      <div className="relative z-10 min-h-screen flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="glass-card p-6 sm:p-8 rounded-2xl shadow-2xl backdrop-blur-xl border border-white/20 dark:border-white/10 animate-theme-slide-in">
            {/* App Branding */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 shadow-xl mb-4 animate-theme-fade-in">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold premium-gradient-text mb-2">Finance AI</h1>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {step === 'identifier' ? 'Welcome' : 'Verify OTP'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {step === 'identifier' 
                  ? 'Enter your email or Indian phone number to continue'
                  : `We sent a 4-digit code to your ${identifierType}`
                }
              </p>
            </div>

            {/* Step 1: Enter Identifier */}
            {step === 'identifier' && (
              <form className="space-y-6" onSubmit={handleSendOtp}>
                <div>
                  <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email or Phone Number
                  </label>
                  <input
                    id="identifier"
                    name="identifier"
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="premium-input w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-dark-700 
                      focus:border-purple-500 dark:focus:border-purple-400 
                      focus:ring-4 focus:ring-purple-500/20 
                      transition-all duration-300 
                      placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    placeholder="email@example.com or 9876543210"
                  />
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    📧 Email or 📱 Indian phone number (10 digits)
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800/50 
                    rounded-xl p-4 animate-theme-fade-in backdrop-blur-sm">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="premium-button w-full py-3 px-6 rounded-xl font-semibold 
                    shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 
                    transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                    disabled:transform-none"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Sending OTP...
                    </div>
                  ) : (
                    'Send OTP'
                  )}
                </button>
              </form>
            )}

            {/* Step 2: Verify OTP */}
            {step === 'otp' && (
              <form className="space-y-6" onSubmit={handleVerifyOtp}>
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Enter 4-Digit OTP
                  </label>
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="premium-input w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-dark-700 
                      focus:border-purple-500 dark:focus:border-purple-400 
                      focus:ring-4 focus:ring-purple-500/20 
                      transition-all duration-300 
                      placeholder:text-gray-400 dark:placeholder:text-gray-500
                      text-center text-2xl font-mono tracking-widest"
                    placeholder="••••"
                    autoFocus
                  />
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">
                      ⏰ Valid for: <span className="font-mono font-semibold">{formatTime(timeRemaining)}</span>
                    </span>
                    {timeRemaining > 0 ? (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={loading}
                        className="text-purple-600 hover:text-purple-500 font-medium disabled:opacity-50"
                      >
                        Resend OTP
                      </button>
                    ) : (
                      <span className="text-red-600 dark:text-red-400 font-medium">OTP Expired</span>
                    )}
                  </div>
                </div>

                {isNewUser && (
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Your Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="premium-input w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-dark-700 
                        focus:border-purple-500 dark:focus:border-purple-400 
                        focus:ring-4 focus:ring-purple-500/20 
                        transition-all duration-300 
                        placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      placeholder="Enter your full name"
                    />
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      👋 Looks like you're new! Please enter your name to create an account.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800/50 
                    rounded-xl p-4 animate-theme-fade-in backdrop-blur-sm">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={loading || timeRemaining <= 0}
                    className="premium-button w-full py-3 px-6 rounded-xl font-semibold 
                      shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 
                      transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                      disabled:transform-none"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Verifying...
                      </div>
                    ) : (
                      'Verify & Sign In'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={loading}
                    className="w-full py-3 px-6 rounded-xl font-semibold 
                      bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300
                      hover:bg-gray-200 dark:hover:bg-dark-600
                      transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ← Back
                  </button>
                </div>
              </form>
            )}

            {/* Info Box */}
            <div className="mt-6 p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10 
              rounded-xl border border-purple-200/50 dark:border-purple-800/30">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                🔒 Secure OTP Login
              </p>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <li>• No password required</li>
                <li>• OTP valid for 5 minutes</li>
                <li>• Works with email or phone</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

