import { pgTable, text, timestamp, integer, jsonb, boolean, doublePrecision } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { applications } from './tenancy.js';

export const blocks = pgTable('blocks', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  applicationId: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  blockType: text('block_type', {
    enum: ['metric', 'dimension_list', 'transaction_list', 'table'],
  }).notNull(),
  description: text('description'),
  formula: text('formula'),
  formatType: text('format_type', {
    enum: ['number', 'currency', 'percentage', 'date', 'text', 'boolean'],
  }).default('number'),
  formatOptions: jsonb('format_options').$type<Record<string, unknown>>(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const dimensions = pgTable('dimensions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  applicationId: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const dimensionMembers = pgTable('dimension_members', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  dimensionId: text('dimension_id').notNull().references(() => dimensions.id, { onDelete: 'cascade' }),
  parentId: text('parent_id'),
  name: text('name').notNull(),
  code: text('code'),
  properties: jsonb('properties').$type<Record<string, unknown>>(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const blockDimensions = pgTable('block_dimensions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  blockId: text('block_id').notNull().references(() => blocks.id, { onDelete: 'cascade' }),
  dimensionId: text('dimension_id').notNull().references(() => dimensions.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').default(0).notNull(),
});

export const cells = pgTable('cells', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  blockId: text('block_id').notNull().references(() => blocks.id, { onDelete: 'cascade' }),
  coordinates: jsonb('coordinates').notNull().$type<Record<string, string>>(),
  numericValue: doublePrecision('numeric_value'),
  textValue: text('text_value'),
  booleanValue: boolean('boolean_value'),
  isInput: boolean('is_input').default(false).notNull(),
  versionId: text('version_id'),
  environmentId: text('environment_id'),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const blockDependencies = pgTable('block_dependencies', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  blockId: text('block_id').notNull().references(() => blocks.id, { onDelete: 'cascade' }),
  dependsOnBlockId: text('depends_on_block_id').notNull().references(() => blocks.id, { onDelete: 'cascade' }),
});

export const environments = pgTable('environments', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  applicationId: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  isDefault: integer('is_default').default(0),
  sourceEnvironmentId: text('source_environment_id'),
  promotedAt: timestamp('promoted_at'),
  promotedBy: text('promoted_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});
