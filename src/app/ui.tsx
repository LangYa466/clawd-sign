import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { Icon, type IconName } from './icons';

/** True while the media query matches (re-renders on change). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * A horizontally scrollable row that shows it can be swiped: the edge with hidden content
 * fades out and gets a small arrow button. Arrows disappear once that end is reached.
 */
export function ScrollRow({
  className,
  children,
  keepInView,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  className: string;
  /** id of a child to scroll into view whenever it changes (e.g. the selected tab). */
  keepInView?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = () => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft < el.scrollWidth - el.clientWidth - 2;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  };

  // Content can change size without the row resizing (language switch…), so re-measure every render.
  useLayoutEffect(measure);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const row = ref.current;
    const item = keepInView ? document.getElementById(keepInView) : null;
    if (!row || !item || row.scrollWidth <= row.clientWidth) return;
    const r = row.getBoundingClientRect();
    const i = item.getBoundingClientRect();
    const pad = 36; // leave room for the arrow
    if (i.left < r.left + pad) row.scrollBy({ left: i.left - r.left - pad, behavior: 'smooth' });
    else if (i.right > r.right - pad) row.scrollBy({ left: i.right - r.right + pad, behavior: 'smooth' });
  }, [keepInView]);

  const page = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: 'smooth' });

  return (
    <div className={`scroll-row${edges.left ? ' more-left' : ''}${edges.right ? ' more-right' : ''}`}>
      <div ref={ref} className={className} {...rest}>
        {children}
      </div>
      {edges.left && (
        <button type="button" className="scroll-hint scroll-hint-left" tabIndex={-1} aria-hidden="true" onClick={() => page(-1)}>
          <Icon name="chevron" size={12} />
        </button>
      )}
      {edges.right && (
        <button type="button" className="scroll-hint scroll-hint-right" tabIndex={-1} aria-hidden="true" onClick={() => page(1)}>
          <Icon name="chevron" size={12} />
        </button>
      )}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2 className="section-head">
        <span className="section-title">{title}</span>
      </h2>
      <div className="section-body">{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={className ? `field ${className}` : 'field'}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="field-control">{children}</div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  hint,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  hint?: ReactNode;
  format?: (v: number) => string;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id} className="field-slider">
      <div className="slider">
        <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <output htmlFor={id}>{format ? format(value) : value}</output>
      </div>
    </Field>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  className,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} className={`toggle${className ? ` ${className}` : ''}`} onClick={() => onChange(!checked)}>
      <span className="toggle-label">{label}</span>
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
    </button>
  );
}

export interface SegOption<T extends string | number> {
  value: T;
  label: ReactNode;
  icon?: IconName;
  title?: string;
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  columns,
}: {
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
  label: string;
  columns?: number;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label} style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          className="seg"
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={14} />}
          {o.label !== '' && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

const HEX = /^#?[0-9a-f]{6}$/i;

export function ColorInput({
  label,
  value,
  onChange,
  inherited,
  onReset,
  resetLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** True while the colour follows the theme (shows the reset as inactive). */
  inherited?: boolean;
  onReset?: () => void;
  resetLabel?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <Field label={label} htmlFor={id}>
      <div className="color-input">
        <span className="swatch" style={{ background: value }}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        </span>
        <input
          id={id}
          className="hex"
          value={draft}
          spellCheck={false}
          maxLength={7}
          onChange={(e) => {
            setDraft(e.target.value);
            if (HEX.test(e.target.value)) onChange(`#${e.target.value.replace('#', '').toLowerCase()}`);
          }}
          onBlur={() => setDraft(value)}
        />
        {onReset && (
          <button type="button" className="icon-btn" onClick={onReset} disabled={inherited} title={resetLabel} aria-label={resetLabel}>
            <Icon name="reset" size={14} />
          </button>
        )}
      </div>
    </Field>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <div className="select">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chevron" size={12} />
      </div>
    </Field>
  );
}
