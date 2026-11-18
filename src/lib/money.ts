import type { CurrencyUnit } from './types';

export const currencies: readonly CurrencyUnit[] = ['TOMAN','IRR','USD'];
const labels = { TOMAN:'تومان', IRR:'ریال', USD:'دلار' };
const whole = new Intl.NumberFormat('fa-IR');
const cents = new Intl.NumberFormat('fa-IR', { minimumIntegerDigits:2, useGrouping:false });
const zero = BigInt(0), hundred = BigInt(100);
export type Money = {amount:number;currency?:CurrencyUnit;amountUnit?:'minor'};

export function parseAmount(entry: string, currency: CurrencyUnit) {
  const match = /^(\d{1,13})(?:\.(\d{1,2}))?$/.exec(entry);
  if (!match || (match[2] && currency !== 'USD')) return;
  const amount = currency === 'USD'
    ? BigInt(match[1]) * hundred + BigInt((match[2] ?? '').padEnd(2,'0'))
    : BigInt(match[1]);
  if (amount > BigInt(1_000_000_000_000)) return;
  return Number(amount);
}

export function minorUnits(value: Money) {
  const amount = BigInt(value.amount);
  // Preview forms entered USD as whole dollars. The explicit marker is applied only to new inputs.
  return value.currency === 'USD' && value.amountUnit !== 'minor' ? amount * hundred : amount;
}
export function inputAmount(value: Money) {
  const minor = minorUnits(value);
  return value.currency === 'USD' ? (minor / hundred).toString() + '.' + (minor % hundred).toString().padStart(2,'0') : minor.toString();
}
export function formatMoney(amount: bigint, currency: CurrencyUnit) {
  if (currency !== 'USD') return whole.format(amount) + ' ' + labels[currency];
  const sign = amount < zero ? '−' : '';
  const absolute = amount < zero ? -amount : amount;
  return sign + whole.format(absolute / hundred) + '٫' + cents.format(absolute % hundred) + ' ' + labels.USD;
}
export function amountLabel(value: Money) { return formatMoney(minorUnits(value), value.currency ?? 'TOMAN'); }

export function totalsByCurrency(entries: readonly Money[]) {
  const totals = new Map<CurrencyUnit,bigint>();
  for (const entry of entries) {
    const currency = entry.currency ?? 'TOMAN';
    totals.set(currency, (totals.get(currency) ?? zero) + minorUnits(entry));
  }
  return totals;
}

export function summaryByCurrency(entries: readonly Money[]) {
  const totals = totalsByCurrency(entries);
  return currencies.flatMap(currency => {
    const total = totals.get(currency);
    return total === undefined ? [] : [formatMoney(total,currency)];
  }).join(' · ') || '—';
}
