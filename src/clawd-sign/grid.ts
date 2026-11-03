/** A filled rectangle in pixel units: [x, y, width, height]. */
export type PixelRect = [number, number, number, number];

/** All pixels of one colour, merged into as few rectangles as possible. */
export interface Layer {
  fill: string;
  rects: PixelRect[];
}

/** A paletted pixel canvas. Later paints overwrite earlier ones. */
export class Grid {
  readonly cells: Uint16Array;
  private readonly colors: string[] = [''];
  private readonly lookup = new Map<string, number>();

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.cells = new Uint16Array(Math.max(0, width * height));
  }

  color(c: string): number {
    let i = this.lookup.get(c);
    if (i === undefined) {
      i = this.colors.length;
      this.colors.push(c);
      this.lookup.set(c, i);
    }
    return i;
  }

  set(x: number, y: number, ci: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.cells[y * this.width + x] = ci;
  }

  rect(x: number, y: number, w: number, h: number, ci: number) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, ci);
  }

  /** Horizontal runs per colour, merged vertically when a run repeats on the next row. */
  layers(): Layer[] {
    const out = new Map<number, PixelRect[]>();
    let open = new Map<string, PixelRect>();
    for (let y = 0; y < this.height; y++) {
      const next = new Map<string, PixelRect>();
      let x = 0;
      while (x < this.width) {
        const ci = this.cells[y * this.width + x];
        let end = x + 1;
        while (end < this.width && this.cells[y * this.width + end] === ci) end++;
        if (ci) {
          const key = `${ci}:${x}:${end}`;
          const prev = open.get(key);
          if (prev) {
            prev[3]++;
            next.set(key, prev);
          } else {
            const r: PixelRect = [x, y, end - x, 1];
            let list = out.get(ci);
            if (!list) out.set(ci, (list = []));
            list.push(r);
            next.set(key, r);
          }
        }
        x = end;
      }
      open = next;
    }
    return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([ci, rects]) => ({ fill: this.colors[ci], rects }));
  }
}

export function layerPath(layer: Layer): string {
  let d = '';
  for (const [x, y, w, h] of layer.rects) d += `M${x} ${y}h${w}v${h}h${-w}z`;
  return d;
}
