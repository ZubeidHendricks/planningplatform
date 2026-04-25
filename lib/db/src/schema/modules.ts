import { pgTable, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { applications } from './tenancy.js';

export const moduleRecords = pgTable('module_records', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  applicationId: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  moduleType: text('module_type', {
    enum: [
      'candidate', 'interview', 'job', 'leave_request', 'employee',
      'vehicle', 'driver', 'route', 'payload', 'fuel_record',
      'repair', 'part', 'tyre', 'fine', 'weighbridge',
      'training_course', 'certificate', 'survey_response',
      'document', 'compliance_item',
    ],
  }).notNull(),
  title: text('title').notNull(),
  status: text('status').default('active'),
  stage: text('stage'),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] }).default('medium'),
  assignedTo: text('assigned_to'),
  data: jsonb('data').$type<Record<string, unknown>>().default({}),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});
