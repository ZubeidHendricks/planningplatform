// ---------------------------------------------------------------------------
// React Query hooks for the Versions resource (scenario / plan versions).
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

export interface Version {
  id: string;
  name: string;
  versionType: 'budget' | 'forecast' | 'actuals';
  applicationId: string;
  parentVersionId?: string | null;
  isLocked: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVersionPayload {
  workspaceSlug: string;
  appSlug: string;
  name: string;
  versionType: 'budget' | 'forecast' | 'actuals';
  parentVersionId?: string;
}

export interface UpdateVersionPayload {
  workspaceSlug: string;
  appSlug: string;
  versionId: string;
  name?: string;
  isLocked?: number;
}

export interface CloneVersionPayload {
  workspaceSlug: string;
  appSlug: string;
  versionId: string;
  name?: string;
  versionType?: 'budget' | 'forecast' | 'actuals';
}

export interface DeleteVersionPayload {
  workspaceSlug: string;
  appSlug: string;
  versionId: string;
}

// ------------------------------------------------------------------
// Query keys
// ------------------------------------------------------------------

export const versionKeys = {
  all: (ws: string, app: string) => ['versions', ws, app] as const,
};

// ------------------------------------------------------------------
// Queries
// ------------------------------------------------------------------

export function useVersions(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
  options?: Partial<UseQueryOptions<Version[]>>,
) {
  return useQuery<Version[]>({
    queryKey: versionKeys.all(workspaceSlug ?? '', appSlug ?? ''),
    queryFn: async () => {
      const res = await api.get<Version[]>(
        `/${workspaceSlug}/apps/${appSlug}/versions`,
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

export function useCreateVersion() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<Version>, Error, CreateVersionPayload>({
    mutationFn: ({ workspaceSlug, appSlug, ...body }) =>
      api.post<Version>(
        `/${workspaceSlug}/apps/${appSlug}/versions`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: versionKeys.all(variables.workspaceSlug, variables.appSlug),
      });
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

export function useUpdateVersion() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<Version>, Error, UpdateVersionPayload>({
    mutationFn: ({ workspaceSlug, appSlug, versionId, ...body }) =>
      api.patch<Version>(
        `/${workspaceSlug}/apps/${appSlug}/versions/${versionId}`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: versionKeys.all(variables.workspaceSlug, variables.appSlug),
      });
    },
  });
}

export function useCloneVersion() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<Version>, Error, CloneVersionPayload>({
    mutationFn: ({ workspaceSlug, appSlug, versionId, ...body }) =>
      api.post<Version>(
        `/${workspaceSlug}/apps/${appSlug}/versions/${versionId}/clone`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: versionKeys.all(variables.workspaceSlug, variables.appSlug),
      });
    },
  });
}

export function useDeleteVersion() {
  const qc = useQueryClient();

  return useMutation<ApiResponse, Error, DeleteVersionPayload>({
    mutationFn: ({ workspaceSlug, appSlug, versionId }) =>
      api.delete(
        `/${workspaceSlug}/apps/${appSlug}/versions/${versionId}`,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: versionKeys.all(variables.workspaceSlug, variables.appSlug),
      });
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}
