// ---------------------------------------------------------------------------
// React Query hooks for the Blocks resource.
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

export interface Block {
  id: string;
  name: string;
  slug: string;
  blockType: string;
  description?: string | null;
  formula?: string | null;
  formatType?: string | null;
  formatOptions?: Record<string, unknown> | null;
  applicationId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBlockPayload {
  workspaceSlug: string;
  appSlug: string;
  name: string;
  slug: string;
  blockType: string;
  description?: string;
  formula?: string;
  formatType?: string;
}

export interface UpdateBlockFormulaPayload {
  workspaceSlug: string;
  appSlug: string;
  blockId: string;
  formula: string;
}

export interface DeleteBlockPayload {
  workspaceSlug: string;
  appSlug: string;
  blockId: string;
}

// ------------------------------------------------------------------
// Query keys
// ------------------------------------------------------------------

export const blockKeys = {
  all: (ws: string, app: string) => ['blocks', ws, app] as const,
  detail: (ws: string, app: string, id: string) =>
    ['blocks', ws, app, id] as const,
};

// ------------------------------------------------------------------
// Queries
// ------------------------------------------------------------------

export function useBlocks(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
  options?: Partial<UseQueryOptions<Block[]>>,
) {
  return useQuery<Block[]>({
    queryKey: blockKeys.all(workspaceSlug ?? '', appSlug ?? ''),
    queryFn: async () => {
      const res = await api.get<Block[]>(
        `/${workspaceSlug}/apps/${appSlug}/blocks`,
      );
      return res.data ?? [];
    },
    enabled: !!workspaceSlug && !!appSlug,
    ...options,
  });
}

// ------------------------------------------------------------------
// Mutations
// ------------------------------------------------------------------

export function useCreateBlock() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<Block>, Error, CreateBlockPayload>({
    mutationFn: ({ workspaceSlug, appSlug, ...body }) =>
      api.post<Block>(`/${workspaceSlug}/apps/${appSlug}/blocks`, body),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: blockKeys.all(variables.workspaceSlug, variables.appSlug),
      });
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

export function useUpdateBlockFormula() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<Block>, Error, UpdateBlockFormulaPayload>({
    mutationFn: ({ workspaceSlug, appSlug, blockId, ...body }) =>
      api.patch<Block>(
        `/${workspaceSlug}/apps/${appSlug}/blocks/${blockId}`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: blockKeys.all(variables.workspaceSlug, variables.appSlug),
      });
      void qc.invalidateQueries({
        queryKey: blockKeys.detail(
          variables.workspaceSlug,
          variables.appSlug,
          variables.blockId,
        ),
      });
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

export function useDeleteBlock() {
  const qc = useQueryClient();

  return useMutation<ApiResponse, Error, DeleteBlockPayload>({
    mutationFn: ({ workspaceSlug, appSlug, blockId }) =>
      api.delete(`/${workspaceSlug}/apps/${appSlug}/blocks/${blockId}`),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: blockKeys.all(variables.workspaceSlug, variables.appSlug),
      });
    },
  });
}
