// ---------------------------------------------------------------------------
// React Query hooks for AI and Analytics endpoints.
// ---------------------------------------------------------------------------

import {
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { useToastStore } from '@/stores/toast';
import { blockKeys } from '@/lib/hooks/use-blocks';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface ModelPlanDimension {
  name: string;
  slug: string;
  members: Array<{ name: string; code: string }>;
}

export interface ModelPlanBlock {
  name: string;
  slug: string;
  blockType: string;
  description: string;
  formula: string | null;
  formatType: string;
  dimensionSlugs: string[];
}

export interface ModelPlan {
  description: string;
  dimensions: ModelPlanDimension[];
  blocks: ModelPlanBlock[];
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKeys: string[];
}

export interface AnalysisHighlight {
  metric: string;
  value: number;
  insight: string;
}

export interface AnalysisResult {
  answer: string;
  chartConfig?: ChartConfig;
  highlights?: AnalysisHighlight[];
}

export interface FormulaResult {
  formula: string;
  explanation: string;
}

export interface ForecastResult {
  method: string;
  forecasted: number[];
  confidence: Array<{ lower: number; upper: number }>;
  accuracy: { mae: number; mape: number };
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonality: boolean;
}

export interface AnomalyEntry {
  index: number;
  value: number;
  expectedRange: { lower: number; upper: number };
  severity: 'low' | 'medium' | 'high';
  zscore: number;
  explanation: string;
}

export interface AnomalyResult {
  anomalies: AnomalyEntry[];
  stats: {
    mean: number;
    stddev: number;
    median: number;
    q1: number;
    q3: number;
    iqr: number;
  };
}

// ------------------------------------------------------------------
// Mutation payloads
// ------------------------------------------------------------------

interface GenerateModelPayload {
  workspaceSlug: string;
  appSlug: string;
  description: string;
}

interface ApplyModelPayload {
  workspaceSlug: string;
  appSlug: string;
  plan: ModelPlan;
}

interface AnalyzeDataPayload {
  workspaceSlug: string;
  appSlug: string;
  question: string;
}

interface SuggestFormulaPayload {
  workspaceSlug: string;
  appSlug: string;
  blockName: string;
  description: string;
}

interface ForecastPayload {
  workspaceSlug: string;
  appSlug: string;
  blockId: string;
  periods: number;
  method?: string;
}

interface DetectAnomaliesPayload {
  workspaceSlug: string;
  appSlug: string;
  blockId: string;
}

// ------------------------------------------------------------------
// Mutations
// ------------------------------------------------------------------

export function useGenerateModel() {
  return useMutation<ApiResponse<ModelPlan>, Error, GenerateModelPayload>({
    mutationFn: ({ workspaceSlug, appSlug, description }) =>
      api.post<ModelPlan>(
        `/${workspaceSlug}/apps/${appSlug}/ai/model`,
        { description },
      ),
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

export function useApplyModel() {
  const qc = useQueryClient();

  return useMutation<ApiResponse, Error, ApplyModelPayload>({
    mutationFn: ({ workspaceSlug, appSlug, plan }) =>
      api.post(
        `/${workspaceSlug}/apps/${appSlug}/ai/model/apply`,
        plan,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: blockKeys.all(variables.workspaceSlug, variables.appSlug),
      });
      useToastStore.getState().addToast('Model applied successfully', 'success');
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

export function useAnalyzeData() {
  return useMutation<ApiResponse<AnalysisResult>, Error, AnalyzeDataPayload>({
    mutationFn: ({ workspaceSlug, appSlug, question }) =>
      api.post<AnalysisResult>(
        `/${workspaceSlug}/apps/${appSlug}/ai/analyze`,
        { question },
      ),
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

export function useSuggestFormula() {
  return useMutation<ApiResponse<FormulaResult>, Error, SuggestFormulaPayload>({
    mutationFn: ({ workspaceSlug, appSlug, blockName, description }) =>
      api.post<FormulaResult>(
        `/${workspaceSlug}/apps/${appSlug}/ai/formula`,
        { blockName, description },
      ),
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

export function useForecast() {
  return useMutation<ApiResponse<ForecastResult>, Error, ForecastPayload>({
    mutationFn: ({ workspaceSlug, appSlug, blockId, periods, method }) =>
      api.post<ForecastResult>(
        `/${workspaceSlug}/apps/${appSlug}/analytics/forecast`,
        { blockId, periods, method },
      ),
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

export function useDetectAnomalies() {
  return useMutation<ApiResponse<AnomalyResult>, Error, DetectAnomaliesPayload>({
    mutationFn: ({ workspaceSlug, appSlug, blockId }) =>
      api.post<AnomalyResult>(
        `/${workspaceSlug}/apps/${appSlug}/analytics/anomalies`,
        { blockId },
      ),
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}
