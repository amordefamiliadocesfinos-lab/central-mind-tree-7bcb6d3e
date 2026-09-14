import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PurchaseStatus = 'rascunho' | 'confirmado' | 'em_transito' | 'parcialmente_recebido' | 'recebido' | 'cancelado';
export const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = { rascunho: 'Rascunho', confirmado: 'Confirmado', em_transito: 'Em trânsito', parcialmente_recebido: 'Parcialmente recebido', recebido: 'Recebido', cancelado: 'Cancelado' };
export interface PurchaseOrder { id: string; internal_purchase_number?: string | null; status: PurchaseStatus; supplier_contact_id: string; ordered_at: string | null; expected_at: string | null; notes: string | null; created_at: string; supplier?: { name: string } | null; items?: PurchaseItem[]; receipts?: PurchaseReceipt[] }
export interface PurchaseItem { id: string; product_id: string; variant_id: string | null; ordered_purchase_qty: number; purchase_unit_label: string; conversion_factor: number; stock_unit_label: string; unit_price: number | null; presentation_snapshot: any; product?: { name: string; variation_mode: string; unit: string | null } | null; variant?: { variant_name: string } | null; }
export interface PurchaseReceipt { id: string; status: 'draft' | 'confirmed' | 'cancelled'; storage_location_id: string; received_at: string | null; confirmed_at: string | null; notes: string | null; items?: any[]; location?: { name: string } | null }
export interface CreatePurchasePresentationInput {
  product_id: string;
  variant_id: string | null;
  name: string;
  purchase_unit_label: string;
  stock_unit_label: string;
  conversion_factor: number;
  is_approximate?: boolean;
  notes?: string | null;
}
export type UpdatePurchasePresentationInput = Partial<Omit<CreatePurchasePresentationInput, 'product_id' | 'variant_id'>> & {
  is_active?: boolean;
};

const db = supabase as any;
export function usePurchases() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]); const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => { setLoading(true); const { data, error } = await db.from('purchase_orders').select('*, supplier:contacts!purchase_orders_supplier_contact_id_fkey(name), items:purchase_order_items(*, product:products(name,variation_mode,unit), variant:product_variants(variant_name)), receipts:purchase_receipts(*, location:storage_locations(name), items:purchase_receipt_items(*))').order('created_at', { ascending: false }); if (!error) setOrders(data || []); else console.error(error); setLoading(false); }, []);
  useEffect(() => { refetch(); }, [refetch]);
  const createDraft = useCallback(async (input: any, items: any[]) => { const { data: order, error } = await db.from('purchase_orders').insert(input).select().single(); if (error) throw error; const { error: itemError } = await db.from('purchase_order_items').insert(items.map(i => ({ ...i, purchase_order_id: order.id }))); if (itemError) throw itemError; await refetch(); return order; }, [refetch]);
  const setStatus = useCallback(async (id: string, status: PurchaseStatus) => { const { error } = await db.from('purchase_orders').update({ status }).eq('id', id); if (error) throw error; await refetch(); }, [refetch]);
  const createPresentation = useCallback(async (input: CreatePurchasePresentationInput) => {
    if (!input.product_id || !input.name.trim() || !input.purchase_unit_label.trim() || !input.stock_unit_label.trim() || input.conversion_factor <= 0) {
      throw new Error('Informe produto, nome, unidades e um fator de conversão maior que zero.');
    }
    const { data, error } = await db.from('purchase_presentations').insert({
      ...input,
      name: input.name.trim(),
      purchase_unit_label: input.purchase_unit_label.trim(),
      stock_unit_label: input.stock_unit_label.trim(),
      is_approximate: input.is_approximate ?? false,
      notes: input.notes || null,
      is_active: true,
    }).select().single();
    if (error) throw error;
    return data;
  }, []);
  const updatePresentation = useCallback(async (id: string, input: UpdatePurchasePresentationInput) => {
    const updates = {
      ...input,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.purchase_unit_label !== undefined ? { purchase_unit_label: input.purchase_unit_label.trim() } : {}),
      ...(input.stock_unit_label !== undefined ? { stock_unit_label: input.stock_unit_label.trim() } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
    };
    if (updates.conversion_factor !== undefined && updates.conversion_factor <= 0) {
      throw new Error('O fator de conversão deve ser maior que zero.');
    }
    const { data, error } = await db.from('purchase_presentations').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }, []);
  const getPresentations = useCallback(async (productId: string, variantId: string | null, includeInactive = false) => { let q = db.from('purchase_presentations').select('*').eq('product_id', productId); if (!includeInactive) q = q.eq('is_active', true); q = variantId ? q.eq('variant_id', variantId) : q.is('variant_id', null); const { data, error } = await q.order('name'); if (error) throw error; return data || []; }, []);
  const createReceipt = useCallback(async (input: any, items: any[]) => { const { data: receipt, error } = await db.from('purchase_receipts').insert(input).select().single(); if (error) throw error; const { error: itemError } = await db.from('purchase_receipt_items').insert(items.map(i => ({ ...i, purchase_receipt_id: receipt.id }))); if (itemError) throw itemError; return receipt; }, []);
  const confirmReceipt = useCallback(async (receiptId: string) => { const { data, error } = await db.rpc('confirm_purchase_receipt', { p_receipt_id: receiptId }); if (error) throw error; await refetch(); return data; }, [refetch]);
  return { orders, loading, refetch, createDraft, setStatus, createPresentation, updatePresentation, getPresentations, createReceipt, confirmReceipt };
}
