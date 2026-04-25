import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { scenarios, applications } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { createScenarioSchema, updateScenarioSchema } from '@planning-platform/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { param } from '../middleware/params.js';

export function createScenariosRouter(db: Database): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  router.get('/:workspaceSlug/apps/:appSlug/scenarios', tenant, async (req, res) => {
    const app = await db.query.applications.findFirst({
      where: and(
        eq(applications.workspaceId, req.workspaceId!),
        eq(applications.slug, param(req, 'appSlug')),
      ),
    });

    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    const result = await db.query.scenarios.findMany({
      where: eq(scenarios.applicationId, app.id),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });

    res.json({ success: true, data: result });
  });

  router.post('/:workspaceSlug/apps/:appSlug/scenarios', tenant, async (req, res) => {
    const parsed = createScenarioSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const app = await db.query.applications.findFirst({
      where: and(
        eq(applications.workspaceId, req.workspaceId!),
        eq(applications.slug, param(req, 'appSlug')),
      ),
    });

    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    const [scenario] = await db.insert(scenarios).values({
      applicationId: app.id,
      ...parsed.data,
    }).returning();

    res.status(201).json({ success: true, data: scenario });
  });

  router.patch('/:workspaceSlug/apps/:appSlug/scenarios/:scenarioId', tenant, async (req, res) => {
    const parsed = updateScenarioSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const app = await db.query.applications.findFirst({
      where: and(
        eq(applications.workspaceId, req.workspaceId!),
        eq(applications.slug, param(req, 'appSlug')),
      ),
    });

    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    const [updated] = await db.update(scenarios)
      .set(parsed.data)
      .where(and(
        eq(scenarios.applicationId, app.id),
        eq(scenarios.id, param(req, 'scenarioId')),
      ))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'Scenario not found' });
      return;
    }

    res.json({ success: true, data: updated });
  });

  router.delete('/:workspaceSlug/apps/:appSlug/scenarios/:scenarioId', tenant, async (req, res) => {
    const app = await db.query.applications.findFirst({
      where: and(
        eq(applications.workspaceId, req.workspaceId!),
        eq(applications.slug, param(req, 'appSlug')),
      ),
    });

    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    const [deleted] = await db.delete(scenarios)
      .where(and(
        eq(scenarios.applicationId, app.id),
        eq(scenarios.id, param(req, 'scenarioId')),
      ))
      .returning();

    if (!deleted) {
      res.status(404).json({ success: false, error: 'Scenario not found' });
      return;
    }

    res.json({ success: true, data: deleted });
  });

  return router;
}
