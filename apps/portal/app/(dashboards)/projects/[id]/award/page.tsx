'use client';

import { useQuery } from '@tanstack/react-query';
import { use, useMemo, useState } from 'react';
import { RecordActionPanel, type PanelAction } from '@/components/action-panel';
import { AttestationModal } from '@/components/attestation-modal';
import { ChainBadge } from '@/components/chain-badge';
import { api } from '@/lib/api';
import {
  useAcceptField,
  useAwardChecks,
  useAwards,
  useCreateAward,
  useExtraction,
  useProjectFamilies,
  useSignAward,
  type AwardChecks,
  type AwardListRow,
  type CheckResult,
  type ExtractedField,
  type FamilyRow,
} from '@/lib/award-api';
import { formatMoney } from '@/lib/format';

const rupeesToPaise = (v: string) => {
  const [r, p = ''] = v.replace(/,/g, '').trim().split('.');
  return `${r}${p.padEnd(2, '0').slice(0, 2)}`.replace(/^0+(?=\d)/, '');
};

/** Award entry with OCR assist (§20) — "the most important screen in this module". */
export default function AwardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const awards = useAwards(projectId);
  const [selected, setSelected] = useState<string | null>(null);
  const award = awards.data?.find((a) => a.id === selected) ?? awards.data?.[awards.data.length - 1] ?? null;

  if (awards.error) return <p className="text-red-700">Could not load awards.</p>;
  if (awards.isLoading) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {awards.data?.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelected(a.id)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              award?.id === a.id ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {a.award_type} {a.award_no} · {a.status}
          </button>
        ))}
        <NewAward projectId={projectId} onCreated={setSelected} />
      </div>

      <ValuationInputs projectId={projectId} />

      {award ? <AwardReview projectId={projectId} award={award} /> : <p className="text-sm text-slate-500">No award drafted yet.</p>}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------

function NewAward({ projectId, onCreated }: { projectId: string; onCreated: (id: string) => void }) {
  const create = useCreateAward(projectId);
  const [open, setOpen] = useState(false);
  const [awardType, setAwardType] = useState<'LAND' | 'RNR'>('LAND');
  const [awardNo, setAwardNo] = useState('');
  const [upload, setUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
        Upload signed award PDF
      </button>
    );

  return (
    <div className="flex flex-wrap items-end gap-2 border border-slate-200 bg-white p-3">
      <label className="text-sm">
        <span className="block text-xs text-slate-500">Type</span>
        <select value={awardType} onChange={(e) => setAwardType(e.target.value as 'LAND' | 'RNR')} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="LAND">Land (s.23)</option>
          <option value="RNR">R&amp;R (s.31)</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="block text-xs text-slate-500">Award number</span>
        <input value={awardNo} onChange={(e) => setAwardNo(e.target.value)} maxLength={100} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <button
        disabled={!awardNo.trim() || create.isPending}
        onClick={() => setUpload(true)}
        className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        Choose PDF &amp; attest…
      </button>
      <button onClick={() => setOpen(false)} className="text-sm text-slate-500">
        Cancel
      </button>
      {error && <p className="w-full text-sm text-red-700">{error}</p>}
      <AttestationModal
        projectId={projectId}
        entityType="project"
        entityId={projectId}
        docType={awardType === 'LAND' ? 'AWARD_LAND' : 'AWARD_RNR'}
        title={`Award ${awardNo}`}
        open={upload}
        onClose={() => setUpload(false)}
        onUploaded={async (documentId) => {
          setError(null);
          try {
            const a = await create.mutateAsync({ awardType, awardNo: awardNo.trim(), documentId });
            onCreated(a.id);
            setOpen(false);
            setAwardNo('');
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not create the award.');
          }
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------------------------------------

interface ValuationDoc {
  id: string;
  doc_type: string;
  title: string;
  uploaded_at: string;
  uploaded_by_designation: string | null;
  attested_at: string | null;
  is_current: boolean;
}

const VALUATION_TYPES: Record<string, string> = {
  CIRCLE_RATE_SCHEDULE: 'Circle rate schedule',
  SALE_DEEDS_REGISTER: 'Sale deeds register (3-year average)',
  VALUATION_REPORT_PWD: 'PWD valuation report (structures)',
  VALUATION_REPORT_FOREST: 'Forest department report (trees)',
  VALUATION_REPORT_HORTICULTURE: 'Horticulture report (fruit trees, crops)',
  VALUATION_REPORT_IRRIGATION: 'Minor Irrigation report (wells, pipelines)',
};

/**
 * Valuation inputs (§20, G1) — DISPLAY ONLY. Lists what officers entered and what departments
 * reported, in upload order. It computes nothing: no total, no "suggested" figure, no highlighted
 * "best" value. The LAO types the final figures into the award.
 */
function ValuationInputs({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['valuation-docs', projectId],
    queryFn: () => api<ValuationDoc[]>(`/documents?projectId=${projectId}`),
    enabled: open,
    select: (docs) => docs.filter((d) => d.doc_type in VALUATION_TYPES && d.is_current),
  });
  return (
    <section className="border border-slate-200 bg-slate-50">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-2.5 text-left">
        <span className="text-sm font-semibold text-slate-800">Valuation inputs — reference only</span>
        <span className="text-xs text-slate-500">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-200 px-4 py-3 text-sm">
          <p className="border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
            This panel only <strong>shows</strong> benchmarks and department reports as they were entered. It does not pick a value, add
            anything up, or apply a multiplication factor. The LAO decides and enters every figure in the award (G1).
          </p>
          {isLoading && <p className="text-slate-500">Loading…</p>}
          {data && data.length === 0 && <p className="text-slate-500">No benchmark documents or department reports uploaded for this project.</p>}
          {data && data.length > 0 && (
            <ul className="divide-y divide-slate-200 border border-slate-200 bg-white">
              {data.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span>
                    <span className="text-slate-500">{VALUATION_TYPES[d.doc_type]}:</span> {d.title}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-slate-500">
                    {d.uploaded_by_designation ?? '—'} · {new Date(d.uploaded_at).toLocaleDateString('en-IN')}
                    <a href={`/api/v1/documents/${d.id}/download`} target="_blank" rel="noreferrer" className="text-teal-700 hover:underline">
                      Open
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500">
            Officer-typed benchmark figures (circle rate, sale-deed average, consented amount) need the
            <code className="mx-1 rounded bg-slate-100 px-1">/projects/:id/valuation-inputs</code>
            endpoint, which the API does not have yet — they will be listed here, unranked, once it exists.
          </p>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------------------------------------

interface AwardDetail {
  id: string;
  status: string;
  version: number;
  documentId: string | null;
  entitlements: Array<{ affected_family_id: string; head_code: string; amount_awarded_paise: string; source: string; head_name: string }>;
}

function AwardReview({ projectId, award }: { projectId: string; award: AwardListRow }) {
  const detail = useQuery({ queryKey: ['award', award.id], queryFn: () => api<AwardDetail>(`/awards/${award.id}`) });
  const extraction = useExtraction(award.ocr_extraction_id);
  const checks = useAwardChecks(award.id);
  const families = useProjectFamilies(projectId);
  const sign = useSignAward(projectId, award.id);
  const [page, setPage] = useState(1);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const famById = useMemo(() => new Map((families.data ?? []).map((f) => [f.id, f])), [families.data]);
  const signed = award.status === 'signed';

  const groups = useMemo(() => {
    const byFamily = new Map<string, ExtractedField[]>();
    for (const f of extraction.data?.fields ?? []) {
      const fam = f.key.slice(0, f.key.lastIndexOf(':'));
      byFamily.set(fam, [...(byFamily.get(fam) ?? []), f]);
    }
    return [...byFamily.entries()];
  }, [extraction.data]);

  const signAction: PanelAction = {
    action: 'SIGN',
    allowed: !signed && award.entitlements > 0,
    failures: signed
      ? [{ code: 'AWARD_SIGNED', message: 'This award is signed.' }]
      : award.entitlements === 0
        ? [{ code: 'AWARD_EMPTY', message: 'Accept at least one field (or enter amounts) before signing.' }]
        : [],
    reasonCodes: [],
    requiresWrittenReasons: (checks.data?.failures ?? 0) > 0,
    writtenReasonsLabel: `Override reason — ${checks.data?.failures ?? 0} statutory check(s) failed; recorded with the signature`,
    requiresAttestation: true,
    makerChecker: true,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold">
          {award.award_type} award {award.award_no}
        </span>
        <span className="text-slate-500">
          v{award.version} · {award.status} · {award.entitlements} head(s) entered · {formatMoney(award.total_paise)}
        </span>
        {signed && <ChainBadge entityType="award" entityId={award.id} version={award.version} />}
      </div>

      {!award.document_id ? (
        <p className="text-sm text-slate-500">This award has no uploaded PDF — amounts were entered manually.</p>
      ) : !award.ocr_extraction_id ? (
        <p className="text-sm text-slate-500">No OCR extraction is linked to this award.</p>
      ) : extraction.data?.status === 'pending' || extraction.isLoading ? (
        <p className="text-sm text-slate-500">Reading the award PDF… suggested fields appear here when the OCR job finishes.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* LEFT: the PDF itself, at the page of the field under review */}
          <div className="border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs text-slate-500">
              <span>
                Award PDF · page {page}
                {focusKey && ' — the selected field is on this page'}
              </span>
              <a href={`/api/v1/documents/${award.document_id}/download`} target="_blank" rel="noreferrer" className="text-teal-700 hover:underline">
                Open in new tab
              </a>
            </div>
            <iframe
              key={page}
              title="Award PDF"
              src={`/api/v1/documents/${award.document_id}/download#page=${page}&view=FitH`}
              className="h-[70vh] w-full"
            />
          </div>

          {/* RIGHT: suggestions, greyed until a human accepts them one by one */}
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Suggested by OCR in grey. Accept each field yourself (edit first if the PDF says otherwise) — nothing is accepted in bulk,
              and only accepted values become entitlements (G3).
            </p>
            {groups.length === 0 && <p className="text-sm text-slate-500">The OCR job found no award lines in this PDF.</p>}
            {groups.map(([familyId, fields]) => (
              <FamilyGroup
                key={familyId}
                familyId={familyId}
                family={famById.get(familyId)}
                fields={fields}
                accepted={extraction.data?.accepted ?? []}
                entered={detail.data?.entitlements ?? []}
                checks={checks.data}
                editable={!signed}
                extractionId={award.ocr_extraction_id!}
                projectId={projectId}
                awardId={award.id}
                focusKey={focusKey}
                onFocus={(f) => {
                  setFocusKey(f.key);
                  setPage(f.page);
                }}
              />
            ))}
          </div>
        </div>
      )}

      <FamiliesWithoutFields checks={checks.data} shown={new Set(groups.map(([f]) => f))} famById={famById} />

      <RecordActionPanel
        title="Collector's signature"
        subtitle="Signing starts the payment clocks (s.38). The post that drafted the award cannot sign it (G20)."
        projectId={projectId}
        entityType="award"
        entityId={award.id}
        actions={[signAction]}
        submit={(_action, body) => sign.mutateAsync({ overrideReason: body.writtenReasons ?? null })}
      />
    </div>
  );
}

function checkClass(r: CheckResult) {
  return r.status === 'FAIL' ? 'border-red-200 bg-red-50 text-red-800' : 'border-slate-200 bg-slate-50 text-slate-600';
}

function FamilyGroup({
  familyId,
  family,
  fields,
  accepted,
  entered,
  checks,
  editable,
  extractionId,
  projectId,
  awardId,
  focusKey,
  onFocus,
}: {
  familyId: string;
  family: FamilyRow | undefined;
  fields: ExtractedField[];
  accepted: Array<{ key: string; value: string | number }>;
  entered: AwardDetail['entitlements'];
  checks: AwardChecks | undefined;
  editable: boolean;
  extractionId: string;
  projectId: string;
  awardId: string;
  focusKey: string | null;
  onFocus: (f: ExtractedField) => void;
}) {
  const results = checks?.families.find((f) => f.familyId === familyId)?.results ?? [];
  // Family-level results (no head) sit on the group; head-level ones next to that head's field.
  const familyLevel = results.filter((r) => !r.headCode && (r.status === 'FAIL' || r.status === 'NOT_EVALUATED'));
  return (
    <section className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-2">
        <p className="text-sm font-medium">{family ? family.head_name : <span className="text-red-700">Unknown family</span>}</p>
        <p className="text-xs text-slate-500">
          {family ? `${family.is_sc_st ? 'SC/ST · ' : ''}${family.is_displaced ? 'displaced' : 'affected'}` : familyId}
        </p>
        {!family && (
          <p className="mt-1 border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
            Mismatch: this family id is not on the project’s record. Check the PDF — nothing is resolved automatically.
          </p>
        )}
        {familyLevel.map((r) => (
          <p key={r.code} className={`mt-1 border px-2 py-1 text-xs ${checkClass(r)}`}>
            {r.status === 'FAIL' ? '⚠ ' : ''}
            {r.message} <span className="text-slate-400">({r.section})</span>
          </p>
        ))}
      </div>
      <ul className="divide-y divide-slate-100">
        {fields.map((f) => (
          <FieldRow
            key={f.key}
            field={f}
            accepted={accepted.find((a) => a.key === f.key)}
            existing={entered.find((e) => `${e.affected_family_id}:${e.head_code}` === f.key)}
            headResults={results.filter((r) => r.headCode === f.key.slice(f.key.lastIndexOf(':') + 1))}
            editable={editable}
            extractionId={extractionId}
            projectId={projectId}
            awardId={awardId}
            focused={focusKey === f.key}
            onFocus={() => onFocus(f)}
          />
        ))}
      </ul>
    </section>
  );
}

function FieldRow({
  field,
  accepted,
  existing,
  headResults,
  editable,
  extractionId,
  projectId,
  awardId,
  focused,
  onFocus,
}: {
  field: ExtractedField;
  accepted: { key: string; value: string | number } | undefined;
  existing: AwardDetail['entitlements'][number] | undefined;
  headResults: CheckResult[];
  editable: boolean;
  extractionId: string;
  projectId: string;
  awardId: string;
  focused: boolean;
  onFocus: () => void;
}) {
  const accept = useAcceptField(extractionId, projectId, awardId);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const head = field.key.slice(field.key.lastIndexOf(':') + 1);
  const isAccepted = !!accepted;
  const typed = value.trim();
  const mismatch = existing && BigInt(existing.amount_awarded_paise) !== BigInt(rupeesToPaise(String(accepted?.value ?? field.value)));

  async function doAccept() {
    setError(null);
    const v = typed || field.value;
    if (!/^\d[\d,]*(\.\d{1,2})?$/.test(v)) return setError('Enter an amount in rupees, e.g. 125000 or 1,25,000.50');
    try {
      await accept.mutateAsync({ key: field.key, value: v.replace(/,/g, '') });
      setValue('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept.');
    }
  }

  return (
    <li className={`space-y-1 px-3 py-2 text-sm ${focused ? 'bg-teal-50/50' : ''}`} onClick={onFocus}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-44 shrink-0 font-medium">{head.replace(/_/g, ' ')}</span>
        {isAccepted ? (
          <span className="font-semibold tabular-nums text-slate-900">
            ₹ {Number(accepted.value).toLocaleString('en-IN', { maximumFractionDigits: 2 })} <span className="text-xs font-normal text-teal-700">✓ accepted</span>
          </span>
        ) : (
          <>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={Number(field.value).toLocaleString('en-IN')}
              disabled={!editable}
              inputMode="decimal"
              className="w-36 rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums placeholder:italic placeholder:text-slate-400"
              aria-label={`Amount for ${head} (suggested ${field.value})`}
            />
            {editable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void doAccept();
                }}
                disabled={accept.isPending}
                className="rounded-md border border-teal-700 px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50"
              >
                {typed ? 'Accept edited' : 'Accept'}
              </button>
            )}
          </>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFocus();
          }}
          className="ml-auto text-xs text-slate-400 hover:text-teal-700"
          title={field.bbox ? 'Show on the PDF' : 'The extractor gave a page, not a region'}
        >
          p.{field.page} · {Math.round(field.confidence * 100)}%
        </button>
      </div>
      {mismatch && (
        <p className="border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
          Mismatch: {head} is already entered for this family at {formatMoney(existing.amount_awarded_paise)} ({existing.source}). Nothing is
          overwritten automatically.
        </p>
      )}
      {headResults
        .filter((r) => r.status === 'FAIL')
        .map((r) => (
          <p key={r.code} className={`border px-2 py-1 text-xs ${checkClass(r)}`}>
            ⚠ {r.message} <span className="text-red-600/70">({r.section})</span>
          </p>
        ))}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </li>
  );
}

/** Families whose heads were entered manually (not in this PDF) still get their check results shown. */
function FamiliesWithoutFields({
  checks,
  shown,
  famById,
}: {
  checks: AwardChecks | undefined;
  shown: Set<string>;
  famById: Map<string, FamilyRow>;
}) {
  const rest = (checks?.families ?? []).filter((f) => !shown.has(f.familyId) && f.failed.length);
  if (!rest.length) return null;
  return (
    <section className="border border-red-200 bg-white">
      <h3 className="border-b border-red-200 px-3 py-2 text-sm font-semibold text-red-800">Checks failing on manually entered heads</h3>
      <ul className="divide-y divide-slate-100 text-sm">
        {rest.map((f) => (
          <li key={f.familyId} className="px-3 py-2">
            <p className="font-medium">{famById.get(f.familyId)?.head_name ?? f.familyId}</p>
            {f.failed.map((r) => (
              <p key={r.code} className="text-xs text-red-800">
                ⚠ {r.headCode ? `${r.headCode}: ` : ''}
                {r.message} ({r.section})
              </p>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
