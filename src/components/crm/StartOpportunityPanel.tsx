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
  const attemptedRef = useRef(false);
  const loadingRef = useRef(false);
  const offsetRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const scanNext = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (mountedRef.current) setScan(s => ({ ...s, isLoading: true, error: null }));
    try {
      const first = offsetRef.current;
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
      if (!mountedRef.current) return;
      offsetRef.current += contacts.length;
      setScan(s => ({
        contacts: [...s.contacts, ...contacts],
        candidates: [...s.candidates, ...analyzed.candidates],
        checked: s.checked + analyzed.analyzedCount,
        isLoading: false,
        moreAvailable: contacts.length === START_OPPORTUNITY_INITIAL_BATCH,
        error: null,
        checkedAt: analyzed.checkedAt,
      }));
    } catch {
      if (mountedRef.current) setScan(s => ({
        ...s, isLoading: false,
        error: 'Não foi possível analisar este lote. O resultado anterior, se existente, permanece parcial.',
      }));
    } finally {
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (active && !attemptedRef.current) {
      attemptedRef.current = true;
      void scanNext();
    }
  }, [active, scanNext]);

  const recommended = useMemo(() =>
    selectStartRecommendedOpportunity(scan.candidates), [scan.candidates]);
  const contactName = recommended
    ? scan.contacts.find(c => c.id === recommended.candidate.contactId)?.name?.trim() || 'Contato sem nome'
    : null;
  const failed = scan.candidates.filter(c => c.state === 'error').length;
  const insufficient = scan.candidates.filter(c => c.state === 'insufficient').length;
  const blocked = scan.candidates.filter(c => c.state === 'blocked').length;
  const isPostSale = recommended?.kind === 'post_sale';
  const repurchase = recommended?.candidate.opportunity?.repurchase;
  const postSale = recommended?.candidate.opportunity?.postSale;

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-3 p-3 md:p-5" aria-label="Start Estratégica de Oportunidades">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold"><Target className="h-4 w-4 shrink-0" /> Start — Oportunidades</h2>
          <p className="mt-1 text-xs text-muted-foreground">Explore possibilidades comerciais com base em fatos do CRM, sem competir com a fila.</p>
        </div>
      </header>

      <Card className="space-y-3 p-3 md:p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 shrink-0" />
          Oportunidade recomendada entre os contatos analisados
        </div>

        {scan.isLoading && scan.checked === 0 ? (
          <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando evidências comerciais...
          </div>
        ) : recommended ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{isPostSale ? 'Pós-venda elegível' : 'Recompra provável'}</Badge>
              <span className="text-xs text-muted-foreground">Sinal comprovado nos registros analisados</span>
            </div>
            <div>
              <p className="text-sm font-semibold">{contactName}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
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
        ) : scan.error && scan.checked === 0 ? (
          <div className="flex items-start gap-2 py-3 text-sm" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Falha de consulta. Isso não significa ausência de oportunidades.</span>
          </div>
        ) : scan.checked === 0 && !scan.moreAvailable ? (
          <div className="py-3 text-sm text-muted-foreground">Nenhum cliente com histórico de compra registrado foi encontrado neste recorte.</div>
        ) : (
          <div className="space-y-2 py-3 text-sm text-muted-foreground">
            <p>Não há oportunidade comprovada entre os {scan.checked} contatos analisados deste recorte.</p>
            {(failed > 0 || insufficient > 0) && (
              <p>Dados incompletos: {failed} consulta(s) com erro e {insufficient} sem evidência suficiente. Não interpretar como ausência geral de oportunidades.</p>
            )}
            {blocked > 0 && <p>{blocked} contato(s) com impedimento operacional ou comercial; não sugerir abordagem paralela.</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
          <div className="space-y-1">
            <p>{scan.checked} contato(s) verificados neste recorte de clientes com compras registradas.</p>
            <p>O resultado é parcial: não representa todas as oportunidades do CRM.</p>
            {scan.error && <p role="alert" className="text-destructive">{scan.error}</p>}
          </div>
          <Button type="button" size="sm" variant="outline"
            disabled={scan.isLoading || (!scan.moreAvailable && !scan.error)}
            onClick={() => { setShowEvidence(false); void scanNext(); }}>
            {scan.isLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
            {scan.error ? 'Tentar novamente' : scan.moreAvailable ? 'Analisar mais 8' : 'Recorte consultado'}
          </Button>
        </div>
      </Card>
      {/* C2-03: caminhos estratégicos, sem criar nova fila nem executar ações comerciais. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="flex min-w-0 flex-col gap-3 p-3 md:p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <HeartHandshake className="h-4 w-4 shrink-0" /> Pós-venda estratégico
          </h3>
          <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
            Explore clientes com entregas e histórico de acompanhamento. A elegibilidade será avaliada pelos critérios oficiais, não apenas por dias sem comprar.
          </p>
          <Button type="button" size="sm" variant="outline" asChild className="self-start">
            <Link to={buildCrmStartDestination('post_sale')}>
              Explorar Pós-venda <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </Card>
        <Card className="flex min-w-0 flex-col gap-3 p-3 md:p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Repeat2 className="h-4 w-4 shrink-0" /> Recompra
          </h3>
          <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
            Consulte padrões de compras e possíveis ciclos de reposição no painel oficial, sem transformar estimativas em obrigações.
          </p>
          <Button type="button" size="sm" variant="outline" asChild className="self-start">
            <Link to={buildCrmStartDestination('repurchase')}>
              Analisar Recompra <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </Card>
      </div>
      <Card className="space-y-3 p-3 md:p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Megaphone className="h-4 w-4 shrink-0" /> Campanhas segmentadas
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
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
