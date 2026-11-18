export const number = (value: number) => new Intl.NumberFormat('fa-IR').format(value);
export const metricNumber = (value: number) => new Intl.NumberFormat('fa-IR', { minimumIntegerDigits: 2 }).format(value);
export const money = (value: number) => `${number(value)} تومان`;
export const percent = (value: number) => `${number(value)}٪`;
export const dateLabel = (date: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }, zone = 'Asia/Tehran') =>
  new Intl.DateTimeFormat('fa-IR', { ...options, timeZone: zone }).format(new Date(date));
export const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const now = () => new Date().toISOString();
const tehranDate = new Intl.DateTimeFormat('sv-SE', { timeZone:'Asia/Tehran', year:'numeric', month:'2-digit', day:'2-digit' });
export const today = () => tehranDate.format(new Date());
export const average = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

export function normalized(input: string) {
  return input.toLowerCase().replaceAll('ي', 'ی').replaceAll('ك', 'ک').replaceAll(/[\s\u200c]+/g, ' ').trim()
    .replace(/[۰-۹٠-٩]/g, digit => String(digit.charCodeAt(0) & 15));
}
export const matches = (query: string, ...fields: string[]) => normalized(query).split(' ').every(word => normalized(fields.join(' ')).includes(word));
export const projectHref = (id: string) => `/projects/${encodeURIComponent(id)}`;
export const taskHref = (id: string) => `/tasks/${encodeURIComponent(id)}`;
export const serverHref = (id: string) => `/infrastructure/servers/${encodeURIComponent(id)}`;
export const docHref = (id: string) => `/docs?doc=${encodeURIComponent(id)}`;

export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function csv(rows: (string | number)[][]) {
  return '\ufeff' + rows.map(row => row.map(value => {
    const text = String(value);
    const safe = typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
}
export const afterHours = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
