import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Severity colour map
// ---------------------------------------------------------------------------

const SEVERITY_STYLES: Record<
  'low' | 'medium' | 'high',
  { dot: string; bg: string; text: string; label: string }
> = {
  low: {
    dot: 'bg-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-950/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    label: 'Low',
  },
  medium: {
    dot: 'bg-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    text: 'text-orange-700 dark:text-orange-400',
    label: 'Medium',
  },
  high: {
    dot: 'bg-red-500',
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-400',
    label: 'High',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AnomalyBadgeProps {
  severity: 'low' | 'medium' | 'high';
  explanation: string;
}

export function AnomalyBadge({ severity, explanation }: AnomalyBadgeProps) {
  const styles = SEVERITY_STYLES[severity];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium cursor-default',
            styles.bg,
            styles.text,
          )}
          role="status"
          aria-label={`${styles.label} severity anomaly: ${explanation}`}
        >
          <span
            className={cn('h-1.5 w-1.5 rounded-full', styles.dot)}
            aria-hidden="true"
          />
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="text-xs">
          <span className="font-medium">{styles.label} anomaly:</span>{' '}
          {explanation}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
