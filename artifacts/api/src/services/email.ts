import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? 'PlanningPlatform <noreply@planningplatform.io>';

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
      console.log(`[EmailService] SMTP configured: ${SMTP_HOST}:${SMTP_PORT}`);
    } else {
      console.warn('[EmailService] SMTP not configured — emails will be logged to console');
    }
  }

  isAvailable(): boolean {
    return this.transporter !== null;
  }

  async sendEmail(params: {
    to: string | string[];
    subject: string;
    text: string;
    html?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const recipients = Array.isArray(params.to) ? params.to.join(', ') : params.to;

    if (!this.transporter) {
      console.log('[EmailService] DEV EMAIL ================================');
      console.log(`  To:      ${recipients}`);
      console.log(`  Subject: ${params.subject}`);
      console.log(`  Body:    ${params.text}`);
      console.log('[EmailService] ==========================================');
      return { success: true, messageId: `dev-${Date.now()}` };
    }

    try {
      const info = await this.transporter.sendMail({
        from: SMTP_FROM,
        to: recipients,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown email error';
      console.error('[EmailService] Send failed:', message);
      return { success: false, error: message };
    }
  }

  async sendNotification(params: {
    to: string;
    userName: string;
    title: string;
    body: string;
    link?: string;
    appName?: string;
  }): Promise<void> {
    const linkHtml = params.link
      ? `<p><a href="${params.link}" style="display:inline-block;padding:10px 20px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">View Details</a></p>`
      : '';

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px;">
        <div style="border-bottom:2px solid #3b82f6;padding-bottom:16px;margin-bottom:24px;">
          <h2 style="margin:0;color:#1a1a1a;">PlanningPlatform${params.appName ? ` &middot; ${params.appName}` : ''}</h2>
        </div>
        <p style="color:#555;">Hi ${params.userName},</p>
        <h3 style="color:#1a1a1a;">${params.title}</h3>
        <p style="color:#333;line-height:1.6;">${params.body}</p>
        ${linkHtml}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#999;font-size:12px;">You received this because you're subscribed to workflow notifications.</p>
      </div>
    `;

    await this.sendEmail({
      to: params.to,
      subject: `[PlanningPlatform] ${params.title}`,
      text: `Hi ${params.userName},\n\n${params.title}\n\n${params.body}${params.link ? `\n\nView: ${params.link}` : ''}`,
      html,
    });
  }

  async sendWorkflowAlert(params: {
    to: string | string[];
    workflowName: string;
    triggerDescription: string;
    details: Record<string, unknown>;
  }): Promise<void> {
    const detailRows = Object.entries(params.details)
      .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#555;font-weight:600;">${k}</td><td style="padding:4px 0;color:#333;">${String(v)}</td></tr>`)
      .join('');

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px;">
        <div style="border-bottom:2px solid #f59e0b;padding-bottom:16px;margin-bottom:24px;">
          <h2 style="margin:0;color:#1a1a1a;">Workflow Alert</h2>
        </div>
        <p style="color:#333;">Workflow <strong>${params.workflowName}</strong> was triggered.</p>
        <p style="color:#555;">${params.triggerDescription}</p>
        <table style="border-collapse:collapse;margin:16px 0;">${detailRows}</table>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#999;font-size:12px;">Automated workflow notification from PlanningPlatform.</p>
      </div>
    `;

    const detailText = Object.entries(params.details)
      .map(([k, v]) => `  ${k}: ${String(v)}`)
      .join('\n');

    await this.sendEmail({
      to: params.to,
      subject: `[PlanningPlatform] Workflow: ${params.workflowName}`,
      text: `Workflow "${params.workflowName}" was triggered.\n\n${params.triggerDescription}\n\nDetails:\n${detailText}`,
      html,
    });
  }
}

export const emailService = new EmailService();
