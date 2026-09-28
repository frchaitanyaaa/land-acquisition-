import { createHash } from 'node:crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { SmsService } from '../adapters/sms/sms.adapter';
import { DbService } from '../common/db/db.service';
import { one, rows } from '../common/db/raw';
import { ProblemException } from '../common/errors/problem';
import { env } from '../config/env';
import { hashToken } from './tokens';

const CHALLENGE_TTL_MS = 5 * 60_000;
const OTP_TTL_MS = 5 * 60_000;

/**
 * The family's side of the acknowledgement loop (§21.2) — public, token-scoped pages. All DB access
 * goes through public_* SECURITY DEFINER functions (G22). WebAuthn runs on the BENEFICIARY'S OWN
 * phone; we store only credential id, public key and counter (G6).
 *
 * Challenges and OTPs are held in memory for their few-minute lifetime (single API instance).
 */
@Injectable()
export class PublicAckService {
  private readonly challenges = new Map<string, { challenge: string; at: number }>();
  private readonly otps = new Map<string, { hash: string; at: number; ref: string }>();

  constructor(
    private readonly db: DbService,
    private readonly sms: SmsService,
  ) {}

  private rp() {
    const e = env();
    return {
      rpID: e.WEBAUTHN_RP_ID,
      rpName: e.WEBAUTHN_RP_NAME,
      origin: e.WEBAUTHN_ORIGIN.split(',').map((s) => s.trim()),
    };
  }

  private takeChallenge(key: string): string {
    const c = this.challenges.get(key);
    this.challenges.delete(key);
    if (!c || Date.now() - c.at > CHALLENGE_TTL_MS)
      throw new ProblemException(410, 'CHALLENGE_EXPIRED', 'Start again — the request expired.');
    return c.challenge;
  }

  // ---------------------------------------------------------------- enrolment

  enrolInfo(token: string) {
    return this.db.withScope(null, async (tx) => {
      const p = await one<{ person_id: string; display_name: string; expired: boolean; used: boolean }>(
        tx,
        sql`SELECT * FROM public_enrol_person(${hashToken(token)})`,
      );
      if (!p) throw new ProblemException(404, 'LINK_INVALID', 'This link is not valid.');
      return { displayName: p.display_name, expired: p.expired, used: p.used };
    });
  }

  async enrolOptions(token: string) {
    const hash = hashToken(token);
    const p = await this.db.withScope(null, (tx) =>
      one<{ person_id: string; display_name: string; expired: boolean; used: boolean }>(
        tx,
        sql`SELECT * FROM public_enrol_person(${hash})`,
      ),
    );
    if (!p || p.expired || p.used)
      throw new ProblemException(410, 'LINK_INVALID', 'This enrolment link is invalid, used or expired.');
    const { rpID, rpName } = this.rp();
    const options = await generateRegistrationOptions({
      rpID,
      rpName,
      userName: p.display_name,
      userID: new Uint8Array(Buffer.from(p.person_id.replace(/-/g, ''), 'hex')),
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
        authenticatorAttachment: 'platform',
      },
    });
    this.challenges.set(`enrol:${hash}`, { challenge: options.challenge, at: Date.now() });
    return options;
  }

  async enrolVerify(token: string, response: RegistrationResponseJSON, deviceLabel?: string) {
    const hash = hashToken(token);
    const expectedChallenge = this.takeChallenge(`enrol:${hash}`);
    const { rpID, origin } = this.rp();
    const v = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    }).catch((e: Error) => {
      throw new ProblemException(422, 'WEBAUTHN_INVALID', `Registration could not be verified: ${e.message}`);
    });
    if (!v.verified || !v.registrationInfo)
      throw new ProblemException(422, 'WEBAUTHN_INVALID', 'Registration could not be verified.');
    const cred = v.registrationInfo.credential;
    const id = await this.db.withScope(null, (tx) =>
      one<{ id: string }>(
        tx,
        sql`SELECT public_enrol_credential(${hash}, ${cred.id}, ${Buffer.from(cred.publicKey)}, ${cred.counter}, string_to_array(${(cred.transports ?? []).join(',')}, ','), ${deviceLabel ?? null}) AS id`,
      ),
    );
    return { enrolled: true, credentialRowId: id?.id };
  }

  // ---------------------------------------------------------------- acknowledgement

  private context(hash: string) {
    return this.db.withScope(null, (tx) =>
      one<{
        disbursement_id: string;
        amount_paise: string;
        head_code: string;
        paid_on: string | null;
        payment_status: string;
        instrument: string;
        project_code: string;
        project_name: string;
        person_first_name: string;
        acknowledged: boolean;
        has_credential: boolean;
        expired: boolean;
        used: boolean;
      }>(tx, sql`SELECT * FROM public_ack_context(${hash})`),
    );
  }

  async ackInfo(token: string) {
    const c = await this.context(hashToken(token));
    if (!c) throw new ProblemException(404, 'LINK_INVALID', 'This link is not valid.');
    // What the family sees: the payment. Never why anything was held (§11.4).
    return {
      amountPaise: c.amount_paise,
      headCode: c.head_code,
      paidOn: c.paid_on,
      paymentStatus: c.payment_status === 'SUCCESS' ? 'PAID' : 'PAYMENT_IN_PROCESS',
      projectCode: c.project_code,
      projectName: c.project_name,
      recipientFirstName: c.person_first_name,
      acknowledged: c.acknowledged,
      canUsePasskey: c.has_credential,
      expired: c.expired,
      used: c.used,
    };
  }

  private async usable(hash: string) {
    const c = await this.context(hash);
    if (!c || c.expired || c.used)
      throw new ProblemException(410, 'LINK_INVALID', 'This link is invalid, used or expired.');
    if (c.payment_status !== 'SUCCESS')
      throw new ProblemException(409, 'NOT_PAID_YET', 'This payment has not been completed yet.');
    return c;
  }

  async ackOptions(token: string) {
    const hash = hashToken(token);
    await this.usable(hash);
    const creds = await this.db.withScope(null, (tx) =>
      rows<{ credential_id: string; transports: string[] | null }>(
        tx,
        sql`SELECT credential_id, transports FROM public_person_credentials(${hash})`,
      ),
    );
    if (!creds.length)
      throw new ProblemException(409, 'NO_PASSKEY', 'No passkey is enrolled for this family — use the OTP option.');
    const options = await generateAuthenticationOptions({
      rpID: this.rp().rpID,
      userVerification: 'required',
      allowCredentials: creds.map((c) => ({
        id: c.credential_id,
        transports: (c.transports ?? []) as AuthenticatorTransport[],
      })),
    });
    this.challenges.set(`ack:${hash}`, { challenge: options.challenge, at: Date.now() });
    return options;
  }

  async ackVerify(token: string, response: AuthenticationResponseJSON) {
    const hash = hashToken(token);
    await this.usable(hash);
    const expectedChallenge = this.takeChallenge(`ack:${hash}`);
    const creds = await this.db.withScope(null, (tx) =>
      rows<{ credential_id: string; public_key: Buffer; counter: string; transports: string[] | null }>(
        tx,
        sql`SELECT * FROM public_person_credentials(${hash})`,
      ),
    );
    const cred = creds.find((c) => c.credential_id === response.id);
    if (!cred)
      throw new ProblemException(422, 'WEBAUTHN_UNKNOWN_CREDENTIAL', 'This passkey is not enrolled for this family.');
    const { rpID, origin } = this.rp();
    const v = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: cred.credential_id,
        publicKey: new Uint8Array(cred.public_key),
        counter: Number(cred.counter),
        transports: (cred.transports ?? []) as AuthenticatorTransport[],
      },
    }).catch((e: Error) => {
      throw new ProblemException(422, 'WEBAUTHN_INVALID', `Assertion could not be verified: ${e.message}`);
    });
    if (!v.verified) throw new ProblemException(422, 'WEBAUTHN_INVALID', 'Assertion could not be verified.');
    const assertionSha = createHash('sha256').update(JSON.stringify(response)).digest('hex');
    const ack = await this.db.withScope(null, (tx) =>
      one<{ id: string }>(
        tx,
        sql`SELECT public_acknowledge(${hash}, 'WEBAUTHN', ${cred.credential_id}, ${assertionSha}, NULL, ${v.authenticationInfo.newCounter}) AS id`,
      ),
    );
    return { acknowledged: true, acknowledgementId: ack?.id, method: 'WEBAUTHN' };
  }

  async otpSend(token: string) {
    const hash = hashToken(token);
    await this.usable(hash);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const ref = `MOCK-OTP-${hash.slice(0, 8).toUpperCase()}`;
    this.otps.set(hash, { hash: createHash('sha256').update(otp).digest('hex'), at: Date.now(), ref });
    // The mock SMS goes to dev_outbox_sms; in DEMO_MODE the OTP is also returned so the demo can proceed.
    const sent = await this.db.withScope(null, (tx) =>
      this.sms.send(tx, { to: null, template: 'ACK_OTP', body: `BhoomiSetu: your acknowledgement code is ${otp}` }),
    );
    return { sent: true, provider: sent.provider, ...(env().DEMO_MODE ? { demoOtp: otp } : {}) };
  }

  async otpVerify(token: string, otp: string) {
    const hash = hashToken(token);
    await this.usable(hash);
    const o = this.otps.get(hash);
    if (!o || Date.now() - o.at > OTP_TTL_MS)
      throw new ProblemException(410, 'OTP_EXPIRED', 'The code expired — send a new one.');
    if (createHash('sha256').update(otp).digest('hex') !== o.hash)
      throw new ProblemException(422, 'OTP_INVALID', 'The code is not correct.');
    this.otps.delete(hash);
    const ack = await this.db.withScope(null, (tx) =>
      one<{ id: string }>(tx, sql`SELECT public_acknowledge(${hash}, 'OTP', NULL, NULL, ${o.ref}, NULL) AS id`),
    );
    return { acknowledged: true, acknowledgementId: ack?.id, method: 'OTP' };
  }

  async dispute(token: string, reason: string) {
    const hash = hashToken(token);
    const c = await this.context(hash);
    if (!c || c.expired || c.used)
      throw new ProblemException(410, 'LINK_INVALID', 'This link is invalid, used or expired.');
    await this.db.withScope(null, (tx) => one(tx, sql`SELECT public_dispute(${hash}, ${reason}) AS id`));
    return { recorded: true, message: 'Your report has been sent to the office of the Collector.' };
  }

  passbook(token: string) {
    return this.db.withScope(null, async (tx) => {
      const r = await one<{ p: unknown }>(tx, sql`SELECT public_passbook(${hashToken(token)}) AS p`);
      if (!r?.p) throw new ProblemException(404, 'LINK_INVALID', 'This passbook link is not valid or has expired.');
      return r.p;
    });
  }
}
