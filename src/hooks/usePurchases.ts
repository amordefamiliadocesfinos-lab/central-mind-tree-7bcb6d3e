import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPhysicalIdentityUnit } from '@/lib/productVariants';

export type PurchaseStatus = 'rascunho' | 'confirmado' | 'em_transito' | 'parcialmente_recebido' | 'recebido' | 'cancelado';
export const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = { rascunho: 'Rascunho', confirmado: 'Confirmado', em_transito: 'Em trânsito', parcialmente_recebido: 'Parcialmente recebido', recebido: 'Recebido', cancelado: 'Cancelado' };
export interface PurchaseOrder { id: string; internal_purchase_number?: string | null; status: PurchaseStatus; supplier_contact_id: string; ordered_at: string | null; expected_at: string | null; notes: string | null; freight_amount: number; created_at: string; supplier?: { name: string } | null; items?: PurchaseItem[]; receipts?: PurchaseReceipt[] }
export interface PurchaseItem { id: string; product_id: string; variant_id: string | null; purchase_presentation_id: string | null; ordered_purchase_qty: number; purchase_unit_label: string; conversion_factor: number; stock_unit_label: string; unit_price: number | null; presentation_snapshot: any; planning_source?: 'mrp' | null; planning_context?: any; product?: { name: string; variation_mode: string; unit: string | null } | null; variant?: { variant_name: string } | null; }
export interface PurchaseReceipt { id: string; status: 'draft' | 'confirmed' | 'cancelled'; storage_location_id: string; received_at: string | null; confirmed_at: string | null; notes: string | null; created_at: string; items?: any[]; location?: { name: string } | null }
export interface CreatePurchasePresentationInput {
  product_id: string;
  variant_id: string | null;
  name: string;
  purchase_unit_label: string;
  /** Derivada da identidade física pelo hook; nunca é uma entrada livre. */
  stock_unit_label?: string;
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

  /** Status comercial sensível não é atualizado diretamente. Confirmação, recebimento e cancelamento possuem rotinas canônicas próprias. */
  const setStatus = useCallback(async (id: string, status: PurchaseStatus) => {
    if (status === 'cancelado') {
      const { error } = await db.rpc('cancel_purchase_with_financial_entries', { p_purchase_order_id: id, p_reason: null });
      if (error) throw error;
      await refetch();
      return;
    }
    if (status !== 'em_transito') {
      throw new Error('Este status só pode ser alterado pela rotina canônica de confirmação ou recebimento.');
    }
    const { error } = await db.from('purchase_orders').update({ status }).eq('id', id);
    if (error) throw error;
    await refetch();
  }, [refetch]);

  const updatePurchase = useCallback(async (id: string, input: Partial<Pick<PurchaseOrder, 'supplier_contact_id' | 'expected_at' | 'notes' | 'freight_amount'>>, items?: any[]) => {
    const { data: current, error: currentError } = await db.from('purchase_orders').select('status').eq('id', id).single();
    if (currentError) throw currentError;

    if (current.status !== 'rascunho') {
      if (items !== undefined || input.supplier_contact_id !== undefined || input.freight_amount !== undefined) {
        throw new Error('Compra confirmada tem identidade comercial bloqueada. Para alterar fornecedor, frete, itens, quantidades ou preços é necessária regularização explícita.');
      }
      const safeUpdates = { expected_at: input.expected_at, notes: input.notes };
      const { error } = await db.from('purchase_orders').update(safeUpdates).eq('id', id);
      if (error) throw error;
      await refetch();
      return;
    }

    const { error } = await db.from('purchase_orders').update(input).eq('id', id);
    if (error) throw error;
    if (items) {
      const { error: deleteError } = await db.from('purchase_order_items').delete().eq('purchase_order_id', id);
      if (deleteError) throw deleteError;
      if (items.length) {
        const { error: insertError } = await db.from('purchase_order_items').insert(items.map(item => ({ ...item, purchase_order_id: id })));
        if (insertError) throw insertError;
      }
    }
    await refetch();
  }, [refetch]);
  const deleteDraft = useCallback(async (id: string) => { const { error } = await db.from('purchase_orders').delete().eq('id', id).eq('status', 'rascunho'); if (error) throw error; await refetch(); }, [refetch]);
  const createPresentation = useCallback(async (input: CreatePurchasePresentationInput) => {
    if (!input.product_id || !input.name.trim() || !input.purchase_unit_label.trim() || input.conversion_factor <= 0) {
      throw new Error('Informe produto, nome, unidade de compra e um fator de conversão maior que zero.');
    }
    const { data: product, error: productError } = await db.from('products').select('unit').eq('id', input.product_id).single();
    if (productError) throw productError;
    const { data: variant, error: variantError } = input.variant_id
      ? await db.from('product_variants').select('unit').eq('id', input.variant_id).single()
      : { data: null, error: null };
    if (variantError) throw variantError;
    const canonicalUnit = getPhysicalIdentityUnit(product, variant);
    const { data, error } = await db.from('purchase_presentations').insert({
      ...input,
      name: input.name.trim(),
      purchase_unit_label: input.purchase_unit_label.trim(),
      stock_unit_label: canonicalUnit,
      is_approximate: input.is_approximate ?? false,
      notes: input.notes || null,
      is_active: true,
    }).select().single();
    if (error) throw error;
    return data;
  }, []);
  const updatePresentation = useCallback(async (id: string, input: UpdatePurchasePresentationInput) => {
    const hasFunctionalChange = input.name !== undefined
      || input.purchase_unit_label !== undefined
      || input.conversion_factor !== undefined
      || input.is_approximate !== undefined
      || input.notes !== undefined;
    if (!hasFunctionalChange && input.is_active !== undefined) {
      const { data, error } = await db.from('purchase_presentations').update({ is_active: input.is_active }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }
    const { data: current, error: currentError } = await db.from('purchase_presentations').select('product_id,variant_id').eq('id', id).single();
    if (currentError) throw currentError;
    const { data: product, error: productError } = await db.from('products').select('unit').eq('id', current.product_id).single();
    if (productError) throw productError;
    const { data: variant, error: variantError } = current.variant_id
      ? await db.from('product_variants').select('unit').eq('id', current.variant_id).single()
      : { data: null, error: null };
    if (variantError) throw variantError;
    const updates = {
      ...input,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.purchase_unit_label !== undefined ? { purchase_unit_label: input.purchase_unit_label.trim() } : {}),
      stock_unit_label: getPhysicalIdentityUnit(product, variant),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
    };
    if (updates.conversion_factor !== undefined && updates.conversion_factor <= 0) throw new Error('O fator de conversão deve ser maior que zero.');
    const { data, error } = await db.from('purchase_presentations').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }, []);
  const getPresentations = useCallback(async (productId: string, variantId: string | null, includeInactive = false) => { let q = db.from('purchase_presentations').select('*').eq('product_id', productId); if (!includeInactive) q = q.eq('is_active', true); q = variantId ? q.eq('variant_id', variantId) : q.is('variant_id', null); const { data, error } = await q.order('name'); if (error) throw error; return data || []; }, []);
  const createReceipt = useCallback(async (input: any, items: any[]) => { const { data: receipt, error } = await db.from('purchase_receipts').insert(input).select().single(); if (error) throw error; const { error: itemError } = await db.from('purchase_receipt_items').insert(items.map(i => ({ ...i, purchase_receipt_id: receipt.id }))); if (itemError) throw itemError; return receipt; }, []);
  const confirmReceipt = useCallback(async (receiptId: string) => { const { data, error } = await db.rpc('confirm_purchase_receipt', { p_receipt_id: receiptId }); if (error) throw error; await refetch(); return data; }, [refetch]);
  return { orders, loading, refetch, createDraft, updatePurchase, deleteDraft, setStatus, createPresentation, updatePresentation, getPresentations, createReceipt, confirmReceipt };
}
