import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface LanguageSelectorProps {
  className?: string;
  showLabel?: boolean;
}

export default function LanguageSelector({ 
  className = '', 
  showLabel = true 
}: LanguageSelectorProps) {
  const { currentLanguage, setLanguage, languages } = useLanguage();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <label htmlFor="language-select" className="text-sm font-medium text-gray-700">
          Language:
        </label>
      )}
      <select 
        id="language-select"
        value={currentLanguage}
        onChange={handleLanguageChange}
        className="input-primary"
      >
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.flag} {language.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}