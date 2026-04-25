// ---------------------------------------------------------------------------
// React Query hooks for the generic Modules resource (recruitment, etc.).
// ---------------------------------------------------------------------------

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { useToastStore } from '@/stores/toast';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface ModuleRecord {
  id: string;
  applicationId: string;
  moduleType: string;
  title: string;
  status: string;
  stage: string | null;
  priority: string;
  assignedTo: string | null;
  data: Record<string, unknown>;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModuleRecordsResponse {
  records: ModuleRecord[];
  total: number;
}

export interface ModuleStagesResponse {
  stages: Array<{ stage: string; count: number }>;
}

export interface CreateModulePayload {
  title: string;
  status?: string;
  stage?: string;
  priority?: string;
  assignedTo?: string;
  data?: Record<string, unknown>;
}

export interface UpdateModulePayload {
  id: string;
  title?: string;
  status?: string;
  stage?: string;
  priority?: string;
  assignedTo?: string;
  data?: Record<string, unknown>;
}

export interface UpdateStagePayload {
  id: string;
  stage: string;
}

// ------------------------------------------------------------------
// Query keys
// ------------------------------------------------------------------

export const moduleKeys = {
  all: (ws: string, app: string, mod: string) =>
    ['modules', ws, app, mod] as const,
  detail: (ws: string, app: string, mod: string, id: string) =>
    ['modules', ws, app, mod, id] as const,
  stages: (ws: string, app: string, mod: string) =>
    ['modules', ws, app, mod, 'stages'] as const,
};

// ------------------------------------------------------------------
// Helper – build base path
// ------------------------------------------------------------------

function basePath(ws: string, app: string, mod: string) {
  return `/${ws}/apps/${app}/modules/${mod}`;
}

// ------------------------------------------------------------------
// Queries
// ------------------------------------------------------------------

export function useModuleRecords(
  workspaceSlug: string,
  appSlug: string,
  moduleType: string,
  filters?: { status?: string; stage?: string; search?: string },
) {
  return useQuery<ModuleRecordsResponse>({
    queryKey: [...moduleKeys.all(workspaceSlug, appSlug, moduleType), filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.stage) params.set('stage', filters.stage);
      if (filters?.search) params.set('search', filters.search);
      const qs = params.toString();
      const path = basePath(workspaceSlug, appSlug, moduleType) + (qs ? `?${qs}` : '');
      const res = await api.get<ModuleRecordsResponse>(path);
      return res.data ?? { records: [], total: 0 };
    },
    enabled: !!workspaceSlug && !!appSlug && !!moduleType,
  });
}

export function useModuleRecord(
  workspaceSlug: string,
  appSlug: string,
  moduleType: string,
  id: string,
) {
  return useQuery<ModuleRecord>({
    queryKey: moduleKeys.detail(workspaceSlug, appSlug, moduleType, id),
    queryFn: async () => {
      const res = await api.get<ModuleRecord>(
        `${basePath(workspaceSlug, appSlug, moduleType)}/${id}`,
      );
      return res.data as ModuleRecord;
    },
    enabled: !!workspaceSlug && !!appSlug && !!moduleType && !!id,
  });
}

export function useModuleStages(
  workspaceSlug: string,
  appSlug: string,
  moduleType: string,
) {
  return useQuery<ModuleStagesResponse>({
    queryKey: moduleKeys.stages(workspaceSlug, appSlug, moduleType),
    queryFn: async () => {
      const res = await api.get<ModuleStagesResponse>(
        `${basePath(workspaceSlug, appSlug, moduleType)}/stages`,
      );
      return res.data ?? { stages: [] };
    },
    enabled: !!workspaceSlug && !!appSlug && !!moduleType,
  });
}

// ------------------------------------------------------------------
// Mutations
// ------------------------------------------------------------------

export function useCreateModuleRecord(
  workspaceSlug: string,
  appSlug: string,
  moduleType: string,
) {
  const qc = useQueryClient();

  return useMutation<ApiResponse<ModuleRecord>, Error, CreateModulePayload>({
    mutationFn: (body) =>
      api.post<ModuleRecord>(basePath(workspaceSlug, appSlug, moduleType), body),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: moduleKeys.all(workspaceSlug, appSlug, moduleType),
      });
      void qc.invalidateQueries({
        queryKey: moduleKeys.stages(workspaceSlug, appSlug, moduleType),
      });
      useToastStore.getState().addToast('Record created', 'success');
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

export function useUpdateModuleRecord(
  workspaceSlug: string,
  appSlug: string,
  moduleType: string,
) {
  const qc = useQueryClient();

  return useMutation<ApiResponse<ModuleRecord>, Error, UpdateModulePayload>({
    mutationFn: ({ id, ...body }) =>
      api.patch<ModuleRecord>(
        `${basePath(workspaceSlug, appSlug, moduleType)}/${id}`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: moduleKeys.all(workspaceSlug, appSlug, moduleType),
      });
      void qc.invalidateQueries({
        queryKey: moduleKeys.detail(
          workspaceSlug,
          appSlug,
          moduleType,
          variables.id,
        ),
      });
      void qc.invalidateQueries({
        queryKey: moduleKeys.stages(workspaceSlug, appSlug, moduleType),
      });
      useToastStore.getState().addToast('Record updated', 'success');
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

export function useDeleteModuleRecord(
  workspaceSlug: string,
  appSlug: string,
  moduleType: string,
) {
  const qc = useQueryClient();

  return useMutation<ApiResponse, Error, string>({
    mutationFn: (id) =>
      api.delete(`${basePath(workspaceSlug, appSlug, moduleType)}/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: moduleKeys.all(workspaceSlug, appSlug, moduleType),
      });
      void qc.invalidateQueries({
        queryKey: moduleKeys.stages(workspaceSlug, appSlug, moduleType),
      });
      useToastStore.getState().addToast('Record deleted', 'success');
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

export function useUpdateModuleStage(
  workspaceSlug: string,
  appSlug: string,
  moduleType: string,
) {
  const qc = useQueryClient();

  return useMutation<ApiResponse<ModuleRecord>, Error, UpdateStagePayload>({
    mutationFn: ({ id, stage }) =>
      api.patch<ModuleRecord>(
        `${basePath(workspaceSlug, appSlug, moduleType)}/${id}/stage`,
        { stage },
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: moduleKeys.all(workspaceSlug, appSlug, moduleType),
      });
      void qc.invalidateQueries({
        queryKey: moduleKeys.detail(
          workspaceSlug,
          appSlug,
          moduleType,
          variables.id,
        ),
      });
      void qc.invalidateQueries({
        queryKey: moduleKeys.stages(workspaceSlug, appSlug, moduleType),
      });
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}
