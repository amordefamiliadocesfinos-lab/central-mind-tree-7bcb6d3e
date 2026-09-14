import { useMemo, useState } from 'react';
import { FileText, MapPin, PackageCheck, Printer, Truck, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { isSeparationEligible } from '@/lib/orders/operationalStatus';
import { OPERATIONAL_DESTINATION_LABELS, getOperationalDestinationLabel } from '@/lib/orders/operationalDestination';
import { ORDER_DOCUMENT_TYPE_LABELS, SUPPORTED_ORDER_DOCUMENT_MIME_TYPES } from '@/lib/orders/orderDocuments';
import type { Order } from '@/hooks/useOrders';
import type { OperationalDestination } from '@/lib/orders/operationalDestination';
import type { OrderDocument, OrderSeparation, SeparationStatus } from '@/hooks/useOrderSeparation';

const COLUMNS: Array<{ status: SeparationStatus; title: string; color: string }> = [
  { status: 'todo', title: 'A FAZER', color: 'border-red-500/40 bg-red-500/5' },
  { status: 'preparing', title: 'EM PREPARAÇÃO', color: 'border-amber-500/40 bg-amber-500/5' },
  { status: 'finalized', title: 'FINALIZADO', color: 'border-emerald-500/40 bg-emerald-500/5' },
];

function documentTypeLabel(type: OrderDocument['document_type']) {
  return ORDER_DOCUMENT_TYPE_LABELS[type] ?? 'Outro';
}

function relevantDate(order: Order) {
  return order.delivery_date || order.due_date || null;
}

function orderReference(order: Order) {
  return order.internal_order_number || order.order_number || order.id.slice(0, 8);
}

function groupedItems(order: Order) {
  const groups = new Map<string, { name: string; variants: Array<{ name: string; quantity: number }> }>();
  for (const item of order.items ?? []) {
    const name = item.product?.name ?? 'Produto';
    const key = item.product_id || name;
    const group = groups.get(key) ?? { name, variants: [] };
    group.variants.push({ name: item.variant_id ? item.variant?.variant_name ?? 'Variante física' : 'Produto simples', quantity: item.quantity });
    groups.set(key, group);
  }
  return [...groups.values()];
}

function printOrderSummary(order: Order) {
  const lines = (order.items ?? []).map(item => `${item.quantity}x ${item.product?.name ?? 'Produto'}${item.variant?.variant_name ? ` — ${item.variant.variant_name}` : ''}`);
  const page = window.open('', '_blank');
  if (!page) return;
  page.opener = null;
  page.document.write(`<title>Pedido ${orderReference(order)}</title><main><h1>Pedido ${orderReference(order)}</h1><p>Cliente: ${order.customer_name ?? 'Não informado'}</p><p>Canal: ${order.channel ?? 'Não informado'}</p><h2>Itens</h2><ul>${lines.map(line => `<li>${line}</li>`).join('')}</ul></main>`);
  page.document.close();
  page.focus();
  page.print();
}

interface Props {
  orders: Order[];
  separationByOrderId: Map<string, OrderSeparation>;
  documentsByOrderId: Map<string, OrderDocument[]>;
  onPrint: (order: Order, document?: OrderDocument) => Promise<void>;
  onFinalize: (order: Order) => Promise<void>;
  onSetDestination: (orderId: string, destination: OperationalDestination) => Promise<void>;
  onAttachDocument: (input: { orderId: string; documentType: OrderDocument['document_type']; file: File }) => Promise<void>;
}

export function OrderSeparationBoard({ orders, separationByOrderId, documentsByOrderId, onPrint, onFinalize, onSetDestination, onAttachDocument }: Props) {
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [documentOrder, setDocumentOrder] = useState<Order | null>(null);
  const [documentType, setDocumentType] = useState<OrderDocument['document_type']>('other');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [printSelectionOrder, setPrintSelectionOrder] = useState<Order | null>(null);
  const operationalOrders = useMemo(() => orders.filter(isSeparationEligible), [orders]);

  const resetDocumentDialog = () => {
    setDocumentOrder(null);
    setDocumentFile(null);
    setDocumentType('other');
  };

  const selectDocumentFile = (file: File | null) => {
    if (!file) {
      setDocumentFile(null);
      return;
    }
    if (!SUPPORTED_ORDER_DOCUMENT_MIME_TYPES.includes(file.type as typeof SUPPORTED_ORDER_DOCUMENT_MIME_TYPES[number])) {
      toast.error('Selecione um arquivo PDF, JPG, PNG ou WebP.');
      return;
    }
    setDocumentFile(file);
  };

  const requestPrint = (order: Order, documents: OrderDocument[]) => {
    if (documents.length > 1) {
      setPrintSelectionOrder(order);
      return;
    }
    void run(order.id, () => onPrint(order, documents[0]));
  };

  const run = async (orderId: string, action: () => Promise<void>) => {
    setBusyOrderId(orderId);
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível concluir esta operação.';
      toast.error(/estoque|insuficiente/i.test(message)
        ? `Separação não finalizada: ${message}`
        : message);
    } finally {
      setBusyOrderId(null);
    }
  };

  return <div className="space-y-4">
    <div>
      <h2 className="text-lg font-semibold">Central de Separação</h2>
      <p className="text-sm text-muted-foreground">A finalização encerra somente a responsabilidade física da separação — não conclui o pedido.</p>
    </div>
    <div className="grid gap-3 xl:grid-cols-3">
      {COLUMNS.map(column => {
        const columnOrders = operationalOrders.filter(order => (separationByOrderId.get(order.id)?.separation_status ?? 'todo') === column.status);
        return <section key={column.status} className={cn('rounded-xl border p-3 min-h-48', column.color)}>
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-sm">{column.title}</h3><Badge variant="secondary">{columnOrders.length}</Badge></div>
          <div className="space-y-3">{columnOrders.map(order => {
            const separation = separationByOrderId.get(order.id);
            const documents = documentsByOrderId.get(order.id) ?? [];
            const busy = busyOrderId === order.id;
            const itemGroups = groupedItems(order);
            return <Card key={order.id} className="bg-background"><CardContent className="space-y-3 p-3">
              <div className="flex items-start justify-between gap-2"><div><p className="font-semibold leading-tight">{order.customer_name ?? 'Cliente não informado'}</p><p className="mt-1 text-xs text-muted-foreground">{order.channel ?? 'Origem não informada'} · {orderReference(order)}</p></div>{documents.length > 0 && <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" /> Documento</Badge>}</div>
              <div className="space-y-2">{itemGroups.length > 0 ? itemGroups.map(group => <div key={group.name} className="text-sm"><p className="font-medium">{group.name}</p>{group.variants.map((variant, index) => <div key={`${variant.name}-${index}`} className="flex items-baseline justify-between gap-3 pl-2 text-xs text-muted-foreground"><span>{variant.name}</span><span className="shrink-0 text-sm font-bold text-foreground">{variant.quantity}x</span></div>)}</div>) : <p className="text-sm text-muted-foreground">Sem itens</p>}</div>
              <div className="space-y-1 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs"><div className="flex items-center gap-1 font-medium"><MapPin className="h-3.5 w-3.5" />{getOperationalDestinationLabel(order.operational_destination) ?? 'Destino operacional a definir'}</div><div className="flex items-center gap-1 text-muted-foreground"><Truck className="h-3.5 w-3.5" />{order.logistics_mode || 'Modalidade não informada'}</div>{relevantDate(order) && <div className="text-muted-foreground">Prazo: {new Date(`${relevantDate(order)}T00:00:00`).toLocaleDateString('pt-BR')}</div>}</div>
              {column.status !== 'finalized' && <Select value={order.operational_destination ?? ''} onValueChange={value => void run(order.id, () => onSetDestination(order.id, value as OperationalDestination))}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Definir destino" /></SelectTrigger><SelectContent>{Object.entries(OPERATIONAL_DESTINATION_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>}
              {documents.length > 0 && <div className="space-y-1 rounded-md border p-2"><p className="text-xs font-medium">Documentos anexados</p>{documents.map(document => <div key={document.id} className="flex items-center justify-between gap-2 text-xs"><span className="min-w-0 truncate">{documentTypeLabel(document.document_type)} · {document.file_name ?? 'Documento'}{document.created_at ? ` · ${new Date(document.created_at).toLocaleDateString('pt-BR')}` : ''}</span><Button variant="link" className="h-auto p-0 text-xs" disabled={busy} onClick={() => void run(order.id, () => onPrint(order, document))}>Abrir / Imprimir</Button></div>)}</div>}
              {column.status === 'todo' && <div className="flex gap-2"><Button className="flex-1" size="sm" disabled={busy} onClick={() => requestPrint(order, documents)}><Printer className="mr-1 h-4 w-4" />IMPRIMIR</Button><Button variant="outline" size="icon" aria-label="Anexar documento" disabled={busy} onClick={() => setDocumentOrder(order)}><Upload className="h-4 w-4" /></Button></div>}
              {column.status === 'preparing' && <div className="flex gap-2"><Button variant="outline" className="flex-1" size="sm" disabled={busy} onClick={() => requestPrint(order, documents)}><Printer className="mr-1 h-4 w-4" />IMPRIMIR</Button><Button className="flex-1" size="sm" disabled={busy} onClick={() => void run(order.id, () => onFinalize(order))}><PackageCheck className="mr-1 h-4 w-4" />FINALIZAR</Button><Button variant="outline" size="icon" aria-label="Anexar documento" disabled={busy} onClick={() => setDocumentOrder(order)}><Upload className="h-4 w-4" /></Button></div>}
              {column.status === 'finalized' && <div className="space-y-2"><p className="text-xs text-emerald-700">Finalizado em {separation?.finalized_at ? new Date(separation.finalized_at).toLocaleString('pt-BR') : '—'} · Impressões: {separation?.print_count ?? 0}</p><div className="flex gap-2"><Button variant="outline" className="flex-1" size="sm" disabled={busy} onClick={() => requestPrint(order, documents)}><Printer className="mr-1 h-4 w-4" />REIMPRIMIR</Button><Button variant="outline" size="icon" aria-label="Anexar documento" disabled={busy} onClick={() => setDocumentOrder(order)}><Upload className="h-4 w-4" /></Button></div></div>}
            </CardContent></Card>;
          })}{columnOrders.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pedido</p>}</div>
        </section>;
      })}
    </div>
    <Dialog open={Boolean(documentOrder)} onOpenChange={open => !open && resetDocumentDialog()}><DialogContent><DialogHeader><DialogTitle>Anexar documento do pedido</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Tipo do documento</Label><Select value={documentType} onValueChange={value => setDocumentType(value as OrderDocument['document_type'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="order_pdf">Pedido em PDF</SelectItem><SelectItem value="shipping_label">Etiqueta de envio</SelectItem><SelectItem value="invoice">Nota fiscal</SelectItem><SelectItem value="declaration">Declaração</SelectItem><SelectItem value="receipt">Comprovante</SelectItem><SelectItem value="other">Outro</SelectItem></SelectContent></Select></div><div className="space-y-2" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); selectDocumentFile(event.dataTransfer.files?.[0] ?? null); }}><Label htmlFor="order-document-file">Arquivo</Label><Input id="order-document-file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event => selectDocumentFile(event.target.files?.[0] ?? null)} /><p className="text-xs text-muted-foreground">Selecione ou arraste um PDF, JPG, PNG ou WebP. {documentFile ? `Selecionado: ${documentFile.name}` : ''}</p></div><div className="flex gap-2"><Button variant="outline" onClick={resetDocumentDialog}>Cancelar</Button><Button disabled={!documentOrder || !documentFile || Boolean(busyOrderId)} onClick={() => { if (!documentOrder || !documentFile) return; const order = documentOrder; const file = documentFile; void run(order.id, async () => { await onAttachDocument({ orderId: order.id, documentType, file }); resetDocumentDialog(); toast.success('Documento anexado ao pedido.'); }); }}>Anexar documento</Button></div></div></DialogContent></Dialog>
    <Dialog open={Boolean(printSelectionOrder)} onOpenChange={open => !open && setPrintSelectionOrder(null)}><DialogContent><DialogHeader><DialogTitle>Escolha o documento para imprimir</DialogTitle></DialogHeader><div className="space-y-2">{printSelectionOrder && (documentsByOrderId.get(printSelectionOrder.id) ?? []).map(document => <Button key={document.id} variant="outline" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => { const order = printSelectionOrder; setPrintSelectionOrder(null); void run(order.id, () => onPrint(order, document)); }}><FileText className="mr-2 h-4 w-4 shrink-0" />{documentTypeLabel(document.document_type)} · {document.file_name ?? 'Documento'}</Button>)}</div></DialogContent></Dialog>
  </div>;
}

export { printOrderSummary };
