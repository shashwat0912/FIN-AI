import React, { useState } from 'react';
import { BrainCircuit, Search, Send, Sparkles } from 'lucide-react';
import AiSuggestion from './AiSuggestion';
import { useBackendAi } from '../../hooks/useBackendAi';

export default function AiAdvisor() {
  const [query, setQuery] = useState('');
  const { suggestions, loading, error, getAdvice } = useBackendAi();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    await getAdvice(query);
    setQuery('');
  };

  return (
    <div className="h-full p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
          <BrainCircuit className="h-6 w-6 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">AI Financial Advisor</h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">Get personalized financial advice instantly</p>
      </div>
      
      {/* Search Form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about investments, savings, or budgeting..."
            className="w-full pl-10 pr-12 py-3 bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>

      {/* AI Suggestions */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 text-sm">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span>AI Suggestions</span>
        </div>
        
        {suggestions.length > 0 ? (
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <AiSuggestion key={index} suggestion={suggestion} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-dark-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <Sparkles className="h-8 w-8 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Ask me anything about your finances!</p>
          </div>
        )}

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
            {error}
          </div>
        )}
      </div>

      {/* Quick Tips */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-dark-700">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quick Tips</h4>
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
            <span>"How can I save more money?"</span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
            <span>"What's the best investment strategy?"</span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
            <div className="w-1.5 h-1.5 bg-pink-500 rounded-full"></div>
            <span>"Help me create a budget plan"</span>
          </div>
        </div>
      </div>
    </div>
  );
}