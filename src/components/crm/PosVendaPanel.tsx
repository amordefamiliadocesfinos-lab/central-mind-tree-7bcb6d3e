import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useContacts, type Contact } from '@/hooks/useContacts';
import { evaluatePostSalePanelOutreach } from '@/lib/crm/postSalePanelOutreach';
import { loadPostSalePanelLifecycleInsight, type PostSalePanelLifecycleInsight } from '@/lib/crm/postSalePanelLifecycle';
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
type InsightStatus =
  | { state: 'loading' }
  | { state: 'ready'; insight: PostSalePanelLifecycleInsight }
  | { state: 'error' };
const PAGE_SIZE = 8;

const TEMPLATES = {
  satisfacao: (name: string) =>
    `Oi ${name.split(' ')[0] || ''}! 😊 Tudo bem? Aqui é da equipe — queremos saber: como foi sua experiência com a sua última compra? Sua opinião nos ajuda muito a melhorar! ⭐`,
  recompra: (name: string) =>
    `Oi ${name.split(' ')[0] || ''}! 👋 Tudo bem? Gostaria de saber se você precisa repor algum produto ou receber novidades da Amor de Família. Posso te contar?`,
  fidelizacao: (name: string) =>
    `Oi ${name.split(' ')[0] || ''}! 💎 Obrigado por comprar com a Amor de Família! Gostaria de saber como podemos te atender melhor e compartilhar nossas novidades. Posso te enviar?`,
};

export function PosVendaPanel({ open, onOpenChange }: Props) {
  const { contacts } = useContacts();
  const navigate = useNavigate();
  const [preparingContactId, setPreparingContactId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [bucket, setBucket] = useState<BucketKey>('30');
  const [historyContact, setHistoryContact] = useState<Contact | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [insights, setInsights] = useState<Record<string, InsightStatus>>({});
  const analyzingIds = useRef(new Set<string>());
  const analysisEpoch = useRef(0);

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

  // A leitura dos sinais é progressiva. Evita consultar milhares de fatos do
  // CRM simultaneamente e não inicializa a memória interpretativa do Assistente.
  const visibleCustomers = useMemo(
    () => filtered.slice(0, visibleCount), [filtered, visibleCount],
  );
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [bucket, search]);
  useEffect(() => {
    if (!open) return;
    const epoch = analysisEpoch.current;
    const pending = visibleCustomers.filter(c =>
      !insights[c.id] && !analyzingIds.current.has(c.id));
    if (pending.length === 0) return;

    for (const c of pending) analyzingIds.current.add(c.id);
    setInsights(prev => ({
      ...prev,
      ...Object.fromEntries(pending.map(c => [c.id, { state: 'loading' as const }])),
    }));

    let next = 0;
    async function worker() {
      while (epoch === analysisEpoch.current && next < pending.length) {
        const contactId = pending[next++].id;
        try {
          const insight = await loadPostSalePanelLifecycleInsight(contactId);
          if (epoch === analysisEpoch.current) setInsights(prev => ({
            ...prev, [contactId]: { state: 'ready', insight },
          }));
        } catch {
          if (epoch === analysisEpoch.current) setInsights(prev => ({
            ...prev, [contactId]: { state: 'error' },
          }));
        } finally {
          if (epoch === analysisEpoch.current) analyzingIds.current.delete(contactId);
        }
      }
    }
    void Promise.all(Array.from({ length: Math.min(2, pending.length) }, () => worker()));
    // Mudanças de aba não descartam as consultas já iniciadas. Fechar o painel
    // invalida a geração anterior para impedir retorno obsoleto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visibleCustomers]);
  useEffect(() => {
    if (!open) {
      analysisEpoch.current += 1;
      analyzingIds.current.clear();
      setInsights({});
    }
  }, [open]);

  const prepareMessage = async (c: Contact, type: 'satisfacao' | 'recompra' | 'fidelizacao') => {
    if (preparingContactId) return;
    setPreparingContactId(c.id);
    try {
      // Mesmo rascunho externo exige opt-out ATUAL e ausência de pendência na Inbox.
      // Não usamos o snapshot em lista como autorização.
      const [{ data: freshContact, error: contactError }, { data: conversations, error: conversationError }] = await Promise.all([
        supabase.from('contacts').select('id,is_active,commercial_opt_out').eq('id', c.id).maybeSingle(),
        supabase.from('service_conversations')
          .select('status,attendance_state,needs_reply,last_inbound_at,last_outbound_at')
          .eq('contact_id', c.id)
          .eq('status', 'open')
          .limit(100),
      ]);
      if (contactError || conversationError) {
        toast.error('Não foi possível verificar as restrições do contato. Tente novamente ou abra a Inbox.');
        return;
      }
      const decision = evaluatePostSalePanelOutreach(
        freshContact ? {
          isActive: freshContact.is_active === true,
          commercialOptOut: freshContact.commercial_opt_out === true,
        } : null,
        (conversations ?? []).map(conversation => ({
          status: conversation.status ?? null,
          attendanceState: conversation.attendance_state ?? null,
          needsReply: conversation.needs_reply === true,
          lastInboundAt: conversation.last_inbound_at ?? null,
          lastOutboundAt: conversation.last_outbound_at ?? null,
        })),
      );
      if (!decision.allowed) {
        toast.message(decision.reason);
        return;
      }
      const phone = c.whatsapp || c.phone || c.mobile;
      if (!phone) {
        toast.error('Contato sem telefone/WhatsApp');
        return;
      }
      const status = prepareExternalWhatsAppDraft(phone, TEMPLATES[type](c.name || ''), openWhatsApp);
      if (status === 'blocked') {
        toast.error('Não foi possível abrir o WhatsApp. Confira o telefone e os pop-ups.');
        return;
      }
      // Abrir um rascunho externo não comprova envio nem entrega.
      // Não registra Resultado, reativação, pesquisa respondida ou campanha enviada.
      toast.message('Rascunho aberto no WhatsApp. Revise e envie por lá; envio não confirmado no CRM.');
    } catch {
      toast.error('Não foi possível verificar a segurança da abordagem. Abra a Inbox do contato.');
    } finally {
      setPreparingContactId(null);
    }
  };

  const openInInbox = (c: Contact) => {
    onOpenChange(false);
    navigate(`/contatos/inbox?contact=${encodeURIComponent(c.id)}&attend=1`);
  };

  const renderContact = (c: Contact) => {
    const dateStr = c.last_purchase_date || c.last_payment_date;
    const days = dateStr ? differenceInDays(new Date(), parseISO(String(dateStr))) : null;
    const ltv = Number(c.lifetime_value ?? 0);
    const orders = c.paid_orders_count ?? 0;
    const isVip = c.client_classification === 'vip' || c.funnel_status === 'vip';
    const signal = insights[c.id];
    const insight = signal?.state === 'ready' ? signal.insight : null;
    const kind = insight?.opportunity.kind ?? 'none';
    const isRestricted = Boolean(insight?.restricted || c.commercial_opt_out);

    return (
      <Card key={c.id} className="p-3 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <ContactAvatar name={c.name || '?'} photoUrl={c.photo_url} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold truncate">{c.name}</p>
              {isVip && <Badge className="bg-amber-100 text-amber-800 border-amber-300 gap-1"><Award className="h-3 w-3" />VIP</Badge>}
              {days !== null && days >= 90 && <Badge variant="destructive" className="gap-1"><Clock className="h-3 w-3" />{days}d sem comprar</Badge>}
              {isRestricted && <Badge variant="outline">Contato restrito</Badge>}
              {signal?.state === 'loading' && <Badge variant="outline">Analisando fatos...</Badge>}
              {signal?.state === 'error' && <Badge variant="outline">Sinal indisponível</Badge>}
              {insight && kind === 'post_sale' && <Badge variant="secondary">Pós-venda elegível</Badge>}
              {insight && kind === 'repurchase' && (
                <Badge variant="secondary">{insight.opportunity.repurchase?.status === 'explicit'
                  ? 'Recompra solicitada' : 'Recompra provável'}</Badge>
              )}
              {insight && kind === 'none' && <Badge variant="outline">Sem oportunidade comprovada</Badge>}
              {days !== null && days >= 60 && days < 90 && <Badge className="bg-orange-100 text-orange-800 border-orange-300 gap-1"><Clock className="h-3 w-3" />{days}d</Badge>}
              {days !== null && days >= 30 && days < 60 && <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 gap-1"><Clock className="h-3 w-3" />{days}d</Badge>}
            </div>
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              {dateStr && <span>Última compra: {format(parseISO(String(dateStr)), 'dd/MM/yyyy', { locale: ptBR })}</span>}
              <span>{orders} {orders === 1 ? 'pedido pago' : 'pedidos pagos'}</span>
              {ltv > 0 && <span className="text-green-700 font-medium">LTV R$ {ltv.toFixed(2)}</span>}
            </div>
            {insight && (
              <p className="mt-1 text-xs text-muted-foreground">
                {insight.opportunity.reason}
                {isRestricted ? ' · Abordagem comercial não autorizada enquanto houver opt-out.' : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Button size="sm" variant="outline" className="gap-1 h-7" disabled={preparingContactId !== null} onClick={() => void prepareMessage(c, 'satisfacao')}>
            <Star className="h-3.5 w-3.5 text-amber-500" />Satisfação
          </Button>
          <Button size="sm" variant="outline" className="gap-1 h-7" disabled={preparingContactId !== null} onClick={() => void prepareMessage(c, 'recompra')}>
            <RotateCcw className="h-3.5 w-3.5 text-blue-600" />Recompra
          </Button>
          <Button size="sm" variant="outline" className="gap-1 h-7" disabled={preparingContactId !== null} onClick={() => void prepareMessage(c, 'fidelizacao')}>
            <Gift className="h-3.5 w-3.5 text-pink-600" />Fidelizar
          </Button>
          <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => setHistoryContact(c)}>
            <History className="h-3.5 w-3.5" />Histórico
          </Button>
          <Button size="sm" variant="ghost" className="gap-1 h-7 text-pink-700" onClick={() => openInInbox(c)}>
            <MessageCircle className="h-3.5 w-3.5" />Atender na Inbox
          </Button>
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

            <p className="text-xs text-muted-foreground">
              Tempo sem comprar não é confirmação de recompra. Os sinais abaixo seguem as
              regras do Assistente CRM, apenas para consulta; atendimentos continuam na Inbox.
            </p>
            <Tabs value={bucket} onValueChange={(v) => setBucket(v as BucketKey)}>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="30" className="gap-1.5">
                  <span className="hidden sm:inline">Sem comprar</span> 30–59d
                  <Badge variant="secondary" className="ml-1">{buckets['30'].length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="60" className="gap-1.5">
                  <span className="hidden sm:inline">Sem comprar</span> 60–89d
                  <Badge variant="secondary" className="ml-1">{buckets['60'].length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="90" className="gap-1.5">
                  <span className="hidden sm:inline">Sem comprar</span> 90d+
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
                  <>
                    {visibleCustomers.map(renderContact)}
                    {filtered.length > visibleCount && (
                      <Button type="button" variant="outline" className="w-full" onClick={() => setVisibleCount(n => n + PAGE_SIZE)}>
                        Mostrar mais {Math.min(PAGE_SIZE, filtered.length - visibleCount)} clientes
                      </Button>
                    )}
                  </>
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
