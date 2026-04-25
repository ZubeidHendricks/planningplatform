import { pgTable, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { blocks } from './blocks.js';
import { applications, users } from './tenancy.js';

export const views = pgTable('views', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  blockId: text('block_id').notNull().references(() => blocks.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isDefault: integer('is_default').default(0).notNull(),
  pivotConfig: jsonb('pivot_config').notNull().$type<{
    rows: string[];
    columns: string[];
    pages: string[];
    filters: Record<string, string[]>;
  }>(),
  formatting: jsonb('formatting').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const boards = pgTable('boards', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  applicationId: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  layout: jsonb('layout').$type<BoardWidget[]>().default([]),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

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

export const scenarios = pgTable('scenarios', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  applicationId: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  baseVersionId: text('base_version_id'),
  isActive: integer('is_active').default(1).notNull(),
  overrides: jsonb('overrides').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const versions = pgTable('versions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  applicationId: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  versionType: text('version_type', {
    enum: ['budget', 'forecast', 'actuals'],
  }).notNull(),
  parentVersionId: text('parent_version_id'),
  isLocked: integer('is_locked').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const comments = pgTable('comments', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  applicationId: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetType: text('target_type', {
    enum: ['block', 'board', 'cell'],
  }).notNull(),
  targetId: text('target_id').notNull(),
  parentCommentId: text('parent_comment_id'),
  body: text('body').notNull(),
  mentions: jsonb('mentions').$type<string[]>().default([]),
  isResolved: integer('is_resolved').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', {
    enum: ['mention', 'reply', 'comment', 'system'],
  }).notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  link: text('link'),
  isRead: integer('is_read').default(0),
  sourceUserId: text('source_user_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Workflow Automation
// ---------------------------------------------------------------------------

export const workflows = pgTable('workflows', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  applicationId: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  triggerType: text('trigger_type', {
    enum: ['cell_change', 'version_lock', 'schedule', 'manual'],
  }).notNull(),
  triggerConfig: jsonb('trigger_config').$type<Record<string, unknown>>().default({}),
  actionType: text('action_type', {
    enum: ['notify', 'email', 'webhook'],
  }).notNull(),
  actionConfig: jsonb('action_config').$type<Record<string, unknown>>().default({}),
  isActive: integer('is_active').default(1).notNull(),
  lastRunAt: timestamp('last_run_at'),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const workflowRuns = pgTable('workflow_runs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workflowId: text('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  status: text('status', {
    enum: ['success', 'failure', 'skipped'],
  }).notNull(),
  triggerData: jsonb('trigger_data').$type<Record<string, unknown>>().default({}),
  result: jsonb('result').$type<Record<string, unknown>>().default({}),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
