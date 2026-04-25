import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import {
  applications,
  blocks,
  boards,
  cells,
  dimensions,
  dimensionMembers,
  blockDimensions,
} from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import {
  aiGenerateModelSchema,
  aiApplyModelSchema,
  aiAnalyzeSchema,
  aiFormulaSchema,
  aiNavigateSchema,
} from '@planning-platform/shared';
import { FormulaEngine } from '@planning-platform/engine';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { param } from '../middleware/params.js';
import {
  AIService,
  AIServiceUnavailableError,
  type ExistingDimension,
  type ExistingBlock,
  type BlockData,
} from '../services/ai.js';

const aiService = new AIService();

export function createAIRouter(db: Database, engine: FormulaEngine): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  // ---------------------------------------------------------------------------
  // Shared helper: resolve app from route params
  // ---------------------------------------------------------------------------

  async function resolveApp(req: { workspaceId?: string; params: Record<string, unknown> }) {
    const workspaceId = req.workspaceId;
    const appSlug = param(req as Parameters<typeof param>[0], 'appSlug');
    if (!workspaceId) return null;
    return db.query.applications.findFirst({
      where: and(
        eq(applications.workspaceId, workspaceId),
        eq(applications.slug, appSlug),
      ),
    });
  }

  // ---------------------------------------------------------------------------
  // Shared helper: build existing context for an app
  // ---------------------------------------------------------------------------

  async function buildContext(applicationId: string) {
    const appBlocks = await db.query.blocks.findMany({
      where: eq(blocks.applicationId, applicationId),
      orderBy: (b, { asc }) => [asc(b.sortOrder)],
    });

    const appDimensions = await db.query.dimensions.findMany({
      where: eq(dimensions.applicationId, applicationId),
      orderBy: (d, { asc }) => [asc(d.sortOrder)],
    });

    const existingDimensions: ExistingDimension[] = await Promise.all(
      appDimensions.map(async (d) => {
        const members = await db.query.dimensionMembers.findMany({
          where: eq(dimensionMembers.dimensionId, d.id),
          orderBy: (m, { asc }) => [asc(m.sortOrder)],
        });
        return {
          name: d.name,
          slug: d.slug,
          members: members.map((m) => ({ name: m.name, code: m.code ?? '' })),
        };
      }),
    );

    const existingBlocks: ExistingBlock[] = appBlocks.map((b) => ({
      name: b.name,
      slug: b.slug,
      blockType: b.blockType,
      formula: b.formula ?? null,
      formatType: b.formatType ?? null,
    }));

    return { appBlocks, appDimensions, existingDimensions, existingBlocks };
  }

  // ---------------------------------------------------------------------------
  // POST /:ws/apps/:app/ai/model — Generate a model plan
  // ---------------------------------------------------------------------------

  router.post('/:workspaceSlug/apps/:appSlug/ai/model', tenant, async (req, res) => {
    if (!aiService.isAvailable()) {
      res.status(503).json({
        success: false,
        error: 'AI service is not available. Set ANTHROPIC_API_KEY environment variable.',
      });
      return;
    }

    const parsed = aiGenerateModelSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const app = await resolveApp(req);
    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    try {
      const { existingDimensions, existingBlocks } = await buildContext(app.id);
      const plan = await aiService.generateModel(
        parsed.data.description,
        existingDimensions,
        existingBlocks,
      );
      res.json({ success: true, data: plan });
    } catch (err) {
      if (err instanceof AIServiceUnavailableError) {
        res.status(503).json({ success: false, error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : 'AI model generation failed';
      res.status(500).json({ success: false, error: message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /:ws/apps/:app/ai/model/apply — Apply a model plan
  // ---------------------------------------------------------------------------

  router.post('/:workspaceSlug/apps/:appSlug/ai/model/apply', tenant, async (req, res) => {
    const parsed = aiApplyModelSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const app = await resolveApp(req);
    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    const plan = parsed.data;

    try {
      // 1. Create dimensions and their members
      const createdDimensions: Array<{ slug: string; id: string }> = [];

      for (const dimPlan of plan.dimensions) {
        const [dim] = await db.insert(dimensions).values({
          applicationId: app.id,
          name: dimPlan.name,
          slug: dimPlan.slug,
        }).returning();

        if (!dim) continue;
        createdDimensions.push({ slug: dimPlan.slug, id: dim.id });

        if (dimPlan.members.length > 0) {
          const memberValues = dimPlan.members.map((m, idx) => ({
            dimensionId: dim.id,
            name: m.name,
            code: m.code,
            sortOrder: idx,
          }));
          await db.insert(dimensionMembers).values(memberValues);
        }
      }

      // Also include existing dimensions for slug->id mapping
      const existingDims = await db.query.dimensions.findMany({
        where: eq(dimensions.applicationId, app.id),
      });
      const dimSlugToId = new Map<string, string>(
        existingDims.map((d) => [d.slug, d.id]),
      );
      for (const cd of createdDimensions) {
        dimSlugToId.set(cd.slug, cd.id);
      }

      // 2. Create blocks and assign dimensions
      const createdBlocks: Array<{ name: string; slug: string; id: string }> = [];

      for (const blockPlan of plan.blocks) {
        // Validate formula if present
        if (blockPlan.formula) {
          const validation = engine.validateFormula(blockPlan.formula);
          if (!validation.valid) {
            // Skip invalid formulas — create as input block instead
            blockPlan.formula = null;
          }
        }

        const [block] = await db.insert(blocks).values({
          applicationId: app.id,
          name: blockPlan.name,
          slug: blockPlan.slug,
          blockType: blockPlan.blockType,
          description: blockPlan.description,
          formula: blockPlan.formula ?? undefined,
          formatType: blockPlan.formatType,
          sortOrder: createdBlocks.length,
        }).returning();

        if (!block) continue;
        createdBlocks.push({ name: block.name, slug: block.slug, id: block.id });

        // Register formula in the engine
        if (block.formula) {
          const deps = engine.extractDependencies(block.formula);
          engine.addBlock({
            id: block.id,
            name: block.name,
            formula: block.formula,
            dependencies: deps,
          });
        }

        // Assign dimensions
        const dimAssignments = blockPlan.dimensionSlugs
          .map((slug, idx) => {
            const dimId = dimSlugToId.get(slug);
            if (!dimId) return null;
            return { blockId: block.id, dimensionId: dimId, sortOrder: idx };
          })
          .filter((a): a is NonNullable<typeof a> => a !== null);

        if (dimAssignments.length > 0) {
          await db.insert(blockDimensions).values(dimAssignments);
        }
      }

      res.status(201).json({
        success: true,
        data: {
          dimensionsCreated: createdDimensions.length,
          blocksCreated: createdBlocks.length,
          dimensions: createdDimensions,
          blocks: createdBlocks,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to apply model plan';
      res.status(500).json({ success: false, error: message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /:ws/apps/:app/ai/analyze — Analyze data
  // ---------------------------------------------------------------------------

  router.post('/:workspaceSlug/apps/:appSlug/ai/analyze', tenant, async (req, res) => {
    if (!aiService.isAvailable()) {
      res.status(503).json({
        success: false,
        error: 'AI service is not available. Set ANTHROPIC_API_KEY environment variable.',
      });
      return;
    }

    const parsed = aiAnalyzeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const app = await resolveApp(req);
    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    try {
      const { appBlocks, existingDimensions } = await buildContext(app.id);

      // Resolve dimension member IDs to names for readable data
      const allDimMembers = await Promise.all(
        (await db.query.dimensions.findMany({
          where: eq(dimensions.applicationId, app.id),
        })).map(async (d) => {
          const members = await db.query.dimensionMembers.findMany({
            where: eq(dimensionMembers.dimensionId, d.id),
          });
          return { dimSlug: d.slug, members };
        }),
      );
      const memberIdToName = new Map<string, string>();
      for (const group of allDimMembers) {
        for (const m of group.members) {
          memberIdToName.set(m.id, m.name);
        }
      }

      // Fetch cell data for each block
      const blockDataList: BlockData[] = await Promise.all(
        appBlocks.map(async (b) => {
          const blockCells = await db.query.cells.findMany({
            where: eq(cells.blockId, b.id),
          });

          return {
            blockName: b.name,
            blockType: b.blockType,
            formula: b.formula ?? null,
            formatType: b.formatType ?? null,
            cells: blockCells.map((c) => {
              // Translate member IDs to names for readability
              const readableCoords: Record<string, string> = {};
              for (const [key, val] of Object.entries(c.coordinates)) {
                readableCoords[key] = memberIdToName.get(val) ?? val;
              }
              return {
                coordinates: readableCoords,
                numericValue: c.numericValue ?? null,
                textValue: c.textValue ?? null,
              };
            }),
          };
        }),
      );

      const result = await aiService.analyzeData(
        parsed.data.question,
        blockDataList,
        existingDimensions,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      if (err instanceof AIServiceUnavailableError) {
        res.status(503).json({ success: false, error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : 'AI analysis failed';
      res.status(500).json({ success: false, error: message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /:ws/apps/:app/ai/formula — Suggest a formula
  // ---------------------------------------------------------------------------

  router.post('/:workspaceSlug/apps/:appSlug/ai/formula', tenant, async (req, res) => {
    if (!aiService.isAvailable()) {
      res.status(503).json({
        success: false,
        error: 'AI service is not available. Set ANTHROPIC_API_KEY environment variable.',
      });
      return;
    }

    const parsed = aiFormulaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const app = await resolveApp(req);
    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    try {
      const { existingBlocks } = await buildContext(app.id);
      const formula = await aiService.suggestFormula(
        parsed.data.blockName,
        parsed.data.description,
        existingBlocks,
      );
      res.json({ success: true, data: { formula } });
    } catch (err) {
      if (err instanceof AIServiceUnavailableError) {
        res.status(503).json({ success: false, error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : 'AI formula suggestion failed';
      res.status(500).json({ success: false, error: message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /:ws/ai/navigate — Parse navigation intent (workspace-level)
  // ---------------------------------------------------------------------------

  router.post('/:workspaceSlug/ai/navigate', tenant, async (req, res) => {
    if (!aiService.isAvailable()) {
      res.status(503).json({
        success: false,
        error: 'AI service is not available. Set ANTHROPIC_API_KEY environment variable.',
      });
      return;
    }

    const parsed = aiNavigateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    try {
      // Fetch all apps in workspace
      const apps = await db.query.applications.findMany({
        where: eq(applications.workspaceId, req.workspaceId!),
      });

      const availableApps = apps.map((a) => ({ name: a.name, slug: a.slug }));

      // Fetch all blocks and boards across apps
      const availableBlocks: Array<{ name: string; slug: string; appSlug: string }> = [];
      const availableBoards: Array<{ name: string; slug: string; appSlug: string }> = [];

      for (const app of apps) {
        const appBlocks = await db.query.blocks.findMany({
          where: eq(blocks.applicationId, app.id),
        });
        for (const b of appBlocks) {
          availableBlocks.push({ name: b.name, slug: b.slug, appSlug: app.slug });
        }

        const appBoards = await db.query.boards.findMany({
          where: eq(boards.applicationId, app.id),
        });
        for (const b of appBoards) {
          availableBoards.push({ name: b.name, slug: b.slug, appSlug: app.slug });
        }
      }

      const intent = await aiService.parseNavigationIntent(
        parsed.data.query,
        availableApps,
        availableBlocks,
        availableBoards,
      );
      res.json({ success: true, data: intent });
    } catch (err) {
      if (err instanceof AIServiceUnavailableError) {
        res.status(503).json({ success: false, error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : 'AI navigation parsing failed';
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}
