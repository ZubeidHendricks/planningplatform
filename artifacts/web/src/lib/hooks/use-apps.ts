// ---------------------------------------------------------------------------
// React Query hooks for the Applications resource.
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

export interface App {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  workspaceId: string;
  templateId?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppPayload {
  workspaceSlug: string;
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateAppPayload {
  workspaceSlug: string;
  appSlug: string;
  name?: string;
  description?: string;
}

export interface DeleteAppPayload {
  workspaceSlug: string;
  appSlug: string;
}

// ------------------------------------------------------------------
// Query keys
// ------------------------------------------------------------------

export const appKeys = {
  all: (ws: string) => ['apps', ws] as const,
  detail: (ws: string, slug: string) => ['apps', ws, slug] as const,
};

// ------------------------------------------------------------------
// Queries
// ------------------------------------------------------------------

export function useApps(
  workspaceSlug: string | undefined,
  options?: Partial<UseQueryOptions<App[]>>,
) {
  return useQuery<App[]>({
    queryKey: appKeys.all(workspaceSlug ?? ''),
    queryFn: async () => {
      const res = await api.get<App[]>(`/${workspaceSlug}/apps`);
      return res.data ?? [];
    },
    enabled: !!workspaceSlug,
    ...options,
  });
}

export function useApp(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
  options?: Partial<UseQueryOptions<App>>,
) {
  return useQuery<App>({
    queryKey: appKeys.detail(workspaceSlug ?? '', appSlug ?? ''),
    queryFn: async () => {
      const res = await api.get<App>(`/${workspaceSlug}/apps/${appSlug}`);
      if (!res.data) throw new Error(res.error ?? 'App not found');
      return res.data;
    },
    enabled: !!workspaceSlug && !!appSlug,
    ...options,
  });
}

// ------------------------------------------------------------------
// Mutations
// ------------------------------------------------------------------

export function useCreateApp() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<App>, Error, CreateAppPayload>({
    mutationFn: ({ workspaceSlug, ...body }) =>
      api.post<App>(`/${workspaceSlug}/apps`, body),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: appKeys.all(variables.workspaceSlug),
      });
    },
  });
}

export function useUpdateApp() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<App>, Error, UpdateAppPayload>({
    mutationFn: ({ workspaceSlug, appSlug, ...body }) =>
      api.patch<App>(`/${workspaceSlug}/apps/${appSlug}`, body),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: appKeys.all(variables.workspaceSlug),
      });
      void qc.invalidateQueries({
        queryKey: appKeys.detail(variables.workspaceSlug, variables.appSlug),
      });
    },
  });
}

export function useDeleteApp() {
  const qc = useQueryClient();

  return useMutation<ApiResponse, Error, DeleteAppPayload>({
    mutationFn: ({ workspaceSlug, appSlug }) =>
      api.delete(`/${workspaceSlug}/apps/${appSlug}`),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: appKeys.all(variables.workspaceSlug),
      });
    },
  });
}
