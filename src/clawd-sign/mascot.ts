import type { EyeStyle } from './types';

/** [x, y, width, height] in mascot space: the body's top-left pixel is (0, 0). */
export type Rect = [number, number, number, number];

const BODY_W = 16;

/** Mirror a left-side rect onto the right side of the body. */
const mirror = ([x, y, w, h]: Rect): Rect => [BODY_W - x - w, y, w, h];
const pair = (r: Rect): Rect[] => [r, mirror(r)];

/**
 *            ┌──┐                    ┌──┐   ← hands (drawn over the sign's bottom edge)
 *             ││                      ││    ← arms
 *           ──┘└──┌────────────────┐──┘└──  ← shoulders
 *                 │  ■■        ■■  │
 *                 │     body       │
 *                 └┬─┬─┬──────┬─┬─┬┘
 *                  legs ×4
 */
export const MASCOT_BODY: Rect[] = [
  [0, 0, BODY_W, 10], // body
  ...pair([0, 10, 2, 4]), // outer legs
  ...pair([4, 10, 2, 4]), // inner legs
  ...pair([-5, 3, 5, 3]), // shoulders
  ...pair([-5, 0, 2, 3]), // arms
];

export const MASCOT_HANDS: Rect[] = pair([-6, -3, 4, 3]);

/** Bounding box of the mascot (exclusive right / bottom). */
export const MASCOT_BOX = { left: -6, top: -3, right: BODY_W + 6, bottom: 14 };

/** The sign's bottom border sits on this row so the hands overlap it. */
export const SIGN_BOTTOM_ROW = MASCOT_BOX.top + 1;

/** Sign is centred on the body. */
export const MASCOT_CENTER_X = BODY_W / 2;

/** Minimum sign width so the sign sticks out a little past the hands. */
export const MIN_SIGN_WIDTH = MASCOT_BOX.right - MASCOT_BOX.left + 6;

type Pt = [number, number];
const px = (pts: Pt[]): Rect[] => pts.map(([x, y]) => [x, y, 1, 1]);
const both = (left: Pt[]): Rect[] => [...px(left), ...px(left).map(mirror)];

const EYE_SHAPES: Record<Exclude<EyeStyle, 'wink'>, Pt[]> = {
  square: [[2, 2], [3, 2], [2, 3], [3, 3]],
  tall: [[2, 1], [3, 1], [2, 2], [3, 2], [2, 3], [3, 3]],
  happy: [[1, 3], [2, 2], [3, 2], [4, 3]],
  closed: [[1, 3], [2, 3], [3, 3], [4, 3]],
  dizzy: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]],
};

export function eyePixels(style: EyeStyle): Rect[] {
  if (style === 'wink') return [...px(EYE_SHAPES.square), ...px(EYE_SHAPES.closed).map(mirror)];
  return both(EYE_SHAPES[style]);
}
