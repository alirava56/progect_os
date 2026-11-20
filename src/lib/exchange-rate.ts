import { normalized } from './format';
import type { ExchangeRate } from './types';

export function parseRate(input: string) {
  const text=normalized(input).replace('٫','.');
  if (!/^\d{1,12}(?:\.\d{1,10})?$/.test(text)) return;
  const [whole,decimal='']=text.split('.');
  const digits=BigInt(whole+decimal);
  if (digits===BigInt(0)) return;
  return {text,digits,scale:BigInt(10)**BigInt(decimal.length)};
}

export function convertAtRate(amount: bigint, quote: Pick<ExchangeRate,'from'|'to'|'rate'>) {
  const value=parseRate(quote.rate);
  if (!value || quote.from===quote.to) return;
  const inputScale=quote.from==='USD'?BigInt(100):BigInt(1);
  const outputScale=quote.to==='USD'?BigInt(100):BigInt(1);
  const divisor=value.scale*inputScale;
  const absolute=(amount<BigInt(0)?-amount:amount)*value.digits*outputScale;
  const rounded=(absolute+divisor/BigInt(2))/divisor;
  return amount<BigInt(0)?-rounded:rounded;
}
