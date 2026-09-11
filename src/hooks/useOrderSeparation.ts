import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Order } from '@/hooks/useOrders';

const db = supabase as any;

export type SeparationStatus = 'todo' | 'preparing' | 'finalized';
export type OperationalDestination = 'academia_ponto_logistico' | 'retirada_fabrica' | 'uber' | 'outro';

export interface OrderSeparation {
  id: string;
  order_id: string;
  separation_status: SeparationStatus;
  operational_destination: OperationalDestination | null;
  logistics_mode: string | null;
  first_printed_at: string | null;
  print_count: number;
  finalized_at: string | null;
}

export interface OrderDocument {
  id: string;
  order_id: string;
  document_type: 'order_pdf' | 'shipping_label' | 'declaration' | 'receipt' | 'other';
  file_url: string;
  file_name: string | null;
  source: string | null;
  created_at?: string;
  created_by?: string | null;
}

export function useOrderSeparation(orders: Order[]) {
  const [separations, setSeparations] = useState<OrderSeparation[]>([]);
  const [documents, setDocuments] = useState<OrderDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSeparation = useCallback(async () => {
    const activeIds = orders.filter(order => !['cancelado', 'concluido'].includes(order.status)).map(order => order.id);
    if (activeIds.length === 0) {
      setSeparations([]);
      setDocuments([]);
      setLoading(false);
      return;
    }
    const [separationResult, documentsResult] = await Promise.all([
      db.from('order_separation').select('*').in('order_id', activeIds),
      db.from('order_documents').select('*').in('order_id', activeIds).order('created_at', { ascending: false }),
    ]);
    if (!separationResult.error) setSeparations((separationResult.data ?? []) as OrderSeparation[]);
    if (!documentsResult.error) setDocuments((documentsResult.data ?? []) as OrderDocument[]);
    setLoading(false);
  }, [orders]);

  useEffect(() => { void fetchSeparation(); }, [fetchSeparation]);

  useEffect(() => {
    const channel = supabase.channel('order-separation-v1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_separation' }, () => void fetchSeparation())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_documents' }, () => void fetchSeparation())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchSeparation]);

  const separationByOrderId = useMemo(
    () => new Map(separations.map(separation => [separation.order_id, separation])),
    [separations],
  );
  const documentsByOrderId = useMemo(() => {
    const grouped = new Map<string, OrderDocument[]>();
    documents.forEach(document => grouped.set(document.order_id, [...(grouped.get(document.order_id) ?? []), document]));
    return grouped;
  }, [documents]);

  const markPrinted = useCallback(async (orderId: string) => {
    const { error } = await db.rpc('mark_order_separation_printed', { p_order_id: orderId });
    if (error) throw error;
    await fetchSeparation();
  }, [fetchSeparation]);

  const finalize = useCallback(async (orderId: string) => {
    const { data, error } = await db.rpc('finalize_order_separation', { p_order_id: orderId });
    if (error) throw error;
    await fetchSeparation();
    return data as { already_finalized: boolean; stock_result: { already_applied?: boolean; movement_count?: number } | null };
  }, [fetchSeparation]);

  const setDestination = useCallback(async (orderId: string, destination: OperationalDestination) => {
    const { error } = await db.from('order_separation').upsert({ order_id: orderId, operational_destination: destination }, { onConflict: 'order_id' });
    if (error) throw error;
    await fetchSeparation();
  }, [fetchSeparation]);

  const addDocument = useCallback(async (input: Omit<OrderDocument, 'id'>) => {
    const { error } = await db.from('order_documents').insert(input);
    if (error) throw error;
    await fetchSeparation();
  }, [fetchSeparation]);

  return { loading, separationByOrderId, documentsByOrderId, markPrinted, finalize, setDestination, addDocument, refetch: fetchSeparation };
}
