// ---------------------------------------------------------------------------
// React hooks for WebSocket real-time functionality.
// ---------------------------------------------------------------------------

import { useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useRealtimeStore,
  type CellUpdateEvent,
  type PresenceUser,
  type CursorInfo,
} from '@/lib/realtime';
import { cellKeys } from '@/lib/hooks/use-cells';

// -----------------------------------------------------------------------
// useRealtimeSync — joins an app room and auto-invalidates cell queries
// -----------------------------------------------------------------------

export function useRealtimeSync(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
): void {
  const joinApp = useRealtimeStore((s) => s.joinApp);
  const leaveApp = useRealtimeStore((s) => s.leaveApp);
  const setOnCellUpdated = useRealtimeStore((s) => s._setOnCellUpdated);
  const qc = useQueryClient();

  // Memoize the cell-updated handler
  const handleCellUpdated = useCallback(
    (event: CellUpdateEvent) => {
      if (!workspaceSlug || !appSlug) return;

      // Invalidate the cell query for the affected block
      void qc.invalidateQueries({
        queryKey: cellKeys.all(workspaceSlug, appSlug, event.blockId),
      });
    },
    [workspaceSlug, appSlug, qc],
  );

  useEffect(() => {
    if (!workspaceSlug || !appSlug) return;

    joinApp(workspaceSlug, appSlug);
    setOnCellUpdated(handleCellUpdated);

    return () => {
      leaveApp(workspaceSlug, appSlug);
      setOnCellUpdated(null);
    };
  }, [workspaceSlug, appSlug, joinApp, leaveApp, setOnCellUpdated, handleCellUpdated]);
}

// -----------------------------------------------------------------------
// usePresence — returns list of online users in current app
// -----------------------------------------------------------------------

export function usePresence(): PresenceUser[] {
  return useRealtimeStore((s) => s.onlineUsers);
}

// -----------------------------------------------------------------------
// useCursors — returns other users' cursor positions for a specific block
// -----------------------------------------------------------------------

export function useCursors(blockId: string | undefined): CursorInfo[] {
  const cursors = useRealtimeStore((s) => s.cursors);

  return useMemo(() => {
    if (!blockId) return [];
    return cursors.get(blockId) ?? [];
  }, [cursors, blockId]);
}
