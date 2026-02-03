import React from 'react';
import { Globe, Clock, IndianRupee } from 'lucide-react';
import LanguageSelector from '../common/LanguageSelector';
import { useLanguage } from '../../context/LanguageContext';

export default function PreferenceSettings() {
  const { t } = useLanguage();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold mb-6 text-gray-900">
        {t('preferences')}
      </h2>
      <div className="space-y-6">
        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <Globe className="w-5 h-5 text-purple-600" />
          <div className="flex-1">
            <LanguageSelector showLabel={false} />
          </div>
        </div>
        
        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <Clock className="w-5 h-5 text-blue-600" />
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('timezone')}</label>
            <select className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200">
              <option>IST (UTC+5:30)</option>
              <option>UTC</option>
              <option>EST (UTC-5)</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <IndianRupee className="w-5 h-5 text-green-600" />
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('currency')}</label>
            <select className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200">
              <option>₹ (INR)</option>
              <option>$ (USD)</option>
              <option>€ (EUR)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}