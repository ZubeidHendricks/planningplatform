import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { blocks, blockDependencies, applications, cells, dimensions, dimensionMembers, blockDimensions } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { createBlockSchema, updateBlockFormulaSchema } from '@planning-platform/shared';
import { FormulaEngine } from '@planning-platform/engine';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { param } from '../middleware/params.js';

export function createBlocksRouter(db: Database, engine: FormulaEngine): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  router.get('/:workspaceSlug/apps/:appSlug/blocks', tenant, async (req, res) => {
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

    const result = await db.query.blocks.findMany({
      where: eq(blocks.applicationId, app.id),
      orderBy: (b, { asc }) => [asc(b.sortOrder)],
    });

    res.json({ success: true, data: result });
  });

  router.post('/:workspaceSlug/apps/:appSlug/blocks', tenant, async (req, res) => {
    const parsed = createBlockSchema.safeParse(req.body);
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

    if (parsed.data.formula) {
      const validation = engine.validateFormula(parsed.data.formula);
      if (!validation.valid) {
        res.status(400).json({ success: false, error: `Invalid formula: ${validation.error}` });
        return;
      }
    }

    const [block] = await db.insert(blocks).values({
      applicationId: app.id,
      ...parsed.data,
    }).returning();

    if (block && parsed.data.formula) {
      const deps = engine.extractDependencies(parsed.data.formula);
      engine.addBlock({ id: block.id, name: block.name, formula: parsed.data.formula, dependencies: deps });

      if (deps.length > 0) {
        const depRecords = deps.map(depBlockId => ({
          blockId: block.id,
          dependsOnBlockId: depBlockId,
        }));
        await db.insert(blockDependencies).values(depRecords);
      }
    }

    // Audit log
    try {
      await req.audit?.({
        workspaceId: req.workspaceId!,
        userId: req.auth!.userId,
        userEmail: req.auth!.email,
        action: 'create',
        resourceType: 'block',
        resourceId: block?.id,
        resourceName: block?.name,
        details: { blockType: parsed.data.blockType, applicationId: app.id },
        ipAddress: req.clientIp,
      });
    } catch { /* audit failure should not break the main operation */ }

    res.status(201).json({ success: true, data: block });
  });

  router.patch('/:workspaceSlug/apps/:appSlug/blocks/:blockId', tenant, async (req, res) => {
    const parsed = updateBlockFormulaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const validation = engine.validateFormula(parsed.data.formula);
    if (!validation.valid) {
      res.status(400).json({ success: false, error: `Invalid formula: ${validation.error}` });
      return;
    }

    const blockId = param(req, 'blockId');
    const [updated] = await db.update(blocks)
      .set({ formula: parsed.data.formula })
      .where(eq(blocks.id, blockId))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'Block not found' });
      return;
    }

    const deps = engine.extractDependencies(parsed.data.formula);
    engine.addBlock({ id: blockId, name: updated.name, formula: parsed.data.formula, dependencies: deps });

    await db.delete(blockDependencies).where(eq(blockDependencies.blockId, blockId));
    if (deps.length > 0) {
      await db.insert(blockDependencies).values(deps.map(d => ({ blockId, dependsOnBlockId: d })));
    }

    const results = engine.recalculate([blockId]);

    // Audit log
    try {
      await req.audit?.({
        workspaceId: req.workspaceId!,
        userId: req.auth!.userId,
        userEmail: req.auth!.email,
        action: 'update',
        resourceType: 'block',
        resourceId: blockId,
        resourceName: updated.name,
        details: { formula: parsed.data.formula },
        ipAddress: req.clientIp,
      });
    } catch { /* audit failure should not break the main operation */ }

    res.json({ success: true, data: { block: updated, recalculated: Object.fromEntries(results) } });
  });

  // CSV export: GET /:ws/apps/:app/blocks/:blockId/export
  router.get('/:workspaceSlug/apps/:appSlug/blocks/:blockId/export', tenant, async (req, res) => {
    const blockId = param(req, 'blockId');
    const block = await db.query.blocks.findFirst({ where: eq(blocks.id, blockId) });
    if (!block) {
      res.status(404).json({ success: false, error: 'Block not found' });
      return;
    }

    const bdList = await db.query.blockDimensions.findMany({
      where: eq(blockDimensions.blockId, blockId),
      orderBy: (bd, { asc }) => [asc(bd.sortOrder)],
    });

    const dimIds = bdList.map((bd) => bd.dimensionId);
    const dimRows = dimIds.length > 0
      ? await Promise.all(dimIds.map((id) => db.query.dimensions.findFirst({ where: eq(dimensions.id, id) })))
      : [];
    const dimMap = new Map(dimRows.filter(Boolean).map((d) => [d!.id, d!]));

    const allMembers = await Promise.all(
      dimIds.map((id) => db.query.dimensionMembers.findMany({ where: eq(dimensionMembers.dimensionId, id) })),
    );
    const memberMap = new Map<string, string>();
    for (const group of allMembers) {
      for (const m of group) memberMap.set(m.id, m.name);
    }

    const blockCells = await db.query.cells.findMany({ where: eq(cells.blockId, blockId) });

    const dimSlugs = bdList.map((bd) => dimMap.get(bd.dimensionId)?.slug ?? bd.dimensionId);
    const header = [...dimSlugs, 'value'].join(',');
    const rows = blockCells.map((c) => {
      const dimValues = bdList.map((bd) => {
        const dimSlug = dimMap.get(bd.dimensionId)?.slug ?? bd.dimensionId;
        const memberId = c.coordinates?.[dimSlug] as string | undefined;
        return memberMap.get(memberId ?? '') ?? memberId ?? '';
      });
      const val = c.numericValue ?? c.textValue ?? '';
      return [...dimValues, val].join(',');
    });

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${block.slug}-export.csv"`);
    res.send(csv);
  });

  // CSV import: POST /:ws/apps/:app/blocks/:blockId/import
  router.post('/:workspaceSlug/apps/:appSlug/blocks/:blockId/import', tenant, async (req, res) => {
    const blockId = param(req, 'blockId');
    const block = await db.query.blocks.findFirst({ where: eq(blocks.id, blockId) });
    if (!block) {
      res.status(404).json({ success: false, error: 'Block not found' });
      return;
    }

    const { rows: csvRows, versionId } = req.body as {
      rows: Array<Record<string, string | number>>;
      versionId?: string;
    };

    if (!Array.isArray(csvRows) || csvRows.length === 0) {
      res.status(400).json({ success: false, error: 'rows array is required' });
      return;
    }

    const bdList = await db.query.blockDimensions.findMany({
      where: eq(blockDimensions.blockId, blockId),
      orderBy: (bd, { asc }) => [asc(bd.sortOrder)],
    });

    const dimIds = bdList.map((bd) => bd.dimensionId);
    const dimRows = dimIds.length > 0
      ? await Promise.all(dimIds.map((id) => db.query.dimensions.findFirst({ where: eq(dimensions.id, id) })))
      : [];
    const dimMap = new Map(dimRows.filter(Boolean).map((d) => [d!.id, d!]));

    const allMembers = await Promise.all(
      dimIds.map((id) => db.query.dimensionMembers.findMany({ where: eq(dimensionMembers.dimensionId, id) })),
    );
    const nameToIdByDim = new Map<string, Map<string, string>>();
    for (let i = 0; i < dimIds.length; i++) {
      const dim = dimMap.get(dimIds[i]!);
      if (!dim) continue;
      const lookup = new Map<string, string>();
      for (const m of allMembers[i] ?? []) {
        lookup.set(m.name.toLowerCase(), m.id);
        if (m.code) lookup.set(m.code.toLowerCase(), m.id);
      }
      nameToIdByDim.set(dim.slug, lookup);
    }

    const cellValues: Array<{
      blockId: string;
      coordinates: Record<string, string>;
      numericValue: number | null;
      textValue: string | null;
      isInput: boolean;
      versionId?: string;
    }> = [];

    const dimSlugs = bdList.map((bd) => dimMap.get(bd.dimensionId)?.slug ?? bd.dimensionId);

    for (const row of csvRows) {
      const coords: Record<string, string> = {};
      let valid = true;
      for (const slug of dimSlugs) {
        const rawVal = String(row[slug] ?? '').toLowerCase();
        const memberId = nameToIdByDim.get(slug)?.get(rawVal);
        if (!memberId) { valid = false; break; }
        coords[slug] = memberId;
      }
      if (!valid) continue;

      const rawValue = row['value'];
      const numVal = typeof rawValue === 'number' ? rawValue : Number(rawValue);

      cellValues.push({
        blockId,
        coordinates: coords,
        numericValue: isNaN(numVal) ? null : numVal,
        textValue: isNaN(numVal) && typeof rawValue === 'string' ? rawValue : null,
        isInput: true,
        ...(versionId ? { versionId } : {}),
      });
    }

    if (cellValues.length > 0) {
      const CHUNK = 100;
      for (let i = 0; i < cellValues.length; i += CHUNK) {
        await db.insert(cells).values(cellValues.slice(i, i + CHUNK));
      }
    }

    // Audit log
    try {
      await req.audit?.({
        workspaceId: req.workspaceId!,
        userId: req.auth!.userId,
        userEmail: req.auth!.email,
        action: 'import',
        resourceType: 'block',
        resourceId: blockId,
        resourceName: block.name,
        details: { imported: cellValues.length, skipped: csvRows.length - cellValues.length },
        ipAddress: req.clientIp,
      });
    } catch { /* audit failure should not break the main operation */ }

    res.json({ success: true, data: { imported: cellValues.length, skipped: csvRows.length - cellValues.length } });
  });

  router.delete('/:workspaceSlug/apps/:appSlug/blocks/:blockId', tenant, async (req, res) => {
    const blockId = param(req, 'blockId');
    const [deleted] = await db.delete(blocks).where(eq(blocks.id, blockId)).returning();
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Block not found' });
      return;
    }
    engine.removeBlock(blockId);

    // Audit log
    try {
      await req.audit?.({
        workspaceId: req.workspaceId!,
        userId: req.auth!.userId,
        userEmail: req.auth!.email,
        action: 'delete',
        resourceType: 'block',
        resourceId: blockId,
        resourceName: deleted.name,
        details: { blockType: deleted.blockType },
        ipAddress: req.clientIp,
      });
    } catch { /* audit failure should not break the main operation */ }

    res.json({ success: true, data: deleted });
  });

  return router;
}
