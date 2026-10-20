import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, CalendarCheck, HeartHandshake, Info, Loader2, Megaphone, RefreshCw, Repeat2, Sparkles, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  analyzeStartOpportunityCandidates,
  START_OPPORTUNITY_INITIAL_BATCH,
  type StartOpportunityCandidate,
} from '@/lib/crm/startOpportunityCandidates';
import { selectStartRecommendedOpportunity } from '@/lib/crm/startOpportunityRecommendation';
import { buildCrmStartDestination } from '@/lib/crm/startOpportunityNavigation';
import { resolveStartOpportunityDisplayState } from '@/lib/crm/startOpportunityPresentation';
import { getCrmStartRecommendationCardClass, getCrmStartSectionCardClass } from '@/lib/crm/startOpportunityVisualHierarchy';
import { cn } from '@/lib/utils';

type PoolContact = { id: string; name: string | null };
type ScanState = {
  contacts: PoolContact[];
  candidates: StartOpportunityCandidate[];
  checked: number;
  isLoading: boolean;
  moreAvailable: boolean;
  error: string | null;
  checkedAt: string | null;
};
const EMPTY: ScanState = {
  contacts: [], candidates: [], checked: 0, isLoading: false,
  moreAvailable: true, error: null, checkedAt: null,
};

function displayDate(value: string | null) {
  if (!value) return 'Não informada';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/**
 * C2-02 — somente leitura e consulta sob demanda.
 * Análise inicial: até 8 clientes ativos com compra registrada no cadastro,
 * ordenados por última compra; mais lotes somente após clique explícito.
 * Não é total geral do CRM, tampouco ordem de atendimento.
 */
export function StartOpportunityPanel({ active }: { active: boolean }) {
  const [scan, setScan] = useState<ScanState>(EMPTY);
  const [showEvidence, setShowEvidence] = useState(false);
  const loadingRef = useRef(false);
  const offsetRef = useRef(0);
  const mountedRef = useRef(true);
  const wasActiveRef = useRef(false);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const scanNext = useCallback(async (restart = false) => {
    if (loadingRef.current && !restart) return;
    const version = restart ? ++requestVersionRef.current : requestVersionRef.current;
    loadingRef.current = true;
    if (restart) {
      offsetRef.current = 0;
      if (mountedRef.current) setScan({ ...EMPTY, isLoading: true });
    } else if (mountedRef.current) {
      setScan(s => ({ ...s, isLoading: true, error: null }));
    }
    try {
      const first = restart ? 0 : offsetRef.current;
      const last = first + START_OPPORTUNITY_INITIAL_BATCH - 1;
      const { data, error } = await supabase.from('contacts')
        .select('id,name')
        .eq('is_active', true)
        .gt('paid_orders_count', 0)
        .order('last_purchase_date', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
        .range(first, last);
      if (error) throw error;
      const contacts = (data || []).filter(c => Boolean(c.id)) as PoolContact[];
      const analyzed = await analyzeStartOpportunityCandidates(contacts.map(c => c.id));
      if (!mountedRef.current || version !== requestVersionRef.current) return;
      offsetRef.current = first + contacts.length;
      setScan(s => ({
        contacts: restart ? contacts : [...s.contacts, ...contacts],
        candidates: restart ? analyzed.candidates : [...s.candidates, ...analyzed.candidates],
        checked: restart ? analyzed.analyzedCount : s.checked + analyzed.analyzedCount,
        isLoading: false,
        moreAvailable: contacts.length === START_OPPORTUNITY_INITIAL_BATCH,
        error: null,
        checkedAt: analyzed.checkedAt,
      }));
    } catch {
      if (mountedRef.current && version === requestVersionRef.current) setScan(s => ({
        ...s, isLoading: false,
        error: 'Não foi possível concluir a análise. Uma falha não comprova ausência de oportunidade.',
      }));
    } finally {
      if (version === requestVersionRef.current) loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Ao retornar, revalida somente o lote inicial (8); nunca a base inteira.
    if (active && !wasActiveRef.current) {
      setShowEvidence(false);
      void scanNext(true);
    }
    wasActiveRef.current = active;
  }, [active, scanNext]);

  const recommended = useMemo(() =>
    selectStartRecommendedOpportunity(scan.candidates), [scan.candidates]);
  const contactName = recommended
    ? scan.contacts.find(c => c.id === recommended.candidate.contactId)?.name?.trim() || 'Contato sem nome'
    : null;
  const failed = scan.candidates.filter(c => c.state === 'error').length;
  const insufficient = scan.candidates.filter(c => c.state === 'insufficient').length;
  const blocked = scan.candidates.filter(c => c.state === 'blocked').length;
  const viewState = resolveStartOpportunityDisplayState({
    isLoading: scan.isLoading, analyzedCount: scan.checked,
    hasRecommendation: Boolean(recommended), hasMore: scan.moreAvailable,
    error: scan.error, candidates: scan.candidates,
  });
  const lastCheckedLabel = scan.checkedAt
    ? new Date(scan.checkedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : null;
  const isPostSale = recommended?.kind === 'post_sale';
  const repurchase = recommended?.candidate.opportunity?.repurchase;
  const postSale = recommended?.candidate.opportunity?.postSale;

  return (
    <section className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-3 p-3 md:p-4 xl:p-5" aria-label="Start Estratégica de Oportunidades">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground"><Target className="h-4 w-4 shrink-0 text-violet-700 dark:text-violet-300" /> Start — Oportunidades</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Explore possibilidades comerciais com base em fatos do CRM, sem competir com a fila.</p>
        </div>
      </header>

      <Card className={cn('space-y-3 p-3 shadow-sm md:p-4', getCrmStartRecommendationCardClass(viewState))}>
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-violet-200 bg-white text-violet-700 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-200"><Sparkles className="h-4 w-4" /></span>
          Oportunidade recomendada entre os contatos analisados
        </div>

        {viewState === 'loading' ? (
          <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando evidências comerciais...
          </div>
        ) : viewState === 'recommended' && recommended ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-violet-300 bg-violet-100 text-violet-950 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200">{isPostSale ? 'Pós-venda elegível' : 'Recompra provável'}</Badge>
              <span className="text-xs text-muted-foreground">Sinal comprovado nos registros analisados</span>
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{contactName}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {isPostSale
                  ? 'Pedido finalizado e entregue, ainda sem Resultado canônico de pós-venda posterior.'
                  : 'Histórico de compras consistente sugere analisar um novo ciclo de reposição.'}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs">
              <div className="flex gap-2">
                <CalendarCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{isPostSale
                  ? `Entrega elegível: ${displayDate(postSale?.deliveryDate ?? null)}`
                  : `Ciclo estimado: ${displayDate(recommended.evidenceDate)} (não é prazo oficial)`}</span>
              </div>
              {!isPostSale && repurchase && (
                <p className="mt-1 pl-6">{repurchase.purchaseCount} compras · intervalo típico de {repurchase.typicalIntervalDays} dias · última compra {displayDate(repurchase.lastPurchaseAt)}</p>
              )}
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Recomendação para consulta; a situação comercial deve ser revalidada antes de qualquer abordagem.
            </p>
            {showEvidence && (
              <div className="rounded-lg border p-3 text-xs" role="region" aria-label="Evidência da oportunidade">
                <p className="font-semibold">Por que este contato?</p>
                <p className="mt-1 text-muted-foreground">{recommended.candidate.reason}</p>
                <p className="mt-2 text-muted-foreground">
                  {isPostSale
                    ? 'Entre os pós-vendas elegíveis analisados, prevalece a entrega mais recente.'
                    : 'Na ausência de pós-venda elegível, prevalece o ciclo provável estimado mais antigo entre os analisados.'}
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setShowEvidence(v => !v)}>
                {showEvidence ? 'Ocultar evidência' : 'Ver evidência'}
              </Button>
              <Button type="button" size="sm" variant="outline" asChild>
                <Link to={`/contatos?contact=${encodeURIComponent(recommended.candidate.contactId)}`}>
                  Consultar cadastro na Gestão <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        ) : viewState === 'error' && scan.checked === 0 ? (
          <div className="flex items-start gap-2 py-3 text-sm" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Falha de consulta. Isso não significa ausência de oportunidades.</span>
          </div>
        ) : viewState === 'empty' ? (
          <div className="py-3 text-sm text-muted-foreground">Nenhum cliente com histórico de compra registrado foi encontrado neste recorte.</div>
        ) : (
          <div className="space-y-2 py-3 text-sm text-muted-foreground" role="status">
            {viewState === 'error' ? (
              <p>Há falhas de análise neste recorte; não é possível concluir que não existam oportunidades.</p>
            ) : viewState === 'insufficient' ? (
              <p>Existem dados insuficientes para comprovar uma oportunidade neste recorte.</p>
            ) : viewState === 'blocked' ? (
              <p>Há contatos impedidos de nova abordagem comercial. A Inbox e as restrições existentes têm precedência.</p>
            ) : (
              <p>Nenhum sinal comercial comprovado entre os {scan.checked} contatos analisados.</p>
            )}
            {(failed > 0 || insufficient > 0) && (
              <p>Verificação incompleta: {failed} consulta(s) com erro e {insufficient} sem evidência suficiente.</p>
            )}
            {blocked > 0 && <p>{blocked} contato(s) impedido(s), sem ações comerciais paralelas.</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <div className="space-y-1">
            <p aria-live="polite">{scan.checked} contato(s) verificados neste recorte de clientes com compras registradas.</p>
            <p>O resultado é parcial: não representa todas as oportunidades do CRM.</p>
            {lastCheckedLabel && <p>Última verificação: {lastCheckedLabel}.</p>}
            {(failed > 0 || insufficient > 0) && (
              <p>Verificações incompletas neste recorte: {failed} falha(s) e {insufficient} evidência(s) insuficiente(s).</p>
            )}
            {scan.isLoading && scan.checked > 0 && <p role="status">Analisando novo lote; os resultados anteriores continuam parciais.</p>}
            {scan.error && <p role="alert" className="text-destructive">{scan.error}</p>}
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button type="button" size="sm" variant="outline" disabled={scan.isLoading}
              onClick={() => { setShowEvidence(false); void scanNext(true); }}>
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${scan.isLoading ? 'animate-spin' : ''}`} />
              Atualizar análise
            </Button>
            <Button type="button" size="sm" variant="outline"
              disabled={scan.isLoading || !scan.moreAvailable}
              onClick={() => { setShowEvidence(false); void scanNext(); }}>
              {scan.isLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="mr-1 h-3.5 w-3.5" />}
              {scan.moreAvailable ? 'Analisar mais 8' : 'Recorte consultado'}
            </Button>
          </div>
        </div>
      </Card>
      {/* C2-03: caminhos estratégicos, sem criar nova fila nem executar ações comerciais. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className={cn('flex min-w-0 flex-col gap-3 p-3 shadow-sm md:p-4', getCrmStartSectionCardClass('post_sale'))}>
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200"><HeartHandshake className="h-4 w-4" /></span> Pós-venda estratégico
          </h3>
          <p className="flex-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            Explore clientes com entregas e histórico de acompanhamento. A elegibilidade será avaliada pelos critérios oficiais, não apenas por dias sem comprar.
          </p>
          <Button type="button" size="sm" variant="outline" asChild className="self-start">
            <Link to={buildCrmStartDestination('post_sale')}>
              Explorar Pós-venda <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </Card>
        <Card className={cn('flex min-w-0 flex-col gap-3 p-3 shadow-sm md:p-4', getCrmStartSectionCardClass('repurchase'))}>
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"><Repeat2 className="h-4 w-4" /></span> Recompra
          </h3>
          <p className="flex-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            Consulte padrões de compras e possíveis ciclos de reposição no painel oficial, sem transformar estimativas em obrigações.
          </p>
          <Button type="button" size="sm" variant="outline" asChild className="self-start">
            <Link to={buildCrmStartDestination('repurchase')}>
              Analisar Recompra <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </Card>
      </div>
      <Card className={cn('space-y-3 p-3 shadow-sm md:p-4', getCrmStartSectionCardClass('campaigns'))}>
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200"><Megaphone className="h-4 w-4" /></span> Campanhas segmentadas
        </h3>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          Identifique públicos comerciais e abra campanhas existentes. A Start não cria campanhas nem envia mensagens; validação e revisão permanecem na Gestão CRM.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" asChild>
            <Link to={buildCrmStartDestination('segment')}>
              Segmentar clientes <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link to={buildCrmStartDestination('campaigns')}>
              Campanhas CRM <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </Card>
    </section>
  );
}
