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
import type { Order } from '@/hooks/useOrders';
import type { OperationalDestination, OrderDocument, OrderSeparation, SeparationStatus } from '@/hooks/useOrderSeparation';

const COLUMNS: Array<{ status: SeparationStatus; title: string; color: string }> = [
  { status: 'todo', title: 'A FAZER', color: 'border-red-500/40 bg-red-500/5' },
  { status: 'preparing', title: 'EM PREPARAÇÃO', color: 'border-amber-500/40 bg-amber-500/5' },
  { status: 'finalized', title: 'FINALIZADO', color: 'border-emerald-500/40 bg-emerald-500/5' },
];

const DESTINATIONS: Record<OperationalDestination, string> = {
  academia_ponto_logistico: 'ACADEMIA / PONTO LOGÍSTICO',
  retirada_fabrica: 'RETIRADA NA FÁBRICA',
  uber: 'UBER / ENTREGA',
  outro: 'OUTRO',
};

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
    group.variants.push({ name: item.variant?.variant_name ?? 'Sem variação', quantity: item.quantity });
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
  onAttachDocument: (input: Omit<OrderDocument, 'id'>) => Promise<void>;
}

export function OrderSeparationBoard({ orders, separationByOrderId, documentsByOrderId, onPrint, onFinalize, onSetDestination, onAttachDocument }: Props) {
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [documentOrder, setDocumentOrder] = useState<Order | null>(null);
  const [documentUrl, setDocumentUrl] = useState('');
  const [documentType, setDocumentType] = useState<OrderDocument['document_type']>('other');
  const operationalOrders = useMemo(() => orders.filter(order => !['cancelado', 'concluido'].includes(order.status)), [orders]);

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
            const latestDocument = documents[0];
            const busy = busyOrderId === order.id;
            const itemGroups = groupedItems(order);
            return <Card key={order.id} className="bg-background"><CardContent className="space-y-3 p-3">
              <div className="flex items-start justify-between gap-2"><div><p className="font-semibold leading-tight">{order.customer_name ?? 'Cliente não informado'}</p><p className="mt-1 text-xs text-muted-foreground">{order.channel ?? 'Origem não informada'} · {orderReference(order)}</p></div>{documents.length > 0 && <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" /> Documento</Badge>}</div>
              <div className="space-y-2">{itemGroups.length > 0 ? itemGroups.map(group => <div key={group.name} className="text-sm"><p className="font-medium">{group.name}</p>{group.variants.map((variant, index) => <div key={`${variant.name}-${index}`} className="flex items-baseline justify-between gap-3 pl-2 text-xs text-muted-foreground"><span>{variant.name}</span><span className="shrink-0 text-sm font-bold text-foreground">{variant.quantity}x</span></div>)}</div>) : <p className="text-sm text-muted-foreground">Sem itens</p>}</div>
              <div className="space-y-1 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs"><div className="flex items-center gap-1 font-medium"><MapPin className="h-3.5 w-3.5" />{separation?.operational_destination ? DESTINATIONS[separation.operational_destination] : 'Destino operacional a definir'}</div><div className="flex items-center gap-1 text-muted-foreground"><Truck className="h-3.5 w-3.5" />{separation?.logistics_mode || 'Modalidade não informada'}</div>{relevantDate(order) && <div className="text-muted-foreground">Prazo: {new Date(`${relevantDate(order)}T00:00:00`).toLocaleDateString('pt-BR')}</div>}</div>
              {column.status !== 'finalized' && <Select value={separation?.operational_destination ?? ''} onValueChange={value => void run(order.id, () => onSetDestination(order.id, value as OperationalDestination))}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Definir destino" /></SelectTrigger><SelectContent>{Object.entries(DESTINATIONS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>}
              {column.status === 'todo' && <div className="flex gap-2"><Button className="flex-1" size="sm" disabled={busy} onClick={() => void run(order.id, async () => { await onPrint(order, latestDocument); })}><Printer className="mr-1 h-4 w-4" />IMPRIMIR</Button><Button variant="outline" size="icon" aria-label="Anexar documento" onClick={() => setDocumentOrder(order)}><Upload className="h-4 w-4" /></Button></div>}
              {column.status === 'preparing' && <div className="flex gap-2"><Button className="flex-1" size="sm" disabled={busy} onClick={() => void run(order.id, () => onFinalize(order))}><PackageCheck className="mr-1 h-4 w-4" />FINALIZAR</Button><Button variant="outline" size="icon" aria-label="Anexar documento" onClick={() => setDocumentOrder(order)}><Upload className="h-4 w-4" /></Button></div>}
              {column.status === 'finalized' && <p className="text-xs text-emerald-700">Finalizado em {separation?.finalized_at ? new Date(separation.finalized_at).toLocaleString('pt-BR') : '—'} · Impressões: {separation?.print_count ?? 0}</p>}
            </CardContent></Card>;
          })}{columnOrders.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pedido</p>}</div>
        </section>;
      })}
    </div>
    <Dialog open={Boolean(documentOrder)} onOpenChange={open => !open && setDocumentOrder(null)}><DialogContent><DialogHeader><DialogTitle>Anexar documento do pedido</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Tipo</Label><Select value={documentType} onValueChange={value => setDocumentType(value as OrderDocument['document_type'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="order_pdf">Pedido em PDF</SelectItem><SelectItem value="shipping_label">Etiqueta de envio</SelectItem><SelectItem value="declaration">Declaração</SelectItem><SelectItem value="receipt">Comprovante</SelectItem><SelectItem value="other">Outro</SelectItem></SelectContent></Select></div><div><Label>URL do documento</Label><Input value={documentUrl} onChange={event => setDocumentUrl(event.target.value)} placeholder="https://..." /></div><Button disabled={!documentOrder || !documentUrl.trim() || Boolean(busyOrderId)} onClick={() => { if (!documentOrder) return; const order = documentOrder; void run(order.id, async () => { await onAttachDocument({ order_id: order.id, document_type: documentType, file_url: documentUrl.trim(), file_name: null, source: 'operacoes', created_at: new Date().toISOString(), created_by: null }); setDocumentOrder(null); setDocumentUrl(''); toast.success('Documento anexado ao pedido.'); }); }}>Anexar documento</Button></div></DialogContent></Dialog>
  </div>;
}

export { printOrderSummary };
