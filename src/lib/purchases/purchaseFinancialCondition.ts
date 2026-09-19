import { addDays, format } from 'date-fns';
import type { PurchaseOrder } from '@/hooks/usePurchases';

export interface PurchaseFinancialInstallment {
  installment_number: number;
  value: number;
  due_date: string;
}

export type PurchaseFinancialConditionPreset = 'avista' | '30dias' | 'personalizado';

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getPurchaseCommercialTotal(order: Pick<PurchaseOrder, 'items' | 'freight_amount'>) {
  const itemsTotal = (order.items ?? []).reduce((total, item) => {
    const qty = Number(item.ordered_purchase_qty) || 0;
    const price = item.unit_price === null ? 0 : Number(item.unit_price) || 0;
    return total + qty * price;
  }, 0);

  return roundMoney(itemsTotal + (Number(order.freight_amount) || 0));
}

export function buildPurchaseFinancialInstallments(
  preset: PurchaseFinancialConditionPreset,
  total: number,
  baseDate = new Date(),
): PurchaseFinancialInstallment[] {
  const normalizedTotal = roundMoney(total);
  const dueDate = preset === '30dias' ? addDays(baseDate, 30) : baseDate;

  return [{
    installment_number: 1,
    value: normalizedTotal,
    due_date: format(dueDate, 'yyyy-MM-dd'),
  }];
}

export function normalizePurchaseFinancialInstallments(
  installments: PurchaseFinancialInstallment[],
): PurchaseFinancialInstallment[] {
  return [...installments]
    .sort((a, b) => a.installment_number - b.installment_number)
    .map((installment, index) => ({
      installment_number: index + 1,
      value: roundMoney(Number(installment.value) || 0),
      due_date: installment.due_date,
    }));
}

export function validatePurchaseFinancialInstallments(
  total: number,
  installments: PurchaseFinancialInstallment[],
) {
  if (!installments.length) {
    return { valid: false, message: 'Informe ao menos uma parcela.' } as const;
  }

  const normalized = normalizePurchaseFinancialInstallments(installments);
  for (const installment of normalized) {
    if (installment.value <= 0) {
      return { valid: false, message: `A parcela ${installment.installment_number} deve ter valor maior que zero.` } as const;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(installment.due_date)) {
      return { valid: false, message: `Informe o vencimento da parcela ${installment.installment_number}.` } as const;
    }
  }

  const totalCents = Math.round(roundMoney(total) * 100);
  const installmentsCents = normalized.reduce((sum, installment) => sum + Math.round(installment.value * 100), 0);
  const differenceCents = installmentsCents - totalCents;

  if (differenceCents !== 0) {
    return {
      valid: false,
      message: `A soma das parcelas deve ser igual ao total comercial da compra. Diferença: R$ ${(differenceCents / 100).toFixed(2).replace('.', ',')}.`,
    } as const;
  }

  return { valid: true, installments: normalized } as const;
}
