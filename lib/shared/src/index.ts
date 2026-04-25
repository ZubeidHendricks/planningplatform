import { z } from 'zod';

export const blockTypeSchema = z.enum(['metric', 'dimension_list', 'transaction_list', 'table']);
export type BlockType = z.infer<typeof blockTypeSchema>;

export const formatTypeSchema = z.enum(['number', 'currency', 'percentage', 'date', 'text', 'boolean']);
export type FormatType = z.infer<typeof formatTypeSchema>;

export const memberRoleSchema = z.enum(['owner', 'admin', 'editor', 'viewer']);
export type MemberRole = z.infer<typeof memberRoleSchema>;

export const versionTypeSchema = z.enum(['budget', 'forecast', 'actuals']);
export type VersionType = z.infer<typeof versionTypeSchema>;

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

export const createApplicationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
});

export const createBlockSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  blockType: blockTypeSchema,
  description: z.string().max(1000).optional(),
  formula: z.string().max(10000).optional(),
  formatType: formatTypeSchema.optional(),
});

export const updateBlockFormulaSchema = z.object({
  formula: z.string().max(10000),
});

export const createDimensionSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
});

export const createDimensionMemberSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().max(50).optional(),
  parentId: z.string().optional(),
  properties: z.record(z.unknown()).optional(),
});

export const setCellValueSchema = z.object({
  blockId: z.string(),
  coordinates: z.record(z.string()),
  value: z.union([z.number(), z.string(), z.boolean(), z.null()]),
});

export const updateApplicationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  icon: z.string().max(100).optional(),
});

export const assignBlockDimensionSchema = z.object({
  dimensionId: z.string(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createViewSchema = z.object({
  blockId: z.string(),
  name: z.string().min(1).max(255),
  isDefault: z.number().int().min(0).max(1).optional(),
  pivotConfig: z.object({
    rows: z.array(z.string()),
    columns: z.array(z.string()),
    pages: z.array(z.string()),
    filters: z.record(z.array(z.string())),
  }),
  formatting: z.record(z.unknown()).optional(),
});

export const updateViewSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isDefault: z.number().int().min(0).max(1).optional(),
  pivotConfig: z.object({
    rows: z.array(z.string()),
    columns: z.array(z.string()),
    pages: z.array(z.string()),
    filters: z.record(z.array(z.string())),
  }).optional(),
  formatting: z.record(z.unknown()).optional(),
});

export const widgetSchema = z.object({
  id: z.string(),
  type: z.enum(['grid', 'chart', 'kpi', 'text', 'action']),
  title: z.string().min(1).max(255),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  config: z.record(z.unknown()),
});

export const createBoardSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
  layout: z.array(widgetSchema).optional(),
});

export const updateBoardLayoutSchema = z.object({
  layout: z.array(widgetSchema),
});

export const createVersionSchema = z.object({
  name: z.string().min(1).max(255),
  versionType: versionTypeSchema,
  parentVersionId: z.string().optional(),
});

export const updateVersionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isLocked: z.number().int().min(0).max(1).optional(),
});

export const createScenarioSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  baseVersionId: z.string().optional(),
});

export const updateScenarioSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  isActive: z.number().int().min(0).max(1).optional(),
  overrides: z.record(z.unknown()).optional(),
});

export const deployTemplateSchema = z.object({
  templateId: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  workspaceName: z.string().min(1).max(255),
  workspaceSlug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const createCommentSchema = z.object({
  targetType: z.enum(['block', 'board', 'cell']),
  targetId: z.string(),
  parentCommentId: z.string().optional(),
  body: z.string().min(1).max(10000),
  mentions: z.array(z.string()).optional(),
});

export const updateCommentSchema = z.object({
  body: z.string().min(1).max(10000).optional(),
  isResolved: z.number().int().min(0).max(1).optional(),
});

// ---------------------------------------------------------------------------
// AI Schemas
// ---------------------------------------------------------------------------

export const aiGenerateModelSchema = z.object({
  description: z.string().min(1).max(5000),
});

const modelPlanDimensionSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  members: z.array(
    z.object({
      name: z.string().min(1).max(255),
      code: z.string().max(50),
    }),
  ),
});

const modelPlanBlockSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  blockType: blockTypeSchema,
  description: z.string().max(1000),
  formula: z.string().max(10000).nullable(),
  formatType: z.enum(['number', 'currency', 'percentage']),
  dimensionSlugs: z.array(z.string()),
});

export const aiApplyModelSchema = z.object({
  description: z.string().max(5000).optional(),
  dimensions: z.array(modelPlanDimensionSchema),
  blocks: z.array(modelPlanBlockSchema),
});

export const aiAnalyzeSchema = z.object({
  question: z.string().min(1).max(2000),
});

export const aiFormulaSchema = z.object({
  blockName: z.string().min(1).max(255),
  description: z.string().min(1).max(2000),
});

export const aiNavigateSchema = z.object({
  query: z.string().min(1).max(500),
});

export const chartConfigSchema = z.object({
  type: z.enum(['bar', 'line', 'pie', 'area']),
  title: z.string(),
  data: z.array(z.record(z.union([z.string(), z.number()]))),
  xKey: z.string(),
  yKeys: z.array(z.string()),
});

export const analysisHighlightSchema = z.object({
  metric: z.string(),
  value: z.number(),
  insight: z.string(),
});

export const analysisResultSchema = z.object({
  answer: z.string(),
  chartConfig: chartConfigSchema.optional(),
  highlights: z.array(analysisHighlightSchema).optional(),
});

export const navigationIntentSchema = z.object({
  type: z.enum(['app', 'block', 'board', 'dashboard']),
  slug: z.string().optional(),
  appSlug: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

// ---------------------------------------------------------------------------
// Analytics Schemas — Forecasting & Anomaly Detection
// ---------------------------------------------------------------------------

export const forecastMethodSchema = z.enum(['linear', 'moving_average', 'exponential_smoothing']);
export type ForecastMethod = z.infer<typeof forecastMethodSchema>;

export const forecastRequestSchema = z.object({
  blockId: z.string().min(1),
  dimensionFilters: z.record(z.string()).optional(),
  periods: z.number().int().min(1).max(120),
  method: forecastMethodSchema.optional(),
});

export const anomalyRequestSchema = z.object({
  blockId: z.string().min(1),
  dimensionFilters: z.record(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Permissions & Audit Schemas
// ---------------------------------------------------------------------------

export const appPermissionRoleSchema = z.enum(['owner', 'editor', 'viewer', 'none']);
export type AppPermissionRole = z.infer<typeof appPermissionRoleSchema>;

export const grantPermissionSchema = z.object({
  userId: z.string().min(1),
  role: appPermissionRoleSchema,
});

export const updatePermissionSchema = z.object({
  role: appPermissionRoleSchema,
});

export const auditLogFilterSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  userId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Workflow Automation Schemas
// ---------------------------------------------------------------------------

export const triggerTypeSchema = z.enum(['cell_change', 'version_lock', 'schedule', 'manual']);
export type TriggerType = z.infer<typeof triggerTypeSchema>;

export const actionTypeSchema = z.enum(['notify', 'email', 'webhook']);
export type ActionType = z.infer<typeof actionTypeSchema>;

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  triggerType: triggerTypeSchema,
  triggerConfig: z.record(z.unknown()).optional(),
  actionType: actionTypeSchema,
  actionConfig: z.record(z.unknown()).optional(),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  triggerType: triggerTypeSchema.optional(),
  triggerConfig: z.record(z.unknown()).optional(),
  actionType: actionTypeSchema.optional(),
  actionConfig: z.record(z.unknown()).optional(),
  isActive: z.number().int().min(0).max(1).optional(),
});

// ---------------------------------------------------------------------------
// Branding Schemas
// ---------------------------------------------------------------------------

export const updateBrandingSchema = z.object({
  brandLogo: z.string().max(50000).optional(),
  brandPrimaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').optional(),
  brandSecondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').optional(),
  brandCompanyName: z.string().max(255).optional(),
});

// ---------------------------------------------------------------------------
// Environment Schemas
// ---------------------------------------------------------------------------

export const createEnvironmentSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

export const promoteEnvironmentSchema = z.object({
  targetEnvironmentId: z.string().min(1),
});
