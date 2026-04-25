// ---------------------------------------------------------------------------
// WebSocket connection manager and Zustand store for real-time state.
// Uses socket.io-client to connect to the backend RealtimeService.
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export interface PresenceUser {
  userId: string;
  email: string;
  blockId?: string;
  cellKey?: string;
  lastSeen: string;
}

export interface CursorInfo {
  userId: string;
  email: string;
  blockId: string;
  cellKey: string;
}

export interface CellUpdateEvent {
  blockId: string;
  coordinates: Record<string, string>;
  value: number | string | boolean | null;
  userId: string;
  email: string;
}

export interface RealtimeNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// -----------------------------------------------------------------------
// Store interface
// -----------------------------------------------------------------------

interface RealtimeState {
  status: ConnectionStatus;
  onlineUsers: PresenceUser[];
  cursors: Map<string, CursorInfo[]>; // blockId -> list of other users' cursors
}

interface RealtimeActions {
  connectSocket: (token: string) => void;
  disconnectSocket: () => void;
  joinApp: (workspaceSlug: string, appSlug: string) => void;
  leaveApp: (workspaceSlug: string, appSlug: string) => void;
  moveCursor: (blockId: string, cellKey: string) => void;

  // Event handlers (set by hooks)
  _onCellUpdated: ((event: CellUpdateEvent) => void) | null;
  _setOnCellUpdated: (handler: ((event: CellUpdateEvent) => void) | null) => void;
  _onNotification: ((notification: RealtimeNotification) => void) | null;
  _setOnNotification: (handler: ((notification: RealtimeNotification) => void) | null) => void;
}

type RealtimeStore = RealtimeState & RealtimeActions;

// -----------------------------------------------------------------------
// Singleton socket reference (outside of Zustand to avoid serialization)
// -----------------------------------------------------------------------

let socket: Socket | null = null;

// -----------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------

export const useRealtimeStore = create<RealtimeStore>((set, get) => ({
  // State
  status: 'disconnected',
  onlineUsers: [],
  cursors: new Map(),

  // Event handler references
  _onCellUpdated: null,
  _setOnCellUpdated: (handler) => set({ _onCellUpdated: handler }),
  _onNotification: null,
  _setOnNotification: (handler) => set({ _onNotification: handler }),

  connectSocket(token: string) {
    // Already connected or connecting
    if (socket?.connected) return;

    // Clean up existing socket
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }

    set({ status: 'connecting' });

    socket = io({
      path: '/socket.io',
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      set({ status: 'connected' });
    });

    socket.on('disconnect', () => {
      set({ status: 'disconnected', onlineUsers: [] });
    });

    socket.on('reconnect_attempt', () => {
      set({ status: 'reconnecting' });
    });

    socket.on('reconnect', () => {
      set({ status: 'connected' });
    });

    socket.on('connect_error', () => {
      set({ status: 'disconnected' });
    });

    // ----- Presence updates -----
    socket.on('presence-update', (data: { users: PresenceUser[] }) => {
      set({ onlineUsers: data.users });
    });

    // ----- Cell updates -----
    socket.on('cell-updated', (event: CellUpdateEvent) => {
      const handler = get()._onCellUpdated;
      if (handler) handler(event);
    });

    // ----- Cursor updates -----
    socket.on('cursor-updated', (data: CursorInfo) => {
      set((state) => {
        const next = new Map(state.cursors);
        const list = (next.get(data.blockId) ?? []).filter(
          (c) => c.userId !== data.userId,
        );
        list.push(data);
        next.set(data.blockId, list);
        return { cursors: next };
      });
    });

    // ----- Notifications -----
    socket.on('notification', (notification: RealtimeNotification) => {
      const handler = get()._onNotification;
      if (handler) handler(notification);
    });
  },

  disconnectSocket() {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
    set({
      status: 'disconnected',
      onlineUsers: [],
      cursors: new Map(),
    });
  },

  joinApp(workspaceSlug: string, appSlug: string) {
    socket?.emit('join-app', { workspaceSlug, appSlug });
  },

  leaveApp(workspaceSlug: string, appSlug: string) {
    socket?.emit('leave-app', { workspaceSlug, appSlug });
  },

  moveCursor(blockId: string, cellKey: string) {
    socket?.emit('cursor-move', { blockId, cellKey });
  },
}));
