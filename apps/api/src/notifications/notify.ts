import { notifications, type Tx } from '@bhoomisetu/db';
import { Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';

// Notification delivery (§28). Worker-side: callers pass a worker (BYPASSRLS) transaction. Every
// notification goes to the RESPONSIBLE POST, deduplicated on (trigger, entity, level).

const logger = new Logger('Notify');
let transport: Transporter | null = null;

export interface NotifyInput {
  recipientPostId: string;
  trigger: string;
  severity: 'info' | 'warn' | 'critical';
  entityType: string;
  entityId: string;
  title: string;
  body?: string;
  deepLink?: string;
  escalationLevel?: number;
  email?: boolean;
  sms?: boolean;
}

async function q<T>(tx: Tx, query: ReturnType<typeof sql>): Promise<T[]> {
  return ((await tx.execute(query)) as unknown as { rows: T[] }).rows;
}

/** Posts with `role` responsible for a project: the most specific jurisdiction wins (district → state → project). */
export async function responsiblePosts(tx: Tx, projectId: string, roles: string[]): Promise<string[]> {
  const r = await q<{ id: string; rank: number }>(
    tx,
    sql`SELECT po.id, CASE po.jurisdiction_level WHEN 'PROJECT' THEN 1 WHEN 'DISTRICT' THEN 2 WHEN 'STATE' THEN 3 ELSE 4 END AS rank
        FROM posts po, projects p
        WHERE p.id = ${projectId} AND po.is_active AND po.role::text = ANY(string_to_array(${roles.join(',')}, ','))
          AND ((po.jurisdiction_level = 'DISTRICT' AND po.district_code = ANY(project_district_codes(p.id)))
            OR (po.jurisdiction_level = 'STATE' AND (po.state_code = p.state_code
                 OR po.state_code IN (SELECT d.state_code FROM districts d WHERE d.code = ANY(project_district_codes(p.id)))))
            OR (po.jurisdiction_level = 'PROJECT' AND (po.project_id = p.id OR po.requiring_body_id = p.requiring_body_id)))`,
  );
  if (!r.length) return [];
  const best = Math.min(...r.map((x) => x.rank));
  return r.filter((x) => x.rank === best).map((x) => x.id);
}

export async function postsByLevel(
  tx: Tx,
  projectId: string,
  level: 'DISTRICT' | 'STATE',
  role: string,
): Promise<string[]> {
  const r = await q<{ id: string }>(
    tx,
    level === 'DISTRICT'
      ? sql`SELECT po.id FROM posts po WHERE po.is_active AND po.role::text = ${role} AND po.jurisdiction_level = 'DISTRICT'
              AND po.district_code = ANY(project_district_codes(${projectId}::uuid))`
      : sql`SELECT po.id FROM posts po, projects p WHERE p.id = ${projectId} AND po.is_active AND po.role::text = ${role}
              AND po.jurisdiction_level = 'STATE' AND po.state_code = p.state_code`,
  );
  return r.map((x) => x.id);
}

export async function notify(tx: Tx, n: NotifyInput): Promise<boolean> {
  const level = n.escalationLevel ?? 0;
  const dup = await q<{ id: string }>(
    tx,
    sql`SELECT id FROM notifications WHERE recipient_post_id = ${n.recipientPostId} AND trigger = ${n.trigger}
          AND entity_id = ${n.entityId} AND escalation_level = ${level} LIMIT 1`,
  );
  if (dup.length) return false;
  const channels: Record<string, unknown> = { inApp: true };
  if (n.email) channels.email = await sendEmail(tx, n.recipientPostId, n.title, n.body ?? '');
  if (n.sms) channels.sms = 'mock';
  await tx.insert(notifications).values({
    recipientPostId: n.recipientPostId,
    trigger: n.trigger,
    severity: n.severity,
    escalationLevel: level,
    entityType: n.entityType,
    entityId: n.entityId,
    title: n.title,
    body: n.body ?? null,
    deepLink: n.deepLink ?? null,
    channels,
  });
  return true;
}

async function sendEmail(tx: Tx, postId: string, subject: string, text: string): Promise<string> {
  try {
    const to = await q<{ email: string }>(
      tx,
      sql`SELECT u.email FROM post_assignments pa JOIN users u ON u.id = pa.user_id
          WHERE pa.post_id = ${postId} AND pa.valid_from <= now() AND (pa.valid_to IS NULL OR pa.valid_to > now())`,
    );
    if (!to.length) return 'no-holder';
    const e = env();
    transport ??= nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: false,
      connectionTimeout: 1500,
      greetingTimeout: 1500,
    });
    await transport.sendMail({
      from: 'BhoomiSetu <no-reply@bhoomisetu.local>',
      to: to.map((t) => t.email).join(','),
      subject: `[BhoomiSetu] ${subject}`,
      text,
    });
    return 'sent';
  } catch (err) {
    logger.debug(`email not sent: ${(err as Error).message}`);
    return 'failed';
  }
}
