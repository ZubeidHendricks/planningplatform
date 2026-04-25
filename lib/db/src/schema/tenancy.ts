import { pgTable, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logoUrl: text('logo_url'),
  brandLogo: text('brand_logo'),
  brandPrimaryColor: text('brand_primary_color').default('#3b82f6'),
  brandSecondaryColor: text('brand_secondary_color').default('#6366f1'),
  brandCompanyName: text('brand_company_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const workspaceMembers = pgTable('workspace_members', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'admin', 'editor', 'viewer'] }).notNull().default('viewer'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const applications = pgTable('applications', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  icon: text('icon'),
  templateId: text('template_id'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const appPermissions = pgTable('app_permissions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  applicationId: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'editor', 'viewer', 'none'] }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  userEmail: text('user_email').notNull(),
  action: text('action', {
    enum: ['create', 'update', 'delete', 'import', 'export', 'login', 'permission_change'],
  }).notNull(),
  resourceType: text('resource_type', {
    enum: ['application', 'block', 'cell', 'dimension', 'board', 'version', 'scenario', 'view', 'comment', 'member', 'workspace', 'workflow'],
  }).notNull(),
  resourceId: text('resource_id'),
  resourceName: text('resource_name'),
  details: jsonb('details').$type<Record<string, unknown>>(),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
