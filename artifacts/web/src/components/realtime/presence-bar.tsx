// ---------------------------------------------------------------------------
// PresenceBar — shows avatar circles of users currently viewing the same app.
// Displays up to 5 users with a +N overflow indicator.
// ---------------------------------------------------------------------------

import { usePresence } from '@/hooks/use-realtime';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

const MAX_VISIBLE = 5;

/** Deterministic color from a string (userId or email). */
function userColor(seed: string): string {
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-violet-500',
    'bg-cyan-500',
    'bg-pink-500',
    'bg-indigo-500',
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length]!;
}

/** Extract initials from an email address. */
function initials(email: string): string {
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export function PresenceBar() {
  const onlineUsers = usePresence();
  const currentUserId = useAuthStore((s) => s.user?.id);

  // Filter out the current user
  const others = onlineUsers.filter((u) => u.userId !== currentUserId);

  if (others.length === 0) return null;

  const visible = others.slice(0, MAX_VISIBLE);
  const overflow = others.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Online users">
      {visible.map((user) => (
        <Tooltip key={user.userId}>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'relative flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-background',
                userColor(user.userId),
              )}
              aria-label={user.email}
            >
              {initials(user.email)}
              {/* Online indicator dot */}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p className="font-medium">{user.email}</p>
            {user.blockId && (
              <p className="text-muted-foreground">
                Viewing block: {user.blockId.slice(0, 8)}...
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      ))}
      {overflow > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground ring-2 ring-background">
              +{overflow}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p>{overflow} more user{overflow === 1 ? '' : 's'} online</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
