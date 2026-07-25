import { Link } from 'react-router-dom';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTrialStatus } from '../hooks/useTrialStatus';

export function TrialBanner({ compact = false }: { compact?: boolean }) {
  const trial = useTrialStatus();
  if (!trial?.show) return null;

  const styles =
    trial.severity === 'error'
      ? 'bg-red-500/10 border-red-500/20 text-red-600'
      : trial.severity === 'warning'
        ? 'bg-amber-500/10 border-amber-500/20 text-amber-700'
        : 'bg-blue-500/10 border-blue-500/20 text-blue-700';

  const Icon = trial.severity === 'info' ? Info : AlertTriangle;

  return (
    <div
      className={cn(
        'border-b px-4 flex items-center justify-between gap-3 shrink-0',
        compact ? 'py-2 text-xs' : 'py-2.5 text-xs md:text-sm',
        styles,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 shrink-0" />
        <span className={cn('font-medium', compact ? 'truncate' : 'line-clamp-2 md:line-clamp-none')}>
          {trial.message}
        </span>
      </div>
      <Link to="/billing" className="font-bold whitespace-nowrap hover:underline shrink-0">
        {compact ? 'Upgrade' : 'Usage & Billing'}
      </Link>
    </div>
  );
}
