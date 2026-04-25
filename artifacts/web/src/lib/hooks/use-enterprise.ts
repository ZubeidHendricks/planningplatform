// ---------------------------------------------------------------------------
// React Query hooks for Phase 4 Enterprise features:
// Permissions, Audit Logs, Workflows, Environments, Branding
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

export interface AppPermission {
  id: string;
  applicationId: string;
  userId: string;
  userEmail?: string;
  role: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

export interface Workflow {
  id: string;
  applicationId: string;
  name: string;
  description?: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  actionType: string;
  actionConfig: Record<string, unknown>;
  isActive: number;
  lastRunAt?: string;
  createdAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: string;
  triggerData: Record<string, unknown>;
  result: Record<string, unknown>;
  durationMs?: number;
  createdAt: string;
}

export interface Environment {
  id: string;
  applicationId: string;
  name: string;
  slug: string;
  isDefault: number;
  promotedAt?: string;
  createdAt: string;
}

export interface WorkspaceBranding {
  brandLogo?: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandCompanyName?: string;
}

// ------------------------------------------------------------------
// Query keys
// ------------------------------------------------------------------

export const enterpriseKeys = {
  permissions: (ws: string, app: string) =>
    ['permissions', ws, app] as const,
  auditLogs: (ws: string, params?: AuditLogParams) =>
    ['audit-logs', ws, params] as const,
  workflows: (ws: string, app: string) =>
    ['workflows', ws, app] as const,
  workflowRuns: (ws: string, app: string, workflowId: string) =>
    ['workflow-runs', ws, app, workflowId] as const,
  environments: (ws: string, app: string) =>
    ['environments', ws, app] as const,
  branding: (ws: string) =>
    ['branding', ws] as const,
};

// ------------------------------------------------------------------
// Params
// ------------------------------------------------------------------

export interface AuditLogParams {
  page?: number;
  limit?: number;
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  userEmail?: string;
}

// ------------------------------------------------------------------
// Queries
// ------------------------------------------------------------------

export function useAppPermissions(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
) {
  return useQuery<AppPermission[]>({
    queryKey: enterpriseKeys.permissions(workspaceSlug ?? '', appSlug ?? ''),
    queryFn: async () => {
      const res = await api.get<AppPermission[]>(
        `/${workspaceSlug}/apps/${appSlug}/permissions`,
      );
      return res.data ?? [];
    },
    enabled: !!workspaceSlug && !!appSlug,
  });
}

export function useAuditLogs(
  workspaceSlug: string | undefined,
  params?: AuditLogParams,
) {
  return useQuery<AuditLogResponse>({
    queryKey: enterpriseKeys.auditLogs(workspaceSlug ?? '', params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.action) searchParams.set('action', params.action);
      if (params?.resourceType) searchParams.set('resourceType', params.resourceType);
      if (params?.startDate) searchParams.set('startDate', params.startDate);
      if (params?.endDate) searchParams.set('endDate', params.endDate);
      if (params?.userEmail) searchParams.set('userEmail', params.userEmail);
      const qs = searchParams.toString();
      const res = await api.get<AuditLogResponse>(
        `/${workspaceSlug}/audit${qs ? `?${qs}` : ''}`,
      );
      return res.data ?? { logs: [], total: 0, page: 1, limit: 50 };
    },
    enabled: !!workspaceSlug,
  });
}

export function useWorkflows(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
) {
  return useQuery<Workflow[]>({
    queryKey: enterpriseKeys.workflows(workspaceSlug ?? '', appSlug ?? ''),
    queryFn: async () => {
      const res = await api.get<Workflow[]>(
        `/${workspaceSlug}/apps/${appSlug}/workflows`,
      );
      return res.data ?? [];
    },
    enabled: !!workspaceSlug && !!appSlug,
  });
}

export function useWorkflowRuns(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
  workflowId: string | undefined,
) {
  return useQuery<WorkflowRun[]>({
    queryKey: enterpriseKeys.workflowRuns(
      workspaceSlug ?? '',
      appSlug ?? '',
      workflowId ?? '',
    ),
    queryFn: async () => {
      const res = await api.get<WorkflowRun[]>(
        `/${workspaceSlug}/apps/${appSlug}/workflows/${workflowId}/runs`,
      );
      return res.data ?? [];
    },
    enabled: !!workspaceSlug && !!appSlug && !!workflowId,
  });
}

export function useEnvironments(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
) {
  return useQuery<Environment[]>({
    queryKey: enterpriseKeys.environments(workspaceSlug ?? '', appSlug ?? ''),
    queryFn: async () => {
      const res = await api.get<Environment[]>(
        `/${workspaceSlug}/apps/${appSlug}/environments`,
      );
      return res.data ?? [];
    },
    enabled: !!workspaceSlug && !!appSlug,
  });
}

// ------------------------------------------------------------------
// Mutations — Permissions
// ------------------------------------------------------------------

interface GrantPermissionPayload {
  workspaceSlug: string;
  appSlug: string;
  userId: string;
  role: string;
}

export function useGrantPermission() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<AppPermission>, Error, GrantPermissionPayload>({
    mutationFn: ({ workspaceSlug, appSlug, ...body }) =>
      api.post<AppPermission>(
        `/${workspaceSlug}/apps/${appSlug}/permissions`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: enterpriseKeys.permissions(
          variables.workspaceSlug,
          variables.appSlug,
        ),
      });
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

interface UpdatePermissionPayload {
  workspaceSlug: string;
  appSlug: string;
  permissionId: string;
  role: string;
}

export function useUpdatePermission() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<AppPermission>, Error, UpdatePermissionPayload>({
    mutationFn: ({ workspaceSlug, appSlug, permissionId, ...body }) =>
      api.patch<AppPermission>(
        `/${workspaceSlug}/apps/${appSlug}/permissions/${permissionId}`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: enterpriseKeys.permissions(
          variables.workspaceSlug,
          variables.appSlug,
        ),
      });
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

interface RevokePermissionPayload {
  workspaceSlug: string;
  appSlug: string;
  permissionId: string;
}

export function useRevokePermission() {
  const qc = useQueryClient();

  return useMutation<ApiResponse, Error, RevokePermissionPayload>({
    mutationFn: ({ workspaceSlug, appSlug, permissionId }) =>
      api.delete(
        `/${workspaceSlug}/apps/${appSlug}/permissions/${permissionId}`,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: enterpriseKeys.permissions(
          variables.workspaceSlug,
          variables.appSlug,
        ),
      });
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

// ------------------------------------------------------------------
// Mutations — Workflows
// ------------------------------------------------------------------

interface CreateWorkflowPayload {
  workspaceSlug: string;
  appSlug: string;
  name: string;
  description?: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  actionType: string;
  actionConfig: Record<string, unknown>;
}

export function useCreateWorkflow() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<Workflow>, Error, CreateWorkflowPayload>({
    mutationFn: ({ workspaceSlug, appSlug, ...body }) =>
      api.post<Workflow>(
        `/${workspaceSlug}/apps/${appSlug}/workflows`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: enterpriseKeys.workflows(
          variables.workspaceSlug,
          variables.appSlug,
        ),
      });
      useToastStore.getState().addToast('Workflow created', 'success');
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

interface UpdateWorkflowPayload {
  workspaceSlug: string;
  appSlug: string;
  workflowId: string;
  name?: string;
  description?: string;
  triggerType?: string;
  triggerConfig?: Record<string, unknown>;
  actionType?: string;
  actionConfig?: Record<string, unknown>;
  isActive?: number;
}

export function useUpdateWorkflow() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<Workflow>, Error, UpdateWorkflowPayload>({
    mutationFn: ({ workspaceSlug, appSlug, workflowId, ...body }) =>
      api.patch<Workflow>(
        `/${workspaceSlug}/apps/${appSlug}/workflows/${workflowId}`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: enterpriseKeys.workflows(
          variables.workspaceSlug,
          variables.appSlug,
        ),
      });
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

interface DeleteWorkflowPayload {
  workspaceSlug: string;
  appSlug: string;
  workflowId: string;
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();

  return useMutation<ApiResponse, Error, DeleteWorkflowPayload>({
    mutationFn: ({ workspaceSlug, appSlug, workflowId }) =>
      api.delete(
        `/${workspaceSlug}/apps/${appSlug}/workflows/${workflowId}`,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: enterpriseKeys.workflows(
          variables.workspaceSlug,
          variables.appSlug,
        ),
      });
      useToastStore.getState().addToast('Workflow deleted', 'success');
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

interface RunWorkflowPayload {
  workspaceSlug: string;
  appSlug: string;
  workflowId: string;
}

export function useRunWorkflow() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<WorkflowRun>, Error, RunWorkflowPayload>({
    mutationFn: ({ workspaceSlug, appSlug, workflowId }) =>
      api.post<WorkflowRun>(
        `/${workspaceSlug}/apps/${appSlug}/workflows/${workflowId}/run`,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: enterpriseKeys.workflows(
          variables.workspaceSlug,
          variables.appSlug,
        ),
      });
      void qc.invalidateQueries({
        queryKey: enterpriseKeys.workflowRuns(
          variables.workspaceSlug,
          variables.appSlug,
          variables.workflowId,
        ),
      });
      useToastStore.getState().addToast('Workflow triggered', 'success');
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

// ------------------------------------------------------------------
// Mutations — Environments
// ------------------------------------------------------------------

interface CreateEnvironmentPayload {
  workspaceSlug: string;
  appSlug: string;
  name: string;
}

export function useCreateEnvironment() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<Environment>, Error, CreateEnvironmentPayload>({
    mutationFn: ({ workspaceSlug, appSlug, ...body }) =>
      api.post<Environment>(
        `/${workspaceSlug}/apps/${appSlug}/environments`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: enterpriseKeys.environments(
          variables.workspaceSlug,
          variables.appSlug,
        ),
      });
      useToastStore.getState().addToast('Environment created', 'success');
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

interface PromoteEnvironmentPayload {
  workspaceSlug: string;
  appSlug: string;
  environmentId: string;
}

export function usePromoteEnvironment() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<Environment>, Error, PromoteEnvironmentPayload>({
    mutationFn: ({ workspaceSlug, appSlug, environmentId }) =>
      api.post<Environment>(
        `/${workspaceSlug}/apps/${appSlug}/environments/${environmentId}/promote`,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: enterpriseKeys.environments(
          variables.workspaceSlug,
          variables.appSlug,
        ),
      });
      useToastStore.getState().addToast('Environment promoted', 'success');
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

interface DeleteEnvironmentPayload {
  workspaceSlug: string;
  appSlug: string;
  environmentId: string;
}

export function useDeleteEnvironment() {
  const qc = useQueryClient();

  return useMutation<ApiResponse, Error, DeleteEnvironmentPayload>({
    mutationFn: ({ workspaceSlug, appSlug, environmentId }) =>
      api.delete(
        `/${workspaceSlug}/apps/${appSlug}/environments/${environmentId}`,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: enterpriseKeys.environments(
          variables.workspaceSlug,
          variables.appSlug,
        ),
      });
      useToastStore.getState().addToast('Environment deleted', 'success');
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

// ------------------------------------------------------------------
// Mutations — Branding
// ------------------------------------------------------------------

interface UpdateBrandingPayload {
  workspaceSlug: string;
  brandLogo?: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandCompanyName?: string;
}

export function useUpdateBranding() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<WorkspaceBranding>, Error, UpdateBrandingPayload>({
    mutationFn: ({ workspaceSlug, ...body }) =>
      api.patch<WorkspaceBranding>(
        `/${workspaceSlug}/settings/branding`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: enterpriseKeys.branding(variables.workspaceSlug),
      });
      void qc.invalidateQueries({
        queryKey: ['workspace-settings', variables.workspaceSlug],
      });
      useToastStore.getState().addToast('Branding updated', 'success');
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}
