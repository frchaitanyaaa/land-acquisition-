'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FilePicker } from '@/components/file-picker';
import { api, apiUpload } from '@/lib/api';

interface Declaration {
  version: string;
  text: string;
}

/**
 * Document upload with the mandatory per-document attestation (§26.2, G21). Every legal document
 * carries this — the declaration text is rendered from the API's own render of
 * packages/shared/src/declarations.ts (with the signed-in officer's name/designation/jurisdiction
 * filled in), never re-typed here.
 */
export function AttestationModal({
  projectId,
  entityType,
  entityId,
  docType,
  title: docTitle,
  open,
  onClose,
  onUploaded,
}: {
  projectId: string;
  entityType: string;
  entityId: string;
  docType: string;
  title: string;
  open: boolean;
  onClose: () => void;
  onUploaded: (documentId: string) => void;
}) {
  const { data: declaration } = useQuery({
    queryKey: ['declaration', 'current'],
    queryFn: () => api<Declaration>('/declarations/current'),
    enabled: open,
  });
  const [file, setFile] = useState<File | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit() {
    if (!file || !agreed || !declaration) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('entityType', entityType);
      form.append('entityId', entityId);
      form.append('projectId', projectId);
      form.append('docType', docType);
      form.append('title', docTitle);
      form.append('attest', 'true');
      form.append('declarationVersion', declaration.version);
      const doc = await apiUpload<{ id: string }>('/documents', form);
      onUploaded(doc.id);
      setFile(null);
      setAgreed(false);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg border border-slate-200 bg-white p-5 shadow-lg">
        <h3 className="text-sm font-semibold text-slate-900">Upload — {docTitle}</h3>
        <div className="mt-3 text-sm">
          <span className="text-slate-700">File</span>
          <FilePicker onFile={setFile} />
        </div>

        <div className="mt-4 border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
          {declaration ? declaration.text : 'Loading declaration…'}
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span className="text-slate-700">I certify the declaration above.</span>
        </label>

        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={!file || !agreed || busy}
            className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {busy ? 'Uploading…' : 'Attest & upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
