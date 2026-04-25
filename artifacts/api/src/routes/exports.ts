import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import {
  blocks,
  applications,
  cells,
  dimensions,
  dimensionMembers,
  blockDimensions,
  workspaces,
} from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { param } from '../middleware/params.js';
import { exportBlockToExcel, exportAppToExcel } from '../services/export-excel.js';
import { exportBlockToPDF } from '../services/export-pdf.js';
import { exportBlockToPPTX } from '../services/export-pptx.js';
import type { ExportDimension, ExportCell } from '../services/export-excel.js';

interface BlockExportData {
  block: {
    name: string;
    slug: string;
    formatType: string | null;
  };
  dimensions: ExportDimension[];
  cells: ExportCell[];
}

async function fetchBlockExportData(
  db: Database,
  blockId: string,
): Promise<BlockExportData | null> {
  const block = await db.query.blocks.findFirst({
    where: eq(blocks.id, blockId),
  });
  if (!block) return null;

  // Fetch block dimensions in order
  const bdList = await db.query.blockDimensions.findMany({
    where: eq(blockDimensions.blockId, blockId),
    orderBy: (bd, { asc }) => [asc(bd.sortOrder)],
  });

  const dimIds = bdList.map((bd) => bd.dimensionId);

  // Fetch dimension details
  const dimRows = dimIds.length > 0
    ? await Promise.all(
        dimIds.map((id) =>
          db.query.dimensions.findFirst({ where: eq(dimensions.id, id) }),
        ),
      )
    : [];

  // Fetch members for each dimension
  const exportDimensions: ExportDimension[] = [];
  for (const dimRow of dimRows) {
    if (!dimRow) continue;
    const members = await db.query.dimensionMembers.findMany({
      where: eq(dimensionMembers.dimensionId, dimRow.id),
      orderBy: (m, { asc }) => [asc(m.sortOrder)],
    });
    exportDimensions.push({
      name: dimRow.name,
      members: members.map((m) => ({
        name: m.name,
        code: m.code ?? m.name,
      })),
    });
  }

  // Fetch cells
  const blockCells = await db.query.cells.findMany({
    where: eq(cells.blockId, blockId),
  });

  const exportCells: ExportCell[] = blockCells.map((c) => ({
    coordinates: (c.coordinates ?? {}) as Record<string, string>,
    numericValue: c.numericValue,
    textValue: c.textValue,
  }));

  return {
    block: {
      name: block.name,
      slug: block.slug,
      formatType: block.formatType,
    },
    dimensions: exportDimensions,
    cells: exportCells,
  };
}

async function fetchWorkspaceBranding(
  db: Database,
  workspaceId: string,
): Promise<{ companyName?: string; primaryColor?: string }> {
  const ws = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });
  if (!ws) return {};
  return {
    companyName: (ws as any).brandCompanyName ?? undefined,
    primaryColor: (ws as any).brandPrimaryColor ?? undefined,
  };
}

export function createExportsRouter(db: Database): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  // GET /:ws/apps/:app/blocks/:blockId/export/xlsx
  router.get(
    '/:workspaceSlug/apps/:appSlug/blocks/:blockId/export/xlsx',
    tenant,
    async (req, res) => {
      try {
        const blockId = param(req, 'blockId');
        const data = await fetchBlockExportData(db, blockId);
        if (!data) {
          res.status(404).json({ success: false, error: 'Block not found' });
          return;
        }

        const buffer = await exportBlockToExcel({
          blockName: data.block.name,
          dimensions: data.dimensions,
          cells: data.cells,
          formatType: data.block.formatType ?? undefined,
        });

        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${data.block.slug}-export.xlsx"`,
        );
        res.send(buffer);
      } catch (err) {
        console.error('Excel export error:', err);
        res.status(500).json({ success: false, error: 'Export failed' });
      }
    },
  );

  // GET /:ws/apps/:app/blocks/:blockId/export/pdf
  router.get(
    '/:workspaceSlug/apps/:appSlug/blocks/:blockId/export/pdf',
    tenant,
    async (req, res) => {
      try {
        const blockId = param(req, 'blockId');
        const appSlug = param(req, 'appSlug');

        const data = await fetchBlockExportData(db, blockId);
        if (!data) {
          res.status(404).json({ success: false, error: 'Block not found' });
          return;
        }

        const app = await db.query.applications.findFirst({
          where: and(
            eq(applications.workspaceId, req.workspaceId!),
            eq(applications.slug, appSlug),
          ),
        });

        const branding = await fetchWorkspaceBranding(db, req.workspaceId!);

        const buffer = await exportBlockToPDF({
          blockName: data.block.name,
          appName: app?.name ?? appSlug,
          dimensions: data.dimensions,
          cells: data.cells,
          formatType: data.block.formatType ?? undefined,
          branding,
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${data.block.slug}-export.pdf"`,
        );
        res.send(buffer);
      } catch (err) {
        console.error('PDF export error:', err);
        res.status(500).json({ success: false, error: 'Export failed' });
      }
    },
  );

  // GET /:ws/apps/:app/blocks/:blockId/export/pptx
  router.get(
    '/:workspaceSlug/apps/:appSlug/blocks/:blockId/export/pptx',
    tenant,
    async (req, res) => {
      try {
        const blockId = param(req, 'blockId');
        const appSlug = param(req, 'appSlug');

        const data = await fetchBlockExportData(db, blockId);
        if (!data) {
          res.status(404).json({ success: false, error: 'Block not found' });
          return;
        }

        const app = await db.query.applications.findFirst({
          where: and(
            eq(applications.workspaceId, req.workspaceId!),
            eq(applications.slug, appSlug),
          ),
        });

        const branding = await fetchWorkspaceBranding(db, req.workspaceId!);

        const buffer = await exportBlockToPPTX({
          blockName: data.block.name,
          appName: app?.name ?? appSlug,
          dimensions: data.dimensions,
          cells: data.cells,
          formatType: data.block.formatType ?? undefined,
          branding,
        });

        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${data.block.slug}-export.pptx"`,
        );
        res.send(buffer);
      } catch (err) {
        console.error('PPTX export error:', err);
        res.status(500).json({ success: false, error: 'Export failed' });
      }
    },
  );

  // GET /:ws/apps/:app/export/xlsx — download entire app as Excel
  router.get(
    '/:workspaceSlug/apps/:appSlug/export/xlsx',
    tenant,
    async (req, res) => {
      try {
        const appSlug = param(req, 'appSlug');
        const app = await db.query.applications.findFirst({
          where: and(
            eq(applications.workspaceId, req.workspaceId!),
            eq(applications.slug, appSlug),
          ),
        });

        if (!app) {
          res.status(404).json({ success: false, error: 'Application not found' });
          return;
        }

        const appBlocks = await db.query.blocks.findMany({
          where: eq(blocks.applicationId, app.id),
          orderBy: (b, { asc }) => [asc(b.sortOrder)],
        });

        const blockDataList: Array<{
          name: string;
          cells: ExportCell[];
          dimensions: ExportDimension[];
          formatType?: string;
        }> = [];

        for (const block of appBlocks) {
          const data = await fetchBlockExportData(db, block.id);
          if (data) {
            blockDataList.push({
              name: data.block.name,
              cells: data.cells,
              dimensions: data.dimensions,
              formatType: data.block.formatType ?? undefined,
            });
          }
        }

        const buffer = await exportAppToExcel({
          appName: app.name,
          blocks: blockDataList,
        });

        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${app.slug}-full-export.xlsx"`,
        );
        res.send(buffer);
      } catch (err) {
        console.error('App Excel export error:', err);
        res.status(500).json({ success: false, error: 'Export failed' });
      }
    },
  );

  return router;
}
