import { Router } from 'express';
import { eq, and, inArray } from 'drizzle-orm';
import { cells, blocks, applications } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { setCellValueSchema } from '@planning-platform/shared';
import { FormulaEngine, Evaluator, type EvaluationContext, type FormulaValue } from '@planning-platform/engine';
import type { WorkflowEngine } from '../services/workflow-engine.js';
import type { RealtimeService } from '../services/realtime.js';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { param } from '../middleware/params.js';

export function createCellsRouter(db: Database, engine: FormulaEngine, workflowEngine?: WorkflowEngine, realtime?: RealtimeService): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  router.get('/:workspaceSlug/apps/:appSlug/blocks/:blockId/cells', tenant, async (req, res) => {
    const blockId = param(req, 'blockId');
    const versionId = typeof req.query.versionId === 'string' ? req.query.versionId : undefined;

    const block = await db.query.blocks.findFirst({ where: eq(blocks.id, blockId) });
    if (!block) {
      res.status(404).json({ success: false, error: 'Block not found' });
      return;
    }

    // If block has no formula, return stored cells directly
    if (!block.formula || block.formula.trim() === '') {
      const conditions = versionId
        ? and(eq(cells.blockId, blockId), eq(cells.versionId, versionId))
        : eq(cells.blockId, blockId);

      const result = await db.query.cells.findMany({ where: conditions });
      res.json({ success: true, data: result });
      return;
    }

    // --- Computed block: evaluate formula per coordinate tuple ---
    // Recursively resolves transitive formula dependencies (e.g., EBITDA -> Gross Profit -> Revenue, COGS)
    const appBlocks = await db.query.blocks.findMany({
      where: eq(blocks.applicationId, block.applicationId),
    });
    const nameToBlock = new Map(appBlocks.map((b) => [b.name, b]));

    // Cache of computed values per block name: coordKey -> numericValue
    const blockValueCache = new Map<string, Map<string, number>>();

    async function resolveBlockValues(
      blockName: string,
      visited: Set<string>,
    ): Promise<Map<string, number>> {
      if (blockValueCache.has(blockName)) return blockValueCache.get(blockName)!;
      if (visited.has(blockName)) return new Map(); // cycle guard

      const blk = nameToBlock.get(blockName);
      if (!blk) return new Map();

      visited.add(blockName);
      const result = new Map<string, number>();

      if (!blk.formula || blk.formula.trim() === '') {
        // Input block: fetch stored cells
        const conds = versionId
          ? and(eq(cells.blockId, blk.id), eq(cells.versionId, versionId))
          : eq(cells.blockId, blk.id);
        const stored = await db.query.cells.findMany({ where: conds });
        for (const cell of stored) {
          if (cell.numericValue !== null) {
            const ck = JSON.stringify(
              Object.keys(cell.coordinates).sort().reduce<Record<string, string>>((a, k) => { a[k] = cell.coordinates[k] ?? ''; return a; }, {}),
            );
            result.set(ck, cell.numericValue);
          }
        }
      } else {
        // Formula block: recursively resolve deps then evaluate
        const deps = engine.extractDependencies(blk.formula);
        const depMaps: Array<{ name: string; values: Map<string, number> }> = [];
        for (const depName of deps) {
          depMaps.push({ name: depName, values: await resolveBlockValues(depName, new Set(visited)) });
        }

        // Collect all coordinate keys across all deps
        const allCoordKeys = new Set<string>();
        for (const dm of depMaps) {
          for (const ck of dm.values.keys()) allCoordKeys.add(ck);
        }

        const ast = engine.parseFormula(blk.formula);
        for (const ck of allCoordKeys) {
          const ctx: EvaluationContext = {
            resolveIdentifier: (name: string) => {
              const dm = depMaps.find((d) => d.name === name);
              return dm?.values.get(ck) ?? 0;
            },
          };
          try {
            const evaluator = new Evaluator(ctx);
            const val = evaluator.evaluate(ast);
            if (typeof val === 'number') result.set(ck, val);
          } catch { /* skip */ }
        }
      }

      blockValueCache.set(blockName, result);
      return result;
    }

    // Resolve all values for this formula block
    const computedValues = await resolveBlockValues(block.name, new Set());

    // Build coordinate map for reverse lookup (coordKey -> original coordinates)
    const coordKeyToCoords = new Map<string, Record<string, string>>();
    // We need original coordinates — fetch from dependency input blocks
    const allDepNames = new Set<string>();
    function collectDeps(formula: string) {
      for (const dep of engine.extractDependencies(formula)) {
        if (allDepNames.has(dep)) continue;
        allDepNames.add(dep);
        const depBlk = nameToBlock.get(dep);
        if (depBlk?.formula) collectDeps(depBlk.formula);
      }
    }
    collectDeps(block.formula);

    const inputBlockIds = [...allDepNames]
      .map((n) => nameToBlock.get(n))
      .filter((b): b is typeof appBlocks[number] => b !== undefined && (!b.formula || b.formula.trim() === ''))
      .map((b) => b.id);

    if (inputBlockIds.length > 0) {
      const inputConds = versionId
        ? and(inArray(cells.blockId, inputBlockIds), eq(cells.versionId, versionId))
        : inArray(cells.blockId, inputBlockIds);
      const inputCells = await db.query.cells.findMany({ where: inputConds });
      for (const cell of inputCells) {
        const ck = JSON.stringify(
          Object.keys(cell.coordinates).sort().reduce<Record<string, string>>((a, k) => { a[k] = cell.coordinates[k] ?? ''; return a; }, {}),
        );
        if (!coordKeyToCoords.has(ck)) coordKeyToCoords.set(ck, cell.coordinates);
      }
    }

    const now = new Date().toISOString();
    const computedCells = [...computedValues.entries()].map(([coordKey, value]) => ({
      id: `computed:${blockId}:${coordKey}`,
      blockId,
      coordinates: coordKeyToCoords.get(coordKey) ?? JSON.parse(coordKey) as Record<string, string>,
      numericValue: value,
      textValue: null as string | null,
      booleanValue: null as boolean | null,
      isInput: false,
      versionId: versionId ?? null,
      updatedAt: now,
    }));

    res.json({ success: true, data: computedCells });
  });

  router.post('/:workspaceSlug/apps/:appSlug/blocks/:blockId/cells', tenant, async (req, res) => {
    const blockId = param(req, 'blockId');
    const { coordinates, value } = req.body as {
      coordinates: Record<string, string>;
      value: number | string | boolean | null;
    };

    if (!coordinates || typeof coordinates !== 'object') {
      res.status(400).json({ success: false, error: 'coordinates is required' });
      return;
    }

    const coordKey = `${blockId}:${JSON.stringify(coordinates)}`;

    const blockCells = await db.query.cells.findMany({
      where: eq(cells.blockId, blockId),
    });
    const coordStr = JSON.stringify(coordinates);
    const existing = blockCells.find((c) => JSON.stringify(c.coordinates) === coordStr);

    let cell;
    const values = {
      numericValue: typeof value === 'number' ? value : null,
      textValue: typeof value === 'string' ? value : null,
      booleanValue: typeof value === 'boolean' ? value : null,
    };

    if (existing) {
      [cell] = await db.update(cells)
        .set(values)
        .where(eq(cells.id, existing.id))
        .returning();
    } else {
      [cell] = await db.insert(cells).values({
        blockId,
        coordinates,
        isInput: true,
        ...values,
      }).returning();
    }

    engine.setCellValue(coordKey, value);
    const recalculated = engine.recalculate([blockId]);

    // Fire-and-forget: trigger cell_change workflows
    if (workflowEngine) {
      const block = await db.query.blocks.findFirst({ where: eq(blocks.id, blockId) });
      if (block) {
        workflowEngine.executeTrigger({
          applicationId: block.applicationId,
          triggerType: 'cell_change',
          triggerData: {
            blockId,
            blockName: block.name,
            coordinates,
            oldValue: existing ? (existing.numericValue ?? existing.textValue ?? existing.booleanValue) : null,
            newValue: value,
          },
          userId: req.auth!.userId,
        }).catch((err) => console.error('[WorkflowEngine] cell_change trigger error:', err));
      }
    }

    // Broadcast cell update via WebSocket
    if (realtime && req.workspaceSlug) {
      realtime.broadcastCellUpdate(req.workspaceSlug, req.params['appSlug'] as string, {
        blockId,
        coordinates,
        value,
        userId: req.auth!.userId,
        email: req.auth!.email,
      });
    }

    res.json({
      success: true,
      data: {
        cell,
        recalculated: Object.fromEntries(recalculated),
      },
    });
  });

  return router;
}
