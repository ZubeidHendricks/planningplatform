// ---------------------------------------------------------------------------
// React Query hooks for the Notifications resource.
// ---------------------------------------------------------------------------

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { useToastStore } from '@/stores/toast';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface Notification {
  id: string;
  userId: string;
  type: 'mention' | 'reply' | 'comment' | 'system';
  title: string;
  body: string;
  link: string | null;
  isRead: number;
  sourceUserId: string | null;
  createdAt: string;
}

export interface MarkNotificationReadPayload {
  workspaceSlug: string;
  notificationId: string;
}

export interface MarkAllReadPayload {
  workspaceSlug: string;
}

// ------------------------------------------------------------------
// Query keys
// ------------------------------------------------------------------

export const notificationKeys = {
  all: (ws: string) => ['notifications', ws] as const,
  unreadCount: (ws: string) => ['notifications', ws, 'unread-count'] as const,
};

// ------------------------------------------------------------------
// Queries
// ------------------------------------------------------------------

export function useNotifications(
  workspaceSlug: string | undefined,
  options?: Partial<UseQueryOptions<Notification[]>>,
) {
  return useQuery<Notification[]>({
    queryKey: notificationKeys.all(workspaceSlug ?? ''),
    queryFn: async () => {
      const res = await api.get<Notification[]>(
        `/${workspaceSlug}/notifications`,
      );
      return res.data ?? [];
    },
    enabled: !!workspaceSlug,
    ...options,
  });
}

export function useUnreadCount(
  workspaceSlug: string | undefined,
  options?: Partial<UseQueryOptions<number>>,
) {
  return useQuery<number>({
    queryKey: notificationKeys.unreadCount(workspaceSlug ?? ''),
    queryFn: async () => {
      const res = await api.get<{ count: number }>(
        `/${workspaceSlug}/notifications/unread-count`,
      );
      return res.data?.count ?? 0;
    },
    enabled: !!workspaceSlug,
    refetchInterval: 30000,
    ...options,
  });
}

// ------------------------------------------------------------------
// Mutations
// ------------------------------------------------------------------

export function useMarkNotificationRead() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<Notification>, Error, MarkNotificationReadPayload>({
    mutationFn: ({ workspaceSlug, notificationId }) =>
      api.patch<Notification>(
        `/${workspaceSlug}/notifications/${notificationId}/read`,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: notificationKeys.all(variables.workspaceSlug),
      });
      void qc.invalidateQueries({
        queryKey: notificationKeys.unreadCount(variables.workspaceSlug),
      });
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();

  return useMutation<ApiResponse, Error, MarkAllReadPayload>({
    mutationFn: ({ workspaceSlug }) =>
      api.post(`/${workspaceSlug}/notifications/mark-all-read`),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: notificationKeys.all(variables.workspaceSlug),
      });
      void qc.invalidateQueries({
        queryKey: notificationKeys.unreadCount(variables.workspaceSlug),
      });
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}
