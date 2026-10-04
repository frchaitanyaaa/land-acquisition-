import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
// UX4G imported once, here (00-shared-context.md). The CSS (~8 MB, fonts embedded) is precached by
// the service worker so the restyled screens still render in airplane mode.
import 'ux4g-web-components/styles.css';
import './index.css';

void import('ux4g-web-components/design-system');

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
