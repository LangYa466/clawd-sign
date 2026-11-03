import { Grid, type Layer } from './grid';
import { eyePixels, MASCOT_BODY, MASCOT_BOX, MASCOT_CENTER_X, MASCOT_HANDS, MIN_SIGN_WIDTH, SIGN_BOTTOM_ROW, type Rect } from './mascot';
import { resolvePalette } from './palette';
import { COLOR_FLAG, INK, rasterizeText } from './rasterize';
import type { Aspect, BackgroundSpec, Palette, ResolvedTheme, SignOptions } from './types';

export type SceneBackground =
  | { kind: 'none' }
  | { kind: 'color'; color: string }
  | { kind: 'gradient'; from: string; to: string; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'pixels'; layers: Layer[] }
  | { kind: 'image'; src: string; pixelated: boolean; dim: number };

export interface Scene {
  width: number;
  height: number;
  palette: Palette;
  background: SceneBackground;
  /** Sign, text and mascot body. */
  figure: Layer[];
  /** Open eyes (drawn over the body). */
  eyes: Layer[];
  /** Closed eyes shown briefly when blinking (empty when blinking is off). */
  blinkEyes: Layer[];
  /** Where the figure sits inside the scene. */
  figureBox: { x: number; y: number; width: number; height: number };
  animation: SignOptions['animation'];
  label: string;
}

const clampInt = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

/** Is (x, y) inside a w×h rectangle whose corners are rounded in pixel steps of radius r? */
function inRounded(x: number, y: number, w: number, h: number, r: number): boolean {
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  r = Math.min(r, Math.floor(Math.min(w, h) / 2));
  if (r <= 0) return true;
  const kx = Math.min(x, w - 1 - x);
  const ky = Math.min(y, h - 1 - y);
  if (kx >= r || ky >= r) return true;
  return kx >= Math.ceil(r - Math.sqrt(r * r - (r - ky) * (r - ky)) - 1e-9);
}

const ASPECTS: Record<Exclude<Aspect, 'auto'>, [number, number]> = {
  '1:1': [1, 1],
  '4:3': [4, 3],
  '3:4': [3, 4],
  '16:9': [16, 9],
  '9:16': [9, 16],
};

export async function buildScene(opts: SignOptions, theme: ResolvedTheme): Promise<Scene> {
  const palette = resolvePalette(theme, opts.colors);
  const bitmap = await rasterizeText(opts);

  const border = clampInt(opts.borderWidth, 0, 8);
  const padX = clampInt(opts.paddingX, 0, 64);
  const padY = clampInt(opts.paddingY, 0, 64);
  const radius = clampInt(opts.cornerRadius, 0, 12);
  const mascot = opts.showMascot;
  const k = clampInt(opts.mascotScale, 1, 4);
  const scaled = ([x, y, w, h]: Rect): Rect => [x * k, y * k, w * k, h * k];

  // ── Figure layout (in mascot space: body top-left = 0,0) ─────────────────
  let signW = Math.max(bitmap.width + 2 * (padX + border), clampInt(opts.minWidth, 0, 2000), mascot ? MIN_SIGN_WIDTH * k : 1);
  if (mascot && signW % 2) signW++; // keep the sign centred on the body
  const signH = Math.max(1, bitmap.height + 2 * (padY + border));
  const signLeft = mascot ? MASCOT_CENTER_X * k - signW / 2 : 0;
  const signTop = mascot ? SIGN_BOTTOM_ROW * k - signH + 1 : 0;

  const figLeft = mascot ? Math.min(signLeft, MASCOT_BOX.left * k) : signLeft;
  const figRight = mascot ? Math.max(signLeft + signW, MASCOT_BOX.right * k) : signLeft + signW;
  const figTop = signTop;
  const figBottom = mascot ? MASCOT_BOX.bottom * k : signTop + signH;
  const figW = figRight - figLeft;
  const figH = figBottom - figTop;

  // ── Scene size: margin, then grow to the requested aspect ratio ──────────
  const margin = clampInt(opts.margin, 0, 200);
  let width = figW + 2 * margin;
  let height = figH + 2 * margin;
  if (opts.aspect !== 'auto' && ASPECTS[opts.aspect]) {
    const [rw, rh] = ASPECTS[opts.aspect];
    if (width * rh < height * rw) width = Math.ceil((height * rw) / rh);
    else height = Math.ceil((width * rh) / rw);
  }
  const fx = Math.floor((width - figW) / 2);
  const fy = Math.floor((height - figH) / 2);
  const ox = fx - figLeft; // mascot space → scene space
  const oy = fy - figTop;

  // ── Paint ────────────────────────────────────────────────────────────────
  const fig = new Grid(width, height);
  if (mascot) {
    const body = fig.color(palette.body);
    for (const [x, y, w, h] of MASCOT_BODY.map(scaled)) fig.rect(x + ox, y + oy, w, h, body);
  }

  const sx = signLeft + ox;
  const sy = signTop + oy;
  const fill = fig.color(palette.signFill);
  const edge = fig.color(palette.signBorder);
  const innerR = Math.max(0, radius - border);
  for (let y = 0; y < signH; y++) {
    for (let x = 0; x < signW; x++) {
      if (!inRounded(x, y, signW, signH, radius)) continue;
      const inner = border === 0 || inRounded(x - border, y - border, signW - 2 * border, signH - 2 * border, innerR);
      if (inner && opts.transparentSign) continue;
      fig.set(sx + x, sy + y, inner ? fill : edge);
    }
  }

  if (bitmap.width) {
    const avail = signW - 2 * (border + padX);
    const extra = avail - bitmap.width;
    const tx = sx + border + padX + (opts.align === 'left' ? 0 : opts.align === 'right' ? extra : Math.floor(extra / 2));
    const ty = sy + border + padY;
    const ink = fig.color(palette.text);
    const emoji = new Map<number, number>();
    for (let y = 0; y < bitmap.height; y++) {
      for (let x = 0; x < bitmap.width; x++) {
        const v = bitmap.data[y * bitmap.width + x];
        if (!v) continue;
        let ci = ink;
        if (v !== INK && v & COLOR_FLAG) {
          const rgb = v & 0xffffff;
          ci = emoji.get(rgb) ?? fig.color(`#${rgb.toString(16).padStart(6, '0')}`);
          emoji.set(rgb, ci);
        }
        fig.set(tx + x, ty + y, ci);
      }
    }
  }

  let eyes: Layer[] = [];
  let blinkEyes: Layer[] = [];
  if (mascot) {
    const hands = fig.color(palette.body);
    for (const [x, y, w, h] of MASCOT_HANDS.map(scaled)) fig.rect(x + ox, y + oy, w, h, hands);
    eyes = paintEyes(width, height, ox, oy, k, palette.eyes, opts.eyes);
    if (opts.blink && opts.eyes !== 'closed') blinkEyes = paintEyes(width, height, ox, oy, k, palette.eyes, 'closed');
  }

  return {
    width,
    height,
    palette,
    background: await buildBackground(opts.background, palette, width, height),
    figure: fig.layers(),
    eyes,
    blinkEyes,
    figureBox: { x: fx, y: fy, width: figW, height: figH },
    animation: opts.animation,
    label: opts.text,
  };
}

function paintEyes(w: number, h: number, ox: number, oy: number, k: number, color: string, style: SignOptions['eyes']): Layer[] {
  const g = new Grid(w, h);
  const ci = g.color(color);
  for (const [x, y, rw, rh] of eyePixels(style)) g.rect(x * k + ox, y * k + oy, rw * k, rh * k, ci);
  return g.layers();
}

// ── Backgrounds ──────────────────────────────────────────────────────────────

async function buildBackground(bg: BackgroundSpec, palette: Palette, w: number, h: number): Promise<SceneBackground> {
  switch (bg.type) {
    case 'transparent':
      return { kind: 'none' };
    case 'color':
      return { kind: 'color', color: bg.color };
    case 'gradient': {
      const a = ((Number(bg.angle) || 0) * Math.PI) / 180;
      const dx = Math.sin(a);
      const dy = -Math.cos(a);
      const half = Math.abs((w / 2) * dx) + Math.abs((h / 2) * dy);
      const cx = w / 2;
      const cy = h / 2;
      const steps = clampInt(bg.steps, 0, 64);
      if (steps < 2) {
        return { kind: 'gradient', from: bg.from, to: bg.to, x1: cx - dx * half, y1: cy - dy * half, x2: cx + dx * half, y2: cy + dy * half };
      }
      const g = new Grid(w, h);
      const bands = Array.from({ length: steps }, (_, i) => g.color(mix(bg.from, bg.to, i / (steps - 1))));
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const t = ((x + 0.5 - cx) * dx + (y + 0.5 - cy) * dy) / (2 * half || 1) + 0.5;
          g.set(x, y, bands[Math.max(0, Math.min(steps - 1, Math.floor(t * steps)))]);
        }
      }
      return { kind: 'pixels', layers: g.layers() };
    }
    case 'pattern': {
      const s = clampInt(bg.size, 1, 64);
      const g = new Grid(w, h);
      const c1 = g.color(bg.color1);
      const c2 = g.color(bg.color2);
      const half = Math.floor(s / 2);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let alt: boolean;
          switch (bg.kind) {
            case 'grid':
              alt = x % s === 0 || y % s === 0;
              break;
            case 'dots':
              alt = x % s === half && y % s === half;
              break;
            case 'stripes':
              alt = Math.floor((x + y) / s) % 2 === 1;
              break;
            case 'checker':
            default:
              alt = (Math.floor(x / s) + Math.floor(y / s)) % 2 === 1;
          }
          g.set(x, y, alt ? c2 : c1);
        }
      }
      return { kind: 'pixels', layers: g.layers() };
    }
    case 'image': {
      if (!bg.src) return { kind: 'color', color: palette.background };
      const dim = Math.max(0, Math.min(0.9, Number(bg.dim) || 0));
      if (!bg.pixelate) return { kind: 'image', src: bg.src, pixelated: false, dim };
      try {
        return { kind: 'image', src: await pixelateImage(bg.src, w, h), pixelated: true, dim };
      } catch {
        return { kind: 'image', src: bg.src, pixelated: false, dim };
      }
    }
    case 'theme':
    default:
      return { kind: 'color', color: palette.background };
  }
}

function parseHex(c: string): [number, number, number] {
  let h = c.trim().replace('#', '');
  if (h.length === 3) h = h.replace(/./g, (ch) => ch + ch);
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  return `#${ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image ${src.slice(0, 64)}`));
    img.src = src;
  });
}

/** Source rectangle that makes an image cover a w×h box (like `object-fit: cover`). */
export function coverRect(iw: number, ih: number, w: number, h: number) {
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh };
}

const pixelCache = new Map<string, string>();

/** Downsamples an image to one sample per scene pixel so it matches the pixel-art grid. */
async function pixelateImage(src: string, w: number, h: number): Promise<string> {
  const key = `${w}x${h}:${src.length}:${src.slice(-64)}:${src.slice(0, 96)}`;
  const hit = pixelCache.get(key);
  if (hit) return hit;
  const img = await loadImage(src);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const { sx, sy, sw, sh } = coverRect(img.naturalWidth, img.naturalHeight, w, h);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const url = c.toDataURL('image/png');
  if (pixelCache.size > 16) pixelCache.delete(pixelCache.keys().next().value!);
  pixelCache.set(key, url);
  return url;
}
