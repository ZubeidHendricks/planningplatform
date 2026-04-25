import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { comments, applications, users, notifications } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { createCommentSchema, updateCommentSchema } from '@planning-platform/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { param } from '../middleware/params.js';

export function createCommentsRouter(db: Database): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  // -----------------------------------------------------------------------
  // GET /:ws/apps/:app/comments?targetType=block&targetId=xxx
  // -----------------------------------------------------------------------
  router.get('/:workspaceSlug/apps/:appSlug/comments', tenant, async (req, res) => {
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

    const targetType = req.query['targetType'] as 'block' | 'board' | 'cell' | undefined;
    const targetId = req.query['targetId'] as string | undefined;

    if (!targetType || !targetId) {
      res.status(400).json({ success: false, error: 'targetType and targetId are required' });
      return;
    }

    if (!['block', 'board', 'cell'].includes(targetType)) {
      res.status(400).json({ success: false, error: 'Invalid targetType' });
      return;
    }

    const result = await db.query.comments.findMany({
      where: and(
        eq(comments.applicationId, app.id),
        eq(comments.targetType, targetType),
        eq(comments.targetId, targetId),
      ),
      orderBy: (c, { asc }) => [asc(c.createdAt)],
    });

    // Join with users to include author info
    const userIds = [...new Set(result.map((c) => c.userId))];
    const userRecords = userIds.length > 0
      ? await Promise.all(
          userIds.map((uid) =>
            db.query.users.findFirst({ where: eq(users.id, uid) }),
          ),
        )
      : [];

    const userMap = new Map(
      userRecords.filter(Boolean).map((u) => [u!.id, u!]),
    );

    const data = result.map((c) => {
      const user = userMap.get(c.userId);
      return {
        ...c,
        author: user
          ? { firstName: user.firstName, lastName: user.lastName, email: user.email }
          : { firstName: 'Unknown', lastName: '', email: '' },
      };
    });

    res.json({ success: true, data });
  });

  // -----------------------------------------------------------------------
  // POST /:ws/apps/:app/comments
  // -----------------------------------------------------------------------
  router.post('/:workspaceSlug/apps/:appSlug/comments', tenant, async (req, res) => {
    const parsed = createCommentSchema.safeParse(req.body);
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

    const { targetType, targetId, parentCommentId, body, mentions } = parsed.data;

    const [comment] = await db.insert(comments).values({
      applicationId: app.id,
      userId: req.auth!.userId,
      targetType,
      targetId,
      parentCommentId: parentCommentId ?? null,
      body,
      mentions: mentions ?? [],
    }).returning();

    // Get the author info for response
    const author = await db.query.users.findFirst({
      where: eq(users.id, req.auth!.userId),
    });

    const authorName = author
      ? `${author.firstName} ${author.lastName}`
      : 'Someone';

    // Create notifications for mentioned users
    const mentionList = mentions ?? [];
    for (const mentionedUserId of mentionList) {
      if (mentionedUserId === req.auth!.userId) continue; // don't notify self
      await db.insert(notifications).values({
        userId: mentionedUserId,
        type: 'mention',
        title: `${authorName} mentioned you`,
        body: body.length > 200 ? body.slice(0, 200) + '...' : body,
        link: `/pps/apps/${app.slug}/${targetType}s/${targetId}`,
        sourceUserId: req.auth!.userId,
      });
    }

    // If it's a reply, also notify the parent comment's author
    if (parentCommentId) {
      const parentComment = await db.query.comments.findFirst({
        where: eq(comments.id, parentCommentId),
      });
      if (
        parentComment &&
        parentComment.userId !== req.auth!.userId &&
        !mentionList.includes(parentComment.userId)
      ) {
        await db.insert(notifications).values({
          userId: parentComment.userId,
          type: 'reply',
          title: `${authorName} replied to your comment`,
          body: body.length > 200 ? body.slice(0, 200) + '...' : body,
          link: `/pps/apps/${app.slug}/${targetType}s/${targetId}`,
          sourceUserId: req.auth!.userId,
        });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        ...comment,
        author: author
          ? { firstName: author.firstName, lastName: author.lastName, email: author.email }
          : { firstName: 'Unknown', lastName: '', email: '' },
      },
    });
  });

  // -----------------------------------------------------------------------
  // PATCH /:ws/apps/:app/comments/:commentId
  // -----------------------------------------------------------------------
  router.patch('/:workspaceSlug/apps/:appSlug/comments/:commentId', tenant, async (req, res) => {
    const parsed = updateCommentSchema.safeParse(req.body);
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

    const updateData: Record<string, unknown> = {};
    if (parsed.data.body !== undefined) updateData['body'] = parsed.data.body;
    if (parsed.data.isResolved !== undefined) updateData['isResolved'] = parsed.data.isResolved;

    const [updated] = await db.update(comments)
      .set(updateData)
      .where(and(
        eq(comments.id, param(req, 'commentId')),
        eq(comments.applicationId, app.id),
      ))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'Comment not found' });
      return;
    }

    res.json({ success: true, data: updated });
  });

  // -----------------------------------------------------------------------
  // DELETE /:ws/apps/:app/comments/:commentId
  // -----------------------------------------------------------------------
  router.delete('/:workspaceSlug/apps/:appSlug/comments/:commentId', tenant, async (req, res) => {
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

    // Only allow the author to delete
    const existing = await db.query.comments.findFirst({
      where: and(
        eq(comments.id, param(req, 'commentId')),
        eq(comments.applicationId, app.id),
      ),
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Comment not found' });
      return;
    }

    if (existing.userId !== req.auth!.userId) {
      res.status(403).json({ success: false, error: 'You can only delete your own comments' });
      return;
    }

    const [deleted] = await db.delete(comments)
      .where(eq(comments.id, existing.id))
      .returning();

    res.json({ success: true, data: deleted });
  });

  return router;
}
