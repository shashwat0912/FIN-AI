import { Clock } from 'lucide-react';

interface RateLimitBannerProps {
  retryAfter?: number;
}

export default function RateLimitBanner({ retryAfter }: RateLimitBannerProps) {
  return (
    <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/40 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-300">
      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
      <span>Too many messages. {retryAfter ? `Wait ${retryAfter}s...` : 'Please wait a moment.'}</span>
    </div>
  );
}
