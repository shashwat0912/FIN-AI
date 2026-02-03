import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatsCards from '../components/dashboard/StatsCards';
import BalanceChart from '../components/dashboard/BalanceChart';
import AiAdvisor from '../components/dashboard/AiAdvisor';
import { apiClient } from '../lib/api';
import { colors, components, layout } from '../styles/tokens';
import { useLanguage } from '../context/LanguageContext';
import { logger } from '../utils/logger';

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getTransactionAnalytics('30');
      setAnalytics(response);
    } catch (error) {
      logger.error('Failed to load analytics', error instanceof Error ? error : undefined);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'transactions':
        navigate('/transactions');
        break;
      case 'goals':
        navigate('/goals');
        break;
      case 'budget':
        navigate('/budget');
        break;
      case 'ai':
        navigate('/ai-advisor');
        break;
      default:
        break;
    }
  };


  return (
    <div className={layout.spacing.section + ' w-full'}>
      {/* Welcome Section */}
      <div className={`text-center mb-8 ${components.premiumBg.purple} rounded-2xl ${layout.spacing.card} premium-shadow-lg`}>
        <h1 className="text-3xl font-bold premium-gradient-text mb-2">
          {t('welcome-back')}, {t('user')}! 👋
        </h1>
        <p className={`${colors.text.secondary} text-lg`}>{t('whats-happening')}</p>
      </div>


      {/* Stats Cards */}
      <StatsCards />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className={`${components.card.base} premium-card-hover`}>
            <BalanceChart />
          </div>
        </div>
        <div>
          <div className={`${components.card.base} premium-card-hover`}>
            <AiAdvisor />
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      {analytics && (
        <div className={layout.grid.responsive}>
          <div className={`${components.card.base} ${layout.spacing.card}`}>
            <h3 className={`text-lg font-semibold ${colors.text.primary} mb-2`}>{t('total-income')}</h3>
            <p className={`text-3xl font-bold ${colors.state.positive}`}>₹{analytics.totalIncome?.toLocaleString() || '0'}</p>
            <p className={`text-sm ${colors.text.secondary}`}>{t('last-30-days')}</p>
          </div>
          <div className={`${components.card.base} ${layout.spacing.card}`}>
            <h3 className={`text-lg font-semibold ${colors.text.primary} mb-2`}>{t('total-expenses')}</h3>
            <p className={`text-3xl font-bold ${colors.state.negative}`}>₹{analytics.totalExpenses?.toLocaleString() || '0'}</p>
            <p className={`text-sm ${colors.text.secondary}`}>{t('last-30-days')}</p>
          </div>
          <div className={`${components.card.base} ${layout.spacing.card}`}>
            <h3 className={`text-lg font-semibold ${colors.text.primary} mb-2`}>{t('net-amount')}</h3>
            <p className={`text-3xl font-bold ${analytics.netAmount >= 0 ? colors.state.positive : colors.state.negative}`}>
              ₹{analytics.netAmount?.toLocaleString() || '0'}
            </p>
            <p className={`text-sm ${colors.text.secondary}`}>{t('last-30-days')}</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className={layout.grid.responsive}>
        <div 
          onClick={() => handleQuickAction('transactions')}
          className={`${components.card.interactive} ${layout.spacing.card} premium-card-hover ${components.premiumBg.warm}`}
        >
          <div className="flex items-center space-x-4">
            <div className={`p-3 ${colors.iconBg.purple} rounded-lg`}>
              <svg className={`w-6 h-6 ${colors.icon.purple}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${colors.text.primary}`}>{t('add-transaction')}</h3>
              <p className={`${colors.text.secondary} text-sm`}>Record new income or expense</p>
            </div>
          </div>
        </div>

        <div 
          onClick={() => handleQuickAction('goals')}
          className={`${components.card.interactive} ${layout.spacing.card} premium-card-hover ${components.premiumBg.cool}`}
        >
          <div className="flex items-center space-x-4">
            <div className={`p-3 ${colors.iconBg.green} rounded-lg`}>
              <svg className={`w-6 h-6 ${colors.icon.green}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Set {t('goals')}</h3>
              <p className={`${colors.text.secondary} text-sm`}>Create new financial target</p>
            </div>
          </div>
        </div>

        <div 
          onClick={() => handleQuickAction('budget')}
          className={`${components.card.interactive} ${layout.spacing.card} premium-card-hover ${components.premiumBg.subtle}`}
        >
          <div className="flex items-center space-x-4">
            <div className={`p-3 ${colors.iconBg.pink} rounded-lg`}>
              <svg className={`w-6 h-6 ${colors.icon.pink}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${colors.text.primary}`}>{t('budget')}</h3>
              <p className={`${colors.text.secondary} text-sm`}>Manage your spending</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}