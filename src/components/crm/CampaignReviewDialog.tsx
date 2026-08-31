import { useEffect, useMemo, useState } from 'react';
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
import { CampaignManualQueue } from './CampaignManualQueue';
import { EXCLUSION_LABELS } from '@/lib/crm/campaignEligibility';
import { countCampaignResponses } from '@/lib/crm/campaignContext';
import { CrmCampaign, CrmCampaignRecipient, fetchCampaignRecipients, sendCampaignViaApi, syncCampaignStatus, useCrmCampaigns } from '@/hooks/useCrmCampaigns';

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
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [responses, setResponses] = useState<{ sent: number; responded: number } | null>(null);

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

  const { eligible, excluded, reasons, apiCount, manualCount, sent, skipped, failed } = useMemo(() => {
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
    return { eligible, excluded, reasons: [...reasons.entries()], apiCount, manualCount, sent, skipped, failed };
  }, [recipients]);

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
          {apiCount > 0 && (
            <Button variant="default" disabled={sending} onClick={() => setConfirmApiOpen(true)}>
              {sending
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Send className="h-4 w-4 mr-2" />}
              {sending ? `Enviando ${progress.done}/${progress.total}` : `Enviar via API (${apiCount})`}
            </Button>
          )}
          {manualCount > 0 && (
            <Button variant="secondary" onClick={() => setQueueOpen(true)}>
              <PlayCircle className="h-4 w-4 mr-2" />
              Fila manual ({manualCount})
            </Button>
          )}
          {campaign.status === 'draft' && (
            <Button onClick={async () => { await markPrepared(campaign.id); onOpenChange(false); }}>
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
          <Badge variant="outline">Selecionados: {campaign.total_selected}</Badge>
          <Badge variant="outline" className="text-emerald-600 border-emerald-300">Elegíveis: {campaign.total_eligible}</Badge>
          <Badge variant="outline" className="text-destructive border-destructive/40">Excluídos: {campaign.total_excluded}</Badge>
          <Badge variant="outline" className="text-sky-600 border-sky-300">API: {apiCount}</Badge>
          <Badge variant="outline" className="text-amber-600 border-amber-300">Manual: {manualCount}</Badge>
          <Badge variant="outline">Enviados: {sent.length}</Badge>
          <Badge variant="outline">Pulados: {skipped.length}</Badge>
          <Badge variant="outline" className="text-destructive border-destructive/40">Falhas: {failed.length}</Badge>
          <Badge variant="outline" className="text-sky-600 border-sky-300">
            Respostas: {responses ? `${responses.responded}/${responses.sent}` : '—'}
            {responseRate !== null ? ` (${responseRate}%)` : ''}
          </Badge>
        </div>

        {failed.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={async () => {
              const n = await requeueFailedRecipients(campaign.id);
              toast.success(`${n} destinatário(s) reenfileirado(s) — nenhum envio realizado`);
              reload();
              fetchCampaigns();
            }}
          >
            Reenfileirar falhas ({failed.length})
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
                  <Badge
                    variant="outline"
                    className="max-w-[55%] truncate text-[10px] text-destructive border-destructive/40"
                    title={`${r.error_code || 'send_failed'}: ${r.error_message || ''}`}
                  >
                    Falha · {r.error_code || 'send_failed'}
                  </Badge>
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
                const res = await sendCampaignViaApi(campaign, (done, total) => setProgress({ done, total }));
                setSending(false);
                toast.success(
                  `Enviados: ${res.sent} · Falhas: ${res.failed} · Movidos p/ manual: ${res.movedToManual} · Bloqueados: ${res.blocked}`,
                );
                reload();
                fetchCampaigns();
              }}
            >
              Confirmar envio
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
