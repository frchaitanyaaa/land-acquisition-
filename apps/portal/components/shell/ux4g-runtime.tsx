'use client';

import { useEffect } from 'react';

export function Ux4gRuntime() {
  useEffect(() => {
    void import('ux4g-web-components/design-system');
  }, []);
  return null;
}
