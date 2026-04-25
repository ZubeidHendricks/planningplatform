import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth';
import { useCommandPalette } from '@/hooks/use-command-palette';
import { useShortcut } from '@/hooks/use-shortcut';
import { useSearch, type SearchResult } from '@/lib/hooks/use-search';
import { isMac } from '@/lib/shortcuts';
import {
  Search,
  Boxes,
  Grid3X3,
  LayoutDashboard,
  Settings,
  FileText,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  PanelTop,
} from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
}

const TYPE_META: Record<SearchResult['type'], { label: string; icon: React.ElementType }> = {
  app: { label: 'Apps', icon: Boxes },
  block: { label: 'Blocks', icon: Grid3X3 },
  dimension: { label: 'Dimensions', icon: LayoutDashboard },
  board: { label: 'Boards', icon: PanelTop },
};

export function CommandPalette() {
  const { isOpen, close, toggle } = useCommandPalette();
  const navigate = useNavigate();
  const workspaceSlug = useAuthStore((s) => s.workspaceSlug);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useShortcut('command-palette', 'mod+k', 'Open command palette', 'Navigation', toggle, [toggle]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: searchResults = [], isLoading } = useSearch(
    workspaceSlug ?? undefined,
    debouncedQuery,
  );

  const quickActions: QuickAction[] = useMemo(() => {
    if (!workspaceSlug) return [];
    return [
      { id: 'settings', label: 'Go to Settings', icon: Settings, href: `/${workspaceSlug}/settings` },
      { id: 'templates', label: 'Go to Templates', icon: FileText, href: `/${workspaceSlug}/templates` },
      { id: 'new-app', label: 'Create New App', icon: Boxes, href: `/${workspaceSlug}/apps` },
    ];
  }, [workspaceSlug]);

  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    for (const result of searchResults) {
      if (!groups[result.type]) groups[result.type] = [];
      groups[result.type]!.push(result);
    }
    return groups;
  }, [searchResults]);

  const flatItems = useMemo(() => {
    if (query.length < 2) {
      return quickActions.map((a) => ({ kind: 'action' as const, ...a }));
    }
    const items: Array<{ kind: 'result'; result: SearchResult }> = [];
    const typeOrder: SearchResult['type'][] = ['app', 'block', 'dimension', 'board'];
    for (const type of typeOrder) {
      const group = groupedResults[type];
      if (group) {
        for (const result of group) {
          items.push({ kind: 'result', result });
        }
      }
    }
    return items;
  }, [query, quickActions, groupedResults]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [flatItems]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setDebouncedQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const navigateToResult = useCallback(
    (result: SearchResult) => {
      if (!workspaceSlug) return;
      let path = '';
      switch (result.type) {
        case 'app':
          path = `/${workspaceSlug}/apps/${result.slug}`;
          break;
        case 'block':
          path = `/${workspaceSlug}/apps/${result.appSlug}/blocks/${result.id}`;
          break;
        case 'dimension':
          path = `/${workspaceSlug}/apps/${result.appSlug}/dimensions`;
          break;
        case 'board':
          path = `/${workspaceSlug}/apps/${result.appSlug}/boards/${result.slug}`;
          break;
      }
      navigate(path);
      close();
    },
    [workspaceSlug, navigate, close],
  );

  const handleSelect = useCallback(
    (index: number) => {
      const item = flatItems[index];
      if (!item) return;
      if (item.kind === 'action') {
        navigate(item.href);
        close();
      } else {
        navigateToResult(item.result);
      }
    },
    [flatItems, navigate, close, navigateToResult],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % Math.max(flatItems.length, 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + Math.max(flatItems.length, 1)) % Math.max(flatItems.length, 1));
          break;
        case 'Enter':
          e.preventDefault();
          handleSelect(selectedIndex);
          break;
        case 'Escape':
          e.preventDefault();
          close();
          break;
      }
    },
    [flatItems.length, selectedIndex, handleSelect, close],
  );

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-selected="true"]');
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const showResults = query.length >= 2;
  const showQuickActions = query.length < 2;

  let currentGroupType: string | null = null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-150"
      onClick={close}
      role="presentation"
    >
      <div
        className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg bg-popover border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search apps, blocks, dimensions, boards..."
            className="w-full py-3 bg-transparent text-foreground text-sm placeholder:text-muted-foreground focus:outline-none"
            aria-label="Search"
            aria-activedescendant={flatItems.length > 0 ? `cmd-item-${selectedIndex}` : undefined}
            role="combobox"
            aria-expanded={flatItems.length > 0}
            aria-controls="cmd-list"
            aria-autocomplete="list"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div
          ref={listRef}
          id="cmd-list"
          role="listbox"
          className="max-h-[300px] overflow-y-auto py-2"
        >
          {showResults && isLoading && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          )}

          {showResults && !isLoading && searchResults.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results found for "{query}"
            </div>
          )}

          {showResults &&
            !isLoading &&
            flatItems.map((item, index) => {
              if (item.kind !== 'result') return null;
              const { result } = item;
              const meta = TYPE_META[result.type];
              const Icon = meta.icon;
              const isSelected = index === selectedIndex;

              let groupHeader: React.ReactNode = null;
              if (result.type !== currentGroupType) {
                currentGroupType = result.type;
                groupHeader = (
                  <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {meta.label}
                  </div>
                );
              }

              return (
                <div key={`${result.type}-${result.id}`}>
                  {groupHeader}
                  <div
                    id={`cmd-item-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    data-selected={isSelected}
                    className={`px-4 py-2.5 flex items-center gap-3 text-sm cursor-pointer ${
                      isSelected ? 'bg-accent' : 'hover:bg-accent'
                    }`}
                    onClick={() => handleSelect(index)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="truncate text-foreground">{result.name}</span>
                      {result.appName && (
                        <span className="ml-2 text-xs text-muted-foreground truncate">
                          {result.appName}
                        </span>
                      )}
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground shrink-0">
                      {meta.label.slice(0, -1)}
                    </span>
                  </div>
                </div>
              );
            })}

          {showQuickActions && (
            <>
              <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Quick Actions
              </div>
              {quickActions.map((action, i) => {
                const Icon = action.icon;
                const isSelected = i === selectedIndex;
                return (
                  <div
                    key={action.id}
                    id={`cmd-item-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    data-selected={isSelected}
                    className={`px-4 py-2.5 flex items-center gap-3 text-sm cursor-pointer ${
                      isSelected ? 'bg-accent' : 'hover:bg-accent'
                    }`}
                    onClick={() => handleSelect(i)}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-foreground">{action.label}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ArrowUp className="h-3 w-3" />
            <ArrowDown className="h-3 w-3" />
            navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" />
            select
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            {isMac ? '⌘' : 'Ctrl'}+K to toggle
          </span>
        </div>
      </div>
    </div>
  );
}
