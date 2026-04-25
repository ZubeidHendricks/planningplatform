import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { cells, blocks, dimensions, blockDimensions } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { forecastRequestSchema, anomalyRequestSchema } from '@planning-platform/shared';
import { forecast, autoForecast, type ForecastInput } from '../services/forecasting.js';
import { detectAnomalies } from '../services/anomaly.js';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Heuristic: a dimension name is temporal if it contains time-related keywords. */
const TIME_KEYWORDS = ['time', 'date', 'month', 'year', 'quarter', 'week', 'period', 'day'];

function isTemporalDimension(name: string): boolean {
  const lower = name.toLowerCase();
  return TIME_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Attempt to parse a member name into a sortable numeric key so that
 * temporal members like "Jan 2024", "2024-01", "Q1 2024" are ordered
 * chronologically. Falls back to the original string for alphabetical sort.
 */
function temporalSortKey(member: string): number {
  // ISO-like: "2024-01", "2024-01-15"
  const isoMatch = member.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (isoMatch) {
    return Number(isoMatch[1]) * 10000 + Number(isoMatch[2]) * 100 + Number(isoMatch[3] ?? '1');
  }

  // Month abbreviations
  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const monthYearMatch = member.match(/^([A-Za-z]+)\s*(\d{4})$/);
  if (monthYearMatch) {
    const m = months[monthYearMatch[1]!.slice(0, 3).toLowerCase()];
    if (m !== undefined) {
      return Number(monthYearMatch[2]) * 100 + m;
    }
  }

  // Quarter: "Q1 2024"
  const qMatch = member.match(/^Q(\d)\s*(\d{4})$/i);
  if (qMatch) {
    return Number(qMatch[2]) * 10 + Number(qMatch[1]);
  }

  // Plain number or year
  const num = Number(member);
  if (Number.isFinite(num)) return num;

  // Non-parsable — return NaN and fall back to string sort
  return NaN;
}

/**
 * Extract an ordered numeric time series from cell data for a given block.
 * Auto-detects the temporal dimension, or uses the first dimension if none is clearly temporal.
 */
async function extractTimeSeries(
  db: Database,
  blockId: string,
  dimensionFilters?: Record<string, string>,
): Promise<{ values: number[]; timeDimension: string | null }> {
  // Get block dimensions to identify the temporal one
  const bDims = await db.query.blockDimensions.findMany({
    where: eq(blockDimensions.blockId, blockId),
  });

  const dimIds = bDims.map((bd) => bd.dimensionId);
  let timeDimSlug: string | null = null;

  if (dimIds.length > 0) {
    const allDims = await db.query.dimensions.findMany();
    const blockDimList = allDims.filter((d) => dimIds.includes(d.id));

    // Pick the first temporal dimension; if none, use the first dimension
    const temporal = blockDimList.find((d) => isTemporalDimension(d.name));
    timeDimSlug = temporal?.slug ?? blockDimList[0]?.slug ?? null;
  }

  // Fetch all cells for this block
  const allCells = await db.query.cells.findMany({
    where: eq(cells.blockId, blockId),
  });

  // Apply dimension filters
  let filtered = allCells;
  if (dimensionFilters && Object.keys(dimensionFilters).length > 0) {
    filtered = allCells.filter((cell) => {
      const coords = cell.coordinates as Record<string, string>;
      return Object.entries(dimensionFilters).every(([dim, val]) => coords[dim] === val);
    });
  }

  // Only keep cells with numeric values
  const numeric = filtered.filter((c) => c.numericValue !== null);

  if (numeric.length === 0) {
    return { values: [], timeDimension: timeDimSlug };
  }

  // Sort by temporal dimension if available
  if (timeDimSlug) {
    numeric.sort((a, b) => {
      const coordA = (a.coordinates as Record<string, string>)[timeDimSlug!] ?? '';
      const coordB = (b.coordinates as Record<string, string>)[timeDimSlug!] ?? '';
      const keyA = temporalSortKey(coordA);
      const keyB = temporalSortKey(coordB);
      if (Number.isFinite(keyA) && Number.isFinite(keyB)) return keyA - keyB;
      return coordA.localeCompare(coordB);
    });
  }

  const values = numeric.map((c) => c.numericValue!);
  return { values, timeDimension: timeDimSlug };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createAnalyticsRouter(db: Database): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  // POST /:ws/apps/:app/analytics/forecast
  router.post('/:workspaceSlug/apps/:appSlug/analytics/forecast', tenant, async (req, res) => {
    const parsed = forecastRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const { blockId, dimensionFilters, periods, method } = parsed.data;

    // Verify block exists
    const block = await db.query.blocks.findFirst({ where: eq(blocks.id, blockId) });
    if (!block) {
      res.status(404).json({ success: false, error: 'Block not found' });
      return;
    }

    const { values, timeDimension } = await extractTimeSeries(db, blockId, dimensionFilters);

    if (values.length === 0) {
      res.status(400).json({ success: false, error: 'No numeric data found for the specified block and filters' });
      return;
    }

    let result;
    if (method) {
      result = forecast({ values, periods, method } as ForecastInput);
    } else {
      result = autoForecast(values, periods);
    }

    res.json({
      success: true,
      data: {
        historical: values,
        timeDimension,
        ...result,
      },
    });
  });

  // POST /:ws/apps/:app/analytics/anomalies
  router.post('/:workspaceSlug/apps/:appSlug/analytics/anomalies', tenant, async (req, res) => {
    const parsed = anomalyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const { blockId, dimensionFilters } = parsed.data;

    // Verify block exists
    const block = await db.query.blocks.findFirst({ where: eq(blocks.id, blockId) });
    if (!block) {
      res.status(404).json({ success: false, error: 'Block not found' });
      return;
    }

    const { values, timeDimension } = await extractTimeSeries(db, blockId, dimensionFilters);

    if (values.length === 0) {
      res.status(400).json({ success: false, error: 'No numeric data found for the specified block and filters' });
      return;
    }

    const result = detectAnomalies(values);

    res.json({
      success: true,
      data: {
        values,
        timeDimension,
        ...result,
      },
    });
  });

  return router;
}
