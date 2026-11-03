import {
  DEFAULT_OPTIONS,
  type BackgroundSpec,
  type Palette,
  type SignOptions,
  type ThemeMode,
} from '../clawd-sign';

const STORAGE_KEY = 'clawd-sign:v1';
const PREFS_KEY = 'clawd-sign:prefs';

const HEX = /^#[0-9a-f]{6}$/i;
const PALETTE_KEYS: (keyof Palette)[] = ['background', 'signFill', 'signBorder', 'text', 'body', 'eyes'];

const num = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const color = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : fallback);

function sanitizeBackground(v: unknown): BackgroundSpec {
  const b = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  switch (b.type) {
    case 'transparent':
      return { type: 'transparent' };
    case 'color':
      return { type: 'color', color: color(b.color, '#f7f6f1') };
    case 'gradient':
      return {
        type: 'gradient',
        from: color(b.from, '#fde2c8'),
        to: color(b.to, '#c9e4f6'),
        angle: num(b.angle, 0, 360, 135),
        steps: num(b.steps, 0, 64, 8),
      };
    case 'pattern':
      return {
        type: 'pattern',
        kind: oneOf(b.kind, ['checker', 'grid', 'dots', 'stripes'] as const, 'checker'),
        color1: color(b.color1, '#f7f6f1'),
        color2: color(b.color2, '#ece8de'),
        size: num(b.size, 1, 64, 4),
      };
    case 'image':
      return {
        type: 'image',
        src: typeof b.src === 'string' && /^(data:image\/|https?:|blob:)/.test(b.src) ? b.src : '',
        pixelate: b.pixelate !== false,
        dim: num(b.dim, 0, 0.9, 0),
      };
    default:
      return { type: 'theme' };
  }
}

/** Accepts anything (URL hash, localStorage, …) and returns valid options. */
export function sanitizeOptions(input: unknown): SignOptions {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_OPTIONS;
  const colors: Partial<Palette> = {};
  const rawColors = (o.colors && typeof o.colors === 'object' ? o.colors : {}) as Record<string, unknown>;
  for (const k of PALETTE_KEYS) if (typeof rawColors[k] === 'string' && HEX.test(rawColors[k] as string)) colors[k] = (rawColors[k] as string).toLowerCase();
  return {
    text: typeof o.text === 'string' ? o.text.slice(0, 500) : d.text,
    font: oneOf(o.font, ['fusion-12', 'fusion-10', 'fusion-8', 'unifont', 'system', 'custom'] as const, d.font),
    customFontFamily: typeof o.customFontFamily === 'string' ? o.customFontFamily.slice(0, 100) : '',
    customFontSize: num(o.customFontSize, 6, 64, d.customFontSize),
    cjkRegion: oneOf(o.cjkRegion, ['auto', 'zh_hans', 'zh_hant', 'ja', 'ko'] as const, d.cjkRegion),
    fontScale: num(o.fontScale, 1, 4, d.fontScale),
    bold: typeof o.bold === 'boolean' ? o.bold : d.bold,
    align: oneOf(o.align, ['left', 'center', 'right'] as const, d.align),
    letterSpacing: num(o.letterSpacing, -4, 16, d.letterSpacing),
    lineSpacing: num(o.lineSpacing, -8, 24, d.lineSpacing),
    colorEmoji: typeof o.colorEmoji === 'boolean' ? o.colorEmoji : d.colorEmoji,
    threshold: num(o.threshold, 1, 255, d.threshold),
    paddingX: num(o.paddingX, 0, 64, d.paddingX),
    paddingY: num(o.paddingY, 0, 64, d.paddingY),
    borderWidth: num(o.borderWidth, 0, 8, d.borderWidth),
    cornerRadius: num(o.cornerRadius, 0, 12, d.cornerRadius),
    minWidth: num(o.minWidth, 0, 400, d.minWidth),
    showMascot: typeof o.showMascot === 'boolean' ? o.showMascot : d.showMascot,
    mascotScale: num(o.mascotScale, 1, 4, d.mascotScale),
    eyes: oneOf(o.eyes, ['square', 'tall', 'happy', 'closed', 'wink', 'dizzy'] as const, d.eyes),
    blink: typeof o.blink === 'boolean' ? o.blink : d.blink,
    animation: oneOf(o.animation, ['none', 'bob', 'jump', 'shake'] as const, d.animation),
    colors,
    background: sanitizeBackground(o.background),
    margin: num(o.margin, 0, 200, d.margin),
    aspect: oneOf(o.aspect, ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'] as const, d.aspect),
    pixelSize: num(o.pixelSize, 1, 32, d.pixelSize),
  };
}

/** Only the options that differ from the defaults. */
export function diffOptions(o: SignOptions): Partial<SignOptions> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    const def = (DEFAULT_OPTIONS as unknown as Record<string, unknown>)[k];
    if (JSON.stringify(v) !== JSON.stringify(def)) out[k] = v;
  }
  return out as Partial<SignOptions>;
}

/** Options safe to put in a link: drops uploaded images and fonts. */
export function shareableOptions(o: SignOptions): { options: SignOptions; dropped: boolean } {
  let dropped = false;
  let next = o;
  if (o.background.type === 'image' && !/^https?:/.test(o.background.src)) {
    next = { ...next, background: { type: 'theme' } };
    dropped = true;
  }
  if (o.font === 'custom' && o.customFontFamily.startsWith('Clawd Upload')) {
    next = { ...next, font: 'fusion-12', customFontFamily: '' };
    dropped = true;
  }
  return { options: next, dropped };
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export interface SharedState {
  options: SignOptions;
  theme?: ThemeMode;
}

export function encodeHash(options: SignOptions, theme: ThemeMode): string {
  const payload: Record<string, unknown> = { o: diffOptions(shareableOptions(options).options) };
  if (theme !== 'system') payload.t = theme;
  return toBase64Url(JSON.stringify(payload));
}

export function decodeHash(hash: string): SharedState | null {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;
  try {
    const data = JSON.parse(fromBase64Url(raw));
    const theme = ['light', 'dark', 'system'].includes(data?.t) ? (data.t as ThemeMode) : undefined;
    return { options: sanitizeOptions(data?.o), theme };
  } catch {
    return null;
  }
}

export function loadSaved(): SignOptions | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeOptions(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function save(options: SignOptions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    // Probably a large uploaded image: keep everything else.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shareableOptions(options).options));
    } catch {
      /* storage unavailable */
    }
  }
}

export interface Prefs {
  theme: ThemeMode;
  lang: 'zh' | 'en';
  exportScale: number;
}

export function loadPrefs(): Partial<Prefs> {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    const out: Partial<Prefs> = {};
    if (['light', 'dark', 'system'].includes(p.theme)) out.theme = p.theme;
    if (p.lang === 'zh' || p.lang === 'en') out.lang = p.lang;
    if (Number.isFinite(p.exportScale)) out.exportScale = Math.max(1, Math.min(32, p.exportScale));
    return out;
  } catch {
    return {};
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/** JSX snippet reproducing the current sign with the <ClawdSign> component. */
export function reactSnippet(o: SignOptions, theme: ThemeMode): string {
  const diff = diffOptions(shareableOptions(o).options) as Record<string, unknown>;
  const props: string[] = [];
  const text = o.text;
  props.push(text.includes('\n') || text.includes('"') ? `text={${JSON.stringify(text)}}` : `text="${text}"`);
  delete diff.text;
  props.push(`theme="${theme}"`);
  for (const [k, v] of Object.entries(diff)) {
    if (typeof v === 'string') props.push(`${k}="${v}"`);
    else if (typeof v === 'number' || typeof v === 'boolean') props.push(`${k}={${v}}`);
    else props.push(`${k}={${JSON.stringify(v).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ')}}`);
  }
  return `import { ClawdSign } from './clawd-sign';\n\n<ClawdSign\n  ${props.join('\n  ')}\n/>`;
}
