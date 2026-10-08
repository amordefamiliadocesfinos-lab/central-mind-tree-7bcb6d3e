import { supabase } from '@/integrations/supabase/client';
import type { PurchaseFinancialInstallment } from './purchaseFinancialCondition';

const db = supabase as any;

export interface RegisterPurchaseBillingResult {
  purchase_order_id: string;
  billing_status: 'invoiced';
  already_invoiced: boolean;
  billed_at?: string;
  commercial_total?: number;
  financial_entry_ids: string[];
}

export async function registerPurchaseBilling(
  purchaseOrderId: string,
  installments: PurchaseFinancialInstallment[],
): Promise<RegisterPurchaseBillingResult> {
  const { data, error } = await db.rpc('register_purchase_billing', {
    p_purchase_order_id: purchaseOrderId,
    p_installments: installments,
  });

  if (error) throw error;
  return data as RegisterPurchaseBillingResult;
}


export async function registerPurchaseInvoiceBilling(
  purchaseOrderId: string,
  installments: PurchaseFinancialInstallment[],
  invoiceDate: string,
): Promise<RegisterPurchaseBillingResult> {
  const { data, error } = await db.rpc('register_purchase_invoice_billing', {
    p_purchase_order_id: purchaseOrderId,
    p_installments: installments,
    p_invoice_date: invoiceDate,
  });

  if (error) throw error;
  return data as RegisterPurchaseBillingResult;
}
