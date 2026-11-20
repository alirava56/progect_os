import type { Invoice, Payment } from './types';

export function invoiceBalance(invoice: Invoice, payments: readonly Payment[]) {
  const paid=payments.filter(payment=>payment.invoiceId===invoice.id)
    .reduce((total,payment)=>total+BigInt(payment.amount),BigInt(0));
  return {paid,remaining:BigInt(invoice.amount)-paid};
}

export function installmentBalances(invoice: Invoice, paid: bigint) {
  let budget=paid;
  const schedule=invoice.installments?.length ? invoice.installments : [{dueOn:invoice.dueOn,amount:invoice.amount}];
  return schedule.map(installment=>{
    const amount=BigInt(installment.amount);
    const applied=budget<amount ? budget : amount;
    budget-=applied;
    return {...installment, remaining:amount-applied};
  });
}
