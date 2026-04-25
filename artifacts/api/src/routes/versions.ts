import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { versions, cells, applications } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { createVersionSchema, updateVersionSchema } from '@planning-platform/shared';
import type { WorkflowEngine } from '../services/workflow-engine.js';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { param } from '../middleware/params.js';

export function createVersionsRouter(db: Database, workflowEngine?: WorkflowEngine): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  router.get('/:workspaceSlug/apps/:appSlug/versions', tenant, async (req, res) => {
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

    const result = await db.query.versions.findMany({
      where: eq(versions.applicationId, app.id),
      orderBy: (v, { asc }) => [asc(v.createdAt)],
    });

    res.json({ success: true, data: result });
  });

  router.post('/:workspaceSlug/apps/:appSlug/versions', tenant, async (req, res) => {
    const parsed = createVersionSchema.safeParse(req.body);
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

    const [version] = await db.insert(versions).values({
      applicationId: app.id,
      ...parsed.data,
    }).returning();

    res.status(201).json({ success: true, data: version });
  });

  router.patch('/:workspaceSlug/apps/:appSlug/versions/:versionId', tenant, async (req, res) => {
    const parsed = updateVersionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const versionId = param(req, 'versionId');
    const existing = await db.query.versions.findFirst({ where: eq(versions.id, versionId) });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Version not found' });
      return;
    }

    if (existing.isLocked && !parsed.data.isLocked) {
      // Allow unlocking — but if already locked and trying to change name, reject
      if (parsed.data.name && parsed.data.isLocked === undefined) {
        res.status(409).json({ success: false, error: 'Cannot modify a locked version' });
        return;
      }
    }

    const [updated] = await db.update(versions)
      .set(parsed.data)
      .where(eq(versions.id, versionId))
      .returning();

    // Fire-and-forget: trigger version_lock workflows when locking
    if (workflowEngine && parsed.data.isLocked === 1 && !existing.isLocked) {
      workflowEngine.executeTrigger({
        applicationId: existing.applicationId,
        triggerType: 'version_lock',
        triggerData: {
          versionId: existing.id,
          versionName: existing.name,
          versionType: existing.versionType,
        },
        userId: req.auth!.userId,
      }).catch((err) => console.error('[WorkflowEngine] version_lock trigger error:', err));
    }

    res.json({ success: true, data: updated });
  });

  router.post('/:workspaceSlug/apps/:appSlug/versions/:versionId/clone', tenant, async (req, res) => {
    const sourceId = param(req, 'versionId');
    const source = await db.query.versions.findFirst({ where: eq(versions.id, sourceId) });
    if (!source) {
      res.status(404).json({ success: false, error: 'Version not found' });
      return;
    }

    const name = (req.body?.name as string) || `${source.name} (Copy)`;
    const versionType = (req.body?.versionType as string) || source.versionType;

    const [cloned] = await db.insert(versions).values({
      applicationId: source.applicationId,
      name,
      versionType: versionType as 'budget' | 'forecast' | 'actuals',
      parentVersionId: source.id,
    }).returning();

    const sourceCells = await db.query.cells.findMany({
      where: eq(cells.versionId, sourceId),
    });

    if (sourceCells.length > 0) {
      await db.insert(cells).values(
        sourceCells.map((c) => ({
          blockId: c.blockId,
          coordinates: c.coordinates,
          numericValue: c.numericValue,
          textValue: c.textValue,
          booleanValue: c.booleanValue,
          isInput: c.isInput,
          versionId: cloned!.id,
        })),
      );
    }

    res.status(201).json({ success: true, data: cloned });
  });

  router.delete('/:workspaceSlug/apps/:appSlug/versions/:versionId', tenant, async (req, res) => {
    const versionId = param(req, 'versionId');
    const existing = await db.query.versions.findFirst({ where: eq(versions.id, versionId) });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Version not found' });
      return;
    }

    if (existing.isLocked) {
      res.status(409).json({ success: false, error: 'Cannot delete a locked version' });
      return;
    }

    const [deleted] = await db.delete(versions).where(eq(versions.id, versionId)).returning();
    res.json({ success: true, data: deleted });
  });

  return router;
}
