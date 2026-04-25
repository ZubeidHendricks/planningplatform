import { create } from 'zustand';

export interface UndoEntry {
  blockId: string;
  coordinates: Record<string, string>;
  oldValue: number | string | boolean | null;
  newValue: number | string | boolean | null;
  timestamp: number;
}

const MAX_HISTORY = 50;

interface UndoStore {
  past: UndoEntry[];
  future: UndoEntry[];
  pushEdit: (entry: UndoEntry) => void;
  undo: () => UndoEntry | undefined;
  redo: () => UndoEntry | undefined;
  clear: () => void;
}

export const useUndoStore = create<UndoStore>((set, get) => ({
  past: [],
  future: [],

  pushEdit: (entry) =>
    set((state) => ({
      past: [...state.past, entry].slice(-MAX_HISTORY),
      future: [],
    })),

  undo: () => {
    const { past, future } = get();
    const entry = past[past.length - 1];
    if (!entry) return undefined;
    set({
      past: past.slice(0, -1),
      future: [...future, entry],
    });
    return entry;
  },

  redo: () => {
    const { past, future } = get();
    const entry = future[future.length - 1];
    if (!entry) return undefined;
    set({
      past: [...past, entry],
      future: future.slice(0, -1),
    });
    return entry;
  },

  clear: () => set({ past: [], future: [] }),
}));
