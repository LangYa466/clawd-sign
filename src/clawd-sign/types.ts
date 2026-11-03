export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Built-in pixel fonts. `system` pixelates whatever font the OS has; `custom` uses a user supplied family. */
export type FontId = 'fusion-12' | 'fusion-10' | 'fusion-8' | 'unifont' | 'system' | 'custom';

/** Glyph style for Han characters (the same codepoint is drawn differently per region). */
export type CjkRegion = 'auto' | 'zh_hans' | 'zh_hant' | 'ja' | 'ko';

export type TextAlign = 'left' | 'center' | 'right';
export type EyeStyle = 'square' | 'tall' | 'happy' | 'closed' | 'wink' | 'dizzy';
export type Animation = 'none' | 'bob' | 'shake' | 'jump';
export type Aspect = 'auto' | '1:1' | '4:3' | '3:4' | '16:9' | '9:16';
export type PatternKind = 'checker' | 'grid' | 'dots' | 'stripes';

export interface Palette {
  /** Scene background (used when background.type === 'theme'). */
  background: string;
  signFill: string;
  signBorder: string;
  text: string;
  body: string;
  eyes: string;
}

export type BackgroundSpec =
  | { type: 'theme' }
  | { type: 'transparent' }
  | { type: 'color'; color: string }
  | { type: 'gradient'; from: string; to: string; angle: number; steps: number }
  | { type: 'pattern'; kind: PatternKind; color1: string; color2: string; size: number }
  | { type: 'image'; src: string; pixelate: boolean; dim: number };

export interface SignOptions {
  /** Text on the sign. `\n` starts a new line. */
  text: string;
  font: FontId;
  /** CSS font-family used when `font === 'custom'`. */
  customFontFamily: string;
  /** Pixel height used for `system` / `custom` fonts (built-in pixel fonts use their native size). */
  customFontSize: number;
  cjkRegion: CjkRegion;
  /** Each font pixel becomes `fontScale × fontScale` sign pixels. */
  fontScale: number;
  /** Classic pixel-font bold: every ink pixel is smeared one pixel to the right. */
  bold: boolean;
  align: TextAlign;
  letterSpacing: number;
  lineSpacing: number;
  /** Keep emoji / colour glyphs in colour instead of painting them with the text colour. */
  colorEmoji: boolean;
  /** Alpha (0–255) above which an anti-aliased canvas pixel counts as ink. */
  threshold: number;

  paddingX: number;
  paddingY: number;
  borderWidth: number;
  cornerRadius: number;
  /** Minimum sign width in pixels (0 = just wide enough for the hands). */
  minWidth: number;

  showMascot: boolean;
  /** Mascot pixel size relative to the text pixels (1–4). */
  mascotScale: number;
  eyes: EyeStyle;
  blink: boolean;
  animation: Animation;

  /** Colour overrides. Anything left undefined follows the light / dark theme palette. */
  colors: Partial<Palette>;
  background: BackgroundSpec;
  /** Empty pixels around the figure. */
  margin: number;
  aspect: Aspect;
  /** CSS pixels per sign pixel when rendered on the page. */
  pixelSize: number;
}

export const DEFAULT_OPTIONS: SignOptions = {
  text: 'suspend',
  font: 'fusion-12',
  customFontFamily: '',
  customFontSize: 16,
  cjkRegion: 'auto',
  fontScale: 1,
  bold: true,
  align: 'center',
  letterSpacing: 0,
  lineSpacing: 2,
  colorEmoji: true,
  threshold: 110,

  paddingX: 3,
  paddingY: 3,
  borderWidth: 1,
  cornerRadius: 1,
  minWidth: 0,

  showMascot: true,
  mascotScale: 1,
  eyes: 'square',
  blink: true,
  animation: 'none',

  colors: {},
  background: { type: 'theme' },
  margin: 6,
  aspect: 'auto',
  pixelSize: 8,
};
