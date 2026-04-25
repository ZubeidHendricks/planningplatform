import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { workspaces, workspaceMembers, users } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { updateBrandingSchema } from '@planning-platform/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';

export function createWorkspaceRouter(db: Database): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  router.get('/:workspaceSlug/settings', tenant, async (req, res) => {
    const ws = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, req.workspaceId!),
    });

    if (!ws) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }

    const members = await db.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.workspaceId, ws.id),
    });

    const memberDetails = await Promise.all(
      members.map(async (m) => {
        const user = await db.query.users.findFirst({
          where: eq(users.id, m.userId),
        });
        return {
          id: m.id,
          userId: m.userId,
          role: m.role,
          email: user?.email ?? '',
          firstName: user?.firstName ?? '',
          lastName: user?.lastName ?? '',
        };
      }),
    );

    res.json({
      success: true,
      data: {
        workspace: {
          id: ws.id,
          name: ws.name,
          slug: ws.slug,
          logoUrl: ws.logoUrl,
          brandLogo: ws.brandLogo,
          brandPrimaryColor: ws.brandPrimaryColor,
          brandSecondaryColor: ws.brandSecondaryColor,
          brandCompanyName: ws.brandCompanyName,
        },
        members: memberDetails,
      },
    });
  });

  router.patch('/:workspaceSlug/settings', tenant, async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.length < 1) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const [updated] = await db.update(workspaces)
      .set({ name })
      .where(eq(workspaces.id, req.workspaceId!))
      .returning();

    res.json({ success: true, data: updated });
  });

  router.patch('/:workspaceSlug/settings/branding', tenant, async (req, res) => {
    const parsed = updateBrandingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.brandLogo !== undefined) updates.brandLogo = parsed.data.brandLogo;
    if (parsed.data.brandPrimaryColor !== undefined) updates.brandPrimaryColor = parsed.data.brandPrimaryColor;
    if (parsed.data.brandSecondaryColor !== undefined) updates.brandSecondaryColor = parsed.data.brandSecondaryColor;
    if (parsed.data.brandCompanyName !== undefined) updates.brandCompanyName = parsed.data.brandCompanyName;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: 'No branding fields provided' });
      return;
    }

    const [updated] = await db.update(workspaces)
      .set(updates)
      .where(eq(workspaces.id, req.workspaceId!))
      .returning();

    res.json({
      success: true,
      data: {
        brandLogo: updated!.brandLogo,
        brandPrimaryColor: updated!.brandPrimaryColor,
        brandSecondaryColor: updated!.brandSecondaryColor,
        brandCompanyName: updated!.brandCompanyName,
      },
    });
  });

  router.post('/:workspaceSlug/settings/invite', tenant, async (req, res) => {
    const { email, role } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ success: false, error: 'Email is required' });
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found. They must register first.' });
      return;
    }

    const existing = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, req.workspaceId!),
        eq(workspaceMembers.userId, user.id),
      ),
    });

    if (existing) {
      res.status(409).json({ success: false, error: 'User is already a member' });
      return;
    }

    const [member] = await db.insert(workspaceMembers).values({
      workspaceId: req.workspaceId!,
      userId: user.id,
      role: role ?? 'viewer',
    }).returning();

    res.status(201).json({
      success: true,
      data: {
        id: member!.id,
        userId: user.id,
        role: member!.role,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  });

  router.delete('/:workspaceSlug/settings/members/:memberId', tenant, async (req, res) => {
    const memberId = req.params['memberId'];
    if (Array.isArray(memberId)) {
      res.status(400).json({ success: false, error: 'Invalid member ID' });
      return;
    }

    const member = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.id, memberId!),
    });

    if (!member) {
      res.status(404).json({ success: false, error: 'Member not found' });
      return;
    }

    if (member.role === 'owner') {
      res.status(409).json({ success: false, error: 'Cannot remove the workspace owner' });
      return;
    }

    await db.delete(workspaceMembers).where(eq(workspaceMembers.id, memberId!));
    res.json({ success: true });
  });

  return router;
}
