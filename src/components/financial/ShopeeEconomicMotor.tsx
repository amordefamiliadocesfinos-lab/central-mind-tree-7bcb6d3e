import { useEffect, useMemo, useState } from 'react';
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
import { useProductsList } from '@/hooks/useProductsList';
import { useProductVariants } from '@/hooks/useProductVariants';
import { useCommercialPresentations } from '@/hooks/useCommercialPresentations';
import { usePlatforms } from '@/hooks/usePlatforms';
import { useChannelAccounts } from '@/hooks/useChannelAccounts';
import { useShopeeOfferMappings } from '@/hooks/useShopeeOfferMappings';
import { useEconomicRuleVersions } from '@/hooks/useEconomicRuleVersions';
import { resolveHistoricalShopeeRegime } from '@/lib/economic-engine/rre';
import {
  directCommercialPresentation,
  type CommercialPresentation,
} from '@/lib/products/commercialPresentation';

const DIRECT_PRESENTATION_ID = '__direct__';

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const pct = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

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
  const { platforms, loading: platformsLoading } = usePlatforms();
  const shopeePlatform = useMemo(
    () => platforms.find((platform) =>
      platform.is_active &&
      platform.group_type === 'marketplace' &&
      platform.parent_id === null &&
      platform.name.trim().toLocaleLowerCase('pt-BR').startsWith('shopee'),
    ) ?? null,
    [platforms],
  );
  const { accounts, loading: accountsLoading } = useChannelAccounts(shopeePlatform?.id ?? null);
  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.is_active),
    [accounts],
  );
  const [accountId, setAccountId] = useState('');
  const [effectiveAt, setEffectiveAt] = useState(() => new Date().toISOString().slice(0, 10));
  const { products, loading: productsLoading } = useProductsList();
  const [productId, setProductId] = useState('');
  const selectedProduct = useMemo(
    () => products.find((item) => item.id === productId) ?? null,
    [products, productId],
  );
  const { variants, loading: variantsLoading } = useProductVariants(productId || null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const selectedVariant = useMemo(
    () => variants.find((item) => item.id === variantId) ?? null,
    [variants, variantId],
  );
  const {
    offers: shopeeOffers,
    byId: shopeeOffersById,
    loading: offersLoading,
    error: offersError,
  } = useShopeeOfferMappings(accountId || null, productId || null, variantId);
  const [offerId, setOfferId] = useState('');
  const selectedOffer = shopeeOffersById.get(offerId) ?? null;
  const {
    candidates: economicRuleCandidates,
    loading: rulesLoading,
    error: rulesError,
  } = useEconomicRuleVersions(
    accountId || null,
    selectedOffer?.mapping.id ?? null,
  );
  const { list: listCommercialPresentations } = useCommercialPresentations();
  const [presentations, setPresentations] = useState<CommercialPresentation[]>([]);
  const [presentationsLoading, setPresentationsLoading] = useState(false);
  const [presentationId, setPresentationId] = useState(DIRECT_PRESENTATION_ID);
  const [q, setQ] = useState(1);
  const [originalPrice, setOriginalPrice] = useState(103);
  const [agreedPrice, setAgreedPrice] = useState(97.85);
  const [commissionPct, setCommissionPct] = useState(0);
  const [transactionPct, setTransactionPct] = useState(0);
  const [servicePct, setServicePct] = useState(0);
  const [adsPct, setAdsPct] = useState(0);
  const [affiliatePct, setAffiliatePct] = useState(0);
  const [retMCharges, setRetMCharges] = useState(0);
  const [retMBenefits, setRetMBenefits] = useState(0);
  const [costPerUnit, setCostPerUnit] = useState(0);
  const [targetMarginPct, setTargetMarginPct] = useState(20);
  const [baselinePrice, setBaselinePrice] = useState(97.85);

  useEffect(() => {
    if (accountsLoading || accountId || activeAccounts.length === 0) return;
    const preferred = activeAccounts.find((account) =>
      account.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR') === 'adao',
    ) ?? activeAccounts[0];
    setAccountId(preferred.id);
  }, [activeAccounts, accountsLoading, accountId]);

  useEffect(() => {
    if (productsLoading || productId || products.length === 0) return;
    const preferred = products.find((item) => item.name.toLocaleLowerCase('pt-BR').includes('alfajor')) ?? products[0];
    setProductId(preferred.id);
  }, [products, productsLoading, productId]);

  useEffect(() => {
    if (offersLoading) return;
    if (offerId && shopeeOffersById.has(offerId)) return;
    setOfferId(shopeeOffers[0]?.mapping.id ?? '');
  }, [shopeeOffers, shopeeOffersById, offersLoading, offerId]);

  useEffect(() => {
    setPresentationId(DIRECT_PRESENTATION_ID);
    setPresentations([]);
    if (!selectedProduct) {
      setVariantId(null);
      return;
    }
    if (selectedProduct.variation_mode !== 'variacoes_fisicas') {
      setVariantId(null);
    }
  }, [selectedProduct?.id, selectedProduct?.variation_mode]);

  useEffect(() => {
    if (!selectedProduct || selectedProduct.variation_mode !== 'variacoes_fisicas' || variantsLoading) return;
    if (variantId && variants.some((variant) => variant.id === variantId && variant.is_active)) return;
    const firstActive = variants.find((variant) => variant.is_active);
    setVariantId(firstActive?.id ?? null);
  }, [selectedProduct, variants, variantsLoading, variantId]);

  useEffect(() => {
    let cancelled = false;
    const canLoad = Boolean(
      selectedProduct &&
      (selectedProduct.variation_mode !== 'variacoes_fisicas' || variantId),
    );

    if (!canLoad || !selectedProduct) {
      setPresentations([]);
      setPresentationId(DIRECT_PRESENTATION_ID);
      return;
    }

    setPresentationsLoading(true);
    listCommercialPresentations(selectedProduct.id, variantId, false)
      .then((items) => {
        if (cancelled) return;
        setPresentations(items);
        setPresentationId(items[0]?.id ?? DIRECT_PRESENTATION_ID);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Erro ao carregar apresentações comerciais do Motor Econômico:', error);
        setPresentations([]);
        setPresentationId(DIRECT_PRESENTATION_ID);
      })
      .finally(() => {
        if (!cancelled) setPresentationsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProduct, variantId, listCommercialPresentations]);

  const directPresentation = useMemo(
    () => directCommercialPresentation(selectedProduct, selectedVariant),
    [selectedProduct, selectedVariant],
  );
  const selectedPresentation = useMemo(
    () => presentationId === DIRECT_PRESENTATION_ID
      ? directPresentation
      : presentations.find((item) => item.id === presentationId) ?? directPresentation,
    [presentationId, presentations, directPresentation],
  );
  const presentationFactor = Number(selectedPresentation.conversion_factor);
  const isAlfajorLab = Boolean(selectedProduct?.name.toLocaleLowerCase('pt-BR').includes('alfajor'));

  const rreResolution = useMemo(
    () => resolveHistoricalShopeeRegime({
      rules: economicRuleCandidates,
      channelAccountId: accountId || null,
      effectiveAt,
      presentationFactor,
      offerMappingId: selectedOffer?.mapping.id ?? null,
    }),
    [
      economicRuleCandidates,
      accountId,
      effectiveAt,
      presentationFactor,
      selectedOffer?.mapping.id,
    ],
  );

  useEffect(() => {
    const regime = rreResolution.regime;
    setCommissionPct(regime?.commissionPct ?? 0);
    setTransactionPct(regime?.transactionPct ?? 0);
    setServicePct(regime?.servicePct ?? 0);
    setAdsPct(0);
    setAffiliatePct(0);
    setRetMCharges(0);
    setRetMBenefits(0);
  }, [accountId, effectiveAt, rreResolution.regime?.id]);

  const resetHistoricalRegime = () => {
    const regime = rreResolution.regime;
    if (!regime) return;
    setCommissionPct(regime.commissionPct);
    setTransactionPct(regime.transactionPct);
    setServicePct(regime.servicePct);
    setAdsPct(0);
    setAffiliatePct(0);
    setRetMCharges(0);
    setRetMBenefits(0);
  };

  const scenario = useMemo(() => calculateLegacyEconomicScenario({
    presentation: presentationFactor,
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
    presentationFactor,
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

  const confidence = {
    label: rreResolution.confidence === 'high'
      ? 'ALTA RRE'
      : rreResolution.confidence === 'medium'
        ? 'MÉDIA RRE'
        : 'BAIXA RRE',
    tone: rreResolution.confidence === 'high'
      ? 'good' as const
      : rreResolution.confidence === 'medium'
        ? 'warn' as const
        : 'danger' as const,
    text: rreResolution.regime
      ? rreResolution.regime.note
      : 'Nenhum regime histórico foi resolvido para a conta selecionada.',
  };

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
              <Badge variant="secondary">{selectedProduct?.name ?? 'Produto não selecionado'}</Badge>
              <Badge className={cn(
                confidence.tone === 'good' && 'bg-emerald-600',
                confidence.tone === 'warn' && 'bg-amber-600',
                confidence.tone === 'danger' && 'bg-destructive',
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
                  <Label>Conta Shopee canônica</Label>
                  <Select
                    value={accountId}
                    onValueChange={setAccountId}
                    disabled={platformsLoading || accountsLoading || activeAccounts.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        platformsLoading || accountsLoading
                          ? 'Carregando contas...'
                          : activeAccounts.length === 0
                            ? 'Nenhuma conta Shopee ativa encontrada'
                            : 'Selecione a conta'
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {activeAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}{account.external_identifier ? ' · ' + account.external_identifier : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!shopeePlatform && !platformsLoading && (
                    <p className="text-xs text-destructive">Plataforma Shopee canônica não encontrada.</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    A conta vem de channel_accounts. O regime é resolvido separadamente pelo RRE.
                  </p>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <Label>Data de referência do regime</Label>
                  <Input type="date" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    Vigência da regra: {rreResolution.regime
                      ? rreResolution.regime.observedFrom + ' a ' + (rreResolution.regime.observedTo ?? 'aberta')
                      : rulesLoading
                        ? 'carregando...'
                        : 'não resolvida'}.
                  </p>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <Label>Produto canônico</Label>
                  <Select
                    value={productId}
                    onValueChange={(value) => {
                      setProductId(value);
                      setVariantId(null);
                    }}
                    disabled={productsLoading || products.length === 0}
                  >
                    <SelectTrigger><SelectValue placeholder={productsLoading ? 'Carregando produtos...' : 'Selecione o produto'} /></SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProduct?.variation_mode === 'variacoes_fisicas' && (
                  <div className="space-y-1.5 col-span-2">
                    <Label>Variante física</Label>
                    <Select
                      value={variantId ?? ''}
                      onValueChange={setVariantId}
                      disabled={variantsLoading || variants.filter((variant) => variant.is_active).length === 0}
                    >
                      <SelectTrigger><SelectValue placeholder={variantsLoading ? 'Carregando variantes...' : 'Selecione a variante'} /></SelectTrigger>
                      <SelectContent>
                        {variants.filter((variant) => variant.is_active).map((variant) => (
                          <SelectItem key={variant.id} value={variant.id}>{variant.variant_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5 col-span-2">
                  <Label>Oferta Shopee canônica</Label>
                  <Select
                    value={offerId}
                    onValueChange={setOfferId}
                    disabled={offersLoading || !accountId || !productId || shopeeOffers.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        offersLoading
                          ? 'Carregando Ofertas...'
                          : shopeeOffers.length === 0
                            ? 'Nenhuma Oferta mapeada para esta identidade'
                            : 'Selecione a Oferta'
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {shopeeOffers.map((offer) => (
                        <SelectItem key={offer.mapping.id} value={offer.mapping.id}>
                          {(offer.mapping.external_product_title || offer.mapping.external_item_key)}
                          {offer.mapping.external_variation ? ' · ' + offer.mapping.external_variation : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {offersError && <p className="text-xs text-destructive">{offersError}</p>}
                  {!offersLoading && !offersError && accountId && productId && shopeeOffers.length === 0 && (
                    <p className="text-xs text-amber-600">
                      A Oferta não está mapeada para esta Conta + Produto/Variante. O RRE mantém a Oferta como pendência.
                    </p>
                  )}
                  {selectedOffer && (
                    <p className="text-xs text-muted-foreground">
                      Item externo: {selectedOffer.mapping.external_item_key} · vínculo {selectedOffer.match === 'direct' ? 'direto' : 'por composição'}
                      {selectedOffer.mapping.physical_multiplier ? ' · multiplicador ' + Number(selectedOffer.mapping.physical_multiplier) : ''}.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Apresentação comercial</Label>
                  <Select
                    value={presentationId}
                    onValueChange={setPresentationId}
                    disabled={
                      presentationsLoading ||
                      !selectedProduct ||
                      (selectedProduct.variation_mode === 'variacoes_fisicas' && !variantId)
                    }
                  >
                    <SelectTrigger><SelectValue placeholder={presentationsLoading ? 'Carregando...' : 'Selecione a apresentação'} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DIRECT_PRESENTATION_ID}>
                        {directPresentation.name}
                      </SelectItem>
                      {presentations.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} · 1 {item.commercial_unit_label} = {Number(item.conversion_factor)} un. físicas
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!presentationsLoading && selectedProduct && presentations.length === 0 && (
                    <p className="text-xs text-amber-600">
                      Nenhuma apresentação cadastrada para esta identidade. O Motor usa somente a unidade direta canônica.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Quantidade comercial Q</Label>
                  <Input type="number" min={1} step={1} value={q} onChange={(e) => setQ(Number(e.target.value))} />
                  <p className="text-xs text-muted-foreground">
                    Conversão atual: 1 {selectedPresentation.commercial_unit_label} = {presentationFactor} unidade(s) física(s).
                  </p>
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

              {isAlfajorLab && presentationFactor === 36 && commonInput.q >= 5 && (
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
                  <Button size="sm" variant="ghost" className="gap-1" onClick={resetHistoricalRegime} disabled={!rreResolution.regime}>
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
                <Badge className={cn(
                  confidence.tone === 'good' && 'bg-emerald-600',
                  confidence.tone === 'warn' && 'bg-amber-600',
                  confidence.tone === 'danger' && 'bg-destructive',
                )}>{confidence.label}</Badge>
                <p className="mt-2 text-sm text-muted-foreground">{confidence.text}</p>
                {rulesError && <p className="mt-2 text-xs text-destructive">{rulesError}</p>}
                {rreResolution.regime && (
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <p>Engine: {rreResolution.regime.engineVersion}</p>
                    <p>Regra: {rreResolution.regime.ruleVersion}</p>
                    <p>
                      Evidência: {rreResolution.regime.sourceRefs.length > 0
                        ? rreResolution.regime.sourceRefs.join(' · ')
                        : 'sem referência vinculada'}
                    </p>
                  </div>
                )}
                {rreResolution.warnings.map((warning) => (
                  <p key={warning} className="mt-2 text-xs text-amber-600">{warning}</p>
                ))}
                <p className="mt-2 text-xs text-muted-foreground">
                  RRE: Conta + vigência + Oferta + evidência. A versão usada fica explícita e regras futuras não reescrevem a regra histórica selecionada.
                </p>
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
