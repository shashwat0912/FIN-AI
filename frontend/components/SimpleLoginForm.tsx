import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import { useDarkMode } from '../context/DarkModeContext';
import DarkModeToggle from './common/DarkModeToggle';
import { tokenRefreshService } from '../services/tokenRefreshService';

export default function SimpleLoginForm() {
  const { isDarkMode } = useDarkMode();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Clear any existing error when component mounts
  // This ensures no stale errors are shown
  useEffect(() => {
    // Stop background refresh when showing login form
    tokenRefreshService.stopBackgroundRefresh();
    
    setError(null);
    // Clear ALL tokens when showing login form to prevent any issues
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const response = await apiClient.login(formData.email, formData.password);
        // Store tokens
        apiClient.setRefreshToken(response.refreshToken);
        // Reload page to trigger authentication check
        window.location.reload();
      } else {
        const response = await apiClient.register(formData.email, formData.password, formData.name);
        // Store tokens
        apiClient.setRefreshToken(response.refreshToken);
        // Reload page to trigger authentication check
        window.location.reload();
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
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
                {isLogin ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="font-medium text-purple-600 hover:text-purple-500 transition-colors duration-200"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-4">
                {!isLogin && (
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Full name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required={!isLogin}
                      value={formData.name}
                      onChange={handleInputChange}
                      className="premium-input w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-dark-700 
                        focus:border-purple-500 dark:focus:border-purple-400 
                        focus:ring-4 focus:ring-purple-500/20 
                        transition-all duration-300 
                        placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      placeholder="Enter your full name"
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    className="premium-input w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-dark-700 
                      focus:border-purple-500 dark:focus:border-purple-400 
                      focus:ring-4 focus:ring-purple-500/20 
                      transition-all duration-300 
                      placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    placeholder="Enter your email address"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    className="premium-input w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-dark-700 
                      focus:border-purple-500 dark:focus:border-purple-400 
                      focus:ring-4 focus:ring-purple-500/20 
                      transition-all duration-300 
                      placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    placeholder="Enter your password"
                  />
                </div>
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

              <div>
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
                      {isLogin ? 'Signing in...' : 'Creating account...'}
                    </div>
                  ) : (
                    isLogin ? 'Sign in' : 'Create account'
                  )}
                </button>
              </div>

              {/* Divider for Auth Options */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-dark-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white/80 dark:bg-dark-800/80 text-gray-500 dark:text-gray-400 backdrop-blur-sm rounded-full">
                    Or continue with
                  </span>
                </div>
              </div>

              {/* Social Login Buttons (UI Only) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button 
                  type="button"
                  className="flex items-center justify-center px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-dark-700 
                    hover:border-purple-500 dark:hover:border-purple-400 
                    hover:bg-purple-50 dark:hover:bg-purple-900/20 
                    transition-all duration-300 group"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Google</span>
                </button>
                
                <button 
                  type="button"
                  className="flex items-center justify-center px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-dark-700 
                    hover:border-blue-500 dark:hover:border-blue-400 
                    hover:bg-blue-50 dark:hover:bg-blue-900/20 
                    transition-all duration-300"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone</span>
                </button>
              </div>

              <div className="mt-6 p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10 
                rounded-xl border border-purple-200/50 dark:border-purple-800/30">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Demo Accounts:</p>
                <div className="space-y-2">
                  <div className="font-mono text-xs bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm 
                    px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-dark-700">
                    testuser@example.com / password123
                  </div>
                  <div className="font-mono text-xs bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm 
                    px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-dark-700">
                    test@example.com / password123
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
