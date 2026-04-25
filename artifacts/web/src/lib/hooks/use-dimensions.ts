// ---------------------------------------------------------------------------
// React Query hooks for Dimensions, Dimension Members, and Block-Dimensions.
// ---------------------------------------------------------------------------

import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface Dimension {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  applicationId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DimensionMember {
  id: string;
  dimensionId: string;
  name: string;
  code?: string | null;
  parentId?: string | null;
  properties?: Record<string, unknown> | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface BlockDimension {
  id: string;
  blockId: string;
  dimensionId: string;
  sortOrder: number;
}

export interface CreateDimensionPayload {
  workspaceSlug: string;
  appSlug: string;
  name: string;
  slug: string;
  description?: string;
}

export interface CreateDimensionMemberPayload {
  workspaceSlug: string;
  appSlug: string;
  dimensionId: string;
  name: string;
  code?: string;
}

export interface AssignBlockDimensionPayload {
  workspaceSlug: string;
  appSlug: string;
  blockId: string;
  dimensionId: string;
}

// ------------------------------------------------------------------
// Query keys
// ------------------------------------------------------------------

export const dimensionKeys = {
  all: (ws: string, app: string) => ['dimensions', ws, app] as const,
  members: (ws: string, app: string, dimId: string) =>
    ['dimension-members', ws, app, dimId] as const,
  blockDimensions: (ws: string, app: string, blockId: string) =>
    ['block-dimensions', ws, app, blockId] as const,
};

// ------------------------------------------------------------------
// Queries
// ------------------------------------------------------------------

export function useDimensions(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
  options?: Partial<UseQueryOptions<Dimension[]>>,
) {
  return useQuery<Dimension[]>({
    queryKey: dimensionKeys.all(workspaceSlug ?? '', appSlug ?? ''),
    queryFn: async () => {
      const res = await api.get<Dimension[]>(
        `/${workspaceSlug}/apps/${appSlug}/dimensions`,
      );
      return res.data ?? [];
    },
    enabled: !!workspaceSlug && !!appSlug,
    ...options,
  });
}

export function useDimensionMembers(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
  dimensionId: string | undefined,
  options?: Partial<UseQueryOptions<DimensionMember[]>>,
) {
  return useQuery<DimensionMember[]>({
    queryKey: dimensionKeys.members(
      workspaceSlug ?? '',
      appSlug ?? '',
      dimensionId ?? '',
    ),
    queryFn: async () => {
      const res = await api.get<DimensionMember[]>(
        `/${workspaceSlug}/apps/${appSlug}/dimensions/${dimensionId}/members`,
      );
      return res.data ?? [];
    },
    enabled: !!workspaceSlug && !!appSlug && !!dimensionId,
    ...options,
  });
}

/**
 * Fetch dimension members for multiple dimensions in parallel.
 * Returns a map from dimensionId to its members array.
 */
export function useMultipleDimensionMembers(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
  dimensionIds: string[],
) {
  const results = useQueries({
    queries: dimensionIds.map((dimId) => ({
      queryKey: dimensionKeys.members(workspaceSlug ?? '', appSlug ?? '', dimId),
      queryFn: async () => {
        const res = await api.get<DimensionMember[]>(
          `/${workspaceSlug}/apps/${appSlug}/dimensions/${dimId}/members`,
        );
        return res.data ?? [];
      },
      enabled: !!workspaceSlug && !!appSlug && !!dimId,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const membersMap = new Map<string, DimensionMember[]>();
  for (let i = 0; i < dimensionIds.length; i++) {
    const data = results[i]?.data;
    if (Array.isArray(data)) {
      membersMap.set(dimensionIds[i]!, data);
    }
  }

  return { membersMap, isLoading };
}

export function useBlockDimensions(
  workspaceSlug: string | undefined,
  appSlug: string | undefined,
  blockId: string | undefined,
  options?: Partial<UseQueryOptions<BlockDimension[]>>,
) {
  return useQuery<BlockDimension[]>({
    queryKey: dimensionKeys.blockDimensions(
      workspaceSlug ?? '',
      appSlug ?? '',
      blockId ?? '',
    ),
    queryFn: async () => {
      const res = await api.get<BlockDimension[]>(
        `/${workspaceSlug}/apps/${appSlug}/blocks/${blockId}/dimensions`,
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

export function useCreateDimension() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<Dimension>, Error, CreateDimensionPayload>({
    mutationFn: ({ workspaceSlug, appSlug, ...body }) =>
      api.post<Dimension>(
        `/${workspaceSlug}/apps/${appSlug}/dimensions`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: dimensionKeys.all(
          variables.workspaceSlug,
          variables.appSlug,
        ),
      });
    },
  });
}

export function useCreateDimensionMember() {
  const qc = useQueryClient();

  return useMutation<
    ApiResponse<DimensionMember>,
    Error,
    CreateDimensionMemberPayload
  >({
    mutationFn: ({ workspaceSlug, appSlug, dimensionId, ...body }) =>
      api.post<DimensionMember>(
        `/${workspaceSlug}/apps/${appSlug}/dimensions/${dimensionId}/members`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: dimensionKeys.members(
          variables.workspaceSlug,
          variables.appSlug,
          variables.dimensionId,
        ),
      });
    },
  });
}

export function useAssignBlockDimension() {
  const qc = useQueryClient();

  return useMutation<
    ApiResponse<BlockDimension>,
    Error,
    AssignBlockDimensionPayload
  >({
    mutationFn: ({ workspaceSlug, appSlug, blockId, ...body }) =>
      api.post<BlockDimension>(
        `/${workspaceSlug}/apps/${appSlug}/blocks/${blockId}/dimensions`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: dimensionKeys.blockDimensions(
          variables.workspaceSlug,
          variables.appSlug,
          variables.blockId,
        ),
      });
    },
  });
}

export interface RemoveBlockDimensionPayload {
  workspaceSlug: string;
  appSlug: string;
  blockId: string;
  assignmentId: string;
}

export function useRemoveBlockDimension() {
  const qc = useQueryClient();

  return useMutation<ApiResponse, Error, RemoveBlockDimensionPayload>({
    mutationFn: ({ workspaceSlug, appSlug, blockId, assignmentId }) =>
      api.delete(
        `/${workspaceSlug}/apps/${appSlug}/blocks/${blockId}/dimensions/${assignmentId}`,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: dimensionKeys.blockDimensions(
          variables.workspaceSlug,
          variables.appSlug,
          variables.blockId,
        ),
      });
    },
  });
}
