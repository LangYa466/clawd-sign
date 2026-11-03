import { forwardRef, useEffect, useId, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { layerPath, type Layer } from './grid';
import { resolveTheme } from './palette';
import { animationCss } from './render';
import { buildScene, type Scene } from './scene';
import { DEFAULT_OPTIONS, type ResolvedTheme, type SignOptions, type ThemeMode } from './types';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribeDark(cb: () => void) {
  const mq = window.matchMedia?.(DARK_QUERY);
  mq?.addEventListener('change', cb);
  return () => mq?.removeEventListener('change', cb);
}

/** Tracks the OS colour scheme. */
export function usePrefersDark(): boolean {
  return useSyncExternalStore(
    subscribeDark,
    () => !!window.matchMedia?.(DARK_QUERY).matches,
    () => false,
  );
}

export function useResolvedTheme(mode: ThemeMode): ResolvedTheme {
  return resolveTheme(mode, usePrefersDark());
}

/** Builds (asynchronously — fonts may need to download) the pixel scene for a set of options. */
export function useSignScene(options: SignOptions, theme: ResolvedTheme): Scene | null {
  const [scene, setScene] = useState<Scene | null>(null);
  const key = JSON.stringify(options) + theme;
  useEffect(() => {
    let alive = true;
    buildScene(options, theme)
      .then((s) => alive && setScene(s))
      .catch((err) => console.error('[clawd-sign]', err));
    return () => {
      alive = false;
    };
    // `key` captures every input.
  }, [key]);
  return scene;
}

export interface ClawdSignProps extends Partial<SignOptions> {
  /** Colour scheme for the default palette. Defaults to following the OS. */
  theme?: ThemeMode;
  /** Play the bob / blink animations (they also respect `prefers-reduced-motion`). */
  animate?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Called whenever a new scene has been built (handy for exporting). */
  onSceneChange?: (scene: Scene) => void;
}

function Paths({ layers }: { layers: Layer[] }) {
  return layers.map((l) => <path key={l.fill} fill={l.fill} d={layerPath(l)} />);
}

/**
 * A pixel-art mascot holding up a sign.
 *
 * ```tsx
 * <ClawdSign text="下班了" theme="system" pixelSize={6} />
 * ```
 */
export const ClawdSign = forwardRef<SVGSVGElement, ClawdSignProps>(function ClawdSign(
  { theme = 'system', animate = true, className, style, onSceneChange, ...rest },
  ref,
) {
  const resolved = useResolvedTheme(theme);
  const restKey = JSON.stringify(rest);
  const options = useMemo<SignOptions>(() => {
    const o: SignOptions = { ...DEFAULT_OPTIONS };
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) (o as unknown as Record<string, unknown>)[k] = v;
    return o;
  }, [restKey]);
  const scene = useSignScene(options, resolved);
  const rawId = useId();
  const id = `cs${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    if (scene) onSceneChange?.(scene);
  }, [scene, onSceneChange]);

  const css = useMemo(() => (scene && animate ? animationCss(scene, id) : ''), [scene, animate, id]);

  if (!scene) {
    return <svg ref={ref} className={className} style={{ display: 'block', ...style }} width={0} height={0} aria-busy="true" />;
  }

  const { width: w, height: h, background: bg } = scene;
  const px = Math.max(0.25, options.pixelSize);
  const label = scene.label || 'Clawd sign';
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${w} ${h}`}
      width={w * px}
      height={h * px}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      className={className}
      style={{ display: 'block', maxWidth: '100%', height: 'auto', ...style }}
    >
      <title>{label}</title>
      {css && <style>{css}</style>}
      {bg.kind === 'color' && <rect width={w} height={h} fill={bg.color} />}
      {bg.kind === 'gradient' && (
        <>
          <defs>
            <linearGradient id={`${id}-bg`} gradientUnits="userSpaceOnUse" x1={bg.x1} y1={bg.y1} x2={bg.x2} y2={bg.y2}>
              <stop offset="0" stopColor={bg.from} />
              <stop offset="1" stopColor={bg.to} />
            </linearGradient>
          </defs>
          <rect width={w} height={h} fill={`url(#${id}-bg)`} />
        </>
      )}
      {bg.kind === 'pixels' && <Paths layers={bg.layers} />}
      {bg.kind === 'image' && (
        <>
          <image
            href={bg.src}
            width={w}
            height={h}
            preserveAspectRatio="xMidYMid slice"
            imageRendering={bg.pixelated ? 'optimizeSpeed' : undefined}
            style={bg.pixelated ? { imageRendering: 'pixelated' } : undefined}
          />
          {bg.dim > 0 && <rect width={w} height={h} fill="#000" fillOpacity={bg.dim} />}
        </>
      )}
      <g className={`${id}-fig`}>
        <Paths layers={scene.figure} />
        {scene.eyes.length > 0 && (
          <g className={`${id}-eyes`}>
            <Paths layers={scene.eyes} />
          </g>
        )}
        {animate && scene.blinkEyes.length > 0 && (
          <g className={`${id}-blink`} visibility="hidden">
            <Paths layers={scene.blinkEyes} />
          </g>
        )}
      </g>
    </svg>
  );
});
