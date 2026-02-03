import { LayoutDashboard, WalletCards, PieChart, Settings, BrainCircuit, Goal } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export function useNavItems() {
  const { t } = useLanguage();
  
  return [
    { path: '/', label: t('dashboard'), icon: LayoutDashboard },
    { path: '/transactions', label: t('transactions'), icon: WalletCards },
    { path: '/budget', label: t('budget'), icon: PieChart },
    { path: '/goals', label: t('goals'), icon: Goal },
    { path: '/ai-advisor', label: t('ai-advisor'), icon: BrainCircuit },
    { path: '/settings', label: t('settings'), icon: Settings }
  ];
}