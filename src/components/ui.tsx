'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowLeftRight, Inbox, Info, Search, X, type LucideIcon } from 'lucide-react';
import { cloneElement, useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactElement, type ReactNode, type FormEvent } from 'react';
import type { Tone } from '@/lib/labels';
import { metricNumber, percent } from '@/lib/format';

export function Button({ children, variant = 'soft', icon: Icon, className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'ghost' | 'danger'; icon?: LucideIcon }) {
  return <button type={type} className={`button button-${variant} ${className}`} {...props}>{Icon && <Icon aria-hidden="true" />}{children}</button>;
}
export function IconButton({ label, icon: Icon, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: LucideIcon }) {
  return <Button {...props} className={`icon-button ${props.className ?? ''}`} icon={Icon} aria-label={label} title={label} />;
}
export function LinkButton({ href, children, icon: Icon }: { href: string; children: ReactNode; icon?: LucideIcon }) {
  return <Link className="button button-soft" href={href}>{Icon && <Icon aria-hidden="true" />}{children}</Link>;
}
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link className="text-link" href={href}>{children}<ArrowLeft size={13} aria-hidden="true" /></Link>;
}
export function Art({ name, size = 56, className = '' }: { name: string; size?: number; className?: string }) {
  return <Image className={`icon-art ${className}`} src={`/icons/${name}.png`} width={size} height={size} alt="" />;
}
export function Pill({ children, tone = 'violet', dot = false }: { children: ReactNode; tone?: Tone; dot?: boolean }) {
  return <span className={`pill tone-${tone}`}>{dot && <i aria-hidden="true" />}{children}</span>;
}
export function Heading({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children?: ReactNode }) {
  return <header className="page-heading"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{children && <div className="heading-actions">{children}</div>}</header>;
}
export function Panel({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{(title || action) && <div className="panel-heading">{title && <h2>{title}</h2>}{action}</div>}{children}</section>;
}
export function SectionBar({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="section-bar"><h2>{title}</h2>{children && <div className="control-group">{children}</div>}</div>;
}

export type Metric = { label: string; value: number | string; note: string; icon: LucideIcon; tone?: Tone };
export function Metrics({ entries }: { entries: Metric[] }) {
  return <div className={`metric-grid metric-grid-${entries.length}`}>{entries.map(({ label, value, note, icon: Icon, tone }) => <div className="panel metric" key={label}>
    <div className="metric-head"><span>{label}</span><Glyph icon={Icon} /></div>
    <div className="metric-value" dir="auto">{typeof value === 'number' ? <Numeral value={value} /> : value}</div>
    <div className={`metric-note ${tone ? 'ink-' + tone : ''}`}>{note}</div>
  </div>)}</div>;
}
export function Numeral({ value }: { value: number }) {
  return <><span className="fa-numeral">{metricNumber(value)}</span><span className="latin-numeral">{String(value).padStart(2, '0')}</span></>;
}
export function Glyph({ icon: Icon, className = '' }: { icon: LucideIcon; className?: string }) {
  return <span className={`glyph ${className}`}><Icon aria-hidden="true" /></span>;
}
export function Progress({ value, label = 'پیشرفت' }: { value: number; label?: string }) {
  return <div className="progress-block"><div><small>{label}</small><bdi>{percent(value)}</bdi></div><div className="progress-track" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${value}%` }} /></div></div>;
}
export function Callout({ children }: { children: ReactNode }) {
  return <div className="callout"><Info size={16} aria-hidden="true" /><div>{children}</div></div>;
}
export function Empty({ title = 'موردی پیدا نشد', detail, action }: { title?: string; detail?: string; action?: ReactNode }) {
  return <div className="empty"><Glyph icon={Inbox} /><strong>{title}</strong>{detail && <span>{detail}</span>}{action}</div>;
}
export function Row({ icon: Icon, title, meta, end, href, onClick }: { icon?: LucideIcon; title: ReactNode; meta?: ReactNode; end?: ReactNode; href?: string; onClick?: () => void }) {
  const content = <>{Icon && <Glyph icon={Icon} />}<span className="row-copy"><strong>{title}</strong>{meta && <small>{meta}</small>}</span>{end && <span className="row-end">{end}</span>}</>;
  if (href) return <Link className="item-row item-interactive" href={href}>{content}</Link>;
  if (onClick) return <button type="button" className="item-row item-interactive" onClick={onClick}>{content}</button>;
  return <div className="item-row">{content}</div>;
}
export function SearchField({ label = 'جست‌وجو', value, onChange, autoFocus = false }: { label?: string; value: string; onChange: (value: string) => void; autoFocus?: boolean }) {
  return <label className="search-field"><Search size={16} aria-hidden="true" /><input autoFocus={autoFocus} type="search" aria-label={label} placeholder={label} value={value} onChange={e => onChange(e.target.value)} dir="auto" /></label>;
}
export type Choice = { value: string; label: string };
export function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: ReadonlyArray<Choice> }) {
  return <select className="filter" aria-label={label} value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}
export function Segments<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: ReadonlyArray<{ value: T; label: string; icon?: LucideIcon }> }) {
  return <div className="segments" role="group" aria-label={label}>{options.map(({ value: id, label: text, icon }) => <Button variant={value === id ? 'primary' : 'soft'} aria-pressed={value === id} icon={icon} key={id} onClick={() => onChange(id)}>{text}</Button>)}</div>;
}
export function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  return <div className="field"><label htmlFor={id}>{label}</label>{cloneElement(children, { id })}</div>;
}
export function Switch({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange?: (checked: boolean) => void; disabled?: boolean }) {
  return <button className="switch" type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange?.(!checked)}><span /></button>;
}

interface Column<T> { label: string; render: (row: T) => ReactNode; extra?: boolean }
export function Table<T extends { id: string }>({ columns, rows, label, compact = false }: { columns: Column<T>[]; rows: T[]; label: string; compact?: boolean }) {
  if (!rows.length) return <Empty detail="فیلترها را تغییر دهید یا مورد جدیدی ثبت کنید." />;
  return <>{!compact && <p className="table-scroll-hint"><ArrowLeftRight size={13} aria-hidden="true" />جدول را افقی پیمایش کنید</p>}
    <div className={`table-wrap ${compact ? 'table-compact' : ''}`} tabIndex={0} role="region" aria-label={label}><table aria-label={label}><thead><tr>
    {columns.map(column => <th key={column.label} className={column.extra ? 'table-extra' : undefined} scope="col">{column.label}</th>)}
  </tr></thead><tbody>{rows.map(row => <tr key={row.id}>{columns.map(column => <td key={column.label} className={column.extra ? 'table-extra' : undefined}>{column.render(row)}</td>)}</tr>)}</tbody></table></div></>;
}

export function Modal({ title, onClose, children, align = 'center' }: { title: string; onClose: () => void; children: ReactNode; align?: 'center' | 'drawer' }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const originalFocus = document.activeElement;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('input:not([type=checkbox]):not([disabled]), textarea:not([disabled])')?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previous;
      if (originalFocus instanceof HTMLElement && originalFocus.isConnected) originalFocus.focus();
    };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className={`modal modal-${align}`}
    onKeyDown={event => {
      if (event.key !== 'Escape' || event.nativeEvent.isComposing) return;
      event.preventDefault();
      onClose();
    }}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.currentTarget === event.target) onClose(); }}>
    <div className="modal-inner">
      <div className="modal-heading"><h2 id={titleId}>{title}</h2><IconButton icon={X} label="بستن" onClick={onClose} /></div>
      {children}
    </div>
  </dialog>;
}
export function FormActions({ onClose, submit = 'ذخیره', saving = false }: { onClose: () => void; submit?: string; saving?: boolean }) {
  return <div className="form-actions"><Button type="submit" variant="primary" disabled={saving}>{submit}</Button><Button onClick={onClose}>انصراف</Button></div>;
}
export const formValues = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  const values = new FormData(event.currentTarget);
  return (key: string) => String(values.get(key) ?? '').trim();
};
export const visibleLink = (href: string, title: ReactNode) => <Link className="cell-link" href={href}>{title}</Link>;
