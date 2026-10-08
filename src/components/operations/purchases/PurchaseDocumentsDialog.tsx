import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, FileSearch, FileText, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { PurchaseOrder } from '@/hooks/usePurchases';
import { supabase } from '@/integrations/supabase/client';
import { registerPurchaseInvoiceBilling } from '@/lib/purchases/confirmPurchaseFinancial';
import { parseNfePdf, type NfeParsedData } from '@/lib/purchases/nfePdfParser';
import { validateNfeAgainstPurchase, type NfePurchaseValidation } from '@/lib/purchases/nfePurchaseValidation';
import {
  PURCHASE_DOCUMENT_TYPE_LABELS,
  deletePurchaseDocument,
  listPurchaseDocuments,
  openPurchaseDocument,
  uploadPurchaseDocument,
  type PurchaseDocument,
  type PurchaseDocumentType,
} from '@/lib/purchases/purchaseDocuments';
import { formatCurrency } from '@/lib/utils';

const db = supabase as any;

interface Props {
  order: PurchaseOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => Promise<void> | void;
}

function receiptLabel(order: PurchaseOrder, receiptId: string | null) {
  if (!receiptId) return 'Documento geral da compra';
  const receipt = (order.receipts ?? []).find(item => item.id === receiptId);
  if (!receipt) return 'Recebimento vinculado';
  const date = receipt.confirmed_at ?? receipt.received_at ?? receipt.created_at;
  return `Recebimento ${date ? new Date(date).toLocaleDateString('pt-BR') : receipt.id.slice(0, 8)}`;
}

function displayDate(value: string | null | undefined) {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function PurchaseDocumentsDialog({ order, open, onOpenChange, onImported }: Props) {
  const [documents, setDocuments] = useState<PurchaseDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<PurchaseDocumentType>('invoice');
  const [receiptId, setReceiptId] = useState('purchase');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceData, setInvoiceData] = useState<NfeParsedData | null>(null);
  const [invoiceValidation, setInvoiceValidation] = useState<NfePurchaseValidation | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState(false);

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
      setInvoiceFile(null);
      setInvoiceData(null);
      setInvoiceValidation(null);
    }
  }, [open, order?.id]);

  const readInvoice = async () => {
    if (!order || !invoiceFile) return;
    setInvoiceBusy(true);
    setError(null);

    try {
      const parsed = await parseNfePdf(invoiceFile);
      const { data: supplier, error: supplierError } = await db
        .from('contacts')
        .select('document')
        .eq('id', order.supplier_contact_id)
        .single();

      if (supplierError) throw supplierError;

      const validation = validateNfeAgainstPurchase(parsed, order, supplier?.document ?? null);
      setInvoiceData(parsed);
      setInvoiceValidation(validation);
    } catch (err) {
      console.error('Erro ao ler NF-e:', err);
      setInvoiceData(null);
      setInvoiceValidation(null);
      setError(err instanceof Error ? err.message : 'Não foi possível ler esta NF-e em PDF.');
    } finally {
      setInvoiceBusy(false);
    }
  };

  const applyInvoice = async () => {
    if (!order || !invoiceFile || !invoiceData || !invoiceValidation?.can_apply) return;
    if (order.status === 'rascunho') {
      setError('Confirme primeiro o pedido com o fornecedor. A NF-e representa faturamento, não substitui o fato de o pedido ter sido realizado.');
      return;
    }
    if (order.status === 'cancelado') {
      setError('Compra cancelada não pode receber faturamento.');
      return;
    }

    setInvoiceBusy(true);
    setError(null);

    try {
      const { raw_text: _rawText, ...storedData } = invoiceData;

      await uploadPurchaseDocument({
        purchaseOrderId: order.id,
        purchaseReceiptId: null,
        documentType: 'invoice',
        file: invoiceFile,
        notes: `NF-e ${invoiceData.invoice_number ?? ''} importada e conferida contra o pedido.`,
        documentNumber: invoiceData.invoice_number,
        documentSeries: invoiceData.series,
        documentDate: invoiceData.issue_date,
        accessKey: invoiceData.access_key,
        issuerDocument: invoiceData.issuer_document,
        extractionStatus: 'confirmed',
        extractedData: storedData,
        source: 'nfe_pdf_import',
      });

      if (order.billing_status === 'pending') {
        if (!invoiceData.issue_date) throw new Error('A data de emissão da NF-e não foi identificada.');
        await registerPurchaseInvoiceBilling(
          order.id,
          invoiceData.installments.map(installment => ({
            installment_number: installment.number,
            value: installment.value,
            due_date: installment.due_date,
          })),
          invoiceData.issue_date,
        );
      }

      setInvoiceFile(null);
      setInvoiceData(null);
      setInvoiceValidation(null);
      await refresh();
      await onImported?.();
    } catch (err: any) {
      console.error('Erro ao aplicar NF-e:', err);
      const message = err?.message || 'Não foi possível aplicar esta NF-e à compra.';
      setError(message.includes('purchase_documents_nfe_access_key_unique')
        ? 'Esta chave de acesso de NF-e já foi importada anteriormente.'
        : message);
    } finally {
      setInvoiceBusy(false);
    }
  };

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
      title={`NF / Documentos · ${order?.internal_purchase_number ?? 'Compra'}`}
      description="Importe uma NF-e para transcrever faturamento e parcelas, ou anexe outros documentos da compra."
      className="sm:max-w-4xl"
      scrollable
    >
      <div className="space-y-5 py-1">
        {order && order.status !== 'cancelado' && (
          <section className="space-y-3 rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <FileSearch className="h-4 w-4 text-primary" />
                Importar NF-e (PDF)
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                O Painel lê o DANFE, confere fornecedor, itens, quantidades, preços, frete, total e parcelas contra este pedido. Não movimenta estoque nem registra pagamento.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="file"
                accept="application/pdf"
                onChange={event => {
                  setInvoiceFile(event.target.files?.[0] ?? null);
                  setInvoiceData(null);
                  setInvoiceValidation(null);
                }}
              />
              <Button variant="outline" disabled={!invoiceFile || invoiceBusy} onClick={() => void readInvoice()}>
                <FileSearch className="mr-1 h-4 w-4" />
                {invoiceBusy ? 'Lendo…' : 'Ler NF-e'}
              </Button>
            </div>

            {invoiceData && invoiceValidation && (
              <div className="space-y-3 rounded-lg border bg-background p-3">
                <div className="grid gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">NF-e</p>
                    <p className="font-semibold">{invoiceData.invoice_number ?? '—'}{invoiceData.series ? ` · Série ${invoiceData.series}` : ''}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Emissão</p>
                    <p className="font-semibold">{displayDate(invoiceData.issue_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-semibold">{invoiceData.total_note === null ? '—' : formatCurrency(invoiceData.total_note)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Conteúdo</p>
                    <p className="font-semibold">{invoiceData.items.length} itens · {invoiceData.installments.length} parcelas</p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  <p>{invoiceData.issuer_name ?? 'Emitente não identificado'} · {invoiceData.issuer_document ?? 'CNPJ não identificado'}</p>
                  {invoiceData.access_key && <p className="mt-1 break-all">Chave: {invoiceData.access_key}</p>}
                </div>

                {invoiceValidation.can_apply ? (
                  <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="font-medium">NF-e confere com o pedido.</p>
                      <p className="text-xs text-muted-foreground">
                        Aplicar irá anexar a nota e {order.billing_status === 'pending' ? 'criar as contas a pagar com os vencimentos da NF-e' : 'preservar o faturamento já registrado'}.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    <p className="font-medium text-destructive">Revisão necessária antes de aplicar.</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                      {invoiceValidation.errors.map(item => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                )}

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-md border p-2">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Itens lidos</p>
                    <div className="space-y-1 text-xs">
                      {invoiceData.items.map(item => (
                        <div key={`${item.supplier_code}-${item.description}`} className="flex justify-between gap-3 border-b py-1 last:border-0">
                          <span className="min-w-0 truncate">{item.description}</span>
                          <span className="shrink-0 font-mono">{item.quantity} × {formatCurrency(item.unit_price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parcelas lidas</p>
                    <div className="space-y-1 text-xs">
                      {invoiceData.installments.map(installment => (
                        <div key={installment.number} className="flex justify-between gap-3 border-b py-1 last:border-0">
                          <span>Parcela {installment.number} · {displayDate(installment.due_date)}</span>
                          <span className="font-mono">{formatCurrency(installment.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <Button className="w-full" disabled={!invoiceValidation.can_apply || invoiceBusy} onClick={() => void applyInvoice()}>
                  <Upload className="mr-1 h-4 w-4" />
                  {invoiceBusy ? 'Aplicando…' : order.billing_status === 'pending' ? 'Aplicar NF e registrar faturamento' : 'Anexar NF conferida'}
                </Button>
              </div>
            )}
          </section>
        )}

        <section className="space-y-3 rounded-md border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outros documentos / anexo manual</p>
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
            <Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Ex.: comprovante da transportadora, imagem, documento complementar..." />
          </div>
          <Button variant="outline" disabled={busy || !file} onClick={() => void upload()}>
            <Upload className="mr-1 h-4 w-4" />{busy ? 'Enviando…' : 'Anexar documento'}
          </Button>
        </section>

        {error && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

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
                    {document.document_number ? ` · NF ${document.document_number}` : ''}
                  </p>
                  {document.document_date && <p className="mt-1 text-xs text-muted-foreground">Emissão: {displayDate(document.document_date)}</p>}
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
