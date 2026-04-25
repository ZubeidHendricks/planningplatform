import { useState, useEffect, useMemo, useCallback } from 'react';
import { Keyboard, X } from 'lucide-react';
import { useShortcutStore, isMac } from '@/lib/shortcuts';
import { cn } from '@/lib/utils';

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5',
        'rounded border border-border bg-muted text-xs font-mono text-muted-foreground',
      )}
    >
      {children}
    </kbd>
  );
}

function formatKeyCombo(keys: string): string[] {
  return keys.split('+').map((part) => {
    const p = part.trim().toLowerCase();
    if (p === 'mod') return isMac ? '\u2318' : 'Ctrl';
    if (p === 'shift') return isMac ? '\u21E7' : 'Shift';
    if (p === 'alt') return isMac ? '\u2325' : 'Alt';
    if (p === 'enter') return '\u21B5';
    if (p === 'escape') return 'Esc';
    if (p === 'delete') return 'Del';
    if (p === 'tab') return 'Tab';
    return p.toUpperCase();
  });
}

export function ShortcutHelp() {
  const [open, setOpen] = useState(false);
  const shortcuts = useShortcutStore((s) => s.shortcuts);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (open && e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => {
    const store = useShortcutStore.getState();
    store.registerShortcut({
      id: 'shortcut-help-toggle',
      keys: '?',
      description: 'Show keyboard shortcuts',
      category: 'General',
      handler: toggle,
    });
    return () => store.unregisterShortcut('shortcut-help-toggle');
  }, [toggle]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Array<{ description: string; keys: string }>>();
    const categoryOrder = ['General', 'Navigation', 'Editing'];

    for (const shortcut of shortcuts.values()) {
      if (shortcut.id === 'shortcut-help-toggle') continue;
      const cat = shortcut.category || 'General';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push({
        description: shortcut.description,
        keys: shortcut.keys,
      });
    }

    groups.set('General', [
      { description: 'Show keyboard shortcuts', keys: '?' },
      ...(groups.get('General') ?? []),
    ]);

    const sorted = new Map<string, Array<{ description: string; keys: string }>>();
    for (const cat of categoryOrder) {
      if (groups.has(cat)) sorted.set(cat, groups.get(cat)!);
    }
    for (const [cat, items] of groups) {
      if (!sorted.has(cat)) sorted.set(cat, items);
    }

    return sorted;
  }, [shortcuts]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setOpen(false)}
      />
      <div className="relative w-full max-w-lg mx-4 rounded-lg border border-border bg-popover shadow-lg animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4.5 w-4.5 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-sm p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-5">
          {Array.from(grouped).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {category}
              </h3>
              <div className="space-y-1">
                {items.map((item) => (
                  <div
                    key={item.keys + item.description}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-foreground">{item.description}</span>
                    <div className="flex items-center gap-1">
                      {formatKeyCombo(item.keys).map((part, i) => (
                        <KeyBadge key={i}>{part}</KeyBadge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
