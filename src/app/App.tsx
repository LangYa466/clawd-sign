import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClawdSign,
  DEFAULT_OPTIONS,
  PALETTE_PRESETS,
  resolvePalette,
  sceneToPngBlob,
  sceneToSvg,
  useResolvedTheme,
  type BackgroundSpec,
  type Scene,
  type SignOptions,
  type ThemeMode,
} from '../clawd-sign';
import { shade } from './color';
import { Controls, type Update } from './Controls';
import { DICTS, detectLang, type Key, type Lang } from './i18n';
import { Icon } from './icons';
import { Logo } from './Logo';
import { decodeHash, encodeHash, loadPrefs, loadSaved, reactSnippet, save, savePrefs, shareableOptions } from './state';
import { Segmented } from './ui';

const REPO_URL = 'https://github.com/langya466/clawd-sign';

function initialState() {
  const shared = decodeHash(location.hash);
  if (shared) history.replaceState(null, '', location.pathname + location.search); // keep the URL clean afterwards
  let options = shared?.options ?? loadSaved() ?? DEFAULT_OPTIONS;
  // Uploaded fonts don't survive a reload.
  if (options.font === 'custom' && options.customFontFamily.startsWith('Clawd Upload')) options = { ...options, customFontFamily: '' };
  return { options, theme: shared?.theme };
}

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function App() {
  const [init] = useState(initialState);
  const [prefs] = useState(loadPrefs);
  const [options, setOptions] = useState<SignOptions>(init.options);
  const [theme, setTheme] = useState<ThemeMode>(init.theme ?? prefs.theme ?? 'system');
  const [lang, setLang] = useState<Lang>(prefs.lang ?? detectLang());
  const [exportScale, setExportScale] = useState(prefs.exportScale ?? 10);
  const [scene, setScene] = useState<Scene | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; id: number } | null>(null);
  const resolved = useResolvedTheme(theme);
  const palette = useMemo(() => resolvePalette(resolved), [resolved]);
  const dict = DICTS[lang];
  const t = useCallback((k: Key) => dict[k], [dict]);

  const update: Update = useCallback(
    (patch) => setOptions((o) => ({ ...o, ...(typeof patch === 'function' ? patch(o) : patch) })),
    [],
  );

  const toast = useCallback((text: string) => setToastMsg({ text, id: Date.now() }), []);
  useEffect(() => {
    if (!toastMsg) return;
    const id = setTimeout(() => setToastMsg(null), 2400);
    return () => clearTimeout(id);
  }, [toastMsg]);

  // Theme → <html data-theme> (CSS falls back to prefers-color-scheme when unset).
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = `${dict.title} · ${lang === 'zh' ? '像素举牌生成器' : 'pixel sign maker'}`;
  }, [lang, dict]);

  useEffect(() => {
    const id = setTimeout(() => save(options), 250);
    return () => clearTimeout(id);
  }, [options]);

  useEffect(() => savePrefs({ theme, lang, exportScale }), [theme, lang, exportScale]);

  const slug = () =>
    options.text
      .trim()
      .slice(0, 24)
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'sign';

  const shareUrl = (embed = false) =>
    `${location.origin}${location.pathname}${embed ? '?embed=1' : ''}#${encodeHash(options, theme)}`;

  async function downloadPng() {
    if (!scene) return;
    download(await sceneToPngBlob(scene, exportScale), `clawd-sign-${slug()}.png`);
  }

  function downloadSvg() {
    if (!scene) return;
    const svg = sceneToSvg(scene, { pixelSize: exportScale });
    download(new Blob([svg], { type: 'image/svg+xml' }), `clawd-sign-${slug()}.svg`);
  }

  async function copyImage() {
    if (!scene) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': sceneToPngBlob(scene, exportScale) })]);
      toast(t('toast.copiedImage'));
    } catch {
      toast(t('toast.copyFailed'));
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl());
      toast(shareableOptions(options).dropped ? `${t('toast.copiedLink')} · ${t('toast.shareNote')}` : t('toast.copiedLink'));
    } catch {
      toast(t('toast.copyFailed'));
    }
  }

  function shuffle() {
    const preset = pick(PALETTE_PRESETS.filter((p) => p.id !== 'theme'));
    const c = preset.colors as Required<typeof preset.colors>;
    const bgs: BackgroundSpec[] = [
      { type: 'color', color: c.background },
      { type: 'pattern', kind: pick(['checker', 'grid', 'dots', 'stripes'] as const), color1: c.background, color2: shade(c.background), size: pick([2, 3, 4, 6]) },
      { type: 'gradient', from: c.background, to: shade(c.background, 40), angle: pick([0, 45, 90, 135, 180]), steps: pick([0, 6, 8, 12]) },
    ];
    update({
      colors: { ...preset.colors },
      background: pick(bgs),
      eyes: pick(['square', 'tall', 'happy', 'wink', 'dizzy'] as const),
      animation: pick(['none', 'bob', 'jump', 'shake'] as const),
      cornerRadius: pick([0, 1, 2, 3]),
      borderWidth: pick([1, 1, 2]),
    });
  }

  function reset() {
    setOptions({ ...DEFAULT_OPTIONS, text: options.text });
    toast(t('toast.reset'));
  }

  const embed = useMemo(() => {
    const url = shareUrl(true);
    const w = scene ? scene.width * options.pixelSize : 0;
    const h = scene ? scene.height * options.pixelSize : 0;
    const title = options.text.replace(/"/g, '&quot;').replace(/\n/g, ' ');
    return {
      url,
      iframe: `<iframe src="${url}" width="${w}" height="${h}" style="border:0;background:transparent" title="${title}" loading="lazy"></iframe>`,
      react: reactSnippet(options, theme),
    };
  }, [options, theme, scene]);

  const transparent = options.background.type === 'transparent';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo size={44} />
          <div>
            <h1>{t('title')}</h1>
            <p>{t('tagline')}</p>
          </div>
        </div>
        <div className="top-actions">
          <Segmented<ThemeMode>
            label={t('theme.label')}
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: '', icon: 'sun', title: t('theme.light') },
              { value: 'dark', label: '', icon: 'moon', title: t('theme.dark') },
              { value: 'system', label: '', icon: 'system', title: t('theme.system') },
            ]}
          />
          <button type="button" className="btn btn-ghost" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
            <Icon name="globe" size={14} /> {t('lang.switch')}
          </button>
          <a className="btn btn-ghost" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub">
            <Icon name="code" size={14} /> GitHub
          </a>
        </div>
      </header>

      <main className="layout">
        <section className="preview" aria-label="Preview">
          <div className={`stage${transparent ? ' stage-checker' : ''}`}>
            <ClawdSign {...options} theme={theme} onSceneChange={setScene} className="stage-sign" />
          </div>
          <div className="preview-bar">
            <label className="zoom">
              <span>{t('canvas.zoom')}</span>
              <input type="range" min={2} max={20} value={options.pixelSize} onChange={(e) => update({ pixelSize: Number(e.target.value) })} />
              <output>×{options.pixelSize}</output>
            </label>
            {scene && (
              <span className="dims">
                {t('canvas.size')} {scene.width}×{scene.height} → PNG {scene.width * exportScale}×{scene.height * exportScale}
              </span>
            )}
          </div>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={downloadPng} disabled={!scene}>
              <Icon name="download" size={14} /> {t('action.png')}
            </button>
            <button type="button" className="btn" onClick={downloadSvg} disabled={!scene}>
              <Icon name="download" size={14} /> {t('action.svg')}
            </button>
            <button type="button" className="btn" onClick={copyImage} disabled={!scene}>
              <Icon name="copy" size={14} /> {t('action.copy')}
            </button>
            <button type="button" className="btn" onClick={copyLink}>
              <Icon name="link" size={14} /> {t('action.link')}
            </button>
            <span className="actions-spacer" />
            <button type="button" className="btn btn-ghost" onClick={shuffle}>
              <Icon name="dice" size={14} /> {t('action.random')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={reset}>
              <Icon name="reset" size={14} /> {t('action.reset')}
            </button>
          </div>
        </section>

        <aside className="panel">
          <Controls
            options={options}
            update={update}
            palette={palette}
            t={t}
            lang={lang}
            toast={toast}
            exportScale={exportScale}
            setExportScale={setExportScale}
            embed={embed}
          />
        </aside>
      </main>

      <footer className="footer">
        <span>{t('footer.made')}</span>
        <span>{t('footer.fonts')}</span>
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          MIT · GitHub
        </a>
      </footer>

      <div className="toast-region" role="status" aria-live="polite">
        {toastMsg && (
          <div className="toast" key={toastMsg.id}>
            {toastMsg.text}
          </div>
        )}
      </div>
    </div>
  );
}
