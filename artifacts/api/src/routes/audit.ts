import { Router } from 'express';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { auditLogs, workspaceMembers } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { auditLogFilterSchema } from '@planning-platform/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { param } from '../middleware/params.js';

export function createAuditRouter(db: Database): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  // List audit logs with pagination and filters
  router.get('/:workspaceSlug/audit', tenant, async (req, res) => {
    // Only workspace owners/admins can access audit logs
    const membership = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, req.workspaceId!),
        eq(workspaceMembers.userId, req.auth!.userId),
      ),
    });

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      res.status(403).json({ success: false, error: 'Only workspace owners and admins can access audit logs' });
      return;
    }

    const parsed = auditLogFilterSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const { page = 1, limit = 50, action, resourceType, userId, from, to } = parsed.data;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [eq(auditLogs.workspaceId, req.workspaceId!)];

    if (action) {
      conditions.push(eq(auditLogs.action, action as typeof auditLogs.$inferSelect.action));
    }
    if (resourceType) {
      conditions.push(eq(auditLogs.resourceType, resourceType as typeof auditLogs.$inferSelect.resourceType));
    }
    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }
    if (from) {
      conditions.push(gte(auditLogs.createdAt, new Date(from)));
    }
    if (to) {
      conditions.push(lte(auditLogs.createdAt, new Date(to)));
    }

    const whereClause = and(...conditions);

    const [logs, countResult] = await Promise.all([
      db.select().from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(auditLogs)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

    res.json({
      success: true,
      data: {
        items: logs,
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // Get single audit log entry
  router.get('/:workspaceSlug/audit/:logId', tenant, async (req, res) => {
    const membership = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, req.workspaceId!),
        eq(workspaceMembers.userId, req.auth!.userId),
      ),
    });

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      res.status(403).json({ success: false, error: 'Only workspace owners and admins can access audit logs' });
      return;
    }

    const logId = param(req, 'logId');
    const log = await db.query.auditLogs.findFirst({
      where: and(
        eq(auditLogs.id, logId),
        eq(auditLogs.workspaceId, req.workspaceId!),
      ),
    });

    if (!log) {
      res.status(404).json({ success: false, error: 'Audit log entry not found' });
      return;
    }

    res.json({ success: true, data: log });
  });

  return router;
}
