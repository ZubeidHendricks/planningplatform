// ---------------------------------------------------------------------------
// React Query hooks for the Boards resource (dashboards / layouts).
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

export interface BoardWidget {
  id: string;
  type: 'grid' | 'chart' | 'kpi' | 'text' | 'action';
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config: Record<string, unknown>;
}

export interface Board {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  applicationId: string;
  layout: BoardWidget[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBoardPayload {
  workspaceSlug: string;
  appSlug: string;
  name: string;
  slug: string;
  description?: string;
  layout?: BoardWidget[];
}

export interface UpdateBoardLayoutPayload {
  workspaceSlug: string;
  appSlug: string;
  boardSlug: string;
  layout: BoardWidget[];
}

export interface DeleteBoardPayload {
  workspaceSlug: string;
  appSlug: string;
  boardSlug: string;
}

// ------------------------------------------------------------------
// Query keys
// ------------------------------------------------------------------

export const boardKeys = {
  all: (ws: string, app: string) => ['boards', ws, app] as const,
  detail: (ws: string, app: string, slug: string) =>
    ['boards', ws, app, slug] as const,
};

// ------------------------------------------------------------------
// Queries
// ------------------------------------------------------------------

export function useBoards(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
  options?: Partial<UseQueryOptions<Board[]>>,
) {
  return useQuery<Board[]>({
    queryKey: boardKeys.all(workspaceSlug ?? '', appSlug ?? ''),
    queryFn: async () => {
      const res = await api.get<Board[]>(
        `/${workspaceSlug}/apps/${appSlug}/boards`,
      );
      return res.data ?? [];
    },
    enabled: !!workspaceSlug && !!appSlug,
    ...options,
  });
}

export function useBoard(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
  boardSlug: string | undefined,
  options?: Partial<UseQueryOptions<Board>>,
) {
  return useQuery<Board>({
    queryKey: boardKeys.detail(
      workspaceSlug ?? '',
      appSlug ?? '',
      boardSlug ?? '',
    ),
    queryFn: async () => {
      const res = await api.get<Board>(
        `/${workspaceSlug}/apps/${appSlug}/boards/${boardSlug}`,
      );
      if (!res.data) throw new Error(res.error ?? 'Board not found');
      return res.data;
    },
    enabled: !!workspaceSlug && !!appSlug && !!boardSlug,
    ...options,
  });
}

// ------------------------------------------------------------------
// Mutations
// ------------------------------------------------------------------

export function useCreateBoard() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<Board>, Error, CreateBoardPayload>({
    mutationFn: ({ workspaceSlug, appSlug, ...body }) =>
      api.post<Board>(`/${workspaceSlug}/apps/${appSlug}/boards`, body),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: boardKeys.all(variables.workspaceSlug, variables.appSlug),
      });
    },
  });
}

export function useUpdateBoardLayout() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<Board>, Error, UpdateBoardLayoutPayload>({
    mutationFn: ({ workspaceSlug, appSlug, boardSlug, ...body }) =>
      api.patch<Board>(
        `/${workspaceSlug}/apps/${appSlug}/boards/${boardSlug}`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: boardKeys.all(variables.workspaceSlug, variables.appSlug),
      });
      void qc.invalidateQueries({
        queryKey: boardKeys.detail(
          variables.workspaceSlug,
          variables.appSlug,
          variables.boardSlug,
        ),
      });
    },
  });
}

export function useDeleteBoard() {
  const qc = useQueryClient();

  return useMutation<ApiResponse, Error, DeleteBoardPayload>({
    mutationFn: ({ workspaceSlug, appSlug, boardSlug }) =>
      api.delete(`/${workspaceSlug}/apps/${appSlug}/boards/${boardSlug}`),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: boardKeys.all(variables.workspaceSlug, variables.appSlug),
      });
    },
  });
}
