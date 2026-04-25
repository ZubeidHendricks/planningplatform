import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { notifications } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { param } from '../middleware/params.js';

export function createNotificationsRouter(db: Database): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  // -----------------------------------------------------------------------
  // GET /:ws/notifications
  // -----------------------------------------------------------------------
  router.get('/:workspaceSlug/notifications', tenant, async (req, res) => {
    const result = await db.query.notifications.findMany({
      where: eq(notifications.userId, req.auth!.userId),
      orderBy: (n, { desc: d }) => [d(n.createdAt)],
      limit: 50,
    });

    res.json({ success: true, data: result });
  });

  // -----------------------------------------------------------------------
  // GET /:ws/notifications/unread-count
  // -----------------------------------------------------------------------
  router.get('/:workspaceSlug/notifications/unread-count', tenant, async (req, res) => {
    const result = await db.query.notifications.findMany({
      where: and(
        eq(notifications.userId, req.auth!.userId),
        eq(notifications.isRead, 0),
      ),
    });

    res.json({ success: true, data: { count: result.length } });
  });

  // -----------------------------------------------------------------------
  // PATCH /:ws/notifications/:notificationId/read
  // -----------------------------------------------------------------------
  router.patch('/:workspaceSlug/notifications/:notificationId/read', tenant, async (req, res) => {
    const [updated] = await db.update(notifications)
      .set({ isRead: 1 })
      .where(and(
        eq(notifications.id, param(req, 'notificationId')),
        eq(notifications.userId, req.auth!.userId),
      ))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'Notification not found' });
      return;
    }

    res.json({ success: true, data: updated });
  });

  // -----------------------------------------------------------------------
  // POST /:ws/notifications/mark-all-read
  // -----------------------------------------------------------------------
  router.post('/:workspaceSlug/notifications/mark-all-read', tenant, async (req, res) => {
    await db.update(notifications)
      .set({ isRead: 1 })
      .where(and(
        eq(notifications.userId, req.auth!.userId),
        eq(notifications.isRead, 0),
      ));

    res.json({ success: true, data: { message: 'All notifications marked as read' } });
  });

  return router;
}
