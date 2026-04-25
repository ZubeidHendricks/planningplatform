import type { Request, Response, NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';
import { applications, appPermissions, workspaceMembers } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { param } from './params.js';

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
  none: 0,
};

function meetsMinRole(userRole: string, minRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
}

function workspaceRoleToAppRole(wsRole: string): string {
  if (wsRole === 'owner' || wsRole === 'admin') return 'owner';
  if (wsRole === 'editor') return 'editor';
  return 'viewer';
}

export function requireAppPermission(db: Database, minRole: 'viewer' | 'editor' | 'owner') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.auth) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!req.workspaceId) {
      res.status(400).json({ success: false, error: 'Workspace context required' });
      return;
    }

    const appSlug = param(req, 'appSlug');
    if (!appSlug) {
      res.status(400).json({ success: false, error: 'Application slug required' });
      return;
    }

    // Look up the application
    const app = await db.query.applications.findFirst({
      where: and(
        eq(applications.workspaceId, req.workspaceId),
        eq(applications.slug, appSlug),
      ),
    });

    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    // Get workspace membership
    const membership = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, req.workspaceId),
        eq(workspaceMembers.userId, req.auth.userId),
      ),
    });

    if (!membership) {
      res.status(403).json({ success: false, error: 'Not a member of this workspace' });
      return;
    }

    // Workspace owner/admin bypasses app-level checks
    if (membership.role === 'owner' || membership.role === 'admin') {
      next();
      return;
    }

    // Check app-level permission
    const appPerm = await db.query.appPermissions.findFirst({
      where: and(
        eq(appPermissions.applicationId, app.id),
        eq(appPermissions.userId, req.auth.userId),
      ),
    });

    let effectiveRole: string;

    if (appPerm) {
      effectiveRole = appPerm.role;
    } else {
      // Fall back to workspace member role mapped to app role
      effectiveRole = workspaceRoleToAppRole(membership.role);
    }

    if (!meetsMinRole(effectiveRole, minRole)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions for this application' });
      return;
    }

    next();
  };
}
