import { useEffect, useMemo, useState } from 'react';
import { MonetaryIntegrityPanel } from './MonetaryIntegrityPanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SALES_CHANNELS, channelNeedsAccount } from '@/lib/salesChannels';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; onChanged?: () => void }
interface OrderRow { id: string; order_number: string | null; customer_name: string | null; contact_id: string | null; total_value: number | null; due_date: string | null; financial_due_date?: string | null; channel?: string | null; marketplace_account?: string | null }
interface EntryRow { id: string; order_id: string | null; value: number; value_paid: number; description?: string; payment_date?: string | null; sales_channel?: string | null; marketplace_account?: string | null }

export function FinancialIntegrityDialog({ open, onOpenChange, onChanged }: Props) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [shopeeCategories, setShopeeCategories] = useState<any[]>([]);
  const [shopeeContacts, setShopeeContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState<string | null>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [linkingOrder, setLinkingOrder] = useState<OrderRow | null>(null);
  const [entryId, setEntryId] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [channelAccount, setChannelAccount] = useState('');

  const load = async () => {
    setLoading(true);
    const [ordersRes, entriesRes, linksRes, categoriesRes, contactsRes] = await Promise.all([
      supabase.from('orders').select('id,order_number,customer_name,contact_id,total_value,due_date,financial_due_date,channel,marketplace_account').is('deleted_at', null),
      supabase.from('financial_entries').select('id,order_id,value,value_paid,description,payment_date,sales_channel,marketplace_account').eq('type', 'receber'),
      (supabase.from as any)('financial_order_links').select('order_id,financial_entry_id,allocated_value'),
      supabase.from('financial_categories').select('id,name,type,is_active').ilike('name', '%shopee%'),
      supabase.from('contacts').select('id,name,type,is_active').ilike('name', '%shopee%'),
    ]);
    setOrders((ordersRes.data as any) || []); setEntries((entriesRes.data as any) || []);
    setLinks((linksRes.data as any) || []);
    setShopeeCategories(categoriesRes.data || []); setShopeeContacts(contactsRes.data || []);
    setLoading(false);
  };
  useEffect(() => { if (open) load(); }, [open]);

  const byOrder = useMemo(() => new Map(entries.map(e => [e.order_id, e])), [entries]);
  const linkedOrders = useMemo(() => new Set(links.map(link => link.order_id)), [links]);
  const missing = orders.filter(o => Number(o.total_value) > 0 && !byOrder.has(o.id) && !linkedOrders.has(o.id));
  const divergent = orders.filter(o => {
    const e = byOrder.get(o.id); return e && Math.abs(Number(o.total_value) - Number(e.value)) > .01;
  });

  const createReceivable = async (order: OrderRow) => {
    setFixing(order.id);
    try {
      const { data: category } = await supabase.from('financial_categories').select('id')
        .eq('is_active', true).in('type', ['receber', 'ambos']).in('name', ['Venda de produtos', 'Vendas']).limit(1).maybeSingle();
      const due = order.financial_due_date || order.due_date || new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from('financial_entries').insert({
        type: 'receber', description: `Pedido ${order.order_number || order.id.slice(0, 8)} - ${order.customer_name || 'Cliente'}`,
        value: Number(order.total_value), due_date: due, original_due_date: due,
        order_id: order.id, contact_id: order.contact_id, category_id: category?.id || null,
        notes: 'Regularizado manualmente pela revisão de integração',
      } as any);
      if (error) throw error;
      toast.success('Conta a receber vinculada ao pedido.'); await load(); onChanged?.();
    } catch (e: any) { toast.error(e?.message || 'Não foi possível regularizar.'); }
    finally { setFixing(null); }
  };

  const availableEntries = useMemo(() => entries
    .filter(entry => !entry.order_id)
    .map(entry => ({ ...entry, available: Number(entry.value) - links.filter(link => link.financial_entry_id === entry.id).reduce((sum, link) => sum + Number(link.allocated_value), 0) }))
    .filter(entry => entry.available > 0.009)
    .sort((a, b) => Math.abs(a.available - Number(linkingOrder?.total_value || 0)) - Math.abs(b.available - Number(linkingOrder?.total_value || 0))), [entries, links, linkingOrder]);

  const openLink = (order: OrderRow) => {
    setLinkingOrder(order); setEntryId('');
    setChannel(order.channel === 'marketplace' ? 'shopee' : order.channel || 'whatsapp');
    setChannelAccount(order.marketplace_account || '');
  };

  const linkExisting = async () => {
    if (!linkingOrder || !entryId) return toast.error('Selecione a entrada bancária.');
    if (channelNeedsAccount(channel) && !channelAccount.trim()) return toast.error('Informe qual conta/loja recebeu a venda.');
    setFixing(linkingOrder.id);
    const { error } = await (supabase.rpc as any)('link_order_to_existing_financial_entry', {
      p_order_id: linkingOrder.id, p_entry_id: entryId, p_allocated_value: Number(linkingOrder.total_value),
      p_sales_channel: channel, p_marketplace_account: channelAccount.trim() || null,
    });
    setFixing(null);
    if (error) return toast.error(error.message);
    toast.success('Pedido vinculado à entrada existente sem duplicar a receita.');
    setLinkingOrder(null); await load(); onChanged?.();
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-4xl max-h-[90vh]">
      <DialogHeader><DialogTitle>Revisão de integração financeira</DialogTitle></DialogHeader>
      <Tabs defaultValue="pedidos">
        <TabsList><TabsTrigger value="pedidos">Pedidos</TabsTrigger><TabsTrigger value="cadastros">Shopee e cadastros</TabsTrigger><TabsTrigger value="monetaria">Integridade monetária</TabsTrigger></TabsList>
        <TabsContent value="monetaria"><MonetaryIntegrityPanel /></TabsContent>
        <TabsContent value="pedidos" className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Sem financeiro</div><div className="text-xl font-bold text-amber-600">{missing.length}</div></div>
            <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Valor divergente</div><div className="text-xl font-bold text-red-600">{divergent.length}</div></div>
          </div>
          <p className="text-xs text-muted-foreground">Nenhum registro é criado automaticamente. Confirme cada pedido após verificar se ele já foi recebido por outro lançamento.</p>
          <ScrollArea className="h-[420px] rounded-md border">
            {loading ? <div className="p-8 text-center"><Loader2 className="mx-auto animate-spin" /></div> : missing.map(order => <div key={order.id} className="flex items-center gap-3 border-b p-3">
              <AlertTriangle className="h-4 w-4 text-amber-500" /><div className="min-w-0 flex-1"><div className="font-medium">{order.order_number} · {order.customer_name}</div><div className="text-xs text-muted-foreground">{formatCurrency(Number(order.total_value))} · sem conta a receber vinculada</div></div>
              <div className="flex gap-2"><Button size="sm" onClick={() => openLink(order)}>Vincular entrada</Button><Button size="sm" variant="outline" disabled={fixing === order.id} onClick={() => createReceivable(order)}>{fixing === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerar a receber'}</Button></div>
            </div>)}
            {!loading && !missing.length && <div className="p-8 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 text-emerald-500" />Todos os pedidos com valor possuem financeiro.</div>}
          </ScrollArea>
        </TabsContent>
        <TabsContent value="cadastros" className="space-y-4">
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/20">Use “Shopee Marketplace” como contato institucional e “Venda de produtos” como categoria. Conta/responsável (Viviane, Adão etc.) deve ficar em Conta do marketplace, não no nome da categoria.</div>
          <div><h3 className="mb-2 text-sm font-semibold">Categorias Shopee para consolidar ({shopeeCategories.length})</h3><div className="flex flex-wrap gap-2">{shopeeCategories.map(c => <Badge key={c.id} variant="outline">{c.name}</Badge>)}</div></div>
          <div><h3 className="mb-2 text-sm font-semibold">Contatos Shopee para revisar ({shopeeContacts.length})</h3><div className="flex flex-wrap gap-2">{shopeeContacts.map(c => <Badge key={c.id} variant="outline">{c.name} · {c.type}</Badge>)}</div></div>
          <p className="text-xs text-muted-foreground">Esta tela não apaga o histórico. A consolidação será feita depois, com substituição dos vínculos e confirmação do usuário.</p>
        </TabsContent>
      </Tabs>
      <Dialog open={!!linkingOrder} onOpenChange={open => !open && setLinkingOrder(null)}>
        <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Vincular recebimento existente</DialogTitle></DialogHeader>
          <div className="rounded-md bg-muted p-3 text-sm"><strong>{linkingOrder?.order_number}</strong> · {formatCurrency(Number(linkingOrder?.total_value || 0))}<br/><span className="text-muted-foreground">Não cria outra receita. Apenas relaciona o pedido à entrada importada.</span></div>
          <div className="space-y-2"><Label>Entrada bancária</Label><Select value={entryId} onValueChange={setEntryId}><SelectTrigger><SelectValue placeholder="Selecione pela descrição e valor" /></SelectTrigger><SelectContent>{availableEntries.map(entry => <SelectItem key={entry.id} value={entry.id}>{entry.description} · disponível {formatCurrency(entry.available)}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Canal</Label><Select value={channel} onValueChange={setChannel}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SALES_CHANNELS.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Conta do canal</Label><Input value={channelAccount} onChange={e => setChannelAccount(e.target.value)} placeholder="Ex.: Shopee Viviane" /></div></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setLinkingOrder(null)}>Cancelar</Button><Button onClick={linkExisting} disabled={!!fixing}>{fixing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar vínculo</Button></div>
        </DialogContent>
      </Dialog>
    </DialogContent>
  </Dialog>;
}
