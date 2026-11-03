import { eyePixels, MASCOT_BODY, MASCOT_HANDS } from '../clawd-sign/mascot';

const rects = [...MASCOT_BODY, ...MASCOT_HANDS];
const d = rects.map(([x, y, w, h]) => `M${x + 6} ${y + 3}h${w}v${h}h${-w}z`).join('');
const eyes = eyePixels('square')
  .map(([x, y, w, h]) => `M${x + 6} ${y + 3}h${w}v${h}h${-w}z`)
  .join('');

/** The mascot on its own, arms up — used as the logo. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 28 17" width={size} height={(size * 17) / 28} shapeRendering="crispEdges" aria-hidden="true">
      <path d={d} fill="#d97757" />
      <path d={eyes} fill="#141413" />
    </svg>
  );
}
