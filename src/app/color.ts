/** A slightly darker (or, for dark colours, lighter) variant — used for second pattern colours. */
export function shade(hex: string, amount = 14): string {
  const n = parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
  const d = lum > 128 ? -amount : amount + 4;
  return `#${rgb.map((v) => Math.max(0, Math.min(255, v + d)).toString(16).padStart(2, '0')).join('')}`;
}
