import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { applications, appPermissions, workspaceMembers, users } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { grantPermissionSchema, updatePermissionSchema } from '@planning-platform/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { param } from '../middleware/params.js';

export function createPermissionsRouter(db: Database): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  // List all permissions for an app
  router.get('/:workspaceSlug/apps/:appSlug/permissions', tenant, async (req, res) => {
    // Only workspace owner/admin can manage permissions
    const membership = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, req.workspaceId!),
        eq(workspaceMembers.userId, req.auth!.userId),
      ),
    });

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      res.status(403).json({ success: false, error: 'Only workspace owners and admins can manage permissions' });
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

    const perms = await db.query.appPermissions.findMany({
      where: eq(appPermissions.applicationId, app.id),
    });

    const permDetails = await Promise.all(
      perms.map(async (p) => {
        const user = await db.query.users.findFirst({
          where: eq(users.id, p.userId),
        });
        return {
          id: p.id,
          userId: p.userId,
          role: p.role,
          email: user?.email ?? '',
          firstName: user?.firstName ?? '',
          lastName: user?.lastName ?? '',
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      }),
    );

    res.json({ success: true, data: permDetails });
  });

  // Grant permission to a user
  router.post('/:workspaceSlug/apps/:appSlug/permissions', tenant, async (req, res) => {
    const membership = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, req.workspaceId!),
        eq(workspaceMembers.userId, req.auth!.userId),
      ),
    });

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      res.status(403).json({ success: false, error: 'Only workspace owners and admins can manage permissions' });
      return;
    }

    const parsed = grantPermissionSchema.safeParse(req.body);
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

    // Verify the target user exists and is a workspace member
    const targetMember = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, req.workspaceId!),
        eq(workspaceMembers.userId, parsed.data.userId),
      ),
    });

    if (!targetMember) {
      res.status(404).json({ success: false, error: 'User is not a member of this workspace' });
      return;
    }

    // Check if permission already exists
    const existing = await db.query.appPermissions.findFirst({
      where: and(
        eq(appPermissions.applicationId, app.id),
        eq(appPermissions.userId, parsed.data.userId),
      ),
    });

    if (existing) {
      res.status(409).json({ success: false, error: 'Permission already exists for this user. Use PATCH to update.' });
      return;
    }

    const [perm] = await db.insert(appPermissions).values({
      applicationId: app.id,
      userId: parsed.data.userId,
      role: parsed.data.role,
    }).returning();

    // Audit log
    try {
      await req.audit?.({
        workspaceId: req.workspaceId!,
        userId: req.auth!.userId,
        userEmail: req.auth!.email,
        action: 'permission_change',
        resourceType: 'application',
        resourceId: app.id,
        resourceName: app.name,
        details: { targetUserId: parsed.data.userId, role: parsed.data.role, action: 'grant' },
        ipAddress: req.clientIp,
      });
    } catch { /* audit failure should not break the main operation */ }

    res.status(201).json({ success: true, data: perm });
  });

  // Update a permission
  router.patch('/:workspaceSlug/apps/:appSlug/permissions/:permId', tenant, async (req, res) => {
    const membership = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, req.workspaceId!),
        eq(workspaceMembers.userId, req.auth!.userId),
      ),
    });

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      res.status(403).json({ success: false, error: 'Only workspace owners and admins can manage permissions' });
      return;
    }

    const parsed = updatePermissionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const permId = param(req, 'permId');
    const existing = await db.query.appPermissions.findFirst({
      where: eq(appPermissions.id, permId),
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Permission not found' });
      return;
    }

    const oldRole = existing.role;

    const [updated] = await db.update(appPermissions)
      .set({ role: parsed.data.role })
      .where(eq(appPermissions.id, permId))
      .returning();

    // Audit log
    try {
      const app = await db.query.applications.findFirst({
        where: eq(applications.id, existing.applicationId),
      });

      await req.audit?.({
        workspaceId: req.workspaceId!,
        userId: req.auth!.userId,
        userEmail: req.auth!.email,
        action: 'permission_change',
        resourceType: 'application',
        resourceId: existing.applicationId,
        resourceName: app?.name,
        details: { targetUserId: existing.userId, oldRole, newRole: parsed.data.role, action: 'update' },
        ipAddress: req.clientIp,
      });
    } catch { /* audit failure should not break the main operation */ }

    res.json({ success: true, data: updated });
  });

  // Revoke a permission
  router.delete('/:workspaceSlug/apps/:appSlug/permissions/:permId', tenant, async (req, res) => {
    const membership = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, req.workspaceId!),
        eq(workspaceMembers.userId, req.auth!.userId),
      ),
    });

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      res.status(403).json({ success: false, error: 'Only workspace owners and admins can manage permissions' });
      return;
    }

    const permId = param(req, 'permId');
    const existing = await db.query.appPermissions.findFirst({
      where: eq(appPermissions.id, permId),
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Permission not found' });
      return;
    }

    await db.delete(appPermissions).where(eq(appPermissions.id, permId));

    // Audit log
    try {
      const app = await db.query.applications.findFirst({
        where: eq(applications.id, existing.applicationId),
      });

      await req.audit?.({
        workspaceId: req.workspaceId!,
        userId: req.auth!.userId,
        userEmail: req.auth!.email,
        action: 'permission_change',
        resourceType: 'application',
        resourceId: existing.applicationId,
        resourceName: app?.name,
        details: { targetUserId: existing.userId, revokedRole: existing.role, action: 'revoke' },
        ipAddress: req.clientIp,
      });
    } catch { /* audit failure should not break the main operation */ }

    res.json({ success: true });
  });

  return router;
}
