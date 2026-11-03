import { hasArabic, shapeArabic } from './arabic';
import {
  covers,
  detectRegion,
  fontCoverage,
  fontShorthand,
  loadFont,
  resolveFontSpec,
  SYSTEM_STACK,
  UNIFONT_FAMILY,
  unifontSpec,
  type FontSpec,
} from './fonts';
import type { SignOptions } from './types';

/**
 * A text bitmap. Each cell is
 *   0            – empty
 *   1            – ink (painted with the text colour)
 *   0x1000000|rgb – a colour glyph pixel (emoji), kept in its own colour
 */
export interface TextBitmap {
  width: number;
  height: number;
  data: Uint32Array;
}

export const INK = 1;
export const COLOR_FLAG = 0x1000000;

export type RasterOptions = Pick<
  SignOptions,
  | 'text'
  | 'font'
  | 'customFontFamily'
  | 'customFontSize'
  | 'cjkRegion'
  | 'fontScale'
  | 'bold'
  | 'align'
  | 'letterSpacing'
  | 'lineSpacing'
  | 'colorEmoji'
  | 'threshold'
>;

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

function context(): CanvasRenderingContext2D {
  if (!ctx) {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D is not available');
  }
  return ctx;
}

const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿\u{10800}-\u{10FFF}\u{1E800}-\u{1EFFF}]/u;
const STRONG_LTR = /\p{L}/u;

function isRtl(line: string): boolean {
  for (const ch of line) {
    if (RTL_CHAR.test(ch)) return true;
    if (STRONG_LTR.test(ch)) return false;
  }
  return false;
}

interface LineBitmap {
  width: number;
  height: number;
  data: Uint32Array;
}

/** Scripts whose letters connect; extra letter spacing would tear them apart. */
const CONNECTED =
  /[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Nko}\p{Script=Mongolian}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}]/u;
/** Scripts that need real OpenType shaping (conjuncts, reordering) which pixel fonts lack. */
export const NEEDS_SHAPING =
  /[\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}\p{Script=Myanmar}\p{Script=Khmer}\p{Script=Tibetan}\p{Script=Javanese}\p{Script=Balinese}]/u;

const hasCanvasLetterSpacing = () => 'letterSpacing' in context();

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graphemes = (s: string) => (segmenter ? [...segmenter.segment(s)].map((g) => g.segment) : [...s]);

function rasterizeLine(raw: string, spec: FontSpec, o: RasterOptions): LineBitmap {
  const c = context();
  const line = spec.family === UNIFONT_FAMILY && hasArabic(raw) ? shapeArabic(raw) : raw;
  const rtl = isRtl(line);
  // Pixel bold smears glyphs one pixel right, so give every glyph one extra pixel of room.
  const spacing = Math.round(o.letterSpacing) + (o.bold && !CONNECTED.test(line) ? 1 : 0);
  // Browsers without ctx.letterSpacing: place graphemes one by one (LTR only, shaping-free lines).
  const manual = spacing !== 0 && !hasCanvasLetterSpacing() && !rtl && !CONNECTED.test(line) && !NEEDS_SHAPING.test(line);
  const parts = manual ? graphemes(line) : [line];

  const setup = () => {
    c.font = fontShorthand(spec);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.direction = rtl ? 'rtl' : 'ltr';
    if (!manual && 'letterSpacing' in c) (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
  };
  setup();
  const m = c.measureText(line);
  const advances = manual ? parts.map((p) => c.measureText(p).width + spacing) : [];
  const advance = manual ? advances.reduce((a, b) => a + b, 0) : m.width;
  const fontAsc = Math.ceil(m.fontBoundingBoxAscent ?? spec.size * 0.8);
  const fontDesc = Math.ceil(m.fontBoundingBoxDescent ?? spec.size * 0.2);
  const inkAsc = Math.ceil(m.actualBoundingBoxAscent || 0);
  const inkDesc = Math.ceil(m.actualBoundingBoxDescent || 0);
  const asc = Math.max(fontAsc, inkAsc);
  const desc = Math.max(fontDesc, inkDesc);
  const pad = spec.size + Math.abs(spacing);
  const w = Math.ceil(Math.max(advance, (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || 0))) + pad * 2;
  const h = asc + desc + pad * 2;
  const cv = c.canvas;
  cv.width = Math.max(1, w);
  cv.height = Math.max(1, h);
  setup(); // resizing a canvas resets its state

  const baseline = pad + asc;
  const draw = (fill: string) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = fill;
    if (!manual) {
      c.fillText(line, pad, baseline);
      return;
    }
    let x = pad;
    parts.forEach((p, i) => {
      c.fillText(p, Math.round(x), baseline);
      x += advances[i];
    });
  };
  draw('#000');
  const dark = c.getImageData(0, 0, w, h).data;
  let light: Uint8ClampedArray | null = null;
  if (o.colorEmoji) {
    // Text follows fillStyle, colour glyphs don't: drawing twice tells them apart.
    draw('#fff');
    light = c.getImageData(0, 0, w, h).data;
  }

  const threshold = Math.max(1, Math.min(255, o.threshold));
  const full = new Uint32Array(w * h);
  let minX = w;
  let maxX = -1;
  for (let i = 0, p = 0; p < full.length; p++, i += 4) {
    if (dark[i + 3] < threshold) continue;
    let v = INK;
    if (light) {
      const diff = Math.abs(dark[i] - light[i]) + Math.abs(dark[i + 1] - light[i + 1]) + Math.abs(dark[i + 2] - light[i + 2]);
      if (diff < 96) {
        // Quantise to 4 bits per channel so emoji don't explode into hundreds of colours.
        const r = Math.round(dark[i] / 17) * 17;
        const g = Math.round(dark[i + 1] / 17) * 17;
        const b = Math.round(dark[i + 2] / 17) * 17;
        v = COLOR_FLAG | (r << 16) | (g << 8) | b;
      }
    }
    full[p] = v;
    const x = p % w;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }

  // Keep the font's full line box vertically (so baselines line up), crop horizontally to the ink.
  const top = pad;
  const lh = asc + desc;
  if (maxX < 0) return { width: 0, height: lh, data: new Uint32Array(0) };
  const lw = maxX - minX + 1;
  const out = new Uint32Array(lw * lh);
  for (let y = 0; y < lh; y++) {
    const src = (top + y) * w + minX;
    out.set(full.subarray(src, src + lw), y * lw);
  }
  return { width: lw, height: lh, data: out };
}

function embolden(b: LineBitmap): LineBitmap {
  if (!b.width) return b;
  const w = b.width + 1;
  const out = new Uint32Array(w * b.height);
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      const v = b.data[y * b.width + x];
      if (!v) continue;
      out[y * w + x] = v;
      if (v === INK && !out[y * w + x + 1]) out[y * w + x + 1] = INK;
    }
  }
  return { width: w, height: b.height, data: out };
}

function upscale(b: LineBitmap, s: number): LineBitmap {
  if (s <= 1 || !b.width) return { ...b, height: b.height * Math.max(1, s) };
  const w = b.width * s;
  const h = b.height * s;
  const out = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.floor(y / s) * b.width;
    for (let x = 0; x < w; x++) out[y * w + x] = b.data[sy + Math.floor(x / s)];
  }
  return { width: w, height: h, data: out };
}

const cache = new Map<string, TextBitmap>();

/** Draws `text` with a pixel font and returns its 1-bit (+ colour emoji) bitmap, cropped to the ink. */
export async function rasterizeText(o: RasterOptions): Promise<TextBitmap> {
  const key = JSON.stringify([
    o.text, o.font, o.customFontFamily, o.customFontSize, o.cjkRegion, o.fontScale, o.bold,
    o.align, o.letterSpacing, o.lineSpacing, o.colorEmoji, o.threshold,
  ]);
  const hit = cache.get(key);
  if (hit) return hit;

  const text = o.text.replace(/\r\n?/g, '\n');
  const region = o.cjkRegion === 'auto' ? detectRegion(text) : o.cjkRegion;
  const primary = resolveFontSpec(o, region);
  const fallback = unifontSpec();
  await loadFont(primary, text);

  // Lines the primary pixel font can't draw (Arabic, Thai, Devanagari…) switch to Unifont as a whole,
  // so every glyph on the line is drawn at a native pixel size instead of a blurry scaled one.
  const lines = text.split('\n');
  const specs: FontSpec[] = lines.map(() => primary);
  const primaryCov = primary.family === fallback.family ? null : fontCoverage(primary);
  if (primaryCov) {
    const missingChars = [...new Set([...text].filter((ch) => !/\s/u.test(ch) && !covers(primaryCov, ch.codePointAt(0)!)))];
    const missing = lines.map((line) => [...line].some((ch) => missingChars.includes(ch)));
    if (missingChars.length) {
      await loadFont(fallback, missingChars.join(''));
      const fbCov = fontCoverage(fallback);
      lines.forEach((line, i) => {
        if (!missing[i]) return;
        const useful = [...line].some((ch) => {
          const cp = ch.codePointAt(0)!;
          return !covers(primaryCov, cp) && (!fbCov || covers(fbCov, cp));
        });
        if (useful) specs[i] = fallback;
      });
    }
  } else if (primary.family !== fallback.family) {
    // System / custom fonts may still fall back to Unifont through the CSS font stack.
    await loadFont(fallback, text);
  }
  if (!primary.isStack && primary.css) {
    // Indic & co. need conjuncts / vowel reordering that pixel fonts can't do: pixelate the OS font instead.
    lines.forEach((line, i) => {
      if (NEEDS_SHAPING.test(line)) specs[i] = { family: SYSTEM_STACK, size: Math.max(16, primary.size), isStack: true };
    });
  }

  const scale = Math.max(1, Math.min(8, Math.round(o.fontScale)));
  const rendered = lines.map((line, i) => {
    let b = rasterizeLine(line, specs[i], o);
    if (o.bold) b = embolden(b);
    return upscale(b, scale);
  });

  const gap = Math.max(-8, Math.round(o.lineSpacing));
  const width = Math.max(0, ...rendered.map((b) => b.width));
  let height = 0;
  rendered.forEach((b, i) => (height += b.height + (i ? gap : 0)));
  height = Math.max(0, height);
  const data = new Uint32Array(width * height);
  let y0 = 0;
  for (const b of rendered) {
    const x0 = o.align === 'left' ? 0 : o.align === 'right' ? width - b.width : Math.floor((width - b.width) / 2);
    for (let y = 0; y < b.height; y++) {
      const ty = y0 + y;
      if (ty < 0 || ty >= height) continue;
      for (let x = 0; x < b.width; x++) {
        const v = b.data[y * b.width + x];
        if (v) data[ty * width + x0 + x] = v;
      }
    }
    y0 += b.height + gap;
  }

  const result = cropRows({ width, height, data }, primary.size * scale);
  if (cache.size > 64) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}

/** Trims empty rows above and below the ink so the text sits optically centred on the sign. */
function cropRows(b: TextBitmap, emptyHeight: number): TextBitmap {
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < b.height; y++) {
    const row = b.data.subarray(y * b.width, (y + 1) * b.width);
    if (row.some((v) => v !== 0)) {
      if (top < 0) top = y;
      bottom = y;
    }
  }
  if (top < 0) return { width: 0, height: emptyHeight, data: new Uint32Array(0) };
  const h = bottom - top + 1;
  return { width: b.width, height: h, data: b.data.slice(top * b.width, (bottom + 1) * b.width) };
}
