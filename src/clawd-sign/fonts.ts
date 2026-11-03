import type { CjkRegion, FontId, SignOptions } from './types';

export interface FontSpec {
  /** CSS font-family name (unquoted), or a full stack when `isStack` is set. */
  family: string;
  /** Native pixel size; glyphs are rasterised at exactly this size. */
  size: number;
  /** Stylesheet declaring the @font-face rules (with unicode-range splitting). */
  css?: string;
  isStack?: boolean;
}

type Region = Exclude<CjkRegion, 'auto'>;

const REGION_NAMES: Record<Region, string> = {
  zh_hans: 'Simplified Chinese',
  zh_hant: 'Traditional Chinese',
  ja: 'Japanese',
  ko: 'Korean',
};

export const UNIFONT_FAMILY = 'Clawd Unifont';

/** Last-resort fonts: anything the pixel fonts lack (emoji, rare scripts) is pixelated from these. */
export const SYSTEM_STACK =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "PingFang SC", "Hiragino Sans", "Microsoft YaHei", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';

let fontBaseUrl = `${import.meta.env?.BASE_URL ?? '/'}fonts/`;

/** Where the `fonts/` folder is served from (defaults to `<BASE_URL>fonts/`). */
export function setFontBaseUrl(url: string) {
  fontBaseUrl = url.endsWith('/') ? url : `${url}/`;
}

export function unifontSpec(): FontSpec {
  return { family: UNIFONT_FAMILY, size: 16, css: `${fontBaseUrl}unifont/unifont.css` };
}

export function resolveFontSpec(
  opts: Pick<SignOptions, 'font' | 'customFontFamily' | 'customFontSize'>,
  region: Region,
): FontSpec {
  const font: FontId = opts.font;
  switch (font) {
    case 'fusion-12':
    case 'fusion-10':
    case 'fusion-8': {
      const px = Number(font.split('-')[1]);
      const name = REGION_NAMES[region];
      return {
        family: `Fusion Pixel ${px}px Proportional ${name}`,
        size: px,
        css: `${fontBaseUrl}fusion-pixel/${px}px/${region}/Fusion-Pixel-${px}px-Proportional-${name.replace(/ /g, '-')}.css`,
      };
    }
    case 'unifont':
      return unifontSpec();
    case 'custom':
      if (opts.customFontFamily) {
        return { family: opts.customFontFamily, size: clampSize(opts.customFontSize) };
      }
      return { family: SYSTEM_STACK, size: clampSize(opts.customFontSize), isStack: true };
    case 'system':
    default:
      return { family: SYSTEM_STACK, size: clampSize(opts.customFontSize), isStack: true };
  }
}

function clampSize(n: number) {
  return Math.max(6, Math.min(64, Math.round(n || 16)));
}

/** CSS `font` shorthand: the chosen font, then Unifont, then whatever the system has. */
export function fontShorthand(spec: FontSpec): string {
  const primary = spec.isStack ? spec.family : `${quote(spec.family)}, `;
  const rest = spec.isStack ? '' : spec.family === UNIFONT_FAMILY ? SYSTEM_STACK : `${quote(UNIFONT_FAMILY)}, ${SYSTEM_STACK}`;
  return `${spec.size}px ${primary}${rest}`;
}

function quote(family: string) {
  return `"${family.replace(/"/g, '\\"')}"`;
}

const sheets = new Map<string, Promise<void>>();

/** Injects a stylesheet once and resolves when it has loaded (or failed). */
export function ensureStylesheet(href: string): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  let p = sheets.get(href);
  if (!p) {
    // Reuse a <link> the page already has (e.g. preloaded in index.html).
    const existing = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].find(
      (l) => l.getAttribute('href') === href || l.href === new URL(href, document.baseURI).href,
    );
    p = new Promise<void>((resolve) => {
      if (existing?.sheet) return resolve();
      setTimeout(resolve, 8000); // never let a stuck stylesheet block rendering
      const link = existing ?? document.createElement('link');
      link.addEventListener('load', () => resolve(), { once: true });
      link.addEventListener(
        'error',
        () => {
          console.warn(`[clawd-sign] failed to load font stylesheet ${href}`);
          resolve();
        },
        { once: true },
      );
      if (!existing) {
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
      }
    });
    sheets.set(href, p);
  }
  return p;
}

/** Makes sure every font face needed to draw `text` with `spec` is downloaded. */
export async function loadFont(spec: FontSpec, text: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  if (spec.css) await ensureStylesheet(spec.css);
  if (spec.isStack) return;
  const sample = text.trim() || 'A';
  try {
    await document.fonts.load(`${spec.size}px ${quote(spec.family)}`, sample);
  } catch {
    /* a missing face just falls back to the next font */
  }
}

type Ranges = [number, number][];
const coverageCache = new Map<string, Ranges>();

/**
 * Unicode coverage of a web font, read from the `unicode-range` of its @font-face rules.
 * Returns `null` for fonts without known coverage (system / custom fonts).
 */
export function fontCoverage(spec: FontSpec): Ranges | null {
  if (spec.isStack || !spec.css || typeof document === 'undefined' || !document.fonts) return null;
  const cached = coverageCache.get(spec.family);
  if (cached) return cached;
  const ranges: Ranges = [];
  document.fonts.forEach((face) => {
    if (face.family.replace(/^["']|["']$/g, '') !== spec.family) return;
    for (const part of face.unicodeRange.split(',')) {
      const r = parseRange(part.trim());
      if (r) ranges.push(r);
    }
  });
  if (!ranges.length) return null;
  ranges.sort((a, b) => a[0] - b[0]);
  coverageCache.set(spec.family, ranges);
  return ranges;
}

function parseRange(s: string): [number, number] | null {
  const m = /^U\+([0-9A-F?]+)(?:-([0-9A-F]+))?$/i.exec(s);
  if (!m) return null;
  if (m[1].includes('?')) {
    return [parseInt(m[1].replace(/\?/g, '0'), 16), parseInt(m[1].replace(/\?/g, 'F'), 16)];
  }
  const a = parseInt(m[1], 16);
  return [a, m[2] ? parseInt(m[2], 16) : a];
}

export function covers(ranges: Ranges, cp: number): boolean {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [a, b] = ranges[mid];
    if (cp < a) hi = mid - 1;
    else if (cp > b) lo = mid + 1;
    else return true;
  }
  return false;
}

/** Picks the Han glyph style: kana → Japanese, Hangul → Korean, otherwise the browser language. */
export function detectRegion(text: string): Region {
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return 'ja';
  if (/\p{Script=Hangul}/u.test(text)) return 'ko';
  const langs = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
  for (const raw of langs) {
    const l = (raw || '').toLowerCase();
    if (l.startsWith('zh')) return /hant|tw|hk|mo/.test(l) ? 'zh_hant' : 'zh_hans';
    if (l.startsWith('ja')) return 'ja';
    if (l.startsWith('ko')) return 'ko';
  }
  return 'zh_hans';
}
