// ---------------------------------------------------------------------------
// React Query hooks for the Comments resource.
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

export interface Comment {
  id: string;
  applicationId: string;
  userId: string;
  targetType: 'block' | 'board' | 'cell';
  targetId: string;
  parentCommentId: string | null;
  body: string;
  mentions: string[];
  isResolved: number;
  createdAt: string;
  updatedAt: string;
  author: { firstName: string; lastName: string; email: string };
}

export interface CreateCommentPayload {
  workspaceSlug: string;
  appSlug: string;
  targetType: 'block' | 'board' | 'cell';
  targetId: string;
  parentCommentId?: string;
  body: string;
  mentions?: string[];
}

export interface UpdateCommentPayload {
  workspaceSlug: string;
  appSlug: string;
  commentId: string;
  body?: string;
  isResolved?: number;
}

export interface DeleteCommentPayload {
  workspaceSlug: string;
  appSlug: string;
  commentId: string;
  targetType: string;
  targetId: string;
}

// ------------------------------------------------------------------
// Query keys
// ------------------------------------------------------------------

export const commentKeys = {
  all: (ws: string, app: string, targetType: string, targetId: string) =>
    ['comments', ws, app, targetType, targetId] as const,
};

// ------------------------------------------------------------------
// Queries
// ------------------------------------------------------------------

export function useComments(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
  targetType: string | undefined,
  targetId: string | undefined,
  options?: Partial<UseQueryOptions<Comment[]>>,
) {
  return useQuery<Comment[]>({
    queryKey: commentKeys.all(
      workspaceSlug ?? '',
      appSlug ?? '',
      targetType ?? '',
      targetId ?? '',
    ),
    queryFn: async () => {
      const res = await api.get<Comment[]>(
        `/${workspaceSlug}/apps/${appSlug}/comments?targetType=${targetType}&targetId=${targetId}`,
      );
      return res.data ?? [];
    },
    enabled: !!workspaceSlug && !!appSlug && !!targetType && !!targetId,
    ...options,
  });
}

// ------------------------------------------------------------------
// Mutations
// ------------------------------------------------------------------

export function useCreateComment() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<Comment>, Error, CreateCommentPayload>({
    mutationFn: ({ workspaceSlug, appSlug, ...body }) =>
      api.post<Comment>(`/${workspaceSlug}/apps/${appSlug}/comments`, body),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: commentKeys.all(
          variables.workspaceSlug,
          variables.appSlug,
          variables.targetType,
          variables.targetId,
        ),
      });
      // Also invalidate block-level cell comment counts
      if (variables.targetType === 'cell') {
        void qc.invalidateQueries({
          queryKey: ['cell-comments-block', variables.workspaceSlug, variables.appSlug],
        });
      }
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

export function useUpdateComment() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<Comment>, Error, UpdateCommentPayload>({
    mutationFn: ({ workspaceSlug, appSlug, commentId, ...body }) =>
      api.patch<Comment>(
        `/${workspaceSlug}/apps/${appSlug}/comments/${commentId}`,
        body,
      ),
    onSuccess: () => {
      // Invalidate all comment queries since we don't track targetType/targetId here
      void qc.invalidateQueries({ queryKey: ['comments'] });
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

/**
 * Fetch all cell comments for a given block.
 * Returns a Map from targetId (cellKey) to comment count.
 */
export function useCellCommentsForBlock(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
  blockId: string | undefined,
) {
  return useQuery<Map<string, number>>({
    queryKey: ['cell-comments-block', workspaceSlug, appSlug, blockId],
    queryFn: async () => {
      const res = await api.get<Comment[]>(
        `/${workspaceSlug}/apps/${appSlug}/comments?targetType=cell&targetIdPrefix=${blockId}`,
      );
      const comments = res.data ?? [];
      const map = new Map<string, number>();
      for (const c of comments) {
        map.set(c.targetId, (map.get(c.targetId) ?? 0) + 1);
      }
      return map;
    },
    enabled: !!workspaceSlug && !!appSlug && !!blockId,
    staleTime: 30_000,
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();

  return useMutation<ApiResponse, Error, DeleteCommentPayload>({
    mutationFn: ({ workspaceSlug, appSlug, commentId }) =>
      api.delete(`/${workspaceSlug}/apps/${appSlug}/comments/${commentId}`),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: commentKeys.all(
          variables.workspaceSlug,
          variables.appSlug,
          variables.targetType,
          variables.targetId,
        ),
      });
      // Also invalidate block-level cell comment counts
      if (variables.targetType === 'cell') {
        void qc.invalidateQueries({
          queryKey: ['cell-comments-block', variables.workspaceSlug, variables.appSlug],
        });
      }
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}
