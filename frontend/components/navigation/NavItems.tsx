import { LayoutDashboard, WalletCards, PieChart, Settings, BrainCircuit, Goal } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export function useNavItems() {
  const { t } = useLanguage();
  
  return [
    { path: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { path: '/dashboard/transactions', label: t('transactions'), icon: WalletCards },
    { path: '/dashboard/budget', label: t('budget'), icon: PieChart },
    { path: '/dashboard/goals', label: t('goals'), icon: Goal },
    { path: '/dashboard/ai-advisor', label: t('ai-advisor'), icon: BrainCircuit },
    { path: '/dashboard/settings', label: t('settings'), icon: Settings }
  ];
}