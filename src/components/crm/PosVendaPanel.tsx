import { useMemo, useState } from 'react';
import { differenceInDays, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useContacts, Contact } from '@/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ContactOrderHistory } from '@/components/financial/ContactOrderHistory';
import { ContactAvatar } from '@/components/crm/ContactAvatar';
import { openWhatsApp } from '@/lib/whatsapp';
import { prepareExternalWhatsAppDraft } from '@/lib/crm/externalWhatsAppPreparation';
import { toast } from 'sonner';
import {
  Heart, Star, RotateCcw, History, Search, MessageCircle, Gift, Award, Clock,
} from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type BucketKey = '30' | '60' | '90' | 'all';

const TEMPLATES = {
  satisfacao: (name: string) =>
    `Oi ${name.split(' ')[0] || ''}! 😊 Tudo bem? Aqui é da equipe — queremos saber: como foi sua experiência com a sua última compra? Sua opinião nos ajuda muito a melhorar! ⭐`,
  recompra: (name: string) =>
    `Oi ${name.split(' ')[0] || ''}! 👋 Faz um tempinho que não falamos. Preparamos uma condição especial pra você voltar a comprar com a gente. Posso te mandar as novidades?`,
  fidelizacao: (name: string) =>
    `Oi ${name.split(' ')[0] || ''}! 💎 Você é um cliente especial pra gente. Quero te apresentar nosso programa de fidelidade com vantagens exclusivas. Posso te explicar?`,
};

export function PosVendaPanel({ open, onOpenChange }: Props) {
  const { contacts, fetchContacts } = useContacts();
  const [search, setSearch] = useState('');
  const [bucket, setBucket] = useState<BucketKey>('30');
  const [historyContact, setHistoryContact] = useState<Contact | null>(null);

  const customers = useMemo(() => {
    return contacts.filter(c =>
      c.is_active &&
      (c.funnel_status === 'cliente_ativo' || c.funnel_status === 'pos_venda' || c.funnel_status === 'fechado' || c.funnel_status === 'vip' || (c.paid_orders_count ?? 0) > 0)
    );
  }, [contacts]);

  const buckets = useMemo(() => {
    const today = new Date();
    const out = { '30': [] as Contact[], '60': [] as Contact[], '90': [] as Contact[], 'all': [] as Contact[] };
    customers.forEach(c => {
      const dateStr = c.last_purchase_date || c.last_payment_date;
      if (!dateStr) {
        out.all.push(c);
        return;
      }
      const days = differenceInDays(today, parseISO(String(dateStr)));
      if (days >= 90) out['90'].push(c);
      else if (days >= 60) out['60'].push(c);
      else if (days >= 30) out['30'].push(c);
      out.all.push(c);
    });
    // sort by days desc
    const sortFn = (a: Contact, b: Contact) => {
      const da = a.last_purchase_date || a.last_payment_date;
      const db = b.last_purchase_date || b.last_payment_date;
      const ta = da ? parseISO(String(da)).getTime() : 0;
      const tb = db ? parseISO(String(db)).getTime() : 0;
      return ta - tb;
    };
    out['30'].sort(sortFn); out['60'].sort(sortFn); out['90'].sort(sortFn); out.all.sort(sortFn);
    return out;
  }, [customers]);

  const filtered = useMemo(() => {
    const list = buckets[bucket];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.whatsapp?.includes(q)
    );
  }, [buckets, bucket, search]);

  const prepareMessage = (c: Contact, type: 'satisfacao' | 'recompra' | 'fidelizacao') => {
    const phone = c.whatsapp || c.phone || c.mobile;
    if (!phone) {
      toast.error('Contato sem telefone/WhatsApp');
      return;
    }
    const msg = TEMPLATES[type](c.name || '');
    const status = prepareExternalWhatsAppDraft(phone, msg, openWhatsApp);
    if (status === 'blocked') {
      toast.error('Não foi possível abrir o WhatsApp. Confira o telefone e os pop-ups.');
      return;
    }
    // Abrir um rascunho externo não comprova envio nem entrega.
    // Não registrar "survey_sent"/reativação como fato realizado.
    toast.message('Mensagem preparada no WhatsApp. Revise e envie por lá; envio não confirmado no CRM.');
  };

  const markAsPosVenda = async (c: Contact) => {
    await supabase.from('contacts').update({ funnel_status: 'pos_venda' as any }).eq('id', c.id);
    toast.success(`${c.name} movido para Pós-Venda`);
    fetchContacts();
  };

  const renderContact = (c: Contact) => {
    const dateStr = c.last_purchase_date || c.last_payment_date;
    const days = dateStr ? differenceInDays(new Date(), parseISO(String(dateStr))) : null;
    const ltv = Number(c.lifetime_value ?? 0);
    const orders = c.paid_orders_count ?? 0;
    const isVip = c.client_classification === 'vip' || c.funnel_status === 'vip';

    return (
      <Card key={c.id} className="p-3 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <ContactAvatar name={c.name || '?'} photoUrl={c.photo_url} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold truncate">{c.name}</p>
              {isVip && <Badge className="bg-amber-100 text-amber-800 border-amber-300 gap-1"><Award className="h-3 w-3" />VIP</Badge>}
              {days !== null && days >= 90 && <Badge variant="destructive" className="gap-1"><Clock className="h-3 w-3" />{days}d sem comprar</Badge>}
              {days !== null && days >= 60 && days < 90 && <Badge className="bg-orange-100 text-orange-800 border-orange-300 gap-1"><Clock className="h-3 w-3" />{days}d</Badge>}
              {days !== null && days >= 30 && days < 60 && <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 gap-1"><Clock className="h-3 w-3" />{days}d</Badge>}
            </div>
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              {dateStr && <span>Última compra: {format(parseISO(String(dateStr)), 'dd/MM/yyyy', { locale: ptBR })}</span>}
              <span>{orders} {orders === 1 ? 'pedido pago' : 'pedidos pagos'}</span>
              {ltv > 0 && <span className="text-green-700 font-medium">LTV R$ {ltv.toFixed(2)}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => prepareMessage(c, 'satisfacao')}>
            <Star className="h-3.5 w-3.5 text-amber-500" />Satisfação
          </Button>
          <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => prepareMessage(c, 'recompra')}>
            <RotateCcw className="h-3.5 w-3.5 text-blue-600" />Recompra
          </Button>
          <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => prepareMessage(c, 'fidelizacao')}>
            <Gift className="h-3.5 w-3.5 text-pink-600" />Fidelizar
          </Button>
          <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => setHistoryContact(c)}>
            <History className="h-3.5 w-3.5" />Histórico
          </Button>
          {c.funnel_status !== 'pos_venda' && (
            <Button size="sm" variant="ghost" className="gap-1 h-7 text-pink-700" onClick={() => markAsPosVenda(c)}>
              <Heart className="h-3.5 w-3.5" />Mover p/ Pós-Venda
            </Button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-600" />
              Pós-Venda — Fidelização & Recompra
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Tabs value={bucket} onValueChange={(v) => setBucket(v as BucketKey)}>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="30" className="gap-1.5">
                  <span className="hidden sm:inline">Sem comprar há</span> 30d
                  <Badge variant="secondary" className="ml-1">{buckets['30'].length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="60" className="gap-1.5">
                  <span className="hidden sm:inline">há</span> 60d
                  <Badge variant="secondary" className="ml-1">{buckets['60'].length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="90" className="gap-1.5">
                  <span className="hidden sm:inline">há</span> 90d+
                  <Badge variant="destructive" className="ml-1">{buckets['90'].length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="all">
                  Todos
                  <Badge variant="secondary" className="ml-1">{buckets.all.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value={bucket} className="space-y-2 mt-3">
                {filtered.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    Nenhum cliente neste período.
                  </div>
                ) : (
                  filtered.map(renderContact)
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {historyContact && (
        <ContactOrderHistory
          contact={historyContact as any}
          open={!!historyContact}
          onOpenChange={(v) => !v && setHistoryContact(null)}
        />
      )}
    </>
  );
}
