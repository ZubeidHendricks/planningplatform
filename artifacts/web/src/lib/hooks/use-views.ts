// ---------------------------------------------------------------------------
// React Query hooks for the Views resource (scoped to a block).
// ---------------------------------------------------------------------------

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface View {
  id: string;
  name: string;
  blockId: string;
  isDefault: number;
  pivotConfig: {
    rows: string[];
    columns: string[];
    pages: string[];
    filters: Record<string, string[]>;
  };
  formatting?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateViewPayload {
  workspaceSlug: string;
  appSlug: string;
  blockId: string;
  name: string;
  pivotConfig: {
    rows: string[];
    columns: string[];
    pages: string[];
    filters: Record<string, string[]>;
  };
  isDefault?: number;
  formatting?: Record<string, unknown>;
}

export interface UpdateViewPayload {
  workspaceSlug: string;
  appSlug: string;
  blockId: string;
  viewId: string;
  name?: string;
  pivotConfig?: {
    rows: string[];
    columns: string[];
    pages: string[];
    filters: Record<string, string[]>;
  };
  isDefault?: number;
  formatting?: Record<string, unknown>;
}

export interface DeleteViewPayload {
  workspaceSlug: string;
  appSlug: string;
  blockId: string;
  viewId: string;
}

// ------------------------------------------------------------------
// Query keys
// ------------------------------------------------------------------

export const viewKeys = {
  all: (ws: string, app: string, blockId: string) =>
    ['views', ws, app, blockId] as const,
};

// ------------------------------------------------------------------
// Queries
// ------------------------------------------------------------------

export function useViews(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
  blockId: string | undefined,
  options?: Partial<UseQueryOptions<View[]>>,
) {
  return useQuery<View[]>({
    queryKey: viewKeys.all(workspaceSlug ?? '', appSlug ?? '', blockId ?? ''),
    queryFn: async () => {
      const res = await api.get<View[]>(
        `/${workspaceSlug}/apps/${appSlug}/blocks/${blockId}/views`,
      );
      return res.data ?? [];
    },
    enabled: !!workspaceSlug && !!appSlug && !!blockId,
    ...options,
  });
}

// ------------------------------------------------------------------
// Mutations
// ------------------------------------------------------------------

export function useCreateView() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<View>, Error, CreateViewPayload>({
    mutationFn: ({ workspaceSlug, appSlug, blockId, ...body }) =>
      api.post<View>(
        `/${workspaceSlug}/apps/${appSlug}/blocks/${blockId}/views`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: viewKeys.all(
          variables.workspaceSlug,
          variables.appSlug,
          variables.blockId,
        ),
      });
    },
  });
}

export function useUpdateView() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<View>, Error, UpdateViewPayload>({
    mutationFn: ({ workspaceSlug, appSlug, blockId, viewId, ...body }) =>
      api.patch<View>(
        `/${workspaceSlug}/apps/${appSlug}/blocks/${blockId}/views/${viewId}`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: viewKeys.all(
          variables.workspaceSlug,
          variables.appSlug,
          variables.blockId,
        ),
      });
    },
  });
}

export function useDeleteView() {
  const qc = useQueryClient();

  return useMutation<ApiResponse, Error, DeleteViewPayload>({
    mutationFn: ({ workspaceSlug, appSlug, blockId, viewId }) =>
      api.delete(
        `/${workspaceSlug}/apps/${appSlug}/blocks/${blockId}/views/${viewId}`,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: viewKeys.all(
          variables.workspaceSlug,
          variables.appSlug,
          variables.blockId,
        ),
      });
    },
  });
}
