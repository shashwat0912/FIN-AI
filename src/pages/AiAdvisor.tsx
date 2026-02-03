import React, { useState, useEffect } from 'react';
import { BrainCircuit, Send, MessageCircle, TrendingUp, DollarSign, Target, AlertCircle } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { logger } from '../utils/logger';

interface AiAdvice {
  advice: string;
  category: string;
  sessionId: string;
}

interface AiSession {
  id: string;
  query: string;
  response: string;
  category: string;
  createdAt: string;
}

export default function AiAdvisor() {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [advice, setAdvice] = useState<AiAdvice | null>(null);
  const [sessions, setSessions] = useState<AiSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAiHistory();
  }, []);

  const loadAiHistory = async () => {
    try {
      setError(null);
      // Load AI history from API
      const response = await apiClient.getAiHistory();
      setSessions(response.data || []);
    } catch (error: any) {
      logger.error('Error loading AI history', error);
      setError(t('failed-load-ai-history'));
      // Set empty array on error
      setSessions([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError(null);
      
      // Get real AI advice from backend
      const response = await apiClient.getAiAdvice(query);
      setAdvice(response);
      
      // Add to sessions
      const newSession: AiSession = {
        id: Date.now().toString(),
        query: query,
        response: response.advice,
        category: response.category,
        createdAt: new Date().toISOString(),
      };
      setSessions(prev => [newSession, ...prev]);
      
      setQuery('');
    } catch (error: any) {
      logger.error('Error getting AI advice', error);
      setError(error?.message || t('failed-get-ai-advice'));
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'savings': return <DollarSign className="w-5 h-5" />;
      case 'investment': return <TrendingUp className="w-5 h-5" />;
      case 'emergency': return <AlertCircle className="w-5 h-5" />;
      case 'budget': return <Target className="w-5 h-5" />;
      default: return <MessageCircle className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'savings': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'investment': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      case 'emergency': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'budget': return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl">
            <BrainCircuit className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('ai-financial-advisor')}</h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          {t('ai-advisor-description')}
        </p>
      </div>

      {/* Query Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6 dark:bg-dark-900">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('ask-financial-question')}
            </label>
            <div className="flex space-x-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('ai-question-placeholder')}
                className="flex-1 px-4 py-3 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    {t('ask-ai')}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Quick Questions */}
        <div className="mt-6">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('quick-questions')}:</p>
          <div className="flex flex-wrap gap-2">
            {[
              t('quick-question-1'),
              t('quick-question-2'),
              t('quick-question-3'),
              t('quick-question-4'),
              t('quick-question-5'),
              t('quick-question-6')
            ].map((question) => (
              <button
                key={question}
                onClick={() => setQuery(question)}
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Current Advice */}
      {advice && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-6">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
              <BrainCircuit className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('ai-advice')}</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{advice.advice}</p>
              <div className="mt-3">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(advice.category)}`}>
                  {getCategoryIcon(advice.category)}
                  <span className="ml-1 capitalize">{advice.category}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 dark:bg-dark-900">
        <div className="p-6 border-b border-gray-200 dark:border-dark-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('recent-conversations')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('previous-ai-interactions')}</p>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-dark-700">
          {sessions.length === 0 ? (
            <div className="p-6 text-center">
              <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('no-conversations-yet')}</h3>
              <p className="text-gray-500 dark:text-gray-400">{t('start-asking-question')}</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div key={session.id} className="p-6 hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <MessageCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-900 dark:text-white font-medium">{session.query}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(session.createdAt).toLocaleDateString()} at{' '}
                        {new Date(session.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(session.category)}`}>
                      {getCategoryIcon(session.category)}
                      <span className="ml-1 capitalize">{session.category}</span>
                    </span>
                  </div>
                  
                  <div className="ml-11">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
                        <BrainCircuit className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{session.response}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}