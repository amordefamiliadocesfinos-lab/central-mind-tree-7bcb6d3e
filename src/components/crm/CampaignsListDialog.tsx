/**
 * FRENTE 3.6 — Campanhas CRM: visão operacional simples.
 * Somente leitura + abertura da revisão. Não envia mensagens.
 */
import { useEffect, useMemo, useState } from 'react';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Megaphone, RefreshCw } from 'lucide-react';
import { formatDisplayDate } from '@/lib/dateUtils';
import { countCampaignResponses } from '@/lib/crm/campaignContext';
import { CrmCampaign, useCrmCampaigns } from '@/hooks/useCrmCampaigns';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Em criação',
  prepared: 'Pronta',
  sending: 'Em execução',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenCampaign: (campaign: CrmCampaign) => void;
}

export function CampaignsListDialog({ open, onOpenChange, onOpenCampaign }: Props) {
  const { campaigns, loading, fetchCampaigns } = useCrmCampaigns();
  const [responses, setResponses] = useState<Record<string, { sent: number; responded: number }>>({});

  const ids = useMemo(() => campaigns.map(c => c.id).join(','), [campaigns]);

  useEffect(() => {
    if (!open || !campaigns.length) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        campaigns.map(async c => [c.id, await countCampaignResponses(c.id)] as const),
      );
      if (!cancelled) setResponses(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [open, ids]);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Campanhas CRM"
      description="Acompanhamento das campanhas criadas. Nenhum envio ocorre nesta tela."
      className="sm:max-w-3xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => fetchCampaigns()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      }
    >
      <ScrollArea className="h-[420px]">
        <div className="divide-y">
          {loading && <p className="p-4 text-sm text-muted-foreground">Carregando campanhas...</p>}
          {!loading && campaigns.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma campanha criada ainda.</p>
          )}
          {campaigns.map(c => {
            const r = responses[c.id];
            const rate = r && r.sent > 0 ? Math.round((r.responded / r.sent) * 100) : null;
            return (
              <button
                key={c.id}
                onClick={() => onOpenCampaign(c)}
                className="w-full text-left px-3 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-muted-foreground shrink-0" />
                    {c.name}
                  </p>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {STATUS_LABEL[c.status] || c.status}
                  </Badge>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
                  <Badge variant="outline" className="text-[10px]">{formatDisplayDate(c.created_at)}</Badge>
                  <Badge variant="outline" className="text-[10px]">Selecionados: {c.total_selected}</Badge>
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">Elegíveis: {c.total_eligible}</Badge>
                  <Badge variant="outline" className="text-[10px]">Enviados: {c.total_sent}</Badge>
                  <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">Falhas: {c.total_failed}</Badge>
                  <Badge variant="outline" className="text-[10px] text-sky-600 border-sky-300">
                    Respostas: {r ? `${r.responded}${rate !== null ? ` (${rate}%)` : ''}` : '—'}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </ResponsiveDialog>
  );
}
