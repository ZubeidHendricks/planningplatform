// ---------------------------------------------------------------------------
// ConnectionStatus — small dot indicator for WebSocket connection state.
// Green = connected, yellow = reconnecting, red = disconnected.
// ---------------------------------------------------------------------------

import { useRealtimeStore } from '@/lib/realtime';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

const statusConfig = {
  connected: {
    color: 'bg-green-400',
    pulse: false,
    label: 'Connected',
  },
  connecting: {
    color: 'bg-yellow-400',
    pulse: true,
    label: 'Connecting...',
  },
  reconnecting: {
    color: 'bg-yellow-400',
    pulse: true,
    label: 'Reconnecting...',
  },
  disconnected: {
    color: 'bg-red-400',
    pulse: false,
    label: 'Disconnected',
  },
} as const;

export function ConnectionStatus() {
  const status = useRealtimeStore((s) => s.status);
  const config = statusConfig[status];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="relative flex items-center justify-center h-5 w-5"
          role="status"
          aria-label={`Connection: ${config.label}`}
        >
          {config.pulse && (
            <span
              className={cn(
                'absolute h-2.5 w-2.5 rounded-full opacity-75 animate-ping',
                config.color,
              )}
            />
          )}
          <span className={cn('relative h-2 w-2 rounded-full', config.color)} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {config.label}
      </TooltipContent>
    </Tooltip>
  );
}
