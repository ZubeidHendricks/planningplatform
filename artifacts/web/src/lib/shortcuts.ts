import { create } from 'zustand';

export interface Shortcut {
  id: string;
  keys: string;
  description: string;
  category: string;
  handler: () => void;
  enabled?: boolean;
}

interface ShortcutStore {
  shortcuts: Map<string, Shortcut>;
  registerShortcut: (shortcut: Shortcut) => void;
  unregisterShortcut: (id: string) => void;
}

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

function parseKeys(keys: string): { mod: boolean; shift: boolean; alt: boolean; key: string } {
  const parts = keys.toLowerCase().split('+');
  return {
    mod: parts.includes('mod'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key: parts.filter((p) => p !== 'mod' && p !== 'shift' && p !== 'alt')[0] ?? '',
  };
}

function matchEvent(e: KeyboardEvent, parsed: ReturnType<typeof parseKeys>): boolean {
  const modPressed = isMac ? e.metaKey : e.ctrlKey;
  if (parsed.mod && !modPressed) return false;
  if (!parsed.mod && modPressed) return false;
  if (parsed.shift !== e.shiftKey) return false;
  if (parsed.alt !== e.altKey) return false;

  const eventKey = e.key.toLowerCase();

  if (parsed.key === 'escape') return eventKey === 'escape';
  if (parsed.key === 'delete') return eventKey === 'delete' || eventKey === 'backspace';
  if (parsed.key === 'enter') return eventKey === 'enter';
  if (parsed.key === 'tab') return eventKey === 'tab';
  if (parsed.key === '?') return eventKey === '?' || (e.shiftKey && eventKey === '/');

  return eventKey === parsed.key;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  return false;
}

export const useShortcutStore = create<ShortcutStore>((set) => ({
  shortcuts: new Map(),
  registerShortcut: (shortcut) =>
    set((state) => {
      const next = new Map(state.shortcuts);
      next.set(shortcut.id, shortcut);
      return { shortcuts: next };
    }),
  unregisterShortcut: (id) =>
    set((state) => {
      const next = new Map(state.shortcuts);
      next.delete(id);
      return { shortcuts: next };
    }),
}));

function handleGlobalKeydown(e: KeyboardEvent) {
  const shortcuts = useShortcutStore.getState().shortcuts;
  const inEditable = isEditableTarget(e.target);

  for (const shortcut of shortcuts.values()) {
    if (shortcut.enabled === false) continue;

    const parsed = parseKeys(shortcut.keys);

    if (inEditable && !parsed.mod) continue;

    if (matchEvent(e, parsed)) {
      e.preventDefault();
      e.stopPropagation();
      shortcut.handler();
      return;
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleGlobalKeydown, true);
}

export { isMac };
