// ---------------------------------------------------------------------------
// React Query hooks for the Cells resource.
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

export interface Cell {
  id: string;
  blockId: string;
  coordinates: Record<string, string>;
  numericValue: number | null;
  textValue: string | null;
  booleanValue: boolean | null;
  isInput: boolean;
  versionId?: string | null;
  updatedAt: string;
}

export interface SetCellValuePayload {
  workspaceSlug: string;
  appSlug: string;
  blockId: string;
  coordinates: Record<string, string>;
  value: number | string | boolean | null;
}

// ------------------------------------------------------------------
// Query keys
// ------------------------------------------------------------------

export const cellKeys = {
  all: (ws: string, app: string, blockId: string, versionId?: string) =>
    ['cells', ws, app, blockId, ...(versionId ? [versionId] : [])] as const,
};

// ------------------------------------------------------------------
// Queries
// ------------------------------------------------------------------

export function useCells(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
  blockId: string | undefined,
  versionId?: string | undefined,
  options?: Partial<UseQueryOptions<Cell[]>>,
) {
  return useQuery<Cell[]>({
    queryKey: cellKeys.all(workspaceSlug ?? '', appSlug ?? '', blockId ?? '', versionId ?? undefined),
    queryFn: async () => {
      const params = versionId ? `?versionId=${encodeURIComponent(versionId)}` : '';
      const res = await api.get<Cell[]>(
        `/${workspaceSlug}/apps/${appSlug}/blocks/${blockId}/cells${params}`,
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

export function useSetCellValue() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<Cell>, Error, SetCellValuePayload>({
    mutationFn: ({ workspaceSlug, appSlug, blockId, coordinates, value }) =>
      api.post<Cell>(
        `/${workspaceSlug}/apps/${appSlug}/blocks/${blockId}/cells`,
        { coordinates, value },
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: cellKeys.all(
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
