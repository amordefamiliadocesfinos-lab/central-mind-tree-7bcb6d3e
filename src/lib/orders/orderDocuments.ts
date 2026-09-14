import { supabase } from '@/integrations/supabase/client';

export const ORDER_DOCUMENT_TYPE_LABELS = {
  order_pdf: 'Pedido em PDF',
  shipping_label: 'Etiqueta de envio',
  invoice: 'Nota fiscal',
  declaration: 'Declaração',
  receipt: 'Comprovante',
  other: 'Outro',
} as const;

export type OrderDocumentType = keyof typeof ORDER_DOCUMENT_TYPE_LABELS;

export const SUPPORTED_ORDER_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export interface PendingOrderDocument {
  id: string;
  documentType: OrderDocumentType;
  file: File;
}

export async function uploadOrderDocument({
  orderId,
  documentType,
  file,
  source,
}: {
  orderId: string;
  documentType: OrderDocumentType;
  file: File;
  source: string;
}) {
  const db = supabase as any;
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
    source,
    storage_bucket: bucket,
    storage_path: storagePath,
    mime_type: file.type || null,
    file_size: file.size,
  }).select().single();
  if (error) {
    await db.storage.from(bucket).remove([storagePath]);
    throw error;
  }
  return data;
}
