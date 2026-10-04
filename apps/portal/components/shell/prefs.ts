/**
 * Per-viewer display preferences (theme, text size, contrast, last project). They live in
 * localStorage on purpose: they are conveniences for this browser, not records. Every access is
 * wrapped because storage can be blocked (private mode, policies).
 */
export type Theme = 'light' | 'dark';
export type TextSize = 's' | 'm' | 'l' | 'xl';
export type Contrast = 'normal' | 'high';

export const PREF_KEYS = {
  theme: 'bs.theme',
  textSize: 'bs.textSize',
  contrast: 'bs.contrast',
  project: 'bs.project',
} as const;

export const TEXT_SIZES: readonly TextSize[] = ['s', 'm', 'l', 'xl'];

/**
 * Routes whose screens are fully restyled with UX4G and pass AA in dark mode. Everything else is
 * still Tailwind with hard-coded light colours, so it renders light whatever the viewer chose
 * (UX4G's dark tokens only exist at :root, so a section cannot be scoped back to light).
 * Whoever converts a screen adds its route prefix here in the same commit.
 */
export const DARK_READY_ROUTES: readonly string[] = ['/session'];

export function isDarkReady(pathname: string): boolean {
  return DARK_READY_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

export function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — the preference just won't persist */
  }
}

/** Mirror a preference onto <html> (the attributes globals.css and UX4G key off). */
export function applyPref(attr: 'data-theme' | 'data-text-size' | 'data-contrast', value: string | null) {
  const root = document.documentElement;
  if (value === null) root.removeAttribute(attr);
  else root.setAttribute(attr, value);
}

/** Inlined in <head> so the saved theme applies before first paint (no light flash in dark mode). */
export const PREFS_BOOT_SCRIPT = `(function(){try{var s=window.localStorage,r=document.documentElement;
var p=location.pathname,ok=${JSON.stringify(DARK_READY_ROUTES)}.some(function(x){return p===x||p.indexOf(x+'/')===0;});
var t=s.getItem('${PREF_KEYS.theme}');if(t==='dark'&&ok)r.setAttribute('data-theme','dark');
var z=s.getItem('${PREF_KEYS.textSize}');if(z==='s'||z==='l'||z==='xl')r.setAttribute('data-text-size',z);
if(s.getItem('${PREF_KEYS.contrast}')==='high')r.setAttribute('data-contrast','high');}catch(e){}})();`;
