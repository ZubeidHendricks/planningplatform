import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import {
  applications,
  cells,
  environments,
} from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import {
  createEnvironmentSchema,
  promoteEnvironmentSchema,
} from '@planning-platform/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { param } from '../middleware/params.js';

export function createEnvironmentsRouter(db: Database): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  // GET /:ws/apps/:app/environments — list environments
  router.get(
    '/:workspaceSlug/apps/:appSlug/environments',
    tenant,
    async (req, res) => {
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

      const envs = await db.query.environments.findMany({
        where: eq(environments.applicationId, app.id),
        orderBy: (e, { asc }) => [asc(e.createdAt)],
      });

      res.json({ success: true, data: envs });
    },
  );

  // POST /:ws/apps/:app/environments — create environment
  router.post(
    '/:workspaceSlug/apps/:appSlug/environments',
    tenant,
    async (req, res) => {
      const parsed = createEnvironmentSchema.safeParse(req.body);
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

      const [env] = await db.insert(environments).values({
        applicationId: app.id,
        name: parsed.data.name,
        slug: parsed.data.slug,
      }).returning();

      res.status(201).json({ success: true, data: env });
    },
  );

  // POST /:ws/apps/:app/environments/:envId/promote — promote environment
  router.post(
    '/:workspaceSlug/apps/:appSlug/environments/:envId/promote',
    tenant,
    async (req, res) => {
      const parsed = promoteEnvironmentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.message });
        return;
      }

      const envId = param(req, 'envId');
      const { targetEnvironmentId } = parsed.data;

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

      // Verify source environment exists
      const sourceEnv = await db.query.environments.findFirst({
        where: and(
          eq(environments.id, envId),
          eq(environments.applicationId, app.id),
        ),
      });

      if (!sourceEnv) {
        res.status(404).json({ success: false, error: 'Source environment not found' });
        return;
      }

      // Verify target environment exists
      const targetEnv = await db.query.environments.findFirst({
        where: and(
          eq(environments.id, targetEnvironmentId),
          eq(environments.applicationId, app.id),
        ),
      });

      if (!targetEnv) {
        res.status(404).json({ success: false, error: 'Target environment not found' });
        return;
      }

      // Get all cells from the source environment
      const sourceCells = await db.query.cells.findMany({
        where: eq(cells.environmentId, envId),
      });

      // Delete existing cells in the target environment
      await db.delete(cells).where(eq(cells.environmentId, targetEnvironmentId));

      // Copy source cells to target environment
      if (sourceCells.length > 0) {
        const CHUNK = 100;
        for (let i = 0; i < sourceCells.length; i += CHUNK) {
          const batch = sourceCells.slice(i, i + CHUNK).map((c) => ({
            blockId: c.blockId,
            coordinates: c.coordinates as Record<string, string>,
            numericValue: c.numericValue,
            textValue: c.textValue,
            booleanValue: c.booleanValue,
            isInput: c.isInput,
            versionId: c.versionId,
            environmentId: targetEnvironmentId,
          }));
          await db.insert(cells).values(batch);
        }
      }

      // Update the target environment metadata
      const [updated] = await db
        .update(environments)
        .set({
          sourceEnvironmentId: envId,
          promotedAt: new Date(),
          promotedBy: req.auth!.userId,
        })
        .where(eq(environments.id, targetEnvironmentId))
        .returning();

      res.json({
        success: true,
        data: {
          environment: updated,
          cellsCopied: sourceCells.length,
        },
      });
    },
  );

  // DELETE /:ws/apps/:app/environments/:envId — delete environment
  router.delete(
    '/:workspaceSlug/apps/:appSlug/environments/:envId',
    tenant,
    async (req, res) => {
      const envId = param(req, 'envId');

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

      const env = await db.query.environments.findFirst({
        where: and(
          eq(environments.id, envId),
          eq(environments.applicationId, app.id),
        ),
      });

      if (!env) {
        res.status(404).json({ success: false, error: 'Environment not found' });
        return;
      }

      if (env.isDefault === 1) {
        res.status(409).json({ success: false, error: 'Cannot delete the default environment' });
        return;
      }

      // Delete cells belonging to this environment first
      await db.delete(cells).where(eq(cells.environmentId, envId));

      const [deleted] = await db
        .delete(environments)
        .where(eq(environments.id, envId))
        .returning();

      res.json({ success: true, data: deleted });
    },
  );

  return router;
}
