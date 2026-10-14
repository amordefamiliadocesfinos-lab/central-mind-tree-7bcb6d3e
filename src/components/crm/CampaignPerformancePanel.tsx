/**
 * F5-D — visão consolidada dos fatos comerciais de campanhas.
 * Não substitui o painel geral do CRM e não dispara ações operacionais.
 */
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { loadCrmCampaignPerformance } from '@/lib/crm/campaignPerformanceIO';
import {
  consolidateCampaignPerformance,
  type CampaignPerformance,
} from '@/lib/crm/campaignPerformance';
import type { CrmCampaign } from '@/hooks/useCrmCampaigns';

interface Props {
  campaigns: CrmCampaign[];
  open: boolean;
  refreshKey: number;
}
const money = (value: number) => value.toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL',
});

export function CampaignPerformancePanel({ campaigns, open, refreshKey }: Props) {
  const [rows, setRows] = useState<Record<string, CampaignPerformance>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const ids = useMemo(() => campaigns.map(c => c.id).join(','), [campaigns]);

  useEffect(() => {
    if (!open) return;
    if (campaigns.length === 0) {
      setRows({});
      setErrors({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    let cursor = 0;
    setLoading(true);
    setRows({});
    setErrors({});
    const loaded: Record<string, CampaignPerformance> = {};
    const failures: Record<string, string> = {};
    async function worker() {
      while (!cancelled && cursor < campaigns.length) {
        const campaign = campaigns[cursor++];
        try {
          loaded[campaign.id] = await loadCrmCampaignPerformance(campaign);
        } catch (error) {
          failures[campaign.id] = error instanceof Error ? error.message : 'Consulta indisponível.';
        }
      }
    }
    void Promise.all(Array.from({ length: Math.min(2, campaigns.length) }, () => worker()))
      .then(() => {
        if (cancelled) return;
        setRows(loaded);
        setErrors(failures);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, ids, refreshKey]);

  // Total só existe com 100% das campanhas lidas: falha de uma não vira zero.
  const totals = useMemo(() => {
    if (loading || campaigns.length === 0 || Object.keys(errors).length > 0
      || Object.keys(rows).length !== campaigns.length) return null;
    try {
      return consolidateCampaignPerformance(campaigns.map(c => rows[c.id]));
    } catch {
      return null;
    }
  }, [campaigns, loading, errors, rows]);

  if (!campaigns.length) return null;
  return (
    <section className="space-y-2 rounded-lg border p-3" aria-label="Indicadores comerciais consolidados">
      <p className="text-sm font-semibold">Desempenho comercial das campanhas</p>
      <p className="text-xs text-muted-foreground">
        Fatos das campanhas, respostas e Pedidos oficiais. Venda registrada na Inbox
        só é vinculada quando a F5-C comprova a origem; proximidade de datas não equivale a conversão.
      </p>
      {loading && <p className="text-xs text-muted-foreground">Conferindo dados oficiais...</p>}
      {!loading && !totals && (
        <p className="text-xs text-destructive">
          Indicadores consolidados indisponíveis. Uma leitura falhou ou os dados mudaram.
          Nenhum total parcial é apresentado como resultado completo.
        </p>
      )}
      {totals && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {([
              ['Campanhas com envios', totals.campaignsWithSends + '/' + totals.campaigns],
              ['Destinatários enviados', String(totals.recipientSends)],
              ['Indícios de resposta', String(totals.responseSignals)],
              ['Taxa de indícios', totals.responseSignalRate === null ? '—' : totals.responseSignalRate + '%'],
              ['Pedidos com origem rastreada', String(totals.tracedOrders)],
              ['Valor nominal rastreado', money(totals.tracedOrderValue)],
              ['Pedidos com status pago', String(totals.paidStatusOrders)],
              ['Pendentes de envio', String(totals.pending)],
              ['Falhas de envio', String(totals.failed)],
            ] as Array<[string, string]>).map(([title, value]) => (
              <div key={title} className="rounded-md bg-muted/40 p-2">
                <p className="text-[11px] text-muted-foreground">{title}</p>
                <p className="text-base font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Outros fatos: {totals.excluded} excluídos · {totals.skipped} pulados ·
            {' '}{totals.unlinkedOrderOccurrences} ocorrências de Pedido posterior sem vínculo.
            Destinatários enviados podem se repetir entre campanhas.
          </p>
          {totals.ambiguousOrderLinks > 0 && (
            <p className="text-xs text-destructive">
              {totals.ambiguousOrderLinks} Pedido(s) ligados a mais de uma campanha foram
              excluídos do valor total por ambiguidade.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Resposta é um indício pela última entrada da conversa em até 72h, não uma
            confirmação de intenção. Origem rastreada não prova causalidade da campanha.
            Valor de Pedido não é recebimento; status pago não equivale à conciliação bancária.
            Eventos F5-C não são retroativos.
          </p>
        </>
      )}
      <div className="space-y-1.5 border-t pt-2">
        <p className="text-xs font-medium">Detalhamento por campanha</p>
        {campaigns.map(c => {
          const r = rows[c.id];
          const percent = r && r.sent > 0 ? Math.round(1000 * r.responded / r.sent) / 10 : null;
          return (
            <div key={c.id} className="rounded-md border p-2 text-xs">
              <p className="font-medium truncate">{c.name}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge variant="outline">Envios: {r ? r.sent : '—'}</Badge>
                <Badge variant="outline">
                  Indícios de resposta: {r ? String(r.responded) + (percent !== null ? ' (' + percent + '%)' : '') : '—'}
                </Badge>
                <Badge variant="outline">Pedidos rastreados: {r ? r.sales.tracedOrders.length : '—'}</Badge>
                <Badge variant="outline">Valor nominal: {r ? money(r.sales.tracedOrderValue) : '—'}</Badge>
                <Badge variant="outline">Pendentes: {r ? r.pending : '—'}</Badge>
              </div>
              {errors[c.id] && <p className="mt-1 text-destructive">Fonte indisponível: {errors[c.id]}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
