import { Router } from 'express';
import { eq, and, ilike, or, sql } from 'drizzle-orm';
import { applications, blocks, dimensions, boards } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';

interface SearchResult {
  type: 'app' | 'block' | 'dimension' | 'board';
  id: string;
  name: string;
  slug: string;
  appSlug?: string;
  appName?: string;
  icon?: string;
}

export function createSearchRouter(db: Database): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  router.get('/:workspaceSlug/search', tenant, async (req, res) => {
    const q = (req.query['q'] as string ?? '').trim();
    const limit = Math.min(parseInt(req.query['limit'] as string ?? '10', 10), 50);

    if (!q || q.length < 2) {
      res.json({ success: true, data: { results: [] } });
      return;
    }

    const pattern = `%${q}%`;
    const workspaceId = req.workspaceId!;

    const wsApps = await db.query.applications.findMany({
      where: eq(applications.workspaceId, workspaceId),
    });

    if (wsApps.length === 0) {
      res.json({ success: true, data: { results: [] } });
      return;
    }

    const appIds = wsApps.map((a) => a.id);
    const appMap = new Map(wsApps.map((a) => [a.id, a]));

    const results: SearchResult[] = [];

    const matchingApps = wsApps.filter(
      (a) =>
        a.name.toLowerCase().includes(q.toLowerCase()) ||
        a.slug.toLowerCase().includes(q.toLowerCase()),
    );
    for (const a of matchingApps.slice(0, limit)) {
      results.push({
        type: 'app',
        id: a.id,
        name: a.name,
        slug: a.slug,
        icon: a.icon ?? undefined,
      });
    }

    const matchingBlocks = await db
      .select({
        id: blocks.id,
        name: blocks.name,
        slug: blocks.slug,
        applicationId: blocks.applicationId,
      })
      .from(blocks)
      .where(
        and(
          sql`${blocks.applicationId} IN ${appIds}`,
          or(ilike(blocks.name, pattern), ilike(blocks.slug, pattern)),
        ),
      )
      .limit(limit);

    for (const b of matchingBlocks) {
      const app = appMap.get(b.applicationId);
      results.push({
        type: 'block',
        id: b.id,
        name: b.name,
        slug: b.slug,
        appSlug: app?.slug,
        appName: app?.name,
      });
    }

    const matchingDimensions = await db
      .select({
        id: dimensions.id,
        name: dimensions.name,
        slug: dimensions.slug,
        applicationId: dimensions.applicationId,
      })
      .from(dimensions)
      .where(
        and(
          sql`${dimensions.applicationId} IN ${appIds}`,
          or(ilike(dimensions.name, pattern), ilike(dimensions.slug, pattern)),
        ),
      )
      .limit(limit);

    for (const d of matchingDimensions) {
      const app = appMap.get(d.applicationId);
      results.push({
        type: 'dimension',
        id: d.id,
        name: d.name,
        slug: d.slug,
        appSlug: app?.slug,
        appName: app?.name,
      });
    }

    const matchingBoards = await db
      .select({
        id: boards.id,
        name: boards.name,
        slug: boards.slug,
        applicationId: boards.applicationId,
      })
      .from(boards)
      .where(
        and(
          sql`${boards.applicationId} IN ${appIds}`,
          or(ilike(boards.name, pattern), ilike(boards.slug, pattern)),
        ),
      )
      .limit(limit);

    for (const b of matchingBoards) {
      const app = appMap.get(b.applicationId);
      results.push({
        type: 'board',
        id: b.id,
        name: b.name,
        slug: b.slug,
        appSlug: app?.slug,
        appName: app?.name,
      });
    }

    res.json({ success: true, data: { results: results.slice(0, limit) } });
  });

  return router;
}
