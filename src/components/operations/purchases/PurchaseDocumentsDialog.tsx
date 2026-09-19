import { useEffect, useState } from 'react';
import { ExternalLink, FileText, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { PurchaseOrder } from '@/hooks/usePurchases';
import {
  PURCHASE_DOCUMENT_TYPE_LABELS,
  deletePurchaseDocument,
  listPurchaseDocuments,
  openPurchaseDocument,
  uploadPurchaseDocument,
  type PurchaseDocument,
  type PurchaseDocumentType,
} from '@/lib/purchases/purchaseDocuments';

interface Props {
  order: PurchaseOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function receiptLabel(order: PurchaseOrder, receiptId: string | null) {
  if (!receiptId) return 'Documento geral da compra';
  const receipt = (order.receipts ?? []).find(item => item.id === receiptId);
  if (!receipt) return 'Recebimento vinculado';
  const date = receipt.confirmed_at ?? receipt.received_at ?? receipt.created_at;
  return `Recebimento ${date ? new Date(date).toLocaleDateString('pt-BR') : receipt.id.slice(0, 8)}`;
}

export function PurchaseDocumentsDialog({ order, open, onOpenChange }: Props) {
  const [documents, setDocuments] = useState<PurchaseDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<PurchaseDocumentType>('invoice');
  const [receiptId, setReceiptId] = useState('purchase');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!order) return;
    setLoading(true);
    setError(null);
    try {
      setDocuments(await listPurchaseDocuments(order.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os documentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && order) void refresh();
    if (!open) {
      setFile(null);
      setReceiptId('purchase');
      setNotes('');
      setError(null);
    }
  }, [open, order?.id]);

  const upload = async () => {
    if (!order || !file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadPurchaseDocument({
        purchaseOrderId: order.id,
        purchaseReceiptId: receiptId === 'purchase' ? null : receiptId,
        documentType,
        file,
        notes,
      });
      setFile(null);
      setNotes('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o documento.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (document: PurchaseDocument) => {
    if (!window.confirm(`Excluir o documento ${document.file_name}?`)) return;
    setBusy(true);
    try {
      await deletePurchaseDocument(document);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir o documento.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Documentos · ${order?.internal_purchase_number ?? 'Compra'}`}
      description="Anexe nota fiscal, XML, comprovante, imagem ou outra evidência à compra ou a um recebimento específico."
      className="sm:max-w-2xl"
      scrollable
    >
      <div className="space-y-5 py-1">
        <div className="space-y-3 rounded-md border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={documentType} onValueChange={value => setDocumentType(value as PurchaseDocumentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PURCHASE_DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vínculo</Label>
              <Select value={receiptId} onValueChange={setReceiptId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Compra em geral</SelectItem>
                  {(order?.receipts ?? []).map(receipt => (
                    <SelectItem key={receipt.id} value={receipt.id}>{receiptLabel(order as PurchaseOrder, receipt.id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Arquivo</Label>
            <Input type="file" accept="application/pdf,text/xml,application/xml,image/*" onChange={event => setFile(event.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-2">
            <Label>Observação opcional</Label>
            <Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Ex.: NF do recebimento parcial, comprovante da transportadora..." />
          </div>
          <Button disabled={busy || !file} onClick={() => void upload()}>
            <Upload className="mr-1 h-4 w-4" />{busy ? 'Enviando…' : 'Anexar documento'}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {loading ? <p className="text-sm text-muted-foreground">Carregando documentos…</p> : documents.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhum documento vinculado a esta compra.</p>
        ) : (
          <div className="space-y-2">
            {documents.map(document => (
              <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" />{document.file_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {PURCHASE_DOCUMENT_TYPE_LABELS[document.document_type]} · {receiptLabel(order as PurchaseOrder, document.purchase_receipt_id)}
                  </p>
                  {document.notes && <p className="mt-1 text-xs text-muted-foreground">{document.notes}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label="Abrir documento" onClick={() => void openPurchaseDocument(document)}><ExternalLink className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Excluir documento" disabled={busy} onClick={() => void remove(document)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
