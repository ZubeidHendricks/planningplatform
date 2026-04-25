import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useAuthStore } from '@/stores/auth';
import { useBoards, type Board } from '@/lib/hooks/use-boards';
import { useBlocks, type Block } from '@/lib/hooks/use-blocks';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Boxes,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ArrowLeft,
  Plus,
  PanelTop,
  Box,
  Hash,
  Calculator,
  TrendingUp,
  Table2,
  Loader2,
  ClipboardList,
  Settings,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { useCommandPalette } from '@/hooks/use-command-palette';
import { isMac } from '@/lib/shortcuts';

// ------------------------------------------------------------------
// Block type color mapping (Pigment-style)
// ------------------------------------------------------------------

const BLOCK_TYPE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  dimension: { label: 'Dimensions', color: 'bg-violet-500/15 text-violet-600', icon: Hash },
  metric: { label: 'Metrics', color: 'bg-emerald-500/15 text-emerald-600', icon: TrendingUp },
  formula: { label: 'Formulas', color: 'bg-amber-500/15 text-amber-600', icon: Calculator },
  input: { label: 'Inputs', color: 'bg-sky-500/15 text-sky-600', icon: Table2 },
  default: { label: 'Other', color: 'bg-slate-500/15 text-slate-600', icon: Box },
};

function getBlockTypeMeta(type: string): { label: string; color: string; icon: React.ElementType } {
  const fallback = { label: 'Other', color: 'bg-slate-500/15 text-slate-600', icon: Box };
  return BLOCK_TYPE_META[type] ?? fallback;
}

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  /** Mobile overlay mode: sidebar slides in from the left */
  mobileOpen?: boolean;
  /** Called to close the mobile sidebar overlay */
  onMobileClose?: () => void;
}

// ------------------------------------------------------------------
// Helper: extract appSlug from the URL path
// ------------------------------------------------------------------

function useAppContext() {
  const params = useParams<{ workspaceSlug?: string; appSlug?: string }>();
  const location = useLocation();
  const storeWorkspaceSlug = useAuthStore((s) => s.workspaceSlug);

  // The URL pattern is /:workspaceSlug/apps/:appSlug/...
  const segments = location.pathname.split('/').filter(Boolean);
  const appsIndex = segments.indexOf('apps');

  const workspaceSlug = params.workspaceSlug ?? storeWorkspaceSlug ?? undefined;
  const appSlug =
    params.appSlug ?? (appsIndex >= 0 && segments[appsIndex + 1] ? segments[appsIndex + 1] : undefined);

  const isInsideApp = !!appSlug && appsIndex >= 0;

  // Detect current board slug from URL: /:ws/apps/:app/boards/:boardSlug
  const boardsIndex = segments.indexOf('boards');
  const currentBoardSlug =
    boardsIndex >= 0 && segments[boardsIndex + 1] ? segments[boardsIndex + 1] : undefined;

  return { workspaceSlug, appSlug, isInsideApp, currentBoardSlug };
}

// ------------------------------------------------------------------
// Board tree sub-component
// ------------------------------------------------------------------

function BoardTree({
  boards,
  isLoading,
  workspaceSlug,
  appSlug,
  currentBoardSlug,
}: {
  boards: Board[];
  isLoading: boolean;
  workspaceSlug: string;
  appSlug: string;
  currentBoardSlug?: string;
}) {
  const basePath = `/${workspaceSlug}/apps/${appSlug}/boards`;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Loading boards...</span>
      </div>
    );
  }

  if (boards.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">
        No boards yet
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {boards.map((board) => {
        const active = currentBoardSlug === board.slug;
        return (
          <Link
            key={board.id}
            to={`${basePath}/${board.slug}`}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm transition-colors',
              active
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
            aria-current={active ? 'page' : undefined}
          >
            <PanelTop className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{board.name}</span>
          </Link>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------
// Block explorer sub-component
// ------------------------------------------------------------------

function BlockExplorer({
  blocks,
  isLoading,
  workspaceSlug,
  appSlug,
}: {
  blocks: Block[];
  isLoading: boolean;
  workspaceSlug: string;
  appSlug: string;
}) {
  const grouped = useMemo(() => {
    const groups: Record<string, Block[]> = {};
    for (const block of blocks) {
      const type = block.blockType || 'default';
      if (!groups[type]) groups[type] = [];
      groups[type].push(block);
    }
    return groups;
  }, [blocks]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Loading blocks...</span>
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">
        No blocks yet
      </div>
    );
  }

  const basePath = `/${workspaceSlug}/apps/${appSlug}/blocks`;

  return (
    <div className="space-y-2">
      {Object.entries(grouped).map(([type, items]) => {
        const meta = getBlockTypeMeta(type);
        const TypeIcon = meta.icon;
        return (
          <div key={type}>
            <div className="flex items-center gap-1.5 px-3 py-1">
              <span
                className={cn(
                  'inline-flex h-4 w-4 items-center justify-center rounded-lg',
                  meta.color
                )}
              >
                <TypeIcon className="h-2.5 w-2.5" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {meta.label}
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground/70">
                {items.length}
              </span>
            </div>
            <div className="space-y-0.5">
              {items.slice(0, 8).map((block) => (
                <Link
                  key={block.id}
                  to={`${basePath}/${block.id}`}
                  className="flex items-center gap-2 rounded-xl px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="truncate">{block.name}</span>
                </Link>
              ))}
              {items.length > 8 && (
                <div className="px-3 py-1 text-[10px] text-muted-foreground/60">
                  +{items.length - 8} more
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------
// Main Sidebar component
// ------------------------------------------------------------------

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const { user, workspaceSlug: storeWorkspaceSlug, logout } = useAuthStore();
  const openCommandPalette = useCommandPalette((s) => s.open);
  const { workspaceSlug, appSlug, isInsideApp, currentBoardSlug } = useAppContext();

  const wsSlug = workspaceSlug ?? storeWorkspaceSlug;

  /** On mobile, close the sidebar after clicking a nav link */
  const handleNavClick = () => {
    onMobileClose?.();
  };

  // In mobile overlay mode the sidebar always renders expanded (never collapsed)
  const isMobileOverlay = mobileOpen !== undefined;
  const isCollapsed = isMobileOverlay ? false : collapsed;

  // Fetch boards and blocks when inside an app
  const { data: boards = [], isLoading: boardsLoading } = useBoards(
    isInsideApp ? wsSlug ?? undefined : undefined,
    isInsideApp ? appSlug : undefined,
  );

  const { data: blocks = [], isLoading: blocksLoading } = useBlocks(
    isInsideApp ? wsSlug ?? undefined : undefined,
    isInsideApp ? appSlug : undefined,
  );

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/',
    },
    {
      label: 'Applications',
      icon: Boxes,
      href: wsSlug ? `/${wsSlug}/apps` : '/apps',
    },
    {
      label: 'Marketplace',
      icon: ShoppingBag,
      href: wsSlug ? `/${wsSlug}/marketplace` : '/marketplace',
    },
    {
      label: 'Settings',
      icon: Settings,
      href: wsSlug ? `/${wsSlug}/settings` : '/settings',
    },
    {
      label: 'Audit Log',
      icon: ClipboardList,
      href: wsSlug ? `/${wsSlug}/audit` : '/audit',
    },
  ];

  function isActive(href: string): boolean {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  }

  const userInitials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : 'U';

  const userName = user ? `${user.firstName} ${user.lastName}` : 'User';
  const userEmail = user?.email ?? '';

  // The inner sidebar content is shared between desktop and mobile overlay.
  const sidebarContent = (
    <aside
      className={cn(
        'flex h-full flex-col bg-card/40 backdrop-blur-xl border-r border-border/30 transition-[width] duration-200 ease-in-out',
        // On mobile overlay the sidebar is always full-width (w-[280px])
        mobileOpen !== undefined ? 'w-[280px]' : (collapsed ? 'w-16' : 'w-[250px]'),
      )}
    >
      {/* Header: workspace name + collapse/close toggle */}
      <div className="flex h-14 items-center gap-2 border-b border-border/30 px-3">
        {/* Mobile close button (only in overlay mode) */}
        {mobileOpen !== undefined && (
          <>
            <div className="flex flex-1 items-center gap-2 overflow-hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary text-xs font-bold text-primary-foreground">
                {wsSlug?.charAt(0).toUpperCase() ?? 'W'}
              </div>
              <span className="truncate text-sm font-semibold text-foreground">
                {wsSlug ?? 'Workspace'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={onMobileClose}
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </>
        )}

        {/* Desktop: expanded header */}
        {mobileOpen === undefined && !collapsed && (
          <div className="flex flex-1 items-center gap-2 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary text-xs font-bold text-primary-foreground">
              {wsSlug?.charAt(0).toUpperCase() ?? 'W'}
            </div>
            <span className="truncate text-sm font-semibold text-foreground">
              {wsSlug ?? 'Workspace'}
            </span>
          </div>
        )}

        {/* Desktop: collapsed header */}
        {mobileOpen === undefined && collapsed && (
          <div className="flex flex-1 justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-primary text-xs font-bold text-primary-foreground">
              {wsSlug?.charAt(0).toUpperCase() ?? 'W'}
            </div>
          </div>
        )}

        {/* Desktop collapse toggle (hidden in mobile overlay) */}
        {mobileOpen === undefined && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onToggle}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {!isCollapsed && (
        <div className="px-2 pt-2">
          <button
            type="button"
            onClick={openCommandPalette}
            className="flex w-full items-center gap-2 rounded-2xl border border-border/50 bg-white/30 dark:bg-white/5 backdrop-blur-sm px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Search"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left text-xs">Search...</span>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 text-[10px] font-medium text-muted-foreground">
              {isMac ? '\u2318' : 'Ctrl'}K
            </kbd>
          </button>
        </div>
      )}

      {isCollapsed && (
        <div className="px-2 pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={openCommandPalette}
                className="flex w-full items-center justify-center rounded-2xl px-2 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Search ({isMac ? '\u2318' : 'Ctrl'}+K)</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Back to apps (when inside an app) */}
      {isInsideApp && !isCollapsed && (
        <div className="px-2 pt-2">
          <Link
            to={wsSlug ? `/${wsSlug}/apps` : '/apps'}
            onClick={handleNavClick}
            className="flex items-center gap-2 rounded-2xl px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to apps</span>
          </Link>
        </div>
      )}

      {isInsideApp && isCollapsed && (
        <div className="px-2 pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to={wsSlug ? `/${wsSlug}/apps` : '/apps'}
                className="flex items-center justify-center rounded-2xl px-2 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Back to apps</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Navigation */}
      <nav className="space-y-1 px-2 py-3" aria-label="Main navigation">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          const linkContent = (
            <Link
              to={item.href}
              onClick={handleNavClick}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-all duration-200 min-h-[44px]',
                active
                  ? 'bg-primary/10 text-primary backdrop-blur-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                isCollapsed && 'justify-center px-2'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          if (isCollapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.href}>{linkContent}</div>;
        })}
      </nav>

      {/* Board tree + Block explorer (only when inside an app and expanded) */}
      {isInsideApp && !isCollapsed && wsSlug && appSlug && (
        <div className="flex-1 overflow-y-auto border-t border-border px-2 py-3">
          {/* Boards section */}
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between px-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Boards
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={`/${wsSlug}/apps/${appSlug}/boards`}
                    className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    aria-label="Create new board"
                  >
                    <Plus className="h-3 w-3" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">New board</TooltipContent>
              </Tooltip>
            </div>
            <BoardTree
              boards={boards}
              isLoading={boardsLoading}
              workspaceSlug={wsSlug}
              appSlug={appSlug}
              currentBoardSlug={currentBoardSlug}
            />
          </div>

          <Separator className="my-2" />

          {/* Block explorer section */}
          <div>
            <div className="mb-1.5 flex items-center justify-between px-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Blocks
              </span>
              <span className="text-[10px] text-muted-foreground/70">
                {blocks.length}
              </span>
            </div>
            <BlockExplorer
              blocks={blocks}
              isLoading={blocksLoading}
              workspaceSlug={wsSlug}
              appSlug={appSlug}
            />
          </div>
        </div>
      )}

      {/* When inside an app but collapsed, show board icon shortcut */}
      {isInsideApp && isCollapsed && wsSlug && appSlug && (
        <div className="px-2 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to={`/${wsSlug}/apps/${appSlug}/boards`}
                className="flex items-center justify-center rounded-2xl px-2 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <PanelTop className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              Boards ({boards.length})
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to={`/${wsSlug}/apps/${appSlug}`}
                className="flex items-center justify-center rounded-2xl px-2 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Box className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              Blocks ({blocks.length})
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Spacer when not inside app */}
      {!isInsideApp && <div className="flex-1" />}

      {/* Bottom section: user info + logout */}
      <div className="mt-auto">
        <Separator />
        <div
          className={cn(
            'flex items-center gap-3 px-3 py-3',
            isCollapsed && 'flex-col gap-2 px-2 py-2'
          )}
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
          </Avatar>

          {!isCollapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-foreground">
                {userName}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {userEmail}
              </span>
            </div>
          )}

          <ThemeToggle collapsed={isCollapsed} />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={logout}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );

  // If in mobile overlay mode, wrap the sidebar with a backdrop overlay
  if (isMobileOverlay) {
    return (
      <>
        {/* Backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
            onClick={onMobileClose}
            aria-hidden="true"
          />
        )}
        {/* Sliding sidebar panel */}
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {sidebarContent}
        </div>
      </>
    );
  }

  // Desktop: render sidebar inline
  return sidebarContent;
}
