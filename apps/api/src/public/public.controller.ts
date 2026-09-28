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
@AuditEntity('public')
export class PublicController {
  constructor(
    private readonly db: DbService,
    private readonly ack: PublicAckService,
    private readonly clock: ClockService,
  ) {}

  private meta() {
    return { provenance: PROVENANCE, asOf: this.clock.now() };
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
