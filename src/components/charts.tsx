'use client';

import { useId } from 'react';
import { number, percent } from '@/lib/format';

export function Trend({ values, label, start, end }: { values: readonly number[]; label: string; start?: string; end?: string }) {
  const gradient = useId();
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const points = values.map((value, index) => [
    index * 600 / Math.max(values.length - 1, 1),
    143 - (value - low) / span * 124,
  ]);
  const first = points[0];
  if (!first) return null;
  const path = points.slice(1).reduce((line, point, index) => {
    const previous = points[index];
    const mid = (previous[0] + point[0]) / 2;
    return `${line} C ${mid} ${previous[1]} ${mid} ${point[1]} ${point[0]} ${point[1]}`;
  }, `M ${first[0]} ${first[1]}`);
  return <figure className="trend" dir="ltr">
    <svg viewBox="0 0 600 163" preserveAspectRatio="none" role="img" aria-label={label}>
      <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="var(--violet)" stopOpacity=".34" /><stop offset="100%" stopColor="var(--violet)" stopOpacity="0" />
      </linearGradient></defs>
      {[30, 62, 94, 126, 162].map(y => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="var(--border)" strokeWidth=".65" />)}
      <path d={`${path} L 600 163 L 0 163 Z`} fill={`url(#${gradient})`} />
      <path d={path} fill="none" stroke="var(--violet-light)" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
    </svg>
    {(start || end) && <figcaption><span>{start}</span><span>{end}</span></figcaption>}
  </figure>;
}

export function Bars({ entries, label }: { entries: { label: string; value: number }[]; label: string }) {
  const max = Math.max(...entries.map(entry => entry.value), 1);
  return <figure className="bars" aria-label={label} dir="ltr">{entries.map(entry => <div className="bar-item" key={entry.label} aria-label={`${entry.label}، ${number(entry.value)}`}>
    <div className="bar-slot"><span style={{ height: `${entry.value / max * 100}%` }} title={number(entry.value)} /></div><figcaption dir="rtl">{entry.label}</figcaption>
  </div>)}</figure>;
}

export function Donut({ entries, display }: { entries: { label: string; value: number }[]; display: string }) {
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  const colors = ['var(--violet)', 'var(--success)', 'var(--warning)', 'var(--violet-light)'];
  const slices = entries.map((entry, index) => {
    const before = entries.slice(0,index).reduce((sum, previous) => sum + previous.value,0);
    const start = total ? before / total * 100 : 0;
    const end = total ? (before + entry.value) / total * 100 : 0;
    return { ...entry, color: colors[index % colors.length], start, end };
  });
  return <div className="donut-layout"><div className="donut" style={{ background: total ? `conic-gradient(${slices.map(slice => `${slice.color} ${slice.start}% ${slice.end}%`).join(',')})` : 'var(--border)' }}><div><strong dir="auto">{display}</strong><small>تومان</small></div></div><ul>{slices.map(slice => <li key={slice.label}><i style={{ background: slice.color }} />{slice.label}<bdi>{percent(total ? Math.round(slice.value / total * 100) : 0)}</bdi></li>)}</ul></div>;
}
