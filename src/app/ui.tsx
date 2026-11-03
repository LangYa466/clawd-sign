import { useEffect, useId, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';

export function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="section" open={defaultOpen}>
      <summary>
        <span className="section-title">{title}</span>
        <Icon name="chevron" size={12} className="section-chevron" />
      </summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
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
    <Field label={label} hint={hint} htmlFor={id}>
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
