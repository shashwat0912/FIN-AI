import React, { useState, useEffect } from 'react';
import { Send, MessageCircle, TrendingUp, DollarSign, Target, AlertCircle } from 'lucide-react';
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
      case 'emergency': return 'border-red-500/20 bg-red-500/10 text-red-300';
      case 'savings':
      case 'investment':
      case 'budget': return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
      default: return 'border-zinc-700 bg-zinc-800/70 text-zinc-300';
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1080px] space-y-6 text-white">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">AI Advisor</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Ask questions about your spending, budgets, and financial activity.
        </p>
      </div>

      {/* Query Form */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              {t('ask-financial-question')}
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('ai-question-placeholder')}
                className="min-h-12 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-zinc-950"></div>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Ask FinanceAI
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Quick Questions */}
        <div className="mt-6">
          <p className="mb-3 text-sm font-medium text-zinc-300">{t('quick-questions')}:</p>
          <div className="flex flex-wrap gap-2">
            {[
              'Summarize this month',
              'Why is Food high?',
              'How can I reduce spending?'
            ].map((question) => (
              <button
                key={question}
                onClick={() => setQuery(question)}
                className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-200"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Current Advice */}
      {advice && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6">
          <div className="flex items-start space-x-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2">
              <MessageCircle className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="flex-1">
              <h3 className="mb-2 text-base font-semibold text-white">{t('ai-advice')}</h3>
              <p className="leading-relaxed text-zinc-300">{advice.advice}</p>
              <div className="mt-3">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getCategoryColor(advice.category)}`}>
                  {getCategoryIcon(advice.category)}
                  <span className="ml-1 capitalize">{advice.category}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI History */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
        <div className="border-b border-zinc-800 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-white">{t('recent-conversations')}</h3>
          <p className="mt-1 text-sm text-zinc-500">{t('previous-ai-interactions')}</p>
        </div>
        
        <div className="divide-y divide-zinc-800">
          {sessions.length === 0 ? (
            <div className="p-6 text-center">
              <MessageCircle className="mx-auto mb-4 h-10 w-10 text-zinc-600" />
              <h3 className="mb-2 text-base font-medium text-white">{t('no-conversations-yet')}</h3>
              <p className="text-sm text-zinc-500">{t('start-asking-question')}</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div key={session.id} className="p-4 hover:bg-zinc-900/70 sm:p-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl border border-zinc-700 bg-zinc-800/70 p-2">
                      <MessageCircle className="h-4 w-4 text-zinc-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{session.query}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {new Date(session.createdAt).toLocaleDateString()} at{' '}
                        {new Date(session.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <span className={`hidden items-center rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex ${getCategoryColor(session.category)}`}>
                      {getCategoryIcon(session.category)}
                      <span className="ml-1 capitalize">{session.category}</span>
                    </span>
                  </div>
                  
                  <div className="sm:ml-11">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2">
                        <MessageCircle className="h-4 w-4 text-emerald-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="leading-relaxed text-zinc-300">{session.response}</p>
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
