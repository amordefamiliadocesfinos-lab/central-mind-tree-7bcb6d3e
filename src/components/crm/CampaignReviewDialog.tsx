import { useEffect, useMemo, useRef, useState } from 'react';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, PlayCircle, Send, Loader2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { assessCampaignDispatchEvidence, type CampaignDispatchMessage, type CampaignMessageLookup } from '@/lib/crm/campaignDispatchEvidence';
import { canOfferCrmCampaignFormalReconciliation } from '@/lib/crm/campaignFormalReconciliation';
import { CampaignManualQueue } from './CampaignManualQueue';
import { EXCLUSION_LABELS } from '@/lib/crm/campaignEligibility';
import { countCampaignResponses } from '@/lib/crm/campaignContext';
import { canSafelyRequeueCampaignRecipient, requiresCampaignSendReconciliation, isCampaignDispatchProtocolV2 } from '@/lib/crm/campaignReplaySafety';
import { CrmCampaign, CrmCampaignRecipient, fetchCampaignRecipients, requeueFailedRecipients, sendCampaignViaApi, syncCampaignStatus, useCrmCampaigns } from '@/hooks/useCrmCampaigns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CrmCampaign | null;
}

type StatusFilter = 'all' | 'pending' | 'sent' | 'skipped' | 'failed' | 'excluded';

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'Todos',
  pending: 'Elegíveis',
  sent: 'Enviados',
  skipped: 'Pulados',
  failed: 'Falhas',
  excluded: 'Excluídos',
};

export function CampaignReviewDialog({ open, onOpenChange, campaign }: Props) {
  const { markPrepared, fetchCampaigns } = useCrmCampaigns();
  const [recipients, setRecipients] = useState<(CrmCampaignRecipient & { contact?: { name?: string } })[]>([]);
  const [loading, setLoading] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [confirmApiOpen, setConfirmApiOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [requeuing, setRequeuing] = useState(false);
  // F0-B: estado consultado do runtime real, não inferido do SHA da main.
  const protectionRequestRef = useRef(0);
  const [protection, setProtection] = useState<'unchecked' | 'checking' | 'active' | 'unavailable'>('unchecked');
  const [protectionCampaignId, setProtectionCampaignId] = useState<string | null>(null);
  const [protectionError, setProtectionError] = useState<string | null>(null);
  const checkActiveProtection = async () => {
    if (!campaign || !open) return;
    const campaignId = campaign.id;
    const requestId = ++protectionRequestRef.current;
    setProtectionCampaignId(campaignId);
    setProtection('checking');
    setProtectionError(null);
    try {
      // Preflight autenticado: não cria mensagens nem modifica destinatários.
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: { mode: 'campaign_preflight' },
      });
      if (protectionRequestRef.current !== requestId) return;
      if (error || !isCampaignDispatchProtocolV2(data)) {
        setProtection('unavailable');
        setProtectionError('Não foi possível confirmar a proteção no servidor. Nenhum envio foi realizado.');
      } else {
        setProtection('active');
      }
    } catch {
      if (protectionRequestRef.current !== requestId) return;
      setProtection('unavailable');
      setProtectionError('Falha ao consultar o servidor. Nenhum envio foi realizado.');
    }
  };
  // F0-C: a revisão não altera nenhum recipient e não habilita retransmissão.
  const [evidenceRecipientId, setEvidenceRecipientId] = useState<string | null>(null);
  const [isReconciliationAdmin, setIsReconciliationAdmin] = useState(false);
  const [confirmReconciliationOpen, setConfirmReconciliationOpen] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [evidenceRead, setEvidenceRead] = useState<{
    key: string;
    lookup: CampaignMessageLookup;
    message: CampaignDispatchMessage | null;
  } | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [responses, setResponses] = useState<{ sent: number; responded: number } | null>(null);

  useEffect(() => {
    // O resultado de outra campanha nunca é transportado como verificação.
    protectionRequestRef.current += 1;
    setProtection('unchecked');
    setProtectionCampaignId(null);
    setProtectionError(null);
  }, [open, campaign?.id]);

  useEffect(() => {
    if (!open || !campaign) return;
    setLoading(true);
    fetchCampaignRecipients(campaign.id).then(rows => { setRecipients(rows); setLoading(false); });
    syncCampaignStatus(campaign);
    countCampaignResponses(campaign.id).then(setResponses);
  }, [open, campaign]);

  const reload = () => {
    if (!campaign) return;
    fetchCampaignRecipients(campaign.id).then(setRecipients);
    countCampaignResponses(campaign.id).then(setResponses);
  };

  const { eligible, excluded, reasons, apiCount, manualCount, sent, skipped, failed, retryable, requiresReview } = useMemo(() => {
    const eligible = recipients.filter(r => r.status === 'pending');
    const excluded = recipients.filter(r => r.status === 'excluded');
    const reasons = new Map<string, number>();
    excluded.forEach(r => {
      const key = r.exclusion_reason || 'outros';
      reasons.set(key, (reasons.get(key) || 0) + 1);
    });
    const apiCount = eligible.filter(r => r.delivery_mode === 'api').length;
    const manualCount = eligible.filter(r => r.delivery_mode !== 'api').length;
    const sent = recipients.filter(r => r.status === 'sent');
    const skipped = recipients.filter(r => r.status === 'skipped');
    const failed = recipients.filter(r => r.status === 'failed');
    const retryable = failed.filter(canSafelyRequeueCampaignRecipient);
    const requiresReview = failed.filter(requiresCampaignSendReconciliation);
    return { eligible, excluded, reasons: [...reasons.entries()], apiCount, manualCount, sent, skipped, failed, retryable, requiresReview };
  }, [recipients]);

  const evidenceRecipient = recipients.find(r => r.id === evidenceRecipientId && r.status === 'failed') || null;
  const evidenceKey = campaign && evidenceRecipient
    ? [campaign.id, evidenceRecipient.id, evidenceRecipient.conversation_id ?? '',
      evidenceRecipient.service_message_id ?? ''].join('|')
    : '';

  useEffect(() => {
    setEvidenceRecipientId(null);
    setEvidenceRead(null);
    setConfirmReconciliationOpen(false);
    setIsReconciliationAdmin(false);
    if (!open || !campaign) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data: userResult, error: userError } = await supabase.auth.getUser();
        if (userError || !userResult.user) return;
        const { data, error } = await supabase.from('app_users')
          .select('id')
          .eq('auth_user_id', userResult.user.id)
          .eq('role', 'Administrador')
          .eq('is_active', true)
          .maybeSingle();
        if (!cancelled && !error && data) {
          // A tela não oferece conciliação enquanto a migration da RPC
          // ainda não estiver disponível no Lovable Cloud oficial.
          const { error: schemaError } = await (supabase as any)
            .from('crm_campaign_recipient_reconciliations')
            .select('id', { head: true }).limit(0);
          if (!cancelled && !schemaError) setIsReconciliationAdmin(true);
        }
      } catch {
        // Fail closed: a RPC faz sua própria autorização.
      }
    })();
    return () => { cancelled = true; };
  }, [campaign?.id, open]);

  useEffect(() => {
    setEvidenceRead(null);
    if (!open || !campaign || !evidenceRecipient
      || !evidenceRecipient.service_message_id || !evidenceRecipient.conversation_id) return;
    const key = evidenceKey;
    let cancelled = false;
    setEvidenceRead({ key, lookup: 'loading', message: null });
    void supabase.from('service_messages')
      .select('id,conversation_id,source,direction,content,delivery_status,external_message_id,created_at,provider_name')
      .eq('id', evidenceRecipient.service_message_id)
      .eq('conversation_id', evidenceRecipient.conversation_id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setEvidenceRead({
          key,
          lookup: error ? 'error' : data ? 'found' : 'missing',
          message: error ? null : (data as CampaignDispatchMessage | null),
        });
      });
    return () => { cancelled = true; };
  }, [open, campaign?.id, evidenceRecipient?.id, evidenceRecipient?.service_message_id,
      evidenceRecipient?.conversation_id]);

  const dispatchEvidence = evidenceRecipient
    ? assessCampaignDispatchEvidence({
        recipient: evidenceRecipient,
        lookup: evidenceRead?.key === evidenceKey ? evidenceRead.lookup : 'not_requested',
        message: evidenceRead?.key === evidenceKey ? evidenceRead.message : null,
      })
    : null;
  const mayReconcile = Boolean(evidenceRecipient && dispatchEvidence
    && canOfferCrmCampaignFormalReconciliation({
      isAdmin: isReconciliationAdmin,
      recipient: evidenceRecipient,
      evidence: dispatchEvidence,
    }));
  const confirmFormalReconciliation = async () => {
    if (!campaign || !evidenceRecipient || !dispatchEvidence || reconciling
      || !canOfferCrmCampaignFormalReconciliation({
        isAdmin: isReconciliationAdmin, recipient: evidenceRecipient, evidence: dispatchEvidence,
      })) return;
    setReconciling(true);
    try {
      // O banco revalida TODA a evidência e a autorização na mesma transação.
      const { data, error } = await (supabase as any).rpc('reconcile_crm_campaign_recipient', {
        p_recipient_id: evidenceRecipient.id,
        p_service_message_id: evidenceRecipient.service_message_id,
      });
      if (error || !['reconciled', 'already_reconciled'].includes(data?.status)) {
        throw new Error(error?.message || 'Servidor não confirmou a conciliação.');
      }
      toast.success('Conciliação registrada com auditoria. Nenhuma mensagem foi reenviada.');
      setEvidenceRecipientId(null);
      reload();
      void fetchCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Conciliação indisponível. Nenhum reenvio foi realizado.');
    } finally {
      setConfirmReconciliationOpen(false);
      setReconciling(false);
    }
  };

  const visibleRecipients = useMemo(() => {
    const ordered = [...eligible, ...sent, ...skipped, ...failed, ...excluded];
    return statusFilter === 'all' ? ordered : ordered.filter(r => r.status === statusFilter);
  }, [eligible, sent, skipped, failed, excluded, statusFilter]);

  const responseRate = responses && responses.sent > 0
    ? Math.round((responses.responded / responses.sent) * 100)
    : null;

  if (!campaign) return null;


  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={campaign.name}
      description="Revisão da campanha — nenhum envio é realizado nesta etapa."
      className="sm:max-w-2xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          {apiCount > 0 && ['prepared', 'sending'].includes(campaign.status) && (
            <Button variant="default" disabled={sending || requeuing} onClick={() => setConfirmApiOpen(true)}>
              {sending
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Send className="h-4 w-4 mr-2" />}
              {sending ? `Enviando ${progress.done}/${progress.total}` : `Enviar via API (${apiCount})`}
            </Button>
          )}
          {manualCount > 0 && ['prepared', 'sending'].includes(campaign.status) && (
            <Button variant="secondary" onClick={() => setQueueOpen(true)}>
              <PlayCircle className="h-4 w-4 mr-2" />
              Fila manual ({manualCount})
            </Button>
          )}
          {campaign.status === 'draft' && (
            <Button onClick={async () => { if (await markPrepared(campaign.id)) onOpenChange(false); }}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Marcar como preparada
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Status: {campaign.status}</Badge>
          <Badge variant="outline">
            Proteção API: {protectionCampaignId !== campaign.id || protection === 'unchecked'
              ? 'não verificada' : protection === 'checking'
                ? 'verificando' : protection === 'active' ? 'v2 ativa' : 'não confirmada'}
          </Badge>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
            disabled={protection === 'checking' || sending}
            onClick={() => { void checkActiveProtection(); }}>
            {protection === 'checking' ? 'Verificando…' : 'Verificar proteção no servidor'}
          </Button>
          {protectionError && protectionCampaignId === campaign.id && (
            <span className="text-xs text-destructive">{protectionError}</span>
          )}
          {campaign.segment_filters?.crm_lifecycle_criterion && (
            <Badge variant="outline" className="border-violet-400/60">
              Público inteligente · revalidação exigida na preparação e execução
            </Badge>
          )}
          <Badge variant="outline">Selecionados: {campaign.total_selected}</Badge>
          <Badge variant="outline" className="text-emerald-600 border-emerald-300">Elegíveis: {campaign.total_eligible}</Badge>
          <Badge variant="outline" className="text-destructive border-destructive/40">Excluídos: {campaign.total_excluded}</Badge>
          <Badge variant="outline" className="text-sky-600 border-sky-300">API: {apiCount}</Badge>
          <Badge variant="outline" className="text-amber-600 border-amber-300">Manual: {manualCount}</Badge>
          <Badge variant="outline">Enviados: {sent.length}</Badge>
          <Badge variant="outline">Pulados: {skipped.length}</Badge>
          <Badge variant="outline" className="text-destructive border-destructive/40">Falhas: {failed.length}</Badge>
          {requiresReview.length > 0 && (
            <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">
              Envio a conferir: {requiresReview.length}
            </Badge>
          )}
          <Badge variant="outline" className="text-sky-600 border-sky-300">
            Respostas: {responses ? `${responses.responded}/${responses.sent}` : '—'}
            {responseRate !== null ? ` (${responseRate}%)` : ''}
          </Badge>
        </div>

        {requiresReview.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {requiresReview.length} tentativa(s) com entrega incerta ou sem prova negativa.
            Confira o histórico e o provedor antes de qualquer novo disparo; reenvio automático bloqueado.
          </p>
        )}
        {retryable.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={requeuing || sending}
            onClick={async () => {
              setRequeuing(true);
              try {
                const n = await requeueFailedRecipients(campaign.id);
                toast.success(`${n} falha(s) anteriores ao disparo reenfileiradas; nenhum envio realizado`);
                reload();
                await fetchCampaigns();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Falha ao reenfileirar destinatários.');
              } finally {
                setRequeuing(false);
              }
            }}
          >
            Reenfileirar falhas seguras ({retryable.length})
          </Button>
        )}

        <div className="flex flex-wrap gap-1">
          {(Object.keys(FILTER_LABELS) as StatusFilter[]).map(key => (
            <Button
              key={key}
              size="sm"
              variant={statusFilter === key ? 'default' : 'outline'}
              className="h-7 text-[11px] px-2"
              onClick={() => setStatusFilter(key)}
            >
              {FILTER_LABELS[key]}
            </Button>
          ))}
        </div>


        <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{campaign.message_text}</div>

        {reasons.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {reasons.map(([reason, count]) => (
              <Badge key={reason} variant="outline" className="text-[10px]">
                {EXCLUSION_LABELS[reason as keyof typeof EXCLUSION_LABELS] || reason}: {count}
              </Badge>
            ))}
          </div>
        )}

        {evidenceRecipient && dispatchEvidence && (
          <div className="space-y-1.5 rounded-lg border p-3 text-xs" aria-label="Conciliação somente leitura de campanha">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">Evidências · {evidenceRecipient.contact?.name || evidenceRecipient.contact_id}</span>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs"
                onClick={() => setEvidenceRecipientId(null)}>Fechar consulta</Button>
            </div>
            <p className="text-muted-foreground">{dispatchEvidence.message}</p>
            <p className="text-muted-foreground">
              Estado consultado: {dispatchEvidence.providerStatus || 'não identificado'}
              {' · '}Mensagem CRM: {dispatchEvidence.serviceMessageId || 'sem referência direta'}
              {dispatchEvidence.providerMessageId ? ` · Referência externa: ${dispatchEvidence.providerMessageId}` : ''}
            </p>
            <p className="font-medium">Reenvio permanece bloqueado. Esta consulta não modifica a campanha.</p>
            {mayReconcile && (
              <Button type="button" size="sm" variant="outline" className="mt-1 h-8 text-xs"
                disabled={reconciling} onClick={() => setConfirmReconciliationOpen(true)}>
                Conciliar envio com auditoria
              </Button>
            )}
          </div>
        )}

        <ScrollArea className="h-[320px] rounded-lg border">
          <div className="divide-y">
            {loading && <p className="p-3 text-sm text-muted-foreground">Carregando destinatários...</p>}
            {!loading && recipients.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">Nenhum destinatário.</p>
            )}
            {!loading && recipients.length > 0 && visibleRecipients.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">Nenhum destinatário neste filtro.</p>
            )}
            {visibleRecipients.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.contact?.name || r.contact_id}</p>
                  <p className="text-[11px] text-muted-foreground">{r.phone_normalized || 'sem telefone'}</p>
                </div>
                {r.status === 'sent' ? (
                  <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-400">Enviado</Badge>
                ) : r.status === 'skipped' ? (
                  <Badge variant="outline" className="text-[10px]">Pulado</Badge>
                ) : r.status === 'failed' ? (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge
                      variant="outline"
                      className="max-w-[180px] truncate text-[10px] text-destructive border-destructive/40"
                      title={`${r.error_code || 'send_failed'}: ${r.error_message || ''}`}
                    >
                      Falha · {r.error_code || 'send_failed'}
                    </Badge>
                    {requiresCampaignSendReconciliation(r) && (
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]"
                        onClick={() => setEvidenceRecipientId(r.id)}>
                        Conferir evidências
                      </Button>
                    )}
                  </div>
                ) : r.status === 'pending' ? (
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">Elegível</Badge>
                    <Badge
                      variant="outline"
                      className={r.delivery_mode === 'api'
                        ? 'text-[10px] text-sky-600 border-sky-300'
                        : 'text-[10px] text-amber-600 border-amber-300'}
                    >
                      {r.delivery_mode === 'api' ? 'API' : 'Manual'}
                    </Badge>
                  </div>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">
                    {EXCLUSION_LABELS[(r.exclusion_reason || '') as keyof typeof EXCLUSION_LABELS] || 'Excluído'}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <AlertDialog open={confirmApiOpen} onOpenChange={setConfirmApiOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar campanha via API?</AlertDialogTitle>
            <AlertDialogDescription>
              Campanha: <strong>{campaign.name}</strong>. Serão processados <strong>{apiCount}</strong> destinatários
              API pendentes, um a um. Destinatários manuais não são enviados por aqui.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setSending(true);
                setProgress({ done: 0, total: apiCount });
                try {
                  const res = await sendCampaignViaApi(campaign, (done, total) => setProgress({ done, total }));
                  toast.message(
                    `Enviados: ${res.sent} · Falhas a conferir: ${res.unconfirmed} · Movidos p/ manual: ${res.movedToManual} · Bloqueados: ${res.blocked} · Já processados: ${res.alreadyProcessed}`,
                  );
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Envio não concluído. Atualize a campanha.');
                } finally {
                  setSending(false);
                  reload();
                  void fetchCampaigns();
                }
              }}
            >
              Confirmar envio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmReconciliationOpen}
        onOpenChange={value => { if (!reconciling) setConfirmReconciliationOpen(value); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar conciliação formal do envio?</AlertDialogTitle>
            <AlertDialogDescription>
              A mensagem exata possui identificador externo e registro de aceite/entrega/leitura.
              O servidor verificará novamente a evidência e seu perfil administrativo,
              atualizará somente este destinatário para enviado e criará um registro de auditoria imutável.
              Nenhuma mensagem será reenviada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reconciling}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={reconciling || !mayReconcile}
              onClick={event => { event.preventDefault(); void confirmFormalReconciliation(); }}>
              {reconciling ? 'Conferindo…' : 'Confirmar conciliação auditável'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CampaignManualQueue
        open={queueOpen}
        onOpenChange={setQueueOpen}
        campaignId={campaign.id}
        campaignMessage={campaign.message_text}
        recipients={recipients}
        onChanged={reload}
      />
    </ResponsiveDialog>
  );
}
