import type { Palette, ResolvedTheme, ThemeMode } from './types';

export const THEME_PALETTES: Record<ResolvedTheme, Palette> = {
  light: {
    background: '#f7f6f1',
    signFill: '#fcf4e8',
    signBorder: '#141413',
    text: '#141413',
    body: '#d97757',
    eyes: '#141413',
  },
  dark: {
    background: '#1c1b19',
    signFill: '#2a2825',
    signBorder: '#f0ebe1',
    text: '#f0ebe1',
    body: '#d97757',
    eyes: '#141413',
  },
};

export interface PalettePreset {
  id: string;
  name: { zh: string; en: string };
  colors: Partial<Palette>;
}

/** One-click colour schemes. An empty `colors` object means "follow the theme". */
export const PALETTE_PRESETS: PalettePreset[] = [
  { id: 'theme', name: { zh: '跟随主题', en: 'Theme' }, colors: {} },
  {
    id: 'classic',
    name: { zh: '经典', en: 'Classic' },
    colors: { ...THEME_PALETTES.light },
  },
  {
    id: 'midnight',
    name: { zh: '午夜', en: 'Midnight' },
    colors: { ...THEME_PALETTES.dark },
  },
  {
    id: 'matcha',
    name: { zh: '抹茶', en: 'Matcha' },
    colors: { background: '#e8efdc', signFill: '#fbfdf5', signBorder: '#2f4a22', text: '#2f4a22', body: '#7fae5b', eyes: '#1d2b15' },
  },
  {
    id: 'sakura',
    name: { zh: '樱花', en: 'Sakura' },
    colors: { background: '#fdeef3', signFill: '#fffafc', signBorder: '#7a2e4a', text: '#7a2e4a', body: '#f08fb0', eyes: '#3d1424' },
  },
  {
    id: 'ocean',
    name: { zh: '深海', en: 'Ocean' },
    colors: { background: '#0f2233', signFill: '#e9f6ff', signBorder: '#0b1a26', text: '#0b4f7c', body: '#3fa7d6', eyes: '#0b1a26' },
  },
  {
    id: 'gameboy',
    name: { zh: '掌机', en: 'Handheld' },
    colors: { background: '#9bbc0f', signFill: '#8bac0f', signBorder: '#0f380f', text: '#0f380f', body: '#306230', eyes: '#0f380f' },
  },
  {
    id: 'mono',
    name: { zh: '黑白', en: 'Mono' },
    colors: { background: '#ffffff', signFill: '#ffffff', signBorder: '#000000', text: '#000000', body: '#000000', eyes: '#ffffff' },
  },
  {
    id: 'neon',
    name: { zh: '霓虹', en: 'Neon' },
    colors: { background: '#120b1f', signFill: '#1d1033', signBorder: '#ff4fd8', text: '#5cf2ff', body: '#ff8a3d', eyes: '#120b1f' },
  },
];

export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(mode: ThemeMode, prefersDark = systemPrefersDark()): ResolvedTheme {
  if (mode === 'system') return prefersDark ? 'dark' : 'light';
  return mode;
}

export function resolvePalette(theme: ResolvedTheme, overrides: Partial<Palette> = {}): Palette {
  const base = THEME_PALETTES[theme];
  const out = { ...base };
  for (const key of Object.keys(base) as (keyof Palette)[]) {
    const v = overrides[key];
    if (v) out[key] = v;
  }
  return out;
}
