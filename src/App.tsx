import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { DarkModeProvider } from './context/DarkModeContext';
import ErrorBoundary from './components/ErrorBoundary';
import OtpLoginForm from './components/OtpLoginForm';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Budget from './pages/Budget';
import Goals from './pages/Goals';
import AiAdvisor from './pages/AiAdvisor';
import Settings from './pages/Settings';
import { sessionSyncService } from './services/sessionSyncService';
import { tokenRefreshService } from './services/tokenRefreshService';
import { isTokenExpired } from './utils/jwtUtils';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize session synchronization
    sessionSyncService.init();

    // Check authentication status with token refresh attempt
    const checkAuth = async () => {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      
      // If we have no tokens at all, user is not authenticated
      if (!accessToken && !refreshToken) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      
      // If we have a refresh token but access token is expired, try to refresh
      if (refreshToken && accessToken && isTokenExpired(accessToken)) {
        // Check if refresh token is also expired first
        if (isTokenExpired(refreshToken)) {
          // Both tokens expired, clear them silently
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }
        
        try {
          // Try to refresh the token silently
          await tokenRefreshService.ensureTokenValid();
          // After refresh, check again
          const newAccessToken = localStorage.getItem('accessToken');
          if (newAccessToken && !isTokenExpired(newAccessToken)) {
            setIsAuthenticated(true);
            setLoading(false);
            return;
          }
        } catch (error) {
          // Refresh failed silently - clear tokens and show login
          // Don't log or show errors here - user will see login form
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }
      }
      
      // Check if we have a valid access token
      if (accessToken && !isTokenExpired(accessToken)) {
        setIsAuthenticated(true);
        // Only start background refresh if user is authenticated
        tokenRefreshService.startBackgroundRefresh();
      } else {
        setIsAuthenticated(false);
        // Stop background refresh if user is not authenticated
        tokenRefreshService.stopBackgroundRefresh();
        // Clear invalid tokens silently
        if (accessToken) {
          localStorage.removeItem('accessToken');
          if (refreshToken && isTokenExpired(refreshToken)) {
            localStorage.removeItem('refreshToken');
          }
        }
      }
      
      setLoading(false);
    };

    checkAuth();

    // Listen for storage changes (cross-tab updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessToken') {
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <DarkModeProvider>
          <LanguageProvider>
            <Routes>
              {/* Main app routes */}
              {!isAuthenticated ? (
                <Route path="*" element={<OtpLoginForm />} />
              ) : (
                <Route path="*" element={
                  <MainLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/transactions" element={<Transactions />} />
                      <Route path="/budget" element={<Budget />} />
                      <Route path="/goals" element={<Goals />} />
                      <Route path="/ai-advisor" element={<AiAdvisor />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </MainLayout>
                } />
              )}
            </Routes>
          </LanguageProvider>
        </DarkModeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;