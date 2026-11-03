import { layerPath, type Layer } from './grid';
import { coverRect, loadImage, type Scene } from './scene';

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Keyframes are stepped so every frame lands on whole pixels. */
export function animationCss(scene: Scene, id: string): string {
  const rules: string[] = [];
  const fig = `.${id}-fig`;
  switch (scene.animation) {
    case 'bob':
      rules.push(
        `${fig}{animation:${id}-bob 1.1s steps(1,end) infinite}`,
        `@keyframes ${id}-bob{0%{transform:translate(0,0)}50%{transform:translate(0,-1px)}}`,
      );
      break;
    case 'jump':
      rules.push(
        `${fig}{animation:${id}-jump 1.6s steps(1,end) infinite}`,
        `@keyframes ${id}-jump{0%{transform:translate(0,0)}60%{transform:translate(0,-1px)}66%{transform:translate(0,-3px)}72%{transform:translate(0,-4px)}78%{transform:translate(0,-3px)}84%{transform:translate(0,-1px)}90%{transform:translate(0,0)}}`,
      );
      break;
    case 'shake':
      rules.push(
        `${fig}{animation:${id}-shake 1.4s steps(1,end) infinite}`,
        `@keyframes ${id}-shake{0%{transform:translate(0,0)}8%{transform:translate(-1px,0)}16%{transform:translate(1px,0)}24%{transform:translate(-1px,0)}32%{transform:translate(1px,0)}40%{transform:translate(0,0)}}`,
      );
      break;
  }
  if (scene.blinkEyes.length) {
    rules.push(
      `.${id}-eyes{animation:${id}-open 4.2s steps(1,end) infinite}`,
      `.${id}-blink{animation:${id}-shut 4.2s steps(1,end) infinite}`,
      `@keyframes ${id}-open{0%{visibility:visible}93%{visibility:hidden}96%{visibility:visible}}`,
      `@keyframes ${id}-shut{0%{visibility:hidden}93%{visibility:visible}96%{visibility:hidden}}`,
    );
  }
  return rules.length ? `@media (prefers-reduced-motion:no-preference){${rules.join('')}}` : '';
}

const paths = (layers: Layer[]) => layers.map((l) => `<path fill="${esc(l.fill)}" d="${layerPath(l)}"/>`).join('');

export interface SvgOptions {
  /** Output size multiplier (CSS px per sign pixel). */
  pixelSize?: number;
  /** Include the CSS animations (bob / blink…). */
  animate?: boolean;
  /** Prefix for ids and class names, so several SVGs can live on one page. */
  id?: string;
}

/** Standalone SVG document for the scene (what "Download SVG" saves). */
export function sceneToSvg(scene: Scene, { pixelSize = 1, animate = true, id = 'clawd' }: SvgOptions = {}): string {
  const { width: w, height: h, background: bg } = scene;
  const parts: string[] = [];
  const css = animate ? animationCss(scene, id) : '';
  if (css) parts.push(`<style>${css}</style>`);
  switch (bg.kind) {
    case 'color':
      parts.push(`<rect width="${w}" height="${h}" fill="${esc(bg.color)}"/>`);
      break;
    case 'gradient':
      parts.push(
        `<defs><linearGradient id="${id}-bg" gradientUnits="userSpaceOnUse" x1="${bg.x1}" y1="${bg.y1}" x2="${bg.x2}" y2="${bg.y2}">` +
          `<stop offset="0" stop-color="${esc(bg.from)}"/><stop offset="1" stop-color="${esc(bg.to)}"/></linearGradient></defs>`,
        `<rect width="${w}" height="${h}" fill="url(#${id}-bg)"/>`,
      );
      break;
    case 'pixels':
      parts.push(paths(bg.layers));
      break;
    case 'image':
      parts.push(
        `<image href="${esc(bg.src)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"` +
          (bg.pixelated ? ` image-rendering="optimizeSpeed" style="image-rendering:pixelated"` : '') +
          '/>',
      );
      if (bg.dim > 0) parts.push(`<rect width="${w}" height="${h}" fill="#000" fill-opacity="${bg.dim}"/>`);
      break;
  }
  parts.push(`<g class="${id}-fig">`, paths(scene.figure));
  if (scene.eyes.length) parts.push(`<g class="${id}-eyes">${paths(scene.eyes)}</g>`);
  if (scene.blinkEyes.length && animate) parts.push(`<g class="${id}-blink" visibility="hidden">${paths(scene.blinkEyes)}</g>`);
  parts.push('</g>');
  const label = esc(scene.label || 'Clawd sign');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * pixelSize}" height="${h * pixelSize}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="${label}"><title>${label}</title>${parts.join('')}</svg>`
  );
}

/** Rasterises the scene (first animation frame) into a canvas, `scale` device pixels per sign pixel. */
export async function sceneToCanvas(scene: Scene, scale = 8): Promise<HTMLCanvasElement> {
  const s = Math.max(1, Math.round(scale));
  const canvas = document.createElement('canvas');
  canvas.width = scene.width * s;
  canvas.height = scene.height * s;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  const W = canvas.width;
  const H = canvas.height;
  const bg = scene.background;
  switch (bg.kind) {
    case 'color':
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, W, H);
      break;
    case 'gradient': {
      const g = ctx.createLinearGradient(bg.x1 * s, bg.y1 * s, bg.x2 * s, bg.y2 * s);
      g.addColorStop(0, bg.from);
      g.addColorStop(1, bg.to);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      break;
    }
    case 'pixels':
      drawLayers(ctx, bg.layers, s);
      break;
    case 'image': {
      try {
        const img = await loadImage(bg.src);
        ctx.imageSmoothingEnabled = !bg.pixelated;
        if (bg.pixelated) ctx.drawImage(img, 0, 0, W, H);
        else {
          const r = coverRect(img.naturalWidth, img.naturalHeight, W, H);
          ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, W, H);
        }
      } catch {
        /* leave transparent */
      }
      if (bg.dim > 0) {
        ctx.fillStyle = `rgba(0,0,0,${bg.dim})`;
        ctx.fillRect(0, 0, W, H);
      }
      break;
    }
  }
  drawLayers(ctx, scene.figure, s);
  drawLayers(ctx, scene.eyes, s);
  return canvas;
}

function drawLayers(ctx: CanvasRenderingContext2D, layers: Layer[], s: number) {
  for (const l of layers) {
    ctx.fillStyle = l.fill;
    for (const [x, y, w, h] of l.rects) ctx.fillRect(x * s, y * s, w * s, h * s);
  }
}

export async function sceneToPngBlob(scene: Scene, scale = 8): Promise<Blob> {
  const canvas = await sceneToCanvas(scene, scale);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'));
}
