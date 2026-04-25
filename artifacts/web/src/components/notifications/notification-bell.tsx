import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Bell, MessageSquare, AtSign, Reply, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllRead,
  type Notification,
} from '@/lib/hooks/use-notifications';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

const NOTIFICATION_ICONS: Record<Notification['type'], typeof Bell> = {
  mention: AtSign,
  reply: Reply,
  comment: MessageSquare,
  system: Info,
};

// ---------------------------------------------------------------------------
// Notification Item
// ---------------------------------------------------------------------------

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
}

function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const Icon = NOTIFICATION_ICONS[notification.type] ?? Info;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50',
        notification.isRead === 0 && 'bg-primary/5',
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          notification.isRead === 0
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm',
            notification.isRead === 0 ? 'font-medium text-foreground' : 'text-foreground/80',
          )}
        >
          {notification.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {notification.body}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          {relativeTime(notification.createdAt)}
        </p>
      </div>
      {notification.isRead === 0 && (
        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const workspaceSlug = useAuthStore((s) => s.workspaceSlug) ?? '';

  const { data: notifications = [] } = useNotifications(
    workspaceSlug || undefined,
  );
  const { data: unreadCount = 0 } = useUnreadCount(
    workspaceSlug || undefined,
  );
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (notification.isRead === 0) {
      markRead.mutate({ workspaceSlug, notificationId: notification.id });
    }
    // Navigate if link exists
    if (notification.link) {
      navigate(notification.link);
    }
    setOpen(false);
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate({ workspaceSlug });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'relative inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors',
          'hover:bg-accent hover:text-foreground',
          open && 'bg-accent text-foreground',
        )}
        aria-label="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            'absolute right-0 top-full mt-2 z-50 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-lg',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Notifications
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Mark all as read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No notifications yet
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
