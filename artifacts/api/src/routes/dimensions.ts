import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { dimensions, dimensionMembers, blockDimensions, blocks, applications } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { createDimensionSchema, createDimensionMemberSchema, assignBlockDimensionSchema } from '@planning-platform/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { param } from '../middleware/params.js';

export function createDimensionsRouter(db: Database): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  // --- Dimension CRUD ---

  router.get('/:workspaceSlug/apps/:appSlug/dimensions', tenant, async (req, res) => {
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

    const result = await db.query.dimensions.findMany({
      where: eq(dimensions.applicationId, app.id),
      orderBy: (d, { asc }) => [asc(d.sortOrder)],
    });

    res.json({ success: true, data: result });
  });

  router.post('/:workspaceSlug/apps/:appSlug/dimensions', tenant, async (req, res) => {
    const parsed = createDimensionSchema.safeParse(req.body);
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

    const [dimension] = await db.insert(dimensions).values({
      applicationId: app.id,
      ...parsed.data,
    }).returning();

    res.status(201).json({ success: true, data: dimension });
  });

  router.delete('/:workspaceSlug/apps/:appSlug/dimensions/:dimensionId', tenant, async (req, res) => {
    const dimensionId = param(req, 'dimensionId');
    const [deleted] = await db.delete(dimensions).where(eq(dimensions.id, dimensionId)).returning();
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Dimension not found' });
      return;
    }
    res.json({ success: true, data: deleted });
  });

  // --- Dimension Members ---

  router.get('/:workspaceSlug/apps/:appSlug/dimensions/:dimensionId/members', tenant, async (req, res) => {
    const dimensionId = param(req, 'dimensionId');
    const result = await db.query.dimensionMembers.findMany({
      where: eq(dimensionMembers.dimensionId, dimensionId),
      orderBy: (m, { asc }) => [asc(m.sortOrder)],
    });
    res.json({ success: true, data: result });
  });

  router.post('/:workspaceSlug/apps/:appSlug/dimensions/:dimensionId/members', tenant, async (req, res) => {
    const parsed = createDimensionMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const dimensionId = param(req, 'dimensionId');
    const dim = await db.query.dimensions.findFirst({ where: eq(dimensions.id, dimensionId) });
    if (!dim) {
      res.status(404).json({ success: false, error: 'Dimension not found' });
      return;
    }

    const [member] = await db.insert(dimensionMembers).values({
      dimensionId,
      ...parsed.data,
    }).returning();

    res.status(201).json({ success: true, data: member });
  });

  router.delete('/:workspaceSlug/apps/:appSlug/dimensions/:dimensionId/members/:memberId', tenant, async (req, res) => {
    const memberId = param(req, 'memberId');
    const [deleted] = await db.delete(dimensionMembers).where(eq(dimensionMembers.id, memberId)).returning();
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Member not found' });
      return;
    }
    res.json({ success: true, data: deleted });
  });

  // --- Block ↔ Dimension Assignment ---

  router.get('/:workspaceSlug/apps/:appSlug/blocks/:blockId/dimensions', tenant, async (req, res) => {
    const blockId = param(req, 'blockId');
    const result = await db.query.blockDimensions.findMany({
      where: eq(blockDimensions.blockId, blockId),
      orderBy: (bd, { asc }) => [asc(bd.sortOrder)],
    });
    res.json({ success: true, data: result });
  });

  router.post('/:workspaceSlug/apps/:appSlug/blocks/:blockId/dimensions', tenant, async (req, res) => {
    const parsed = assignBlockDimensionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const blockId = param(req, 'blockId');
    const [assignment] = await db.insert(blockDimensions).values({
      blockId,
      dimensionId: parsed.data.dimensionId,
      sortOrder: parsed.data.sortOrder ?? 0,
    }).returning();

    res.status(201).json({ success: true, data: assignment });
  });

  router.delete('/:workspaceSlug/apps/:appSlug/blocks/:blockId/dimensions/:assignmentId', tenant, async (req, res) => {
    const assignmentId = param(req, 'assignmentId');
    const [deleted] = await db.delete(blockDimensions).where(eq(blockDimensions.id, assignmentId)).returning();
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Assignment not found' });
      return;
    }
    res.json({ success: true, data: deleted });
  });

  return router;
}
