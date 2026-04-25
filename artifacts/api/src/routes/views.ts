import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { views, blocks, applications } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { createViewSchema, updateViewSchema } from '@planning-platform/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { param } from '../middleware/params.js';

export function createViewsRouter(db: Database): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  router.get('/:workspaceSlug/apps/:appSlug/blocks/:blockId/views', tenant, async (req, res) => {
    const blockId = param(req, 'blockId');
    const result = await db.query.views.findMany({
      where: eq(views.blockId, blockId),
      orderBy: (v, { desc }) => [desc(v.isDefault), desc(v.createdAt)],
    });
    res.json({ success: true, data: result });
  });

  router.get('/:workspaceSlug/apps/:appSlug/blocks/:blockId/views/:viewId', tenant, async (req, res) => {
    const viewId = param(req, 'viewId');
    const view = await db.query.views.findFirst({
      where: eq(views.id, viewId),
    });

    if (!view) {
      res.status(404).json({ success: false, error: 'View not found' });
      return;
    }

    res.json({ success: true, data: view });
  });

  router.post('/:workspaceSlug/apps/:appSlug/blocks/:blockId/views', tenant, async (req, res) => {
    const parsed = createViewSchema.safeParse({
      ...req.body,
      blockId: param(req, 'blockId'),
    });
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const blockId = param(req, 'blockId');
    const block = await db.query.blocks.findFirst({ where: eq(blocks.id, blockId) });
    if (!block) {
      res.status(404).json({ success: false, error: 'Block not found' });
      return;
    }

    const [view] = await db.insert(views).values(parsed.data).returning();
    res.status(201).json({ success: true, data: view });
  });

  router.patch('/:workspaceSlug/apps/:appSlug/blocks/:blockId/views/:viewId', tenant, async (req, res) => {
    const parsed = updateViewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const viewId = param(req, 'viewId');
    const [updated] = await db.update(views)
      .set(parsed.data)
      .where(eq(views.id, viewId))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'View not found' });
      return;
    }

    res.json({ success: true, data: updated });
  });

  router.delete('/:workspaceSlug/apps/:appSlug/blocks/:blockId/views/:viewId', tenant, async (req, res) => {
    const viewId = param(req, 'viewId');
    const [deleted] = await db.delete(views).where(eq(views.id, viewId)).returning();
    if (!deleted) {
      res.status(404).json({ success: false, error: 'View not found' });
      return;
    }
    res.json({ success: true, data: deleted });
  });

  return router;
}
