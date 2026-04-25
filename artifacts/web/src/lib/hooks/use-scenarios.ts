import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';

export interface Scenario {
  id: string;
  name: string;
  description?: string | null;
  applicationId: string;
  baseVersionId: string;
  isActive: number;
  overrides: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScenarioPayload {
  workspaceSlug: string;
  appSlug: string;
  name: string;
  description?: string;
  baseVersionId: string;
}

export interface UpdateScenarioPayload {
  workspaceSlug: string;
  appSlug: string;
  scenarioId: string;
  name?: string;
  description?: string;
  isActive?: number;
  overrides?: Record<string, unknown>;
}

export interface DeleteScenarioPayload {
  workspaceSlug: string;
  appSlug: string;
  scenarioId: string;
}

export const scenarioKeys = {
  all: (ws: string, app: string) => ['scenarios', ws, app] as const,
};

export function useScenarios(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
  options?: Partial<UseQueryOptions<Scenario[]>>,
) {
  return useQuery<Scenario[]>({
    queryKey: scenarioKeys.all(workspaceSlug ?? '', appSlug ?? ''),
    queryFn: async () => {
      const res = await api.get<Scenario[]>(
        `/${workspaceSlug}/apps/${appSlug}/scenarios`,
      );
      return res.data ?? [];
    },
    enabled: !!workspaceSlug && !!appSlug,
    ...options,
  });
}

export function useCreateScenario() {
  const qc = useQueryClient();
  return useMutation<ApiResponse<Scenario>, Error, CreateScenarioPayload>({
    mutationFn: ({ workspaceSlug, appSlug, ...body }) =>
      api.post<Scenario>(`/${workspaceSlug}/apps/${appSlug}/scenarios`, body),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: scenarioKeys.all(variables.workspaceSlug, variables.appSlug),
      });
    },
  });
}

export function useUpdateScenario() {
  const qc = useQueryClient();
  return useMutation<ApiResponse<Scenario>, Error, UpdateScenarioPayload>({
    mutationFn: ({ workspaceSlug, appSlug, scenarioId, ...body }) =>
      api.patch<Scenario>(`/${workspaceSlug}/apps/${appSlug}/scenarios/${scenarioId}`, body),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: scenarioKeys.all(variables.workspaceSlug, variables.appSlug),
      });
    },
  });
}

export function useDeleteScenario() {
  const qc = useQueryClient();
  return useMutation<ApiResponse, Error, DeleteScenarioPayload>({
    mutationFn: ({ workspaceSlug, appSlug, scenarioId }) =>
      api.delete(`/${workspaceSlug}/apps/${appSlug}/scenarios/${scenarioId}`),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: scenarioKeys.all(variables.workspaceSlug, variables.appSlug),
      });
    },
  });
}
