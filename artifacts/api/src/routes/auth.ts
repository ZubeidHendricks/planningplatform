import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users, workspaces, workspaceMembers } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { loginSchema, registerSchema } from '@planning-platform/shared';
import { signToken, authMiddleware } from '../middleware/auth.js';

export function createAuthRouter(db: Database): Router {
  const router = Router();

  router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const { email, password, firstName, lastName, workspaceName, workspaceSlug } = parsed.data;

    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await db.insert(users).values({
      email,
      passwordHash,
      firstName,
      lastName,
    }).returning();

    const [workspace] = await db.insert(workspaces).values({
      name: workspaceName,
      slug: workspaceSlug,
    }).returning();

    await db.insert(workspaceMembers).values({
      workspaceId: workspace!.id,
      userId: user!.id,
      role: 'owner',
    });

    const token = signToken({ userId: user!.id, email, workspaceId: workspace!.id });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: user!.id, email, firstName, lastName },
        workspace: { id: workspace!.id, name: workspaceName, slug: workspaceSlug },
      },
    });
  });

  router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const { email, password } = parsed.data;

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const membership = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.userId, user.id),
    });

    let workspace = null;
    if (membership) {
      const ws = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, membership.workspaceId),
      });
      if (ws) {
        workspace = { id: ws.id, name: ws.name, slug: ws.slug };
      }
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      workspaceId: membership?.workspaceId,
    });

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
        workspace,
      },
    });
  });

  router.get('/me', authMiddleware, async (req, res) => {
    const auth = req.auth!;

    const user = await db.query.users.findFirst({
      where: eq(users.id, auth.userId),
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    let workspaceSlug: string | null = null;
    if (auth.workspaceId) {
      const ws = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, auth.workspaceId),
      });
      if (ws) workspaceSlug = ws.slug;
    }

    if (!workspaceSlug) {
      const membership = await db.query.workspaceMembers.findFirst({
        where: eq(workspaceMembers.userId, user.id),
      });
      if (membership) {
        const ws = await db.query.workspaces.findFirst({
          where: eq(workspaces.id, membership.workspaceId),
        });
        if (ws) workspaceSlug = ws.slug;
      }
    }

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
        workspaceSlug,
      },
    });
  });

  return router;
}
