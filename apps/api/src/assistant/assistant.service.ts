import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import type { AuthUser } from '../common/auth-user';
import { DbService } from '../common/db/db.service';
import { ProblemException } from '../common/errors/problem';
import { toJsonSafe } from '../common/json';
import { env } from '../config/env';
import { AnalyticsService } from '../dashboards/analytics.service';
import { DashboardsService } from '../dashboards/dashboards.service';
import { TOOLS, toolSchemaJson } from './tools';

const MAX_TURNS = 6;
const SYSTEM = `You are the BhoomiSetu analytics assistant for officers monitoring land acquisition under the RFCTLARR Act 2013.
Answer only from the tool results you receive; cite the numbers you use. Money values are integer paise (100 paise = ₹1) — present them in rupees with Indian grouping.
You are advisory: you cannot change any record, and you must not state legal conclusions beyond the consequence texts the tools return. If the tools cannot answer, say so.`;

export interface ToolCallLog {
  tool: string;
  input: unknown;
  output: unknown;
}

/** §24.5 — tool-calling only, under the caller's RLS scope. Provider: mock (deterministic) | real (Claude). */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger('Assistant');
  private client: Anthropic | null = null;

  constructor(
    private readonly db: DbService,
    private readonly dashboards: DashboardsService,
    private readonly analytics: AnalyticsService,
  ) {}

  private async runTool(user: AuthUser, name: string, input: unknown): Promise<unknown> {
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) return { error: `Unknown tool ${name}` };
    const parsed = tool.schema.safeParse(input ?? {});
    if (!parsed.success) return { error: `Invalid input: ${parsed.error.issues.map((i) => i.message).join('; ')}` };
    return toJsonSafe(
      await tool.run(
        { db: this.db, dashboards: this.dashboards, analytics: this.analytics },
        user,
        parsed.data as Record<string, unknown>,
      ),
    );
  }

  async query(user: AuthUser, question: string) {
    return env().LLM_PROVIDER === 'real' ? this.real(user, question) : this.mock(user, question);
  }

  // ---------------------------------------------------------------- real provider (Claude, manual tool loop)
  private async real(user: AuthUser, question: string) {
    this.client ??= new Anthropic({ apiKey: env().LLM_API_KEY || undefined });
    const tools: Anthropic.Tool[] = TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: toolSchemaJson(t) as Anthropic.Tool.InputSchema,
    }));
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: question }];
    const calls: ToolCallLog[] = [];
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      let response: Anthropic.Message;
      try {
        response = await this.client.messages.create({
          model: env().LLM_MODEL || 'claude-opus-5',
          max_tokens: 16000,
          system: SYSTEM,
          tools,
          messages,
        });
      } catch (e) {
        if (e instanceof Anthropic.APIError)
          throw new ProblemException(
            502,
            'LLM_UNAVAILABLE',
            `The language model is unavailable (${e.status ?? 'network'}).`,
          );
        throw e;
      }
      if (response.stop_reason === 'refusal')
        return { answer: 'The model declined to answer this question.', toolCalls: calls, provider: 'REAL' };
      messages.push({ role: 'assistant', content: response.content });
      if (response.stop_reason === 'pause_turn') continue;
      const uses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      if (response.stop_reason !== 'tool_use' || !uses.length) {
        const answer = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
        return { answer, toolCalls: calls, provider: 'REAL' };
      }
      // All tool results go back in ONE user message.
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const u of uses) {
        const output = await this.runTool(user, u.name, u.input).catch((err: Error) => ({ error: err.message }));
        calls.push({ tool: u.name, input: u.input, output });
        results.push({
          type: 'tool_result',
          tool_use_id: u.id,
          content: JSON.stringify(output).slice(0, 50_000),
          is_error: !!(output as { error?: unknown })?.error,
        });
      }
      messages.push({ role: 'user', content: results });
    }
    return { answer: 'Stopped after the maximum number of tool rounds.', toolCalls: calls, provider: 'REAL' };
  }

  // ---------------------------------------------------------------- mock provider (deterministic, demo)
  private async mock(user: AuthUser, question: string) {
    const q = question.toLowerCase();
    const calls: ToolCallLog[] = [];
    const call = async (tool: string, input: Record<string, unknown> = {}) => {
      const output = await this.runTool(user, tool, input);
      calls.push({ tool, input, output });
      return output;
    };
    const cr = (paise: unknown) => `₹${(Number(paise ?? 0) / 1e9).toFixed(2)} Cr`;
    let answer: string;
    if (/breach|deadline|lapse|overdue/.test(q)) {
      const d = (await call('list_breaching_deadlines', { withinDays: 30 })) as Array<Record<string, unknown>>;
      const breached = d.filter((x) => x.live_status === 'BREACHED');
      answer = d.length
        ? `${breached.length} statutory deadline(s) are breached and ${d.length - breached.length} fall due within 30 days. ` +
          d
            .slice(0, 5)
            .map(
              (x) =>
                `${x.project_code}: ${x.clock_code} (s.${x.section}) — ${Number(x.days_remaining) < 0 ? `${-Number(x.days_remaining)} days overdue` : `${x.days_remaining} days left`}; ${x.consequence_text}`,
            )
            .join(' ')
        : 'No statutory deadline in your scope is breached or due within 30 days.';
    } else if (/acknowledg|gap|unconfirmed|disburs/.test(q)) {
      const g = (await call('disbursement_gap')) as Array<Record<string, unknown>>;
      answer = g.length
        ? g
            .map(
              (x) =>
                `${x.code}: ${cr(x.disbursed_paise)} disbursed, ${cr(x.acknowledged_paise)} acknowledged — ${cr(x.unconfirmed_paise)} not yet confirmed by ${x.families_unconfirmed} families.`,
            )
            .join(' ')
        : 'No disbursements recorded in your scope yet.';
    } else if (/bottleneck|stuck|return|slow/.test(q)) {
      const b = (await call('stage_bottlenecks')) as { byStage: Array<Record<string, unknown>> };
      const worst = [...b.byStage].sort((a, c) => Number(c.open_now) - Number(a.open_now)).slice(0, 3);
      answer = `Stages with the most files open now: ${worst.map((s) => `${s.stage_code} (${s.open_now} open, median ${s.median_days_in_stage ?? '—'} days, ${s.returns} returns)`).join('; ')}.`;
    } else if (/district|rank|worst/.test(q)) {
      const r = (await call('district_ranking', { metric: 'deadlines_breached' })) as Array<{
        district: string;
        value: unknown;
      }>;
      answer = `Districts by breached deadlines: ${r
        .slice(0, 5)
        .map((x) => `${x.district} (${x.value ?? 0})`)
        .join(', ')}.`;
    } else {
      const code = /([A-Z]{2}-[A-Z0-9]{3}-\d{4}-\d{3})/.exec(question)?.[1];
      if (code) {
        const s = (await call('project_summary', { projectCode: code })) as Record<string, Record<string, unknown>>;
        answer = s.kpis
          ? `${code} is at ${s.kpis.current_stage} (${s.kpis.status}); ${s.kpis.parcels_total} parcels, ${s.kpis.affected_families} affected families, possession ${s.kpis.possession_pct ?? 0}%.`
          : `I could not find ${code} in your jurisdiction.`;
      } else {
        const k = (await call('get_kpis')) as Record<string, unknown>;
        answer = `Across your scope: ${k.projects} projects, ${(Number(k.area_affected_sqm) / 10_000).toFixed(1)} ha affected, ${cr(k.compensation_paid_paise)} paid of which ${cr(k.compensation_acknowledged_paise)} is acknowledged by families; ${k.deadlines_breached} statutory deadlines breached; timeline adherence ${k.timeline_adherence_pct ?? '—'}%.`;
      }
    }
    return {
      answer,
      toolCalls: calls,
      provider: 'MOCK',
      note: 'Mock mode — deterministic answers from tool results. Set LLM_PROVIDER=real for the language model.',
    };
  }
}
