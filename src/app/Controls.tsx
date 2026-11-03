import { useId, useRef } from 'react';
import {
  PALETTE_PRESETS,
  type Aspect,
  type BackgroundSpec,
  type CjkRegion,
  type EyeStyle,
  type FontId,
  type Palette,
  type PatternKind,
  type SignOptions,
} from '../clawd-sign';
import { shade } from './color';
import { EXAMPLES, type Dict, type Key, type Lang } from './i18n';
import { Icon } from './icons';
import { ColorInput, Field, Section, Segmented, Select, Slider, Toggle } from './ui';

export type Update = (patch: Partial<SignOptions> | ((o: SignOptions) => Partial<SignOptions>)) => void;

interface Props {
  options: SignOptions;
  update: Update;
  palette: Palette;
  t: (k: Key) => string;
  lang: Lang;
  toast: (msg: string) => void;
  exportScale: number;
  setExportScale: (n: number) => void;
  embed: { iframe: string; react: string; url: string };
}

let uploadCounter = 0;

export function Controls({ options: o, update, palette, t, lang, toast, exportScale, setExportScale, embed }: Props) {
  const textId = useId();
  const fontInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  const colorProps = (key: keyof Palette, label: Key) => ({
    label: t(label),
    value: o.colors[key] ?? palette[key],
    inherited: o.colors[key] === undefined,
    onChange: (v: string) => update((cur) => ({ colors: { ...cur.colors, [key]: v } })),
    onReset: () =>
      update((cur) => {
        const next = { ...cur.colors };
        delete next[key];
        return { colors: next };
      }),
    resetLabel: t('action.resetColor'),
  });

  const setBg = (bg: BackgroundSpec) => update({ background: bg });
  const bg = o.background;

  const switchBg = (type: BackgroundSpec['type']) => {
    if (type === bg.type) return;
    switch (type) {
      case 'color':
        return setBg({ type, color: palette.background });
      case 'gradient':
        return setBg({ type, from: '#fde2c8', to: '#c9e4f6', angle: 135, steps: 8 });
      case 'pattern':
        return setBg({ type, kind: 'checker', color1: palette.background, color2: shade(palette.background), size: 4 });
      case 'image':
        return setBg({ type, src: '', pixelate: true, dim: 0 });
      default:
        return setBg({ type } as BackgroundSpec);
    }
  };

  async function onFontFile(file: File) {
    try {
      const family = `Clawd Upload ${++uploadCounter}`;
      const face = new FontFace(family, await file.arrayBuffer());
      await face.load();
      document.fonts.add(face);
      update({ font: 'custom', customFontFamily: family });
      toast(t('toast.fontLoaded'));
    } catch {
      toast(t('toast.fontFailed'));
    }
  }

  async function onImageFile(file: File) {
    try {
      const src = await readImage(file);
      setBg({ type: 'image', src, pixelate: bg.type === 'image' ? bg.pixelate : true, dim: bg.type === 'image' ? bg.dim : 0 });
    } catch {
      toast(t('toast.imageFailed'));
    }
  }

  const fontHint =
    o.font === 'unifont'
      ? t('font.hint.unifont')
      : o.font === 'system'
        ? t('font.hint.system')
        : o.font === 'custom'
          ? t('font.hint.custom')
          : t('font.hint.fusion');

  return (
    <div className="controls">
      <Section title={t('sec.text')}>
        <textarea
          id={textId}
          className="text-input"
          value={o.text}
          placeholder={t('text.placeholder')}
          rows={Math.min(6, Math.max(2, o.text.split('\n').length))}
          onChange={(e) => update({ text: e.target.value })}
          aria-label={t('sec.text')}
        />
        <div className="chips" aria-label={t('text.examples')}>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip" aria-pressed={o.text === ex} onClick={() => update({ text: ex })}>
              {ex.replace('\n', ' ⏎ ')}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t('sec.font')}>
        <Select<FontId>
          label={t('font.family')}
          value={o.font}
          onChange={(font) => update(font === 'fusion-8' ? { font, bold: false } : { font })}
          hint={fontHint}
          options={[
            { value: 'fusion-12', label: t('font.fusion12') },
            { value: 'fusion-10', label: t('font.fusion10') },
            { value: 'fusion-8', label: t('font.fusion8') },
            { value: 'unifont', label: t('font.unifont') },
            { value: 'system', label: t('font.system') },
            { value: 'custom', label: t('font.custom') },
          ]}
        />
        {o.font === 'custom' && (
          <div className="row">
            <button type="button" className="btn" onClick={() => fontInput.current?.click()}>
              <Icon name="upload" size={14} /> {t('font.upload')}
            </button>
            <input
              ref={fontInput}
              type="file"
              accept=".ttf,.otf,.woff,.woff2,font/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFontFile(f);
                e.target.value = '';
              }}
            />
            <input
              className="text-field"
              placeholder={t('font.localName')}
              aria-label={t('font.localName')}
              value={o.customFontFamily.startsWith('Clawd Upload') ? '' : o.customFontFamily}
              onChange={(e) => update({ customFontFamily: e.target.value })}
            />
          </div>
        )}
        {(o.font === 'system' || o.font === 'custom') && (
          <>
            <Slider label={t('font.size')} value={o.customFontSize} min={8} max={48} onChange={(customFontSize) => update({ customFontSize })} />
            <Slider label={t('font.threshold')} value={o.threshold} min={20} max={240} onChange={(threshold) => update({ threshold })} />
          </>
        )}
        {o.font.startsWith('fusion') && (
          <Field label={t('font.region')}>
            <Segmented<CjkRegion>
              label={t('font.region')}
              value={o.cjkRegion}
              onChange={(cjkRegion) => update({ cjkRegion })}
              options={(['auto', 'zh_hans', 'zh_hant', 'ja', 'ko'] as const).map((v) => ({ value: v, label: t(`region.${v}` as Key) }))}
            />
          </Field>
        )}
        <Slider label={t('font.scale')} value={o.fontScale} min={1} max={4} onChange={(fontScale) => update({ fontScale })} format={(v) => `×${v}`} />
        <Field label={t('font.align')}>
          <Segmented
            label={t('font.align')}
            value={o.align}
            onChange={(align) => update({ align })}
            options={(['left', 'center', 'right'] as const).map((v) => ({ value: v, label: t(`align.${v}` as Key) }))}
          />
        </Field>
        <Slider label={t('font.letterSpacing')} value={o.letterSpacing} min={-2} max={8} onChange={(letterSpacing) => update({ letterSpacing })} />
        <Slider label={t('font.lineSpacing')} value={o.lineSpacing} min={-4} max={16} onChange={(lineSpacing) => update({ lineSpacing })} />
        <div className="toggles">
          <Toggle label={t('font.bold')} checked={o.bold} onChange={(bold) => update({ bold })} />
          <Toggle label={t('font.colorEmoji')} checked={o.colorEmoji} onChange={(colorEmoji) => update({ colorEmoji })} />
        </div>
      </Section>

      <Section title={t('sec.palette')}>
        <div className="presets">
          {PALETTE_PRESETS.map((p) => {
            const c = { ...palette, ...p.colors };
            const active = p.id === 'theme' ? Object.keys(o.colors).length === 0 : sameColors(o.colors, p.colors);
            return (
              <button
                key={p.id}
                type="button"
                className="preset"
                aria-pressed={active}
                onClick={() => update((cur) => ({ colors: { ...p.colors }, background: recolorBackground(cur.background, c.background) }))}
              >
                <span className="preset-swatch" style={{ background: c.background }}>
                  <span style={{ background: c.signFill, borderColor: c.signBorder }} />
                  <i style={{ background: c.body }} />
                </span>
                <span className="preset-name">{p.name[lang]}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title={t('sec.sign')}>
        <div className="grid-2">
          <ColorInput {...colorProps('signFill', 'sign.fill')} />
          <ColorInput {...colorProps('signBorder', 'sign.border')} />
          <ColorInput {...colorProps('text', 'sign.text')} />
        </div>
        <Slider label={t('sign.borderWidth')} value={o.borderWidth} min={0} max={4} onChange={(borderWidth) => update({ borderWidth })} />
        <Slider label={t('sign.radius')} value={o.cornerRadius} min={0} max={8} onChange={(cornerRadius) => update({ cornerRadius })} />
        <Slider label={t('sign.paddingX')} value={o.paddingX} min={0} max={16} onChange={(paddingX) => update({ paddingX })} />
        <Slider label={t('sign.paddingY')} value={o.paddingY} min={0} max={16} onChange={(paddingY) => update({ paddingY })} />
        <Slider label={t('sign.minWidth')} value={o.minWidth} min={0} max={200} onChange={(minWidth) => update({ minWidth })} />
      </Section>

      <Section title={t('sec.mascot')}>
        <div className="toggles">
          <Toggle label={t('mascot.show')} checked={o.showMascot} onChange={(showMascot) => update({ showMascot })} />
          <Toggle label={t('mascot.blink')} checked={o.blink} onChange={(blink) => update({ blink })} />
        </div>
        {o.showMascot && (
          <>
            <div className="grid-2">
              <ColorInput {...colorProps('body', 'mascot.body')} />
              <ColorInput {...colorProps('eyes', 'mascot.eyes')} />
            </div>
            <Field label={t('mascot.eyeStyle')}>
              <Segmented<EyeStyle>
                label={t('mascot.eyeStyle')}
                value={o.eyes}
                columns={3}
                onChange={(eyes) => update({ eyes })}
                options={(['square', 'tall', 'happy', 'closed', 'wink', 'dizzy'] as const).map((v) => ({ value: v, label: t(`eye.${v}` as Key) }))}
              />
            </Field>
            <Field label={t('mascot.animation')}>
              <Segmented
                label={t('mascot.animation')}
                value={o.animation}
                onChange={(animation) => update({ animation })}
                options={(['none', 'bob', 'jump', 'shake'] as const).map((v) => ({ value: v, label: t(`anim.${v}` as Key) }))}
              />
            </Field>
            <Slider label={t('mascot.scale')} value={o.mascotScale} min={1} max={4} onChange={(mascotScale) => update({ mascotScale })} format={(v) => `×${v}`} />
          </>
        )}
      </Section>

      <Section title={t('sec.background')}>
        <Segmented<BackgroundSpec['type']>
          label={t('bg.type')}
          value={bg.type}
          columns={3}
          onChange={switchBg}
          options={(['theme', 'transparent', 'color', 'gradient', 'pattern', 'image'] as const).map((v) => ({ value: v, label: t(`bg.${v}` as Key) }))}
        />
        {bg.type === 'theme' && <ColorInput {...colorProps('background', 'bg.themeColor')} />}
        {bg.type === 'color' && <ColorInput label={t('bg.color')} value={bg.color} onChange={(color) => setBg({ ...bg, color })} />}
        {bg.type === 'gradient' && (
          <>
            <div className="grid-2">
              <ColorInput label={t('bg.from')} value={bg.from} onChange={(from) => setBg({ ...bg, from })} />
              <ColorInput label={t('bg.to')} value={bg.to} onChange={(to) => setBg({ ...bg, to })} />
            </div>
            <Slider label={t('bg.angle')} value={bg.angle} min={0} max={360} step={15} onChange={(angle) => setBg({ ...bg, angle })} format={(v) => `${v}°`} />
            <Slider label={t('bg.steps')} hint={t('bg.steps.hint')} value={bg.steps} min={0} max={24} onChange={(steps) => setBg({ ...bg, steps })} />
          </>
        )}
        {bg.type === 'pattern' && (
          <>
            <Field label={t('bg.kind')}>
              <Segmented<PatternKind>
                label={t('bg.kind')}
                value={bg.kind}
                onChange={(kind) => setBg({ ...bg, kind })}
                options={(['checker', 'grid', 'dots', 'stripes'] as const).map((v) => ({ value: v, label: t(`pattern.${v}` as Key) }))}
              />
            </Field>
            <div className="grid-2">
              <ColorInput label={t('bg.color1')} value={bg.color1} onChange={(color1) => setBg({ ...bg, color1 })} />
              <ColorInput label={t('bg.color2')} value={bg.color2} onChange={(color2) => setBg({ ...bg, color2 })} />
            </div>
            <Slider label={t('bg.size')} value={bg.size} min={2} max={16} onChange={(size) => setBg({ ...bg, size })} />
          </>
        )}
        {bg.type === 'image' && (
          <>
            <div className="row">
              <button type="button" className="btn" onClick={() => imageInput.current?.click()}>
                <Icon name="upload" size={14} /> {t('bg.upload')}
              </button>
              {bg.src ? <img className="thumb" src={bg.src} alt="" /> : <span className="muted">{t('bg.noImage')}</span>}
              <input
                ref={imageInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImageFile(f);
                  e.target.value = '';
                }}
              />
            </div>
            <div className="toggles">
              <Toggle label={t('bg.pixelate')} checked={bg.pixelate} onChange={(pixelate) => setBg({ ...bg, pixelate })} />
            </div>
            <Slider label={t('bg.dim')} value={Math.round(bg.dim * 100)} min={0} max={80} step={5} onChange={(v) => setBg({ ...bg, dim: v / 100 })} format={(v) => `${v}%`} />
          </>
        )}
      </Section>

      <Section title={t('sec.canvas')}>
        <Field label={t('canvas.aspect')}>
          <Segmented<Aspect>
            label={t('canvas.aspect')}
            value={o.aspect}
            columns={3}
            onChange={(aspect) => update({ aspect })}
            options={(['auto', '1:1', '4:3', '3:4', '16:9', '9:16'] as const).map((v) => ({ value: v, label: v === 'auto' ? t('aspect.auto') : v }))}
          />
        </Field>
        <Slider label={t('canvas.margin')} value={o.margin} min={0} max={40} onChange={(margin) => update({ margin })} />
        <Slider label={t('canvas.exportScale')} value={exportScale} min={1} max={32} onChange={setExportScale} format={(v) => `×${v}`} />
      </Section>

      <Section title={t('sec.embed')} defaultOpen={false}>
        <CodeBlock label={t('embed.iframe')} code={embed.iframe} t={t} toast={toast} />
        <CodeBlock label={t('embed.react')} code={embed.react} t={t} toast={toast} />
        <a className="link" href={embed.url} target="_blank" rel="noreferrer">
          {t('embed.open')} ↗
        </a>
      </Section>
    </div>
  );
}

function CodeBlock({ label, code, t, toast }: { label: string; code: string; t: (k: keyof Dict) => string; toast: (m: string) => void }) {
  return (
    <div className="code">
      <div className="code-head">
        <span>{label}</span>
        <button
          type="button"
          className="btn btn-small"
          onClick={() =>
            navigator.clipboard.writeText(code).then(
              () => toast(t('toast.copiedCode')),
              () => toast(t('toast.copyFailed')),
            )
          }
        >
          <Icon name="copy" size={12} /> {t('action.copyCode')}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Keeps a colour / pattern / gradient background in tune with a newly picked palette. */
function recolorBackground(bg: BackgroundSpec, base: string): BackgroundSpec {
  switch (bg.type) {
    case 'color':
      return { ...bg, color: base };
    case 'pattern':
      return { ...bg, color1: base, color2: shade(base) };
    case 'gradient':
      return { ...bg, from: base, to: shade(base, 40) };
    default:
      return bg;
  }
}

function sameColors(a: Partial<Palette>, b: Partial<Palette>) {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k as keyof Palette] === b[k as keyof Palette]);
}

/** Reads an uploaded image as a data URL, shrinking very large photos first. */
async function readImage(file: File): Promise<string> {
  const MAX = 1600;
  const asDataUrl = () =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  if (file.size < 1_500_000 || typeof createImageBitmap !== 'function') return asDataUrl();
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9);
}
