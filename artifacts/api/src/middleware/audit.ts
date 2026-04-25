import type { Request, Response, NextFunction } from 'express';
import { auditLogs } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';

export interface AuditLogParams {
  workspaceId: string;
  userId: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export type AuditLogFn = (params: AuditLogParams) => Promise<void>;

declare global {
  namespace Express {
    interface Request {
      audit?: AuditLogFn;
      clientIp?: string;
    }
  }
}

export function createAuditLogger(db: Database): AuditLogFn {
  return async function logAudit(params: AuditLogParams): Promise<void> {
    await db.insert(auditLogs).values({
      workspaceId: params.workspaceId,
      userId: params.userId,
      userEmail: params.userEmail,
      action: params.action as typeof auditLogs.$inferInsert.action,
      resourceType: params.resourceType as typeof auditLogs.$inferInsert.resourceType,
      resourceId: params.resourceId,
      resourceName: params.resourceName,
      details: params.details,
      ipAddress: params.ipAddress,
    });
  };
}

export function auditMiddleware(db: Database) {
  const logAudit = createAuditLogger(db);

  return (_req: Request, _res: Response, next: NextFunction): void => {
    _req.audit = logAudit;
    _req.clientIp = _req.ip || (_req.headers['x-forwarded-for'] as string) || 'unknown';
    next();
  };
}
