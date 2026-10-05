'use client';

import { PROJECT_CATEGORIES, PROJECT_CATEGORY_LABEL, PROJECT_SUB_CATEGORIES, rupeesToPaise } from '@bhoomisetu/shared';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { AttestationModal } from '@/components/attestation-modal';
import { FilePicker } from '@/components/file-picker';
import { ApiProblem } from '@/lib/api';
import {
  useCreateProject,
  useDistricts,
  useRequiringBodies,
  useRunPrescrutiny,
  useStates,
  useSubmitProject,
  useUploadAlignment,
  type AlignmentPreview,
  type CreateProjectInput,
  type PrescrutinyResult,
} from '@/lib/intake-api';

const AlignmentMap = dynamic(() => import('@/components/gis/alignment-map').then((m) => m.AlignmentMap), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse border border-slate-200 bg-slate-100" />,
});

const STEPS = ['Details', 'Alignment', 'Documents', 'Pre-scrutiny', 'Submit'] as const;
const DOC_STEPS: Array<{ docType: string; title: string }> = [
  { docType: 'DPR_SUMMARY', title: 'DPR summary' },
  { docType: 'ADMIN_FINANCIAL_SANCTION', title: 'Administrative & financial sanction' },
  { docType: 'FUNDING_CLEARANCE', title: 'Funding clearance' },
];

export default function NewProjectWizard() {
  const [step, setStep] = useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isLinear, setIsLinear] = useState(false);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">New proposal</h1>
      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`rounded px-2.5 py-1 ${i === step ? 'bg-teal-700 text-white' : i < step ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-500'}`}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <DetailsStep
          onCreated={(id, linear) => {
            setProjectId(id);
            setIsLinear(linear);
            setStep(1);
          }}
        />
      )}
      {step === 1 && projectId && <AlignmentStep projectId={projectId} isLinear={isLinear} onNext={() => setStep(2)} />}
      {step === 2 && projectId && <DocumentsStep projectId={projectId} onNext={() => setStep(3)} />}
      {step === 3 && projectId && <PrescrutinyStep projectId={projectId} onNext={() => setStep(4)} />}
      {step === 4 && projectId && <SubmitStep projectId={projectId} />}
    </div>
  );
}

function StepCard({ children }: { children: React.ReactNode }) {
  return <div className="max-w-2xl border border-slate-200 bg-white p-5">{children}</div>;
}

function DetailsStep({ onCreated }: { onCreated: (id: string, isLinear: boolean) => void }) {
  const create = useCreateProject();
  const { data: bodies } = useRequiringBodies();
  const { data: states } = useStates();
  const { data: districts } = useDistricts();
  const [category, setCategory] = useState<string>(PROJECT_CATEGORIES[0]);
  const [isLinear, setIsLinear] = useState(false);
  const [stateCode, setStateCode] = useState('');
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const districtsInState = (districts ?? []).filter((d) => d.stateCode === stateCode);

  function validateBudget(v: string) {
    if (!v.trim()) return setBudgetError(null);
    try {
      rupeesToPaise(v);
      setBudgetError(null);
    } catch {
      setBudgetError('Not a valid rupee amount.');
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (budgetError) return;
    setError(null);
    const form = new FormData(e.currentTarget);
    const body: CreateProjectInput = {
      name: String(form.get('name')),
      nameLocal: (form.get('nameLocal') as string) || null,
      category,
      subCategory: (form.get('subCategory') as string) || null,
      acquisitionType: String(form.get('acquisitionType')),
      requiringBodyId: String(form.get('requiringBodyId')),
      nationalImportance: form.get('nationalImportance') === 'on',
      estimatedBudgetRupees: (form.get('estimatedBudgetRupees') as string) || null,
      totalAreaHa: form.get('totalAreaHa') ? Number(form.get('totalAreaHa')) : null,
      appropriateGovt: String(form.get('appropriateGovt')),
      stateCode,
      districtCodes: selectedDistricts,
      isLinear,
      rowWidthM: isLinear && form.get('rowWidthM') ? Number(form.get('rowWidthM')) : null,
      isUrgency: form.get('isUrgency') === 'on',
    };
    try {
      const project = await create.mutateAsync(body);
      onCreated(project.id, isLinear);
    } catch (err) {
      setError(err instanceof ApiProblem ? err.message : 'Could not create the proposal.');
    }
  }

  return (
    <StepCard>
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <Field label="Name">
          <input name="name" required className="input" />
        </Field>
        <Field label="Name (local language)">
          <input name="nameLocal" className="input" />
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
            {PROJECT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {PROJECT_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sub-category">
          <input name="subCategory" list="sub-categories" className="input" />
          <datalist id="sub-categories">
            {(PROJECT_SUB_CATEGORIES[category as keyof typeof PROJECT_SUB_CATEGORIES] ?? []).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Acquisition type">
          <select name="acquisitionType" className="input">
            <option value="GOVERNMENT">Government</option>
            <option value="PPP">PPP</option>
            <option value="PRIVATE">Private</option>
          </select>
        </Field>
        <Field label="Requiring body">
          <select name="requiringBodyId" required className="input">
            <option value="">Select…</option>
            {(bodies ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="nationalImportance" />
          National importance
        </label>
        <Field label="Estimated budget (₹)">
          <input name="estimatedBudgetRupees" onBlur={(e) => validateBudget(e.target.value)} className="input" />
          {budgetError && <p className="mt-1 text-xs text-red-700">{budgetError}</p>}
        </Field>
        <Field label="Total land required (ha)">
          <input name="totalAreaHa" type="number" step="0.01" className="input" />
        </Field>
        <Field label="Appropriate government">
          <select name="appropriateGovt" className="input">
            <option value="state">State</option>
            <option value="central">Central</option>
          </select>
        </Field>
        <Field label="State">
          <select
            value={stateCode}
            onChange={(e) => {
              setStateCode(e.target.value);
              setSelectedDistricts([]);
            }}
            required
            className="input"
          >
            <option value="">Select…</option>
            {(states ?? []).map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        {stateCode && (
          <Field label="Target districts (optional — auto-derived from the alignment at submit)">
            <select
              multiple
              value={selectedDistricts}
              onChange={(e) => setSelectedDistricts([...e.target.selectedOptions].map((o) => o.value))}
              className="input h-24"
            >
              {districtsInState.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isLinear} onChange={(e) => setIsLinear(e.target.checked)} />
          Linear project (corridor)
        </label>
        {isLinear && (
          <Field label="Right-of-way width (m)">
            <input name="rowWidthM" type="number" step="0.1" required className="input" />
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isUrgency" />
          Urgency (s.40)
        </label>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={create.isPending || !!budgetError}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {create.isPending ? 'Creating…' : 'Create draft & continue'}
        </button>
      </form>
    </StepCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function AlignmentStep({ projectId, isLinear, onNext }: { projectId: string; isLinear: boolean; onNext: () => void }) {
  const upload = useUploadAlignment(projectId);
  const [preview, setPreview] = useState<AlignmentPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    try {
      setPreview(await upload.mutateAsync(file));
    } catch (e) {
      setError(e instanceof ApiProblem ? e.message : 'Could not parse the file.');
    }
  }

  return (
    <StepCard>
      <p className="text-sm text-slate-600">
        Upload the {isLinear ? 'centreline' : 'boundary'} as .kml, .kmz, .geojson or a zipped shapefile.
      </p>
      <FilePicker accept=".kml,.kmz,.geojson,.json,.zip" onFile={(f) => f && void onFile(f)} />
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {preview && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-slate-700">
            {preview.alignment_km && `${preview.alignment_km} km · `}
            {preview.footprint_area_sqm && `${(Number(preview.footprint_area_sqm) / 10_000).toFixed(1)} ha footprint`}
          </p>
          <AlignmentMap footprint={preview.footprint} alignment={preview.alignment} />
        </div>
      )}
      <button
        onClick={onNext}
        disabled={!preview}
        className="mt-4 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
      >
        Continue
      </button>
    </StepCard>
  );
}

function DocumentsStep({ projectId, onNext }: { projectId: string; onNext: () => void }) {
  const [uploaded, setUploaded] = useState<Set<string>>(new Set());
  const [openDoc, setOpenDoc] = useState<string | null>(null);

  return (
    <StepCard>
      <ul className="divide-y divide-slate-200">
        {DOC_STEPS.map((d) => (
          <li key={d.docType} className="flex items-center justify-between py-2 text-sm">
            <span>{d.title}</span>
            {uploaded.has(d.docType) ? (
              <span className="text-teal-700">Uploaded</span>
            ) : (
              <button onClick={() => setOpenDoc(d.docType)} className="text-teal-700 hover:underline">
                Upload
              </button>
            )}
          </li>
        ))}
      </ul>
      {DOC_STEPS.map((d) => (
        <AttestationModal
          key={d.docType}
          projectId={projectId}
          entityType="project"
          entityId={projectId}
          docType={d.docType}
          title={d.title}
          open={openDoc === d.docType}
          onClose={() => setOpenDoc(null)}
          onUploaded={() => setUploaded((s) => new Set(s).add(d.docType))}
        />
      ))}
      <button
        onClick={onNext}
        className="mt-4 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
      >
        Continue
      </button>
    </StepCard>
  );
}

const ITEM_CLASSES: Record<string, string> = {
  PASS: 'bg-teal-50 text-teal-800 ring-teal-200',
  FAIL: 'bg-red-50 text-red-800 ring-red-200',
  WARN: 'bg-amber-50 text-amber-800 ring-amber-200',
  NOT_EVALUATED: 'bg-slate-100 text-slate-600 ring-slate-200',
};

function PrescrutinyStep({ projectId, onNext }: { projectId: string; onNext: () => void }) {
  const run = useRunPrescrutiny(projectId);
  const [result, setResult] = useState<PrescrutinyResult | null>(null);

  return (
    <StepCard>
      <button
        onClick={() => void run.mutateAsync().then(setResult)}
        disabled={run.isPending}
        className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {run.isPending ? 'Running…' : 'Run pre-scrutiny'}
      </button>
      {result && (
        <ul className="mt-4 divide-y divide-slate-200 border border-slate-200">
          {result.items.map((item) => (
            <li key={item.code} className="px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${ITEM_CLASSES[item.status]}`}
                >
                  {item.status}
                </span>
                <span className="font-medium text-slate-900">{item.code}</span>
              </div>
              <p className="mt-0.5 text-slate-600">{item.message}</p>
              {item.code === 'NATIONAL_DUPLICATE_FOOTPRINT' && Array.isArray(item.detail) && item.detail.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-xs text-slate-500">
                  {(item.detail as Array<{ code: string; name: string; overlap_area_sqm: string }>).map((o) => (
                    <li key={o.code}>
                      {o.code} — {o.name} ({Number(o.overlap_area_sqm).toLocaleString('en-IN')} m² overlap)
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={onNext}
        disabled={!result}
        className="mt-4 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
      >
        Continue
      </button>
    </StepCard>
  );
}

function SubmitStep({ projectId }: { projectId: string }) {
  const submit = useSubmitProject(projectId);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit() {
    setError(null);
    try {
      await submit.mutateAsync();
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiProblem ? e.message : 'Could not submit.');
    }
  }

  return (
    <StepCard>
      {done ? (
        <div>
          <p className="text-sm text-teal-700">Submitted. The rule pack is pinned and the districts are routed.</p>
          <Link
            href={`/project/${projectId}/timeline`}
            className="mt-2 inline-block text-sm font-medium text-teal-700 hover:underline"
          >
            Open the project timeline →
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            Submitting pins the eligible rule pack and routes the districts derived from the footprint.
          </p>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
          <button
            onClick={() => void onSubmit()}
            disabled={submit.isPending}
            className="mt-3 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {submit.isPending ? 'Submitting…' : 'Submit proposal'}
          </button>
        </>
      )}
    </StepCard>
  );
}
