import * as React from 'react';
import { cn } from '@/lib/utils';

interface ContextMenuItem {
  label: string;
  icon?: React.ElementType;
  shortcut?: string;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

interface ContextMenuSection {
  items: ContextMenuItem[];
}

interface ContextMenuProps {
  sections: ContextMenuSection[];
  position: { x: number; y: number } | null;
  onClose: () => void;
}

export function ContextMenu({ sections, position, onClose }: ContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!position) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handleKey);
    };
  }, [position, onClose]);

  if (!position) return null;

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    zIndex: 50,
  };

  return (
    <div ref={menuRef} style={menuStyle} className="min-w-[180px] bg-popover border border-border/50 rounded-2xl backdrop-blur-xl shadow-win-lg py-1 animate-in fade-in-0 zoom-in-95">
      {sections.map((section, si) => (
        <React.Fragment key={si}>
          {si > 0 && <div className="h-px bg-border my-1" />}
          {section.items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => { item.onClick(); onClose(); }}
                disabled={item.disabled}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors',
                  item.disabled && 'opacity-40 cursor-not-allowed',
                  item.variant === 'destructive'
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-popover-foreground hover:bg-accent',
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <span className="text-xs text-muted-foreground ml-4">{item.shortcut}</span>
                )}
              </button>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

export function useContextMenu() {
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 300);
    setPosition({ x, y });
  }, []);

  const close = React.useCallback(() => setPosition(null), []);

  return { position, handleContextMenu, close };
}
