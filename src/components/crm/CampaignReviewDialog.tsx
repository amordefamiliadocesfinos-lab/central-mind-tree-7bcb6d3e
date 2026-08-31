import { useEffect, useMemo, useState } from 'react';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, PlayCircle } from 'lucide-react';
import { CampaignManualQueue } from './CampaignManualQueue';
import { EXCLUSION_LABELS } from '@/lib/crm/campaignEligibility';
import { CrmCampaign, CrmCampaignRecipient, fetchCampaignRecipients, useCrmCampaigns } from '@/hooks/useCrmCampaigns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CrmCampaign | null;
}

export function CampaignReviewDialog({ open, onOpenChange, campaign }: Props) {
  const { markPrepared } = useCrmCampaigns();
  const [recipients, setRecipients] = useState<(CrmCampaignRecipient & { contact?: { name?: string } })[]>([]);
  const [loading, setLoading] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  useEffect(() => {
    if (!open || !campaign) return;
    setLoading(true);
    fetchCampaignRecipients(campaign.id).then(rows => { setRecipients(rows); setLoading(false); });
  }, [open, campaign]);

  const reload = () => {
    if (!campaign) return;
    fetchCampaignRecipients(campaign.id).then(setRecipients);
  };

  const { eligible, excluded, reasons, apiCount, manualCount, sent, skipped } = useMemo(() => {
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
    return { eligible, excluded, reasons: [...reasons.entries()], apiCount, manualCount, sent, skipped };
  }, [recipients]);

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
            {[...eligible, ...sent, ...skipped, ...excluded].map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.contact?.name || r.contact_id}</p>
                  <p className="text-[11px] text-muted-foreground">{r.phone_normalized || 'sem telefone'}</p>
                </div>
                {r.status === 'sent' ? (
                  <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-400">Enviado</Badge>
                ) : r.status === 'skipped' ? (
                  <Badge variant="outline" className="text-[10px]">Pulado</Badge>
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
