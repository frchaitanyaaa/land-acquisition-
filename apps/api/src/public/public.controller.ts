import { Throttle } from '@nestjs/throttler';
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { AuditEntity } from '../common/audit/audit.interceptor';
import { ClockService } from '../common/clock/clock.service';
import { DbService } from '../common/db/db.service';
import { rows } from '../common/db/raw';
import { Public } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { ChainService } from '../chain/chain.service';
import { PublicAckService } from '../disbursement/public-ack.service';

const Token = z.string().regex(/^[A-Za-z0-9_-]{20,64}$/, 'token');
const SearchQuery = z.object({ village: z.string().min(1).max(64), survey: z.string().max(32).optional() });
const NoticesQuery = z.object({ project: z.string().max(40).optional() });

const PROVENANCE =
  'This portal displays information as recorded by the concerned authority. For the authoritative record, contact the office of the Collector.';

/**
 * Public portal API (§25) — no login. Every read goes through public_* views / functions (G22).
 * Token-scoped acknowledgement, enrolment and passbook pages live here too.
 */
@Controller('public')
@Public()
@Throttle({ default: { ttl: 60_000, limit: 60 } })
@AuditEntity('public')
export class PublicController {
  constructor(
    private readonly db: DbService,
    private readonly ack: PublicAckService,
    private readonly clock: ClockService,
    private readonly chain: ChainService,
  ) {}

  private meta() {
    return { provenance: PROVENANCE, asOf: this.clock.now() };
  }

  /** Landing page + public verify: anchoring ledger totals and node state. Hashes and counts only (G22). */
  @Get('chain-summary')
  async chainSummary() {
    const [ledger] = await this.db.withScope(null, (tx) => rows(tx, sql`SELECT * FROM public_chain_summary`));
    return { ...this.meta(), ledger: ledger ?? null, node: await this.chain.nodeInfo() };
  }

  /**
   * Public proof check (§27.4, G22). Reads only public_chain_anchor and the contract: does the hash in
   * our ledger match the hash on the chain for each anchored version? Officers' /chain/verify goes
   * further and rebuilds the hash from the live record.
   */
  @Get('verify/:entityType/:entityId')
  async verify(@Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    if (!/^[a-z_]{1,40}$/.test(entityType) || !/^[0-9a-f-]{36}$/i.test(entityId))
      return { ...this.meta(), found: false, versions: [] };
    const anchors = await this.db.withScope(null, (tx) =>
      rows<{ entity_version: number; event_type: string; data_hash: string; status: string; tx_hash: string | null; block_number: string | null; anchored_at: string | null }>(
        tx,
        sql`SELECT entity_version, event_type, data_hash, status, tx_hash, block_number, anchored_at
            FROM public_chain_anchor WHERE entity_type = ${entityType} AND entity_id = ${entityId}::uuid
            ORDER BY entity_version`,
      ),
    );
    const versions = await Promise.all(
      anchors.map(async (a) => {
        if (a.status !== 'ANCHORED') return { ...a, onChainHash: null, result: 'PENDING' as const };
        try {
          const onChain = await this.chain.readAnchor(entityType, entityId, a.entity_version);
          return { ...a, onChainHash: onChain.dataHash, result: onChain.dataHash === a.data_hash ? ('MATCH' as const) : ('MISMATCH' as const) };
        } catch {
          return { ...a, onChainHash: null, result: 'UNREACHABLE' as const };
        }
      }),
    );
    return { ...this.meta(), found: versions.length > 0, entityType, entityId, contract: (await this.chain.nodeInfo()).contract, versions };
  }

  @Get('villages')
  async villages(@Query('q') q?: string) {
    const data = await this.db.withScope(null, (tx) =>
      rows(
        tx,
        sql`SELECT v.code, v.name, v.name_local, sd.name AS sub_district, d.name AS district, s.name AS state
            FROM villages v JOIN sub_districts sd ON sd.code = v.sub_district_code JOIN districts d ON d.code = sd.district_code
            JOIN states s ON s.code = d.state_code
            WHERE (${q ?? null}::text IS NULL OR v.name ILIKE '%' || ${q ?? null} || '%') ORDER BY s.name, d.name, v.name LIMIT 100`,
      ),
    );
    return { ...this.meta(), data };
  }

  @Get('parcels')
  async parcels(@Query(new ZodPipe(SearchQuery)) q: z.infer<typeof SearchQuery>) {
    const data = await this.db.withScope(null, (tx) =>
      rows(
        tx,
        sql`SELECT * FROM public_parcel_status WHERE village_code = ${q.village}
              AND (${q.survey ?? null}::text IS NULL OR survey_number = split_part(${q.survey ?? null}, '/', 1))
            ORDER BY survey_number, sub_division LIMIT 200`,
      ),
    );
    return { ...this.meta(), data };
  }

  @Get('notices')
  async notices(@Query(new ZodPipe(NoticesQuery)) q: z.infer<typeof NoticesQuery>) {
    const data = await this.db.withScope(null, (tx) =>
      rows(
        tx,
        sql`SELECT * FROM public_notices WHERE (${q.project ?? null}::text IS NULL OR project_code = ${q.project ?? null}) ORDER BY published_at DESC LIMIT 200`,
      ),
    );
    return { ...this.meta(), data };
  }

  /** File an objection while the s.15 window is open (§25). Rate-limited like every public route. */
  @Post('objections')
  async objection(
    @Body(
      new ZodPipe(
        z.strictObject({
          projectCode: z.string().max(40),
          villageCode: z.string().max(64),
          surveyNo: z.string().max(32),
          name: z.string().max(120).optional(),
          body: z.string().min(10).max(10_000),
          language: z.enum(['en', 'hi', 'mr']).default('en'),
        }),
      ),
    )
    b: {
      projectCode: string;
      villageCode: string;
      surveyNo: string;
      name?: string;
      body: string;
      language: string;
    },
  ) {
    const r = await this.db.withScope(null, (tx) =>
      rows<{ id: string }>(
        tx,
        sql`SELECT public_file_objection(${b.projectCode}, ${b.villageCode}, ${b.surveyNo}, ${b.name ?? null}, ${b.body}, ${b.language}) AS id`,
      ),
    );
    return { ...this.meta(), filed: true, reference: r[0]?.id.slice(0, 8).toUpperCase() };
  }

  // ---- enrolment (beneficiary's own phone)
  @Get('enrol/:token')
  enrolInfo(@Param('token', new ZodPipe(Token)) token: string) {
    return this.ack.enrolInfo(token);
  }

  @Get('enrol/:token/options')
  enrolOptions(@Param('token', new ZodPipe(Token)) token: string) {
    return this.ack.enrolOptions(token);
  }

  @Post('enrol/:token/verify')
  @HttpCode(200)
  enrolVerify(
    @Param('token', new ZodPipe(Token)) token: string,
    @Body() body: { response: RegistrationResponseJSON; deviceLabel?: string },
  ) {
    return this.ack.enrolVerify(token, body.response, body.deviceLabel);
  }

  // ---- acknowledgement
  @Get('ack/:token')
  ackInfo(@Param('token', new ZodPipe(Token)) token: string) {
    return this.ack.ackInfo(token);
  }

  @Get('ack/:token/options')
  ackOptions(@Param('token', new ZodPipe(Token)) token: string) {
    return this.ack.ackOptions(token);
  }

  @Post('ack/:token/verify')
  @HttpCode(200)
  ackVerify(@Param('token', new ZodPipe(Token)) token: string, @Body() body: { response: AuthenticationResponseJSON }) {
    return this.ack.ackVerify(token, body.response);
  }

  @Post('ack/:token/otp/send')
  @HttpCode(200)
  otpSend(@Param('token', new ZodPipe(Token)) token: string) {
    return this.ack.otpSend(token);
  }

  @Post('ack/:token/otp/verify')
  @HttpCode(200)
  otpVerify(
    @Param('token', new ZodPipe(Token)) token: string,
    @Body(new ZodPipe(z.object({ otp: z.string().regex(/^\d{6}$/) }))) body: { otp: string },
  ) {
    return this.ack.otpVerify(token, body.otp);
  }

  @Post('ack/:token/dispute')
  @HttpCode(200)
  dispute(
    @Param('token', new ZodPipe(Token)) token: string,
    @Body(new ZodPipe(z.object({ reason: z.string().min(3).max(2000) }))) body: { reason: string },
  ) {
    return this.ack.dispute(token, body.reason);
  }

  // ---- passbook
  @Get('passbook/:token')
  passbook(@Param('token', new ZodPipe(Token)) token: string) {
    return this.ack.passbook(token);
  }
}
