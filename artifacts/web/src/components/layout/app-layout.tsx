import { useState, useCallback, useEffect } from 'react';
import { Outlet, useLocation, useParams, Link } from 'react-router';
import { useAuthStore } from '@/stores/auth';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Sidebar } from '@/components/layout/sidebar';
import { ChevronRight, Sparkles, Undo2, Redo2, Menu } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { AiChat } from '@/components/ai/ai-chat';
import { ConnectionStatus } from '@/components/realtime/connection-status';
import { useRealtimeStore } from '@/lib/realtime';
import { useShortcutStore } from '@/lib/shortcuts';
import { useUndoStore } from '@/stores/undo';
import { useShortcut } from '@/hooks/use-shortcut';
import { useMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

/**
 * Build a breadcrumb trail from the current pathname.
 * Produces human-readable labels from URL segments.
 */
function useBreadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  const crumbs: Array<{ label: string; href: string }> = [];
  let accumulated = '';

  for (const segment of segments) {
    accumulated += `/${segment}`;

    // Convert slug-style segments to readable labels
    const label = segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    crumbs.push({ label, href: accumulated });
  }

  return crumbs;
}

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const isMobile = useMobile(768); // md breakpoint
  const workspaceSlug = useAuthStore((s) => s.workspaceSlug);
  const token = useAuthStore((s) => s.token);
  const { appSlug } = useParams();
  const breadcrumbs = useBreadcrumbs();
  const connectSocket = useRealtimeStore((s) => s.connectSocket);
  const disconnectSocket = useRealtimeStore((s) => s.disconnectSocket);

  // Undo/redo state
  const canUndo = useUndoStore((s) => s.past.length > 0);
  const canRedo = useUndoStore((s) => s.future.length > 0);

  const handleUndo = useCallback(() => {
    // Delegate to the registered shortcut handler (from block-detail) so the
    // cell mutation is applied together with the store update.
    const shortcut = useShortcutStore.getState().shortcuts.get('undo');
    if (shortcut) {
      shortcut.handler();
    }
  }, []);

  const handleRedo = useCallback(() => {
    const shortcut = useShortcutStore.getState().shortcuts.get('redo');
    if (shortcut) {
      shortcut.handler();
    }
  }, []);

  // Initialize WebSocket connection when authenticated
  useEffect(() => {
    if (token) {
      connectSocket(token);
    }
    return () => {
      disconnectSocket();
    };
  }, [token, connectSocket, disconnectSocket]);

  const handleSearch = useCallback(() => {
    // Placeholder for command palette
  }, []);

  useShortcut('global-search', 'mod+k', 'Search', 'General', handleSearch);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen w-screen overflow-hidden bg-background min-h-screen">
        {/* Sidebar: hidden on mobile, shown as overlay when mobileSidebarOpen */}
        {isMobile ? (
          <Sidebar
            collapsed={false}
            onToggle={() => {}}
            mobileOpen={mobileSidebarOpen}
            onMobileClose={() => setMobileSidebarOpen(false)}
          />
        ) : (
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((prev) => !prev)}
          />
        )}

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <header className="flex h-12 shrink-0 items-center gap-4 bg-card/50 backdrop-blur-xl border-b border-border/50 px-3 md:px-6">
            {/* Mobile hamburger menu button */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="inline-flex md:hidden items-center justify-center rounded-2xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground min-h-[44px] min-w-[44px]"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumbs */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm overflow-hidden min-w-0">
              <Link
                to="/"
                className="text-muted-foreground transition-colors hover:text-foreground shrink-0"
              >
                Home
              </Link>
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.href} className="flex items-center gap-1">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                  {index === breadcrumbs.length - 1 ? (
                    <span className="font-medium text-foreground truncate max-w-[120px] sm:max-w-none">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      to={crumb.href}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </span>
              ))}
            </nav>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Undo / Redo (hidden on mobile -- keyboard shortcuts only) */}
            <div className="hidden md:flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={!canUndo}
                    className={cn(
                      'inline-flex items-center justify-center rounded-2xl p-2 text-muted-foreground transition-all duration-200',
                      canUndo
                        ? 'hover:bg-accent/50 hover:text-foreground'
                        : 'opacity-50 cursor-not-allowed',
                    )}
                    aria-label="Undo"
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <span>Undo</span>
                  <kbd className="ml-2 inline-flex items-center rounded border border-border/50 bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    Ctrl+Z
                  </kbd>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={!canRedo}
                    className={cn(
                      'inline-flex items-center justify-center rounded-2xl p-2 text-muted-foreground transition-all duration-200',
                      canRedo
                        ? 'hover:bg-accent/50 hover:text-foreground'
                        : 'opacity-50 cursor-not-allowed',
                    )}
                    aria-label="Redo"
                  >
                    <Redo2 className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <span>Redo</span>
                  <kbd className="ml-2 inline-flex items-center rounded border border-border/50 bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    Ctrl+Shift+Z
                  </kbd>
                </TooltipContent>
              </Tooltip>
            </div>

            <Separator orientation="vertical" className="hidden md:block h-5" />

            {/* AI & Notifications */}
            <button
              type="button"
              onClick={() => setAiChatOpen((prev) => !prev)}
              className={cn(
                'relative inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors',
                'hover:bg-accent hover:text-foreground',
                aiChatOpen && 'bg-accent text-foreground',
              )}
              aria-label="AI Assistant"
            >
              <Sparkles className="h-4.5 w-4.5" />
            </button>
            <ConnectionStatus />
            <NotificationBell />
            {workspaceSlug && (
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                  {workspaceSlug}
                </span>
              </div>
            )}
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto p-2 sm:p-4">
            <Outlet />
          </main>
        </div>

        {/* AI Chat panel */}
        <AiChat
          workspaceSlug={workspaceSlug ?? undefined}
          appSlug={appSlug}
          open={aiChatOpen}
          onClose={() => setAiChatOpen(false)}
        />
      </div>
    </TooltipProvider>
  );
}
