import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { workspaces, workspaceMembers } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';

declare global {
  namespace Express {
    interface Request {
      workspaceId?: string;
      workspaceSlug?: string;
    }
  }
}

export function createTenantMiddleware(db: Database) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rawSlug = req.params['workspaceSlug'];
    const slug = (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug) ?? req.headers['x-workspace-slug'] as string;

    if (!slug) {
      res.status(400).json({ success: false, error: 'Workspace slug required' });
      return;
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, slug),
    });

    if (!workspace) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }

    if (req.auth) {
      const membership = await db.query.workspaceMembers.findFirst({
        where: (wm, { and, eq: e }) =>
          and(e(wm.workspaceId, workspace.id), e(wm.userId, req.auth!.userId)),
      });

      if (!membership) {
        res.status(403).json({ success: false, error: 'Not a member of this workspace' });
        return;
      }
    }

    req.workspaceId = workspace.id;
    req.workspaceSlug = workspace.slug;
    next();
  };
}
