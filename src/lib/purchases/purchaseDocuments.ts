import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;
const BUCKET = 'order-documents';

export const PURCHASE_DOCUMENT_TYPE_LABELS = {
  invoice: 'Nota fiscal',
  xml: 'XML fiscal',
  pdf: 'PDF / documento',
  image: 'Imagem / evidência',
  receipt: 'Comprovante',
  shipping: 'Frete / transporte',
  other: 'Outro',
} as const;

export type PurchaseDocumentType = keyof typeof PURCHASE_DOCUMENT_TYPE_LABELS;

export interface PurchaseDocument {
  id: string;
  purchase_order_id: string;
  purchase_receipt_id: string | null;
  document_type: PurchaseDocumentType;
  file_name: string;
  source: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  notes: string | null;
  created_at: string;
}

export async function listPurchaseDocuments(purchaseOrderId: string): Promise<PurchaseDocument[]> {
  const { data, error } = await db
    .from('purchase_documents')
    .select('*')
    .eq('purchase_order_id', purchaseOrderId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PurchaseDocument[];
}

export async function uploadPurchaseDocument(input: {
  purchaseOrderId: string;
  purchaseReceiptId?: string | null;
  documentType: PurchaseDocumentType;
  file: File;
  notes?: string | null;
}) {
  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `purchases/${input.purchaseOrderId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await db.storage.from(BUCKET).upload(storagePath, input.file, {
    contentType: input.file.type || undefined,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await db.from('purchase_documents').insert({
    purchase_order_id: input.purchaseOrderId,
    purchase_receipt_id: input.purchaseReceiptId || null,
    document_type: input.documentType,
    file_name: input.file.name,
    source: 'manual',
    storage_bucket: BUCKET,
    storage_path: storagePath,
    mime_type: input.file.type || null,
    file_size: input.file.size,
    notes: input.notes?.trim() || null,
  }).select().single();

  if (error) {
    await db.storage.from(BUCKET).remove([storagePath]);
    throw error;
  }
  return data as PurchaseDocument;
}

export async function openPurchaseDocument(document: PurchaseDocument) {
  const { data, error } = await db.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, 300);
  if (error) throw error;
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

export async function deletePurchaseDocument(document: PurchaseDocument) {
  const { error: storageError } = await db.storage
    .from(document.storage_bucket)
    .remove([document.storage_path]);
  if (storageError) throw storageError;

  const { error } = await db.from('purchase_documents').delete().eq('id', document.id);
  if (error) throw error;
}
