'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Open/close state for the shell's dropdowns, popover and drawer. React owns the state and renders
 * UX4G's open-state classes (`is-open`, `show`, `ux4g-drawer-open`). The triggers deliberately avoid
 * the runtime's delegated hooks (`.ux4g-dropdown-control`, `data-ux-toggle`, `data-drawer`) so the
 * runtime and React never toggle the same element twice.
 *
 * Closes on Escape (focus returns to the trigger) and on a pointer press outside `ref`.
 */
export function useDisclosure<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return { open, setOpen, toggle: () => setOpen((o) => !o), close, ref, triggerRef };
}
