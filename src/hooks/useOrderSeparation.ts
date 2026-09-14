import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { finalizeOrderSeparation } from '@/lib/orderStock';
import { isSeparationEligible } from '@/lib/orders/operationalStatus';
import type { OperationalDestination } from '@/lib/orders/operationalDestination';
import type { Order } from '@/hooks/useOrders';

const db = supabase as any;

export type SeparationStatus = 'todo' | 'preparing' | 'finalized';

export interface OrderSeparation {
  id: string;
  order_id: string;
  separation_status: SeparationStatus;
  first_printed_at: string | null;
  print_count: number;
  finalized_at: string | null;
}

export interface OrderDocument {
  id: string;
  order_id: string;
  document_type: 'order_pdf' | 'shipping_label' | 'invoice' | 'declaration' | 'receipt' | 'other';
  file_url: string | null;
  file_name: string | null;
  source: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at?: string;
  created_by?: string | null;
}

export function useOrderSeparation(orders: Order[]) {
  const [separations, setSeparations] = useState<OrderSeparation[]>([]);
  const [documents, setDocuments] = useState<OrderDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSeparation = useCallback(async () => {
    const activeIds = orders.filter(isSeparationEligible).map(order => order.id);
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
    const data = await finalizeOrderSeparation(orderId);
    await fetchSeparation();
    return data as { already_finalized: boolean; stock_result: { already_applied?: boolean; movement_count?: number } | null };
  }, [fetchSeparation]);

  const updateOrderOperationalDestination = useCallback(async (
    orderId: string,
    destination: OperationalDestination,
    options: { logisticsMode?: string | null; details?: Record<string, unknown> } = {},
  ) => {
    const payload: Record<string, unknown> = {
      operational_destination: destination,
    };
    if (options.logisticsMode !== undefined) payload.logistics_mode = options.logisticsMode;
    if (options.details !== undefined) payload.operational_destination_details = options.details;
    const { error } = await db.from('orders').update(payload).eq('id', orderId);
    if (error) throw error;
    await fetchSeparation();
  }, [fetchSeparation]);

  const uploadDocument = useCallback(async ({ orderId, documentType, file }: {
    orderId: string;
    documentType: OrderDocument['document_type'];
    file: File;
  }) => {
    const bucket = 'order-documents';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${orderId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await db.storage.from(bucket).upload(storagePath, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data, error } = await db.from('order_documents').insert({
      order_id: orderId,
      document_type: documentType,
      file_url: null,
      file_name: file.name,
      source: 'operacoes',
      storage_bucket: bucket,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size: file.size,
    }).select().single();
    if (error) {
      await db.storage.from(bucket).remove([storagePath]);
      throw error;
    }
    await fetchSeparation();
    return data as OrderDocument;
  }, [fetchSeparation]);

  const openDocument = useCallback(async (document: OrderDocument) => {
    if (document.storage_bucket && document.storage_path) {
      const documentWindow = window.open('', '_blank');
      if (documentWindow) documentWindow.opener = null;
      try {
        const { data, error } = await db.storage
          .from(document.storage_bucket)
          .createSignedUrl(document.storage_path, 60 * 5);
        if (error) throw error;
        if (!documentWindow) throw new Error('O navegador bloqueou a abertura do documento.');
        documentWindow.location.assign(data.signedUrl);
      } catch (error) {
        documentWindow?.close();
        throw error;
      }
      return;
    }
    if (!document.file_url) throw new Error('Documento sem local de arquivo disponível.');
    window.open(document.file_url, '_blank', 'noopener,noreferrer');
  }, []);

  return { loading, separationByOrderId, documentsByOrderId, markPrinted, finalize, updateOrderOperationalDestination, uploadDocument, openDocument, refetch: fetchSeparation };
}
