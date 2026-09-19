import { supabase } from '@/integrations/supabase/client';
import type { PurchaseFinancialInstallment } from './purchaseFinancialCondition';

const db = supabase as any;

export interface ConfirmPurchaseFinancialResult {
  purchase_order_id: string;
  status: 'confirmado';
  already_confirmed: boolean;
  commercial_total?: number;
  financial_entry_ids: string[];
}

export async function confirmPurchaseWithFinancialEntries(
  purchaseOrderId: string,
  installments: PurchaseFinancialInstallment[],
): Promise<ConfirmPurchaseFinancialResult> {
  const { data, error } = await db.rpc('confirm_purchase_with_financial_entries', {
    p_purchase_order_id: purchaseOrderId,
    p_installments: installments,
  });

  if (error) throw error;
  return data as ConfirmPurchaseFinancialResult;
}
