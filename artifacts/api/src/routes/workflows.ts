import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { workflows, workflowRuns, applications } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { createWorkflowSchema, updateWorkflowSchema } from '@planning-platform/shared';
import { WorkflowEngine } from '../services/workflow-engine.js';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { param } from '../middleware/params.js';

export function createWorkflowsRouter(db: Database): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);
  const engine = new WorkflowEngine(db);

  router.use(authMiddleware);

  // -----------------------------------------------------------------------
  // Helper: resolve application from workspace + slug
  // -----------------------------------------------------------------------
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

  // -----------------------------------------------------------------------
  // GET /:ws/apps/:app/workflows — list workflows
  // -----------------------------------------------------------------------
  router.get('/:workspaceSlug/apps/:appSlug/workflows', tenant, async (req, res) => {
    const app = await resolveApp(req, res);
    if (!app) return;

    const result = await db.query.workflows.findMany({
      where: eq(workflows.applicationId, app.id),
      orderBy: (w, { desc: d }) => [d(w.createdAt)],
    });

    res.json({ success: true, data: result });
  });

  // -----------------------------------------------------------------------
  // POST /:ws/apps/:app/workflows — create workflow
  // -----------------------------------------------------------------------
  router.post('/:workspaceSlug/apps/:appSlug/workflows', tenant, async (req, res) => {
    const parsed = createWorkflowSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const app = await resolveApp(req, res);
    if (!app) return;

    const [workflow] = await db.insert(workflows).values({
      applicationId: app.id,
      createdBy: req.auth!.userId,
      ...parsed.data,
    }).returning();

    res.status(201).json({ success: true, data: workflow });
  });

  // -----------------------------------------------------------------------
  // PATCH /:ws/apps/:app/workflows/:workflowId — update workflow
  // -----------------------------------------------------------------------
  router.patch('/:workspaceSlug/apps/:appSlug/workflows/:workflowId', tenant, async (req, res) => {
    const parsed = updateWorkflowSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const workflowId = param(req, 'workflowId');
    const existing = await db.query.workflows.findFirst({ where: eq(workflows.id, workflowId) });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Workflow not found' });
      return;
    }

    const [updated] = await db.update(workflows)
      .set(parsed.data)
      .where(eq(workflows.id, workflowId))
      .returning();

    res.json({ success: true, data: updated });
  });

  // -----------------------------------------------------------------------
  // DELETE /:ws/apps/:app/workflows/:workflowId — delete workflow
  // -----------------------------------------------------------------------
  router.delete('/:workspaceSlug/apps/:appSlug/workflows/:workflowId', tenant, async (req, res) => {
    const workflowId = param(req, 'workflowId');
    const existing = await db.query.workflows.findFirst({ where: eq(workflows.id, workflowId) });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Workflow not found' });
      return;
    }

    const [deleted] = await db.delete(workflows).where(eq(workflows.id, workflowId)).returning();
    res.json({ success: true, data: deleted });
  });

  // -----------------------------------------------------------------------
  // POST /:ws/apps/:app/workflows/:workflowId/run — manually trigger
  // -----------------------------------------------------------------------
  router.post('/:workspaceSlug/apps/:appSlug/workflows/:workflowId/run', tenant, async (req, res) => {
    const workflowId = param(req, 'workflowId');
    const existing = await db.query.workflows.findFirst({ where: eq(workflows.id, workflowId) });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Workflow not found' });
      return;
    }

    if (!existing.isActive) {
      res.status(409).json({ success: false, error: 'Workflow is inactive' });
      return;
    }

    // Execute synchronously for manual triggers so the caller gets feedback
    await engine.executeTrigger({
      applicationId: existing.applicationId,
      triggerType: 'manual',
      triggerData: { workflowId: existing.id, triggeredBy: req.auth!.userId, ...(req.body ?? {}) },
      userId: req.auth!.userId,
    });

    res.json({ success: true, data: { message: 'Workflow executed' } });
  });

  // -----------------------------------------------------------------------
  // GET /:ws/apps/:app/workflows/:workflowId/runs — run history
  // -----------------------------------------------------------------------
  router.get('/:workspaceSlug/apps/:appSlug/workflows/:workflowId/runs', tenant, async (req, res) => {
    const workflowId = param(req, 'workflowId');
    const existing = await db.query.workflows.findFirst({ where: eq(workflows.id, workflowId) });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Workflow not found' });
      return;
    }

    const limit = Math.min(parseInt(String(req.query.limit) || '50', 10), 200);

    const result = await db.query.workflowRuns.findMany({
      where: eq(workflowRuns.workflowId, workflowId),
      orderBy: (r, { desc: d }) => [d(r.createdAt)],
      limit,
    });

    res.json({ success: true, data: result });
  });

  return router;
}
