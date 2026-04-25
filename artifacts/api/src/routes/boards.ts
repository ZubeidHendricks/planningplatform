import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { boards, applications } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { createBoardSchema, updateBoardLayoutSchema } from '@planning-platform/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { param } from '../middleware/params.js';

export function createBoardsRouter(db: Database): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  router.get('/:workspaceSlug/apps/:appSlug/boards', tenant, async (req, res) => {
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

    const result = await db.query.boards.findMany({
      where: eq(boards.applicationId, app.id),
      orderBy: (b, { asc }) => [asc(b.sortOrder)],
    });

    res.json({ success: true, data: result });
  });

  router.get('/:workspaceSlug/apps/:appSlug/boards/:boardSlug', tenant, async (req, res) => {
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

    const board = await db.query.boards.findFirst({
      where: and(
        eq(boards.applicationId, app.id),
        eq(boards.slug, param(req, 'boardSlug')),
      ),
    });

    if (!board) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }

    res.json({ success: true, data: board });
  });

  router.post('/:workspaceSlug/apps/:appSlug/boards', tenant, async (req, res) => {
    const parsed = createBoardSchema.safeParse(req.body);
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

    const [board] = await db.insert(boards).values({
      applicationId: app.id,
      ...parsed.data,
    }).returning();

    res.status(201).json({ success: true, data: board });
  });

  router.patch('/:workspaceSlug/apps/:appSlug/boards/:boardSlug', tenant, async (req, res) => {
    const parsed = updateBoardLayoutSchema.safeParse(req.body);
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

    const [updated] = await db.update(boards)
      .set({ layout: parsed.data.layout })
      .where(and(
        eq(boards.applicationId, app.id),
        eq(boards.slug, param(req, 'boardSlug')),
      ))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }

    res.json({ success: true, data: updated });
  });

  router.delete('/:workspaceSlug/apps/:appSlug/boards/:boardSlug', tenant, async (req, res) => {
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

    const [deleted] = await db.delete(boards)
      .where(and(
        eq(boards.applicationId, app.id),
        eq(boards.slug, param(req, 'boardSlug')),
      ))
      .returning();

    if (!deleted) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }

    res.json({ success: true, data: deleted });
  });

  return router;
}
