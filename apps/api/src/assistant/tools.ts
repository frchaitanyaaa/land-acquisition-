import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import type { DbService } from '../common/db/db.service';
import { rows } from '../common/db/raw';
import type { AnalyticsService } from '../dashboards/analytics.service';
import type { DashboardsService } from '../dashboards/dashboards.service';

// Whitelisted, READ-ONLY analytics tools (§24.5). Each runs under the caller's RLS scope; the model
// never writes SQL and no mutating tool exists.

export interface ToolDeps {
  db: DbService;
  dashboards: DashboardsService;
  analytics: AnalyticsService;
}

export interface AssistantTool {
  name: string;
  description: string;
  schema: z.ZodObject;
  run: (deps: ToolDeps, user: AuthUser, input: Record<string, unknown>) => Promise<unknown>;
}

export const TOOLS: AssistantTool[] = [
  {
    name: 'get_kpis',
    description:
      "Headline land-acquisition KPIs (area notified/acquired, compensation assessed/paid/acknowledged, families, possession %, timeline adherence) for the caller's scope, optionally one state.",
    schema: z.object({ stateCode: z.string().optional() }),
    run: async (d, u, i) =>
      (await (i.stateCode ? d.dashboards.state(u, String(i.stateCode)) : d.dashboards.national(u))).kpis,
  },
  {
    name: 'list_breaching_deadlines',
    description:
      'Open statutory deadlines that are breached or due within N days, with section, consequence and days remaining.',
    schema: z.object({ withinDays: z.number().int().min(0).max(3650).default(30) }),
    run: async (d, u, i) =>
      (await d.dashboards.deadlineBoard(u, Number(i.withinDays ?? 30)))
        .filter(
          (x) =>
            (x as { subject_type: string }).subject_type === 'PROJECT' ||
            (x as { subject_type: string }).subject_type === 'STAGE',
        )
        .slice(0, 25),
  },
  {
    name: 'stage_bottlenecks',
    description: 'Per-stage instances, returns, median days in stage, and the most frequent return reason codes.',
    schema: z.object({}),
    run: (d, u) => d.analytics.bottlenecks(u),
  },
  {
    name: 'disbursement_gap',
    description: 'Money disbursed vs acknowledged by families (the unconfirmed gap), per project.',
    schema: z.object({}),
    run: (d, u) =>
      d.db.withScope(u, (tx) =>
        rows(
          tx,
          sql`SELECT p.code, sum(m.disbursed_paise)::text AS disbursed_paise, sum(m.acknowledged_paise)::text AS acknowledged_paise,
                     sum(m.unconfirmed_paise)::text AS unconfirmed_paise, count(*) FILTER (WHERE m.unconfirmed_paise > 0)::int AS families_unconfirmed
              FROM v_family_money m JOIN projects p ON p.id = m.project_id GROUP BY p.code HAVING sum(m.disbursed_paise) > 0 ORDER BY 4 DESC`,
        ),
      ),
  },
  {
    name: 'district_ranking',
    description:
      'Districts ranked by a metric: deadlines_breached, compensation_unconfirmed_paise, possession_pct or timeline_adherence_pct.',
    schema: z.object({
      metric: z.enum([
        'deadlines_breached',
        'compensation_unconfirmed_paise',
        'possession_pct',
        'timeline_adherence_pct',
      ]),
    }),
    run: async (d, u, i) => {
      const dist = (await d.dashboards.national(u)).districts as Array<Record<string, unknown>>;
      const m = String(i.metric);
      return dist
        .map((x) => ({ district: x.district_name, value: x[m] }))
        .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));
    },
  },
  {
    name: 'project_summary',
    description: 'Summary of one project by its code (e.g. MH-PSX-2026-001): status, stage, KPIs, next deadlines.',
    schema: z.object({ projectCode: z.string() }),
    run: async (d, u, i) => {
      const p = await d.db.withScope(u, (tx) =>
        rows<{ id: string }>(tx, sql`SELECT id FROM projects WHERE code = ${String(i.projectCode)}`),
      );
      if (!p[0]) return { error: 'No such project in your jurisdiction.' };
      const r = await d.dashboards.project(u, p[0].id);
      return { kpis: r.kpis, deadlines: (r.deadlines as unknown[]).slice(0, 10), money: r.money, consent: r.consent };
    },
  },
  {
    name: 'explain_deadline',
    description:
      'Explain one deadline by id: clock, section, start event, due date, consequence and delay-risk factors.',
    schema: z.object({ deadlineId: z.string() }),
    run: async (d, u, i) => {
      const risk = await d.analytics.risk(u);
      const r = risk.find((x) => x.deadlineId === String(i.deadlineId));
      return r ?? { error: 'Deadline not found (or not an open project/stage deadline in your scope).' };
    },
  },
];

export function toolSchemaJson(t: AssistantTool): Record<string, unknown> {
  const s = z.toJSONSchema(t.schema) as Record<string, unknown>;
  delete s.$schema;
  return s;
}
