import { eq, and } from 'drizzle-orm';
import { workflows, workflowRuns, notifications } from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import { emailService } from './email.js';

export class WorkflowEngine {
  constructor(private db: Database) {}

  /**
   * Find and execute all active workflows matching a trigger.
   * This is designed to be called fire-and-forget — callers should NOT await.
   */
  async executeTrigger(params: {
    applicationId: string;
    triggerType: 'cell_change' | 'version_lock' | 'schedule' | 'manual';
    triggerData: Record<string, unknown>;
    userId: string;
  }): Promise<void> {
    try {
      const matching = await this.db.query.workflows.findMany({
        where: and(
          eq(workflows.applicationId, params.applicationId),
          eq(workflows.triggerType, params.triggerType),
          eq(workflows.isActive, 1),
        ),
      });

      for (const workflow of matching) {
        if (!this.matchesTriggerConfig(workflow.triggerConfig, params.triggerData, params.triggerType)) {
          // Log skipped run
          await this.db.insert(workflowRuns).values({
            workflowId: workflow.id,
            status: 'skipped',
            triggerData: params.triggerData,
            result: { reason: 'Trigger config did not match' },
          });
          continue;
        }

        const start = Date.now();
        try {
          await this.executeAction(workflow, params.triggerData, params.userId);
          const durationMs = Date.now() - start;

          await this.db.insert(workflowRuns).values({
            workflowId: workflow.id,
            status: 'success',
            triggerData: params.triggerData,
            result: { message: 'Action executed successfully' },
            durationMs,
          });

          await this.db.update(workflows)
            .set({ lastRunAt: new Date() })
            .where(eq(workflows.id, workflow.id));
        } catch (err) {
          const durationMs = Date.now() - start;
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';

          await this.db.insert(workflowRuns).values({
            workflowId: workflow.id,
            status: 'failure',
            triggerData: params.triggerData,
            result: { error: errorMessage },
            durationMs,
          });

          console.error(`[WorkflowEngine] Action failed for workflow ${workflow.id}:`, errorMessage);
        }
      }
    } catch (err) {
      // Top-level catch — never let workflow execution crash the calling context
      console.error('[WorkflowEngine] executeTrigger failed:', err);
    }
  }

  /**
   * Check whether the trigger data matches the workflow's trigger config.
   * Examples:
   *   - cell_change: triggerConfig.blockId must match triggerData.blockId (if set)
   *   - version_lock: triggerConfig.versionType matches (if set)
   *   - manual / schedule: always match (config is for action side)
   */
  private matchesTriggerConfig(
    config: Record<string, unknown> | null,
    data: Record<string, unknown>,
    triggerType: string,
  ): boolean {
    if (!config || Object.keys(config).length === 0) return true;

    if (triggerType === 'cell_change') {
      // If the workflow is scoped to a specific block, check it
      if (config.blockId && config.blockId !== data.blockId) return false;
    }

    if (triggerType === 'version_lock') {
      if (config.versionType && config.versionType !== data.versionType) return false;
    }

    return true;
  }

  private async executeAction(
    workflow: typeof workflows.$inferSelect,
    triggerData: Record<string, unknown>,
    userId: string,
  ): Promise<void> {
    const config = workflow.actionConfig ?? {};

    switch (workflow.actionType) {
      case 'notify': {
        // Create in-app notifications for configured user IDs
        const targetUserIds = Array.isArray(config.userIds)
          ? (config.userIds as string[])
          : [userId];

        const title = (config.title as string) ?? `Workflow: ${workflow.name}`;
        const body = this.interpolateTemplate(
          (config.message as string) ?? 'A workflow was triggered.',
          triggerData,
        );

        for (const uid of targetUserIds) {
          await this.db.insert(notifications).values({
            userId: uid,
            type: 'system',
            title,
            body,
            link: (config.link as string) ?? null,
            sourceUserId: userId,
          });
        }
        break;
      }

      case 'email': {
        const recipients = Array.isArray(config.recipients)
          ? (config.recipients as string[])
          : typeof config.recipients === 'string'
            ? [config.recipients]
            : [];

        if (recipients.length === 0) {
          throw new Error('No email recipients configured');
        }

        const triggerDescription = this.interpolateTemplate(
          (config.message as string) ?? `Trigger: ${workflow.triggerType}`,
          triggerData,
        );

        await emailService.sendWorkflowAlert({
          to: recipients,
          workflowName: workflow.name,
          triggerDescription,
          details: triggerData,
        });
        break;
      }

      case 'webhook': {
        const url = config.url as string;
        if (!url) throw new Error('No webhook URL configured');

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(config.headers as Record<string, string> ?? {}),
        };

        // Add optional secret for HMAC verification
        if (config.secret) {
          headers['X-Webhook-Secret'] = config.secret as string;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            workflow: { id: workflow.id, name: workflow.name },
            trigger: { type: workflow.triggerType, data: triggerData },
            timestamp: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(10_000), // 10s timeout
        });

        if (!response.ok) {
          throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
        }
        break;
      }

      default:
        throw new Error(`Unknown action type: ${workflow.actionType}`);
    }
  }

  /**
   * Replace {{key}} placeholders in a template string with trigger data values.
   */
  private interpolateTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      return data[key] !== undefined ? String(data[key]) : `{{${key}}}`;
    });
  }
}
