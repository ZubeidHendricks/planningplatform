import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { applications } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { createApplicationSchema, updateApplicationSchema } from '@planning-platform/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { param } from '../middleware/params.js';

export function createApplicationsRouter(db: Database): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  router.get('/:workspaceSlug/apps', tenant, async (req, res) => {
    const result = await db.query.applications.findMany({
      where: eq(applications.workspaceId, req.workspaceId!),
      orderBy: (a, { asc }) => [asc(a.sortOrder)],
    });
    res.json({ success: true, data: result });
  });

  router.get('/:workspaceSlug/apps/:appSlug', tenant, async (req, res) => {
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

    res.json({ success: true, data: app });
  });

  router.post('/:workspaceSlug/apps', tenant, async (req, res) => {
    const parsed = createApplicationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const [app] = await db.insert(applications).values({
      workspaceId: req.workspaceId!,
      ...parsed.data,
    }).returning();

    // Audit log
    try {
      await req.audit?.({
        workspaceId: req.workspaceId!,
        userId: req.auth!.userId,
        userEmail: req.auth!.email,
        action: 'create',
        resourceType: 'application',
        resourceId: app?.id,
        resourceName: app?.name,
        details: { slug: parsed.data.slug },
        ipAddress: req.clientIp,
      });
    } catch { /* audit failure should not break the main operation */ }

    res.status(201).json({ success: true, data: app });
  });

  router.patch('/:workspaceSlug/apps/:appSlug', tenant, async (req, res) => {
    const parsed = updateApplicationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const [updated] = await db.update(applications)
      .set(parsed.data)
      .where(and(
        eq(applications.workspaceId, req.workspaceId!),
        eq(applications.slug, param(req, 'appSlug')),
      ))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    // Audit log
    try {
      await req.audit?.({
        workspaceId: req.workspaceId!,
        userId: req.auth!.userId,
        userEmail: req.auth!.email,
        action: 'update',
        resourceType: 'application',
        resourceId: updated.id,
        resourceName: updated.name,
        details: { changes: parsed.data },
        ipAddress: req.clientIp,
      });
    } catch { /* audit failure should not break the main operation */ }

    res.json({ success: true, data: updated });
  });

  router.delete('/:workspaceSlug/apps/:appSlug', tenant, async (req, res) => {
    const [deleted] = await db.delete(applications)
      .where(and(
        eq(applications.workspaceId, req.workspaceId!),
        eq(applications.slug, param(req, 'appSlug')),
      ))
      .returning();

    if (!deleted) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    // Audit log
    try {
      await req.audit?.({
        workspaceId: req.workspaceId!,
        userId: req.auth!.userId,
        userEmail: req.auth!.email,
        action: 'delete',
        resourceType: 'application',
        resourceId: deleted.id,
        resourceName: deleted.name,
        details: { slug: deleted.slug },
        ipAddress: req.clientIp,
      });
    } catch { /* audit failure should not break the main operation */ }

    res.json({ success: true, data: deleted });
  });

  return router;
}
