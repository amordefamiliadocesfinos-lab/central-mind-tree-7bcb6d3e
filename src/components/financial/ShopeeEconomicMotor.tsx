import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CircleDollarSign,
  Layers3,
  RefreshCcw,
  ShieldCheck,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { calculateLegacyEconomicScenario } from '@/lib/economic-engine/legacyCore';

const ACCOUNT_REGIMES = {
  'SH-001': {
    name: 'Adão',
    commissionPct: 12,
    transactionPct: 2,
    servicePct: 3.5,
    note: 'Regime limpo recente usado como referência do laboratório. Ads Fácil não observado no recorte utilizado.',
  },
  'SH-002': {
    name: 'Viviane',
    commissionPct: 12,
    transactionPct: 2,
    servicePct: 3.5,
    note: 'Devolução Fácil e Afiliado apareceram em parte do histórico. Informe-os manualmente quando aplicáveis.',
  },
  'SH-003': {
    name: 'Priscila',
    commissionPct: 12,
    transactionPct: 2,
    servicePct: 3.5,
    note: 'Recarga Automática e Devolução Fácil foram observadas. Ads Fácil deixou de aparecer no recorte recente estudado.',
  },
  'SH-004': {
    name: 'Neto',
    commissionPct: 12,
    transactionPct: 2,
    servicePct: 3.5,
    note: 'Recarga Automática e Devolução Fácil foram observadas. Ads Fácil deixou de aparecer no recorte recente estudado.',
  },
} as const;

type AccountId = keyof typeof ACCOUNT_REGIMES;

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const pct = (value: number) =>
  `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const PRESENTATIONS = [6, 18, 36, 72, 108, 144, 504];

function MetricCard({
  title,
  value,
  helper,
  tone = 'default',
  icon: Icon,
}: {
  title: string;
  value: string;
  helper?: string;
  tone?: 'default' | 'good' | 'warn' | 'danger';
  icon: typeof Wallet;
}) {
  return (
    <Card className={cn(
      tone === 'good' && 'border-emerald-500/40',
      tone === 'warn' && 'border-amber-500/40',
      tone === 'danger' && 'border-destructive/50',
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
            {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
          </div>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ShopeeEconomicMotor() {
  const [accountId, setAccountId] = useState<AccountId>('SH-001');
  const [presentation, setPresentation] = useState(36);
  const [q, setQ] = useState(1);
  const [originalPrice, setOriginalPrice] = useState(103);
  const [agreedPrice, setAgreedPrice] = useState(97.85);
  const [commissionPct, setCommissionPct] = useState(12);
  const [transactionPct, setTransactionPct] = useState(2);
  const [servicePct, setServicePct] = useState(3.5);
  const [adsPct, setAdsPct] = useState(0);
  const [affiliatePct, setAffiliatePct] = useState(0);
  const [retMCharges, setRetMCharges] = useState(0);
  const [retMBenefits, setRetMBenefits] = useState(0);
  const [costPerUnit, setCostPerUnit] = useState(0);
  const [targetMarginPct, setTargetMarginPct] = useState(20);
  const [baselinePrice, setBaselinePrice] = useState(97.85);

  const account = ACCOUNT_REGIMES[accountId];

  const resetHistoricalRegime = () => {
    setCommissionPct(account.commissionPct);
    setTransactionPct(account.transactionPct);
    setServicePct(account.servicePct);
    setAdsPct(0);
    setAffiliatePct(0);
    setRetMCharges(0);
    setRetMBenefits(0);
  };

  const handleAccountChange = (value: AccountId) => {
    const next = ACCOUNT_REGIMES[value];
    setAccountId(value);
    setCommissionPct(next.commissionPct);
    setTransactionPct(next.transactionPct);
    setServicePct(next.servicePct);
    setAdsPct(0);
    setAffiliatePct(0);
    setRetMCharges(0);
    setRetMBenefits(0);
  };

  const scenario = useMemo(() => calculateLegacyEconomicScenario({
    presentation,
    q,
    agreedPrice,
    commissionPct,
    transactionPct,
    servicePct,
    adsPct,
    affiliatePct,
    retMCharges,
    retMBenefits,
    costPerUnit,
    targetMarginPct,
    baselinePrice,
  }), [
    presentation,
    q,
    agreedPrice,
    commissionPct,
    transactionPct,
    servicePct,
    adsPct,
    affiliatePct,
    retMCharges,
    retMBenefits,
    costPerUnit,
    targetMarginPct,
    baselinePrice,
  ]);

  const {
    commonInput,
    result,
    volumePhysical,
    absorptionPct,
    reu,
    costTotal,
    marginCurrent,
    previousWall,
    nextWall,
    recovery,
    isDominated,
    requiredRepasse,
    pmr,
    tceBe,
    tsiBand,
  } = scenario;

  const confidence = accountId === 'SH-001' && presentation === 36
    ? { label: 'ALTA histórica', tone: 'good' as const, text: 'Mesma conta e apresentação do regime-laboratório mais limpo.' }
    : { label: 'MÉDIA', tone: 'warn' as const, text: 'Usa regime histórico comparável; confirme Oferta, vigência e modificadores.' };


  const wallTone = isDominated ? 'danger' : nextWall ? 'warn' : 'default';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Motor Econômico Shopee V2
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Protótipo funcional MV2-12 baseado no checkpoint canônico V0.6. Histórico orienta; transação real decide.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">V0.6</Badge>
              <Badge variant="secondary">Alfajor 60g</Badge>
              <Badge className={cn(
                confidence.tone === 'good' && 'bg-emerald-600',
                confidence.tone === 'warn' && 'bg-amber-600',
              )}>{confidence.label}</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers3 className="h-4 w-4" /> Entradas do Motor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Conta / regime</Label>
                  <Select value={accountId} onValueChange={(v) => handleAccountChange(v as AccountId)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACCOUNT_REGIMES).map(([id, item]) => (
                        <SelectItem key={id} value={id}>{id} — {item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{account.note}</p>
                </div>

                <div className="space-y-1.5">
                  <Label>Apresentação</Label>
                  <Select value={String(presentation)} onValueChange={(v) => setPresentation(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRESENTATIONS.map((p) => <SelectItem key={p} value={String(p)}>{p} un.</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Quantidade comercial Q</Label>
                  <Input type="number" min={1} step={1} value={q} onChange={(e) => setQ(Number(e.target.value))} />
                </div>

                <div className="space-y-1.5">
                  <Label>Preço original / unidade comercial</Label>
                  <Input type="number" min={0} step="0.01" value={originalPrice} onChange={(e) => setOriginalPrice(Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Preço acordado / unidade comercial</Label>
                  <Input type="number" min={0} step="0.01" value={agreedPrice} onChange={(e) => setAgreedPrice(Number(e.target.value))} />
                </div>
              </div>

              {presentation === 36 && commonInput.q >= 5 && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium mb-2">Escada A3 candidata</p>
                  <div className="flex flex-wrap gap-2">
                    {[79.99, 78.99, 77.99].map((price) => (
                      <Button key={price} size="sm" variant="outline" onClick={() => setAgreedPrice(price)}>
                        {money(price)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">RET-E — regime estrutural</p>
                  <Button size="sm" variant="ghost" className="gap-1" onClick={resetHistoricalRegime}>
                    <RefreshCcw className="h-3.5 w-3.5" /> Repor histórico
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Comissão %</Label><Input type="number" step="0.1" value={commissionPct} onChange={(e) => setCommissionPct(Number(e.target.value))} /></div>
                  <div className="space-y-1.5"><Label>Transação %</Label><Input type="number" step="0.1" value={transactionPct} onChange={(e) => setTransactionPct(Number(e.target.value))} /></div>
                  <div className="space-y-1.5"><Label>Serviço adicional %</Label><Input type="number" step="0.1" value={servicePct} onChange={(e) => setServicePct(Number(e.target.value))} /></div>
                  <div className="space-y-1.5"><Label>Ads Fácil %</Label><Input type="number" step="0.1" value={adsPct} onChange={(e) => setAdsPct(Number(e.target.value))} /></div>
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-sm font-medium">RET-M — modificadores</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Afiliado %</Label><Input type="number" min={0} step="0.1" value={affiliatePct} onChange={(e) => setAffiliatePct(Number(e.target.value))} /></div>
                  <div className="space-y-1.5"><Label>Outros custos R$</Label><Input type="number" min={0} step="0.01" value={retMCharges} onChange={(e) => setRetMCharges(Number(e.target.value))} /></div>
                  <div className="space-y-1.5 col-span-2"><Label>Benefícios / ajustes favoráveis R$</Label><Input type="number" min={0} step="0.01" value={retMBenefits} onChange={(e) => setRetMBenefits(Number(e.target.value))} /></div>
                </div>
                <p className="text-xs text-muted-foreground">Preencha apenas quando houver evidência para a transação. Não são aplicados automaticamente por conta.</p>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-sm font-medium">CEA / Motor reverso</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>CEA por unidade física</Label><Input type="number" min={0} step="0.01" value={costPerUnit} onChange={(e) => setCostPerUnit(Number(e.target.value))} /></div>
                  <div className="space-y-1.5"><Label>Margem-alvo %</Label><Input type="number" min={0} max={95} step="1" value={targetMarginPct} onChange={(e) => setTargetMarginPct(Number(e.target.value))} /></div>
                  <div className="space-y-1.5 col-span-2"><Label>Preço baseline para TCE-BE</Label><Input type="number" min={0} step="0.01" value={baselinePrice} onChange={(e) => setBaselinePrice(Number(e.target.value))} /></div>
                </div>
                {costPerUnit <= 0 && <p className="text-xs text-amber-600">CEA real ainda pendente. PMR, margem e TCE-BE permanecem desativados até informar um custo.</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            <MetricCard title="Ticket acordado" value={money(result.ticket)} helper={`${commonInput.q} unidade(s) comercial(is)`} icon={CircleDollarSign} />
            <MetricCard title="Repasse previsto" value={money(result.repasse)} helper="RET-E + RET-M informado" tone={result.repasse >= 0 ? 'good' : 'danger'} icon={Wallet} />
            <MetricCard title="Absorção Shopee" value={pct(absorptionPct)} helper={money(result.shopeeAbsorption)} tone="warn" icon={TrendingUp} />
            <MetricCard title="REU / capacidade" value={money(reu)} helper={`por unidade física (${volumePhysical} un.)`} icon={Target} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Decomposição prevista</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Preço original</span><span>{money(originalPrice * commonInput.q)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Preço acordado</span><span className="font-medium">{money(result.ticket)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Comissão</span><span>- {money(result.commission)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Transação</span><span>- {money(result.transaction)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Serviço adicional</span><span>- {money(result.serviceAdditional)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Ads Fácil</span><span>- {money(result.adsEasy)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TSI-base ({tsiBand})</span><span>- {money(result.tsiTotal)} <span className="text-muted-foreground">({money(result.tsiUnit)} × Q)</span></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Afiliado</span><span>- {money(result.affiliate)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Outros RET-M</span><span>- {money(retMCharges)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Benefícios RET-M</span><span>+ {money(result.retMBenefitsTotal)}</span></div>
                <div className="border-t pt-2 flex justify-between font-semibold"><span>Repasse previsto</span><span>{money(result.repasse)}</span></div>
                <p className="pt-1 text-xs text-muted-foreground">Cada componente é arredondado para centavos antes da soma.</p>
              </CardContent>
            </Card>

            <Card className={cn(isDominated && 'border-destructive/50')}>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Paredes e dominância</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Faixa TSI atual</span>
                  <Badge variant="outline">{tsiBand} · {money(result.tsiUnit)}</Badge>
                </div>
                {previousWall && recovery ? (
                  <div className={cn('rounded-lg border p-3', isDominated ? 'border-destructive/40 bg-destructive/5' : 'bg-muted/30')}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">Parede R${previousWall}</span>
                      <Badge variant={isDominated ? 'destructive' : 'secondary'}>{isDominated ? 'ZONA DOMINADA' : 'RECUPERADA'}</Badge>
                    </div>
                    <p className="mt-2 text-sm">Pré-parede {money(recovery.preWallPrice)} → repasse {money(recovery.preWallRepasse)}</p>
                    <p className="text-sm">PRE calculado → <strong>{money(recovery.recoveryPrice)}</strong></p>
                    {isDominated && <p className="mt-2 text-xs text-destructive">O preço atual cobra mais e ainda entrega menos repasse que o ponto imediatamente anterior à parede.</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Preço ainda abaixo da primeira parede relevante do modelo.</p>
                )}
                {nextWall && <p className="text-sm">Próxima parede: <strong>{money(nextWall)}</strong>.</p>}
                {!nextWall && <p className="text-sm text-muted-foreground">Sem nova parede cadastrada acima de R$200 neste checkpoint.</p>}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Confiança</CardTitle></CardHeader>
              <CardContent>
                <Badge className={cn(confidence.tone === 'good' ? 'bg-emerald-600' : 'bg-amber-600')}>{confidence.label}</Badge>
                <p className="mt-2 text-sm text-muted-foreground">{confidence.text}</p>
                <p className="mt-2 text-xs text-muted-foreground">Conta + vigência + Oferta continuam sendo a chave correta do RRE. Este protótipo ainda usa parâmetros editáveis em tela.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Capacidade / margem</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Custo máximo de equilíbrio</span><strong>{money(reu)}/un.</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">CEA informado</span><span>{costPerUnit > 0 ? money(costPerUnit) : 'PENDENTE'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Custo total</span><span>{costTotal !== null ? money(costTotal) : '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Margem atual sobre repasse</span><span>{marginCurrent !== null ? pct(marginCurrent) : '—'}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">PMR / TCE-BE</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Repasse necessário</span><span>{requiredRepasse !== null ? money(requiredRepasse) : '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">PMR / unidade comercial</span><strong>{pmr !== null ? money(pmr) : '—'}</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TCE-BE vs baseline</span><span>{tceBe !== null && Number.isFinite(tceBe) ? pct(tceBe) : '—'}</span></div>
                {tceBe !== null && Number.isFinite(tceBe) && (
                  <p className="text-xs text-muted-foreground">
                    {tceBe >= 0
                      ? `O cenário atual pode perder aproximadamente ${pct(tceBe)} dos pedidos e empatar a contribuição do baseline, sob as mesmas premissas.`
                      : `O cenário atual precisa ganhar aproximadamente ${pct(-tceBe)} em pedidos para empatar a contribuição do baseline.`}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className={cn('border-dashed', wallTone === 'danger' && 'border-destructive/50')}>
            <CardContent className="p-4 text-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Estado da evidência</p>
                  <p className="mt-1 text-muted-foreground">
                    TSI, taxas e regimes são referências históricas do período estudado. O protótipo não homologa preço, custo, margem ou configuração futura da Shopee. Use a transação real para reconciliar o previsto.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
