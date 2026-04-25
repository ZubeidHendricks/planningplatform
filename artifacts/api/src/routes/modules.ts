import { Router } from 'express';
import { eq, and, ilike, sql, count } from 'drizzle-orm';
import { moduleRecords, applications } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { param } from '../middleware/params.js';

const VALID_MODULE_TYPES = [
  'candidate', 'interview', 'job', 'leave_request', 'employee',
  'vehicle', 'driver', 'route', 'payload', 'fuel_record',
  'repair', 'part', 'tyre', 'fine', 'weighbridge',
  'training_course', 'certificate', 'survey_response',
  'document', 'compliance_item',
] as const;

type ModuleType = (typeof VALID_MODULE_TYPES)[number];

function isValidModuleType(value: string): value is ModuleType {
  return (VALID_MODULE_TYPES as readonly string[]).includes(value);
}

export function createModulesRouter(db: Database): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  // Helper: resolve application from workspace + slug
  async function resolveApp(req: import('express').Request, res: import('express').Response) {
    const app = await db.query.applications.findFirst({
      where: and(
        eq(applications.workspaceId, req.workspaceId!),
        eq(applications.slug, param(req, 'appSlug')),
      ),
    });

    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return null;
    }

    return app;
  }

  // Helper: validate moduleType param
  function validateModuleType(req: import('express').Request, res: import('express').Response): ModuleType | null {
    const moduleType = param(req, 'moduleType');
    if (!isValidModuleType(moduleType)) {
      res.status(400).json({ success: false, error: `Invalid module type: ${moduleType}` });
      return null;
    }
    return moduleType;
  }

  // GET /:workspaceSlug/apps/:appSlug/modules/:moduleType/stages
  // Stage summary counts for kanban views
  // NOTE: This route must be registered BEFORE the /:id route to avoid "stages" matching as :id
  router.get('/:workspaceSlug/apps/:appSlug/modules/:moduleType/stages', tenant, async (req, res) => {
    const moduleType = validateModuleType(req, res);
    if (!moduleType) return;

    const app = await resolveApp(req, res);
    if (!app) return;

    const result = await db
      .select({
        stage: moduleRecords.stage,
        count: count(),
      })
      .from(moduleRecords)
      .where(
        and(
          eq(moduleRecords.applicationId, app.id),
          eq(moduleRecords.moduleType, moduleType),
        ),
      )
      .groupBy(moduleRecords.stage);

    const stages = result.map((r) => ({
      stage: r.stage ?? 'unassigned',
      count: Number(r.count),
    }));

    res.json({ success: true, data: { stages } });
  });

  // GET /:workspaceSlug/apps/:appSlug/modules/:moduleType
  // List records with optional filters and pagination
  router.get('/:workspaceSlug/apps/:appSlug/modules/:moduleType', tenant, async (req, res) => {
    const moduleType = validateModuleType(req, res);
    if (!moduleType) return;

    const app = await resolveApp(req, res);
    if (!app) return;

    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    const conditions = [
      eq(moduleRecords.applicationId, app.id),
      eq(moduleRecords.moduleType, moduleType),
    ];

    if (req.query.status) {
      conditions.push(eq(moduleRecords.status, req.query.status as string));
    }

    if (req.query.stage) {
      conditions.push(eq(moduleRecords.stage, req.query.stage as string));
    }

    if (req.query.priority) {
      conditions.push(eq(moduleRecords.priority, req.query.priority as 'low' | 'medium' | 'high' | 'urgent'));
    }

    if (req.query.assignedTo) {
      conditions.push(eq(moduleRecords.assignedTo, req.query.assignedTo as string));
    }

    if (req.query.search) {
      conditions.push(ilike(moduleRecords.title, `%${req.query.search as string}%`));
    }

    const whereClause = and(...conditions);

    const [records, totalResult] = await Promise.all([
      db
        .select()
        .from(moduleRecords)
        .where(whereClause)
        .orderBy(moduleRecords.sortOrder, moduleRecords.createdAt)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(moduleRecords)
        .where(whereClause),
    ]);

    res.json({
      success: true,
      data: {
        records,
        total: Number(totalResult[0]?.count ?? 0),
      },
    });
  });

  // POST /:workspaceSlug/apps/:appSlug/modules/:moduleType
  // Create a new record
  router.post('/:workspaceSlug/apps/:appSlug/modules/:moduleType', tenant, async (req, res) => {
    const moduleType = validateModuleType(req, res);
    if (!moduleType) return;

    const app = await resolveApp(req, res);
    if (!app) return;

    const { title, status, stage, priority, assignedTo, data, sortOrder } = req.body;

    if (!title || typeof title !== 'string') {
      res.status(400).json({ success: false, error: 'Title is required' });
      return;
    }

    const [record] = await db
      .insert(moduleRecords)
      .values({
        applicationId: app.id,
        moduleType,
        title,
        status: status ?? 'active',
        stage: stage ?? null,
        priority: priority ?? 'medium',
        assignedTo: assignedTo ?? null,
        data: data ?? {},
        sortOrder: sortOrder ?? 0,
        createdBy: req.auth?.userId ?? null,
      })
      .returning();

    res.status(201).json({ success: true, data: record });
  });

  // GET /:workspaceSlug/apps/:appSlug/modules/:moduleType/:id
  // Get a single record
  router.get('/:workspaceSlug/apps/:appSlug/modules/:moduleType/:id', tenant, async (req, res) => {
    const moduleType = validateModuleType(req, res);
    if (!moduleType) return;

    const app = await resolveApp(req, res);
    if (!app) return;

    const record = await db.query.moduleRecords.findFirst({
      where: and(
        eq(moduleRecords.id, param(req, 'id')),
        eq(moduleRecords.applicationId, app.id),
        eq(moduleRecords.moduleType, moduleType),
      ),
    });

    if (!record) {
      res.status(404).json({ success: false, error: 'Record not found' });
      return;
    }

    res.json({ success: true, data: record });
  });

  // PATCH /:workspaceSlug/apps/:appSlug/modules/:moduleType/:id
  // Update a record
  router.patch('/:workspaceSlug/apps/:appSlug/modules/:moduleType/:id', tenant, async (req, res) => {
    const moduleType = validateModuleType(req, res);
    if (!moduleType) return;

    const app = await resolveApp(req, res);
    if (!app) return;

    const { title, status, stage, priority, assignedTo, data, sortOrder } = req.body;

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (status !== undefined) updates.status = status;
    if (stage !== undefined) updates.stage = stage;
    if (priority !== undefined) updates.priority = priority;
    if (assignedTo !== undefined) updates.assignedTo = assignedTo;
    if (data !== undefined) updates.data = data;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: 'No fields to update' });
      return;
    }

    const [updated] = await db
      .update(moduleRecords)
      .set(updates)
      .where(
        and(
          eq(moduleRecords.id, param(req, 'id')),
          eq(moduleRecords.applicationId, app.id),
          eq(moduleRecords.moduleType, moduleType),
        ),
      )
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'Record not found' });
      return;
    }

    res.json({ success: true, data: updated });
  });

  // DELETE /:workspaceSlug/apps/:appSlug/modules/:moduleType/:id
  // Delete a record
  router.delete('/:workspaceSlug/apps/:appSlug/modules/:moduleType/:id', tenant, async (req, res) => {
    const moduleType = validateModuleType(req, res);
    if (!moduleType) return;

    const app = await resolveApp(req, res);
    if (!app) return;

    const [deleted] = await db
      .delete(moduleRecords)
      .where(
        and(
          eq(moduleRecords.id, param(req, 'id')),
          eq(moduleRecords.applicationId, app.id),
          eq(moduleRecords.moduleType, moduleType),
        ),
      )
      .returning();

    if (!deleted) {
      res.status(404).json({ success: false, error: 'Record not found' });
      return;
    }

    res.json({ success: true, data: deleted });
  });

  // PATCH /:workspaceSlug/apps/:appSlug/modules/:moduleType/:id/stage
  // Move a record to a new stage (for kanban drag-and-drop)
  router.patch('/:workspaceSlug/apps/:appSlug/modules/:moduleType/:id/stage', tenant, async (req, res) => {
    const moduleType = validateModuleType(req, res);
    if (!moduleType) return;

    const app = await resolveApp(req, res);
    if (!app) return;

    const { stage } = req.body;

    if (stage === undefined || typeof stage !== 'string') {
      res.status(400).json({ success: false, error: 'Stage is required and must be a string' });
      return;
    }

    const [updated] = await db
      .update(moduleRecords)
      .set({ stage })
      .where(
        and(
          eq(moduleRecords.id, param(req, 'id')),
          eq(moduleRecords.applicationId, app.id),
          eq(moduleRecords.moduleType, moduleType),
        ),
      )
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'Record not found' });
      return;
    }

    res.json({ success: true, data: updated });
  });

  return router;
}
