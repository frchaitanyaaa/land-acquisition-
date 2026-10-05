'use client';

import { useId, useRef, useState } from 'react';

/**
 * A file input that looks like a button: "Choose file", then the chosen file's name ("No file chosen"
 * until one is picked). The native input stays in the DOM (visually hidden) for keyboard and screen readers.
 */
export function FilePicker({
  onFile,
  accept,
  label = 'Choose file',
}: {
  onFile: (file: File | null) => void;
  accept?: string;
  label?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-3">
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setName(f?.name ?? null);
          onFile(f);
        }}
      />
      <button type="button" onClick={() => input.current?.click()} className="ux4g-btn-outline-primary ux4g-btn-s">
        {label}
      </button>
      <label htmlFor={id} className={`min-w-0 truncate text-sm ${name ? 'text-slate-900' : 'text-slate-500'}`}>
        {name ?? 'No file chosen'}
      </label>
    </div>
  );
}
