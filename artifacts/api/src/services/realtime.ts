import { Server as SocketIOServer, type Socket } from 'socket.io';
import type { Server as HTTPServer } from 'node:http';
import jwt from 'jsonwebtoken';
import type { AuthPayload } from '../middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface PresenceUser {
  userId: string;
  email: string;
  blockId?: string;
  cellKey?: string;
  lastSeen: string;
}

interface CellUpdatePayload {
  blockId: string;
  coordinates: Record<string, string>;
  value: number | string | boolean | null;
  userId: string;
  email: string;
}

interface CursorPayload {
  blockId: string;
  cellKey: string;
}

interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
}

// -----------------------------------------------------------------------
// RealtimeService
// -----------------------------------------------------------------------

export class RealtimeService {
  private io: SocketIOServer;

  /** room name -> Map<socketId, PresenceUser> */
  private rooms = new Map<string, Map<string, PresenceUser>>();

  /** userId -> Set<socketId> (for targeted notifications) */
  private userSockets = new Map<string, Set<string>>();

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      path: '/socket.io',
      cors: {
        origin: [
          'http://localhost:5173',
          'http://localhost:4173',
        ],
        credentials: true,
      },
      pingInterval: 25_000,
      pingTimeout: 20_000,
    });

    // ----- Auth middleware -----
    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      try {
        const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
        socket.data.userId = payload.userId;
        socket.data.email = payload.email;
        next();
      } catch {
        next(new Error('Invalid or expired token'));
      }
    });

    this.io.on('connection', (socket) => this.handleConnection(socket));
  }

  // -------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------

  private handleConnection(socket: Socket): void {
    const userId = socket.data.userId as string;
    const email = socket.data.email as string;

    // Track user -> socket mapping
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);

    // ----- join-app -----
    socket.on('join-app', (data: { workspaceSlug: string; appSlug: string }) => {
      if (!data?.workspaceSlug || !data?.appSlug) return;

      const room = this.roomName(data.workspaceSlug, data.appSlug);
      void socket.join(room);

      // Add to presence
      if (!this.rooms.has(room)) {
        this.rooms.set(room, new Map());
      }
      this.rooms.get(room)!.set(socket.id, {
        userId,
        email,
        lastSeen: new Date().toISOString(),
      });

      this.broadcastPresence(room);
    });

    // ----- leave-app -----
    socket.on('leave-app', (data: { workspaceSlug: string; appSlug: string }) => {
      if (!data?.workspaceSlug || !data?.appSlug) return;

      const room = this.roomName(data.workspaceSlug, data.appSlug);
      void socket.leave(room);
      this.removeFromRoom(room, socket.id);
      this.broadcastPresence(room);
    });

    // ----- cursor-move -----
    socket.on('cursor-move', (data: CursorPayload) => {
      if (!data?.blockId) return;

      // Update presence with cursor position
      for (const [room, members] of this.rooms) {
        const member = members.get(socket.id);
        if (member) {
          member.blockId = data.blockId;
          member.cellKey = data.cellKey;
          member.lastSeen = new Date().toISOString();
        }
      }

      // Broadcast to all rooms this socket is in (except sender)
      for (const room of socket.rooms) {
        if (room === socket.id) continue; // skip default room
        socket.to(room).emit('cursor-updated', {
          userId,
          email,
          blockId: data.blockId,
          cellKey: data.cellKey,
        });
      }
    });

    // ----- disconnect -----
    socket.on('disconnect', () => {
      // Remove from all rooms
      for (const [room] of this.rooms) {
        if (this.rooms.get(room)?.has(socket.id)) {
          this.removeFromRoom(room, socket.id);
          this.broadcastPresence(room);
        }
      }

      // Remove socket from user mapping
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
    });
  }

  // -------------------------------------------------------------------
  // Room helpers
  // -------------------------------------------------------------------

  private roomName(workspaceSlug: string, appSlug: string): string {
    return `app:${workspaceSlug}:${appSlug}`;
  }

  private removeFromRoom(room: string, socketId: string): void {
    const members = this.rooms.get(room);
    if (!members) return;
    members.delete(socketId);
    if (members.size === 0) {
      this.rooms.delete(room);
    }
  }

  private broadcastPresence(room: string): void {
    const members = this.rooms.get(room);
    if (!members) {
      this.io.to(room).emit('presence-update', { users: [] });
      return;
    }

    // Deduplicate by userId (a user may have multiple tabs)
    const seen = new Map<string, PresenceUser>();
    for (const user of members.values()) {
      const existing = seen.get(user.userId);
      if (!existing || user.lastSeen > existing.lastSeen) {
        seen.set(user.userId, user);
      }
    }

    this.io.to(room).emit('presence-update', {
      users: Array.from(seen.values()),
    });
  }

  // -------------------------------------------------------------------
  // Public API — called from route handlers
  // -------------------------------------------------------------------

  broadcastCellUpdate(
    workspaceSlug: string,
    appSlug: string,
    data: CellUpdatePayload,
  ): void {
    const room = this.roomName(workspaceSlug, appSlug);
    this.io.to(room).emit('cell-updated', data);
  }

  broadcastNotification(userId: string, notification: NotificationPayload): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;

    for (const socketId of sockets) {
      this.io.to(socketId).emit('notification', notification);
    }
  }
}
