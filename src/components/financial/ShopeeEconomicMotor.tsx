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
  Save,
  GitCompareArrows,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { calculateShopeeAdapterScenario } from '@/lib/economic-engine/shopeeAdapter';
import { composeEconomicResult } from '@/lib/economic-engine/composer';
import { buildGeneralEconomicSnapshot } from '@/lib/economic-engine/snapshot';
import { noB7Occurrence } from '@/lib/economic-engine/b7';
import { useProductsList } from '@/hooks/useProductsList';
import { useProductVariants } from '@/hooks/useProductVariants';
import { useCommercialPresentations } from '@/hooks/useCommercialPresentations';
import { usePlatforms } from '@/hooks/usePlatforms';
import { useChannelAccounts } from '@/hooks/useChannelAccounts';
import { useShopeeOfferMappings } from '@/hooks/useShopeeOfferMappings';
import { useEconomicRuleVersions } from '@/hooks/useEconomicRuleVersions';
import { useEconomicPredictionSnapshots } from '@/hooks/useEconomicPredictionSnapshots';
import { useEconomicB1 } from '@/hooks/useEconomicB1';
import { useEconomicB2B3 } from '@/hooks/useEconomicB2B3';
import { useEconomicB4 } from '@/hooks/useEconomicB4';
import { B4_LOGISTICS_MODE_LABELS, type B4LogisticsMode } from '@/lib/economic-engine/b4';
import { EconomicReconciliationDialog } from '@/components/financial/EconomicReconciliationDialog';
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
  const [b2ConfigurationId, setB2ConfigurationId] = useState<string | null>(null);
  const [b3ConfigurationId, setB3ConfigurationId] = useState<string | null>(null);
  const [b4Mode, setB4Mode] = useState<B4LogisticsMode | null>(null);
  const [b4LogisticsCost, setB4LogisticsCost] = useState<number | null>(null);
  const [b4CustomerFreight, setB4CustomerFreight] = useState<number | null>(null);
  const [b4ChannelSubsidy, setB4ChannelSubsidy] = useState<number | null>(null);
  const [targetMarginPct, setTargetMarginPct] = useState(20);
  const [baselinePrice, setBaselinePrice] = useState(97.85);
  const [reconciliationOpen, setReconciliationOpen] = useState(false);
  const {
    createSnapshot,
    saving: snapshotSaving,
    error: snapshotError,
    lastSnapshotId,
  } = useEconomicPredictionSnapshots();

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
  const { loading: b1Loading, error: b1Error, result: b1Result } = useEconomicB1(
    productId || null,
    variantId,
    isAlfajorLab ? 'provisional-zero-open' : 'unknown',
    effectiveAt,
  );
  const b1OperationalCfu = b1Result?.operationalCfu ?? 0;
  const {
    loading: b2b3Loading,
    error: b2b3Error,
    b2Configurations,
    b3Configurations,
    b2: b2Result,
    b3: b3Result,
  } = useEconomicB2B3(
    productId || null,
    variantId,
    presentationId === DIRECT_PRESENTATION_ID ? null : presentationId,
    effectiveAt,
    b2ConfigurationId,
    b3ConfigurationId,
    q,
  );

  useEffect(() => {
    setB2ConfigurationId(null);
  }, [productId, variantId, presentationId]);

  useEffect(() => {
    setB3ConfigurationId(null);
  }, [productId, variantId]);

  const { error: b4Error, result: b4Result } = useEconomicB4(null, {
    mode: b4Mode,
    logisticsCost: b4LogisticsCost,
    customerFreightPaid: b4CustomerFreight,
    channelFreightSubsidy: b4ChannelSubsidy,
  });

  const physicalVolumeForCost = Math.max(1, presentationFactor * Math.max(1, q));
  const b2KnownCost = b2Result?.composition.blocks.B2.knownNetAmount ?? 0;
  const b3KnownCost = b3Result?.composition.blocks.B3.knownNetAmount ?? 0;
  const b4KnownCost = b4Result.composition.blocks.B4.knownNetAmount;
  const automaticDirectCostPerUnit =
    b1OperationalCfu > 0
      ? ((b1OperationalCfu * physicalVolumeForCost) + b2KnownCost + b3KnownCost + b4KnownCost) / physicalVolumeForCost
      : 0;
  const effectiveCostPerUnit = costPerUnit > 0 ? costPerUnit : automaticDirectCostPerUnit;
  const b1CostSource = costPerUnit > 0
    ? 'manual_override'
    : automaticDirectCostPerUnit > 0
      ? 'b1_b2_b3_b4_operational'
      : 'pending';

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

  const channelAdapter = useMemo(() => calculateShopeeAdapterScenario({
    channelAccountId: accountId || null,
    offerMappingId: selectedOffer?.mapping.id ?? null,
    unitPrice: agreedPrice,
    q,
    presentation: presentationFactor,
    adsPct,
    affiliatePct,
    retMCharges,
    retMBenefits,
    costPerUnit: effectiveCostPerUnit,
    targetMarginPct,
    baselinePrice,
    policy: {
      commissionPct,
      transactionPct,
      servicePct,
      tsiBands: rreResolution.regime?.tsiBands ?? [],
      walls: rreResolution.regime?.walls ?? [],
    },
    rule: {
      engineVersion: rreResolution.regime?.engineVersion ?? '2.0.0',
      ruleVersion: rreResolution.regime?.ruleVersion ?? null,
      effectiveFrom: rreResolution.regime?.observedFrom ?? null,
      effectiveTo: rreResolution.regime?.observedTo ?? null,
      sourceRefs: rreResolution.regime?.sourceRefs ?? [],
      confidence: rreResolution.confidence,
      warnings: rreResolution.warnings,
    },
  }), [
    accountId,
    selectedOffer?.mapping.id,
    agreedPrice,
    q,
    presentationFactor,
    adsPct,
    affiliatePct,
    retMCharges,
    retMBenefits,
    effectiveCostPerUnit,
    targetMarginPct,
    baselinePrice,
    commissionPct,
    transactionPct,
    servicePct,
    rreResolution.regime,
    rreResolution.confidence,
    rreResolution.warnings,
  ]);

  const b5Composition = useMemo(
    () => composeEconomicResult({ components: channelAdapter.components }),
    [channelAdapter.components],
  );
  const generalEconomicSnapshot = useMemo(() => buildGeneralEconomicSnapshot({
    components: [
      ...(b1Result?.components ?? []),
      ...(b2Result?.components ?? []),
      ...(b3Result?.components ?? []),
      ...b4Result.components,
      ...channelAdapter.components,
      ...noB7Occurrence(),
    ],
    pendingBlocks: {
      ...(!b1Result ? { B1: 'B1 ainda não resolvido.' } : {}),
      ...(!b2Result ? { B2: 'Configuração B2 não resolvida para a previsão.' } : {}),
      ...(!b3Result ? { B3: 'Configuração B3 não resolvida para a previsão.' } : {}),
      ...(!b4Mode ? { B4: 'Modalidade logística B4 não selecionada.' } : {}),
      B6: 'Financeiro/Fiscal direto ainda não atribuído para esta previsão.',
      B8: 'Overhead sem metodologia homologada nesta fase.',
      B9: 'Capital/estoque sem metodologia homologada nesta fase.',
    },
  }), [
    b1Result,
    b2Result,
    b3Result,
    b4Result.components,
    channelAdapter.components,
    b2ConfigurationId,
    b3ConfigurationId,
    b4Mode,
  ]);


  const {
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
  } = channelAdapter.scenario;
  const commonInput = { q: Math.max(1, Math.floor(q || 1)) };
  const tsiBand = result.tsiBand?.label ?? 'PENDENTE';

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

  const freezePrediction = async () => {
    if (!accountId || !productId) return;

    await createSnapshot({
      snapshot_schema_version: '2.0.0',
      engine_key: 'shopee-economic-v2',
      engine_version: rreResolution.regime?.engineVersion ?? '2.0.0',
      rule_version_id: rreResolution.regime?.id ?? null,
      rule_version: rreResolution.regime?.ruleVersion ?? null,
      marketplace: 'shopee',
      channel_account_id: accountId,
      marketplace_product_mapping_id: selectedOffer?.mapping.id ?? null,
      product_id: productId,
      variant_id: variantId,
      commercial_presentation_id: presentationId === DIRECT_PRESENTATION_ID ? null : presentationId,
      effective_at: effectiveAt,
      confidence: rreResolution.confidence,
      input_snapshot: {
        accountId,
        offer: selectedOffer ? {
          mappingId: selectedOffer.mapping.id,
          externalItemKey: selectedOffer.mapping.external_item_key,
          externalProductTitle: selectedOffer.mapping.external_product_title,
          externalVariation: selectedOffer.mapping.external_variation,
          match: selectedOffer.match,
          physicalMultiplier: Number(selectedOffer.mapping.physical_multiplier),
        } : null,
        product: selectedProduct ? {
          id: selectedProduct.id,
          name: selectedProduct.name,
        } : null,
        variant: selectedVariant ? {
          id: selectedVariant.id,
          name: selectedVariant.variant_name,
        } : null,
        presentation: {
          id: presentationId === DIRECT_PRESENTATION_ID ? null : presentationId,
          name: selectedPresentation.name,
          commercialUnitLabel: selectedPresentation.commercial_unit_label,
          conversionFactor: presentationFactor,
        },
        q: commonInput.q,
        volumePhysical,
        originalPrice,
        agreedPrice,
        commissionPct,
        transactionPct,
        servicePct,
        b5Rule: {
          adapter: channelAdapter.meta.adapter,
          ruleVersion: channelAdapter.meta.rule.ruleVersion,
          effectiveFrom: channelAdapter.meta.rule.effectiveFrom,
          effectiveTo: channelAdapter.meta.rule.effectiveTo,
          tsiBands: rreResolution.regime?.tsiBands ?? [],
          walls: rreResolution.regime?.walls ?? [],
        },
        adsPct,
        affiliatePct,
        retMCharges,
        retMBenefits,
        costPerUnit: effectiveCostPerUnit > 0 ? effectiveCostPerUnit : null,
        costSource: b1CostSource,
        directCostComposition: {
          physicalVolume: physicalVolumeForCost,
          b1UnitCfu: b1OperationalCfu,
          b1Total: b1OperationalCfu * physicalVolumeForCost,
          b2ConfigurationId,
          b2KnownCost,
          b3ConfigurationId,
          b3KnownCost,
          b4Mode,
          b4KnownCost,
          b4Funding: b4Result.funding,
          automaticCostPerUnit: automaticDirectCostPerUnit,
        },
        b1: b1Result ? {
          operationalCfu: b1Result.operationalCfu,
          completeCfu: b1Result.completeCfu,
          completeness: b1Result.composition.blocks.B1.completeness,
          pendingComponentIds: b1Result.composition.blocks.B1.pendingComponentIds,
          blockedComponentIds: b1Result.composition.blocks.B1.blockedComponentIds,
        } : null,
        targetMarginPct,
        baselinePrice,
      },
      result_snapshot: {
        ticket: result.ticket,
        commission: result.commission,
        transaction: result.transaction,
        serviceAdditional: result.serviceAdditional,
        adsEasy: result.adsEasy,
        affiliate: result.affiliate,
        tsiBand,
        tsiUnit: result.tsiUnit,
        tsiTotal: result.tsiTotal,
        serviceTotal: result.serviceTotal,
        retMChargesTotal: result.retMChargesTotal,
        retMBenefitsTotal: result.retMBenefitsTotal,
        repasse: result.repasse,
        shopeeAbsorption: result.shopeeAbsorption,
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
        economic: generalEconomicSnapshot,
      },
      evidence_snapshot: {
        confidence: rreResolution.confidence,
        matchedBy: rreResolution.matchedBy,
        warnings: rreResolution.warnings,
        b2Configuration: b2Result ? {
          id: b2Result.configuration.id,
          code: b2Result.configuration.code,
          name: b2Result.configuration.name,
          completeness: b2Result.composition.blocks.B2.completeness,
        } : null,
        b3Configuration: b3Result ? {
          id: b3Result.configuration.id,
          code: b3Result.configuration.code,
          name: b3Result.configuration.name,
          completeness: b3Result.composition.blocks.B3.completeness,
        } : null,
        b2Components: b2Result?.components ?? [],
        b3Components: b3Result?.components ?? [],
        b4: {
          mode: b4Result.mode,
          source: b4Result.source,
          funding: b4Result.funding,
          completeness: b4Result.composition.blocks.B4.completeness,
        },
        b4Components: b4Result.components,
        b5: {
          adapter: channelAdapter.meta.adapter,
          confidence: channelAdapter.meta.confidence,
          completeness: b5Composition.blocks.B5.completeness,
          knownNetAmount: b5Composition.blocks.B5.knownNetAmount,
          warnings: channelAdapter.meta.warnings,
        },
        b5Components: channelAdapter.components,
        b1Components: b1Result?.components.map((component) => ({
          id: component.id,
          block: component.block,
          subcategory: component.subcategory,
          itemName: component.itemName,
          amount: component.amount,
          numericNature: component.numericNature,
          costState: component.costState,
          knowledgeState: component.knowledgeState,
          sourceDomain: component.sourceDomain,
          sourceEntity: component.sourceEntity,
          sourceId: component.sourceId,
          observedAt: component.observedAt,
        })) ?? [],
        rule: rreResolution.regime ? {
          id: rreResolution.regime.id,
          engineVersion: rreResolution.regime.engineVersion,
          ruleVersion: rreResolution.regime.ruleVersion,
          effectiveFrom: rreResolution.regime.observedFrom,
          effectiveTo: rreResolution.regime.observedTo,
          sourceRefs: rreResolution.regime.sourceRefs,
          offerSpecific: rreResolution.regime.offerSpecific,
        } : null,
      },
      pending_snapshot: [
        ...rreResolution.missing,
        ...(b1Result?.composition.blocks.B1.pendingComponentIds ?? []),
        ...(b1Result?.composition.blocks.B1.blockedComponentIds ?? []),
        ...(!b2ConfigurationId ? ['B2_CONFIGURATION_UNSELECTED'] : []),
        ...(!b3ConfigurationId ? ['B3_CONFIGURATION_UNSELECTED'] : []),
        ...(b2Result?.composition.blocks.B2.pendingComponentIds ?? []),
        ...(b2Result?.composition.blocks.B2.blockedComponentIds ?? []),
        ...(b3Result?.composition.blocks.B3.pendingComponentIds ?? []),
        ...(b3Result?.composition.blocks.B3.blockedComponentIds ?? []),
        ...(!b4Mode ? ['B4_MODE_UNSELECTED'] : []),
        ...(b4Result.composition.blocks.B4.pendingComponentIds ?? []),
        ...(b4Result.composition.blocks.B4.blockedComponentIds ?? []),
        ...(b5Composition.blocks.B5.pendingComponentIds ?? []),
        ...(b5Composition.blocks.B5.blockedComponentIds ?? []),
        ...generalEconomicSnapshot.pendingComponentIds,
        ...generalEconomicSnapshot.blockedComponentIds,
      ],
    });
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
                Motor em evolução B1–B4 sobre o patrimônio MV2. Histórico orienta; transação real decide.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setReconciliationOpen(true)}
                disabled={!accountId || !productId}
              >
                <GitCompareArrows className="h-3.5 w-3.5" />
                Reconciliar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={freezePrediction}
                disabled={snapshotSaving || !accountId || !productId}
              >
                <Save className="h-3.5 w-3.5" />
                {snapshotSaving ? 'Congelando...' : 'Congelar previsão'}
              </Button>
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

                <div className="space-y-1.5 col-span-2 rounded-lg border p-3">
                  <p className="text-sm font-medium">B2 — Apresentação física</p>
                  <Select
                    value={b2ConfigurationId ?? '__none__'}
                    onValueChange={(value) => setB2ConfigurationId(value === '__none__' ? null : value)}
                    disabled={b2b3Loading}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione a configuração B2" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Não definida — manter pendente</SelectItem>
                      {b2Configurations.map((configuration) => (
                        <SelectItem key={configuration.id} value={configuration.id}>
                          {configuration.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {b2Result
                      ? 'Custo B2 conhecido no cenário: ' + money(b2KnownCost)
                      : b2Configurations.length === 0
                        ? 'Nenhuma configuração B2 cadastrada para esta apresentação.'
                        : 'Escolha explicitamente como esta apresentação será montada.'}
                  </p>
                </div>

                <div className="space-y-1.5 col-span-2 rounded-lg border p-3">
                  <p className="text-sm font-medium">B3 — Preparação / fulfillment</p>
                  <Select
                    value={b3ConfigurationId ?? '__none__'}
                    onValueChange={(value) => setB3ConfigurationId(value === '__none__' ? null : value)}
                    disabled={b2b3Loading}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione a configuração B3" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Não definida — manter pendente</SelectItem>
                      {b3Configurations.map((configuration) => (
                        <SelectItem key={configuration.id} value={configuration.id}>
                          {configuration.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {b3Result
                      ? 'Custo B3 conhecido no pedido: ' + money(b3KnownCost)
                      : b3Configurations.length === 0
                        ? 'Nenhuma configuração B3 cadastrada para esta identidade.'
                        : 'Escolha explicitamente como o pedido será preparado.'}
                  </p>
                  {b2b3Error && <p className="text-xs text-destructive">{b2b3Error}</p>}
                </div>

                <div className="space-y-2 col-span-2 rounded-lg border p-3">
                  <p className="text-sm font-medium">B4 — Logística / distribuição</p>
                  <Select
                    value={b4Mode ?? '__none__'}
                    onValueChange={(value) => {
                      const next = value === '__none__' ? null : value as B4LogisticsMode;
                      setB4Mode(next);
                      if (next === 'retirada_fabrica') setB4LogisticsCost(0);
                      if (next !== 'retirada_fabrica' && b4LogisticsCost === 0) setB4LogisticsCost(null);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione a modalidade logística" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Não definida — manter pendente</SelectItem>
                      {Object.entries(B4_LOGISTICS_MODE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Custo logístico R$</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={b4LogisticsCost ?? ''}
                        disabled={b4Mode === 'retirada_fabrica'}
                        onChange={(e) => setB4LogisticsCost(e.target.value === '' ? null : Number(e.target.value))}
                        placeholder="Pendente"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Frete pago cliente R$</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={b4CustomerFreight ?? ''}
                        onChange={(e) => setB4CustomerFreight(e.target.value === '' ? null : Number(e.target.value))}
                        placeholder="Pendente"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Subsídio canal R$</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={b4ChannelSubsidy ?? ''}
                        onChange={(e) => setB4ChannelSubsidy(e.target.value === '' ? null : Number(e.target.value))}
                        placeholder="Pendente"
                      />
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      Custo B4 conhecido: <strong>{money(b4KnownCost)}</strong>
                      {' · '}estado {b4Result.composition.blocks.B4.completeness}
                    </p>
                    <p>
                      Custo logístico, frete cobrado e subsídio são fatos distintos; o Motor não usa um para apagar o outro.
                    </p>
                    {b4Result.funding.sellerAbsorptionKnown !== null && (
                      <p>Parcela conhecida absorvida pela empresa: <strong>{money(b4Result.funding.sellerAbsorptionKnown)}</strong>.</p>
                    )}
                    {b4Error && <p className="text-destructive">{b4Error}</p>}
                  </div>
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
                  <p className="text-sm font-medium">B5 / RET-E — adaptador Shopee</p>
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
                <p className="text-xs text-muted-foreground">Preencha apenas quando houver evidência para a transação. Estes modificadores pertencem ao B5 do adaptador Shopee e não são aplicados automaticamente por conta.</p>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-sm font-medium">B1 + B2 + B3 + B4 / custo direto operacional</p>
                <div className="rounded-md bg-muted/30 p-2 text-xs space-y-1">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">CFU B1 automático</span>
                    <strong>{b1Loading ? 'Carregando...' : b1OperationalCfu > 0 ? money(b1OperationalCfu) : 'Pendente'}</strong>
                  </div>
                  {b1Result && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Estado B1</span>
                      <span>{b1Result.composition.blocks.B1.completeness}</span>
                    </div>
                  )}
                  {b1Result?.warning && <p className="text-amber-600">{b1Result.warning}</p>}
                  {b1Error && <p className="text-destructive">{b1Error}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Override manual custo direto / unidade</Label>
                    <Input type="number" min={0} step="0.01" value={costPerUnit} onChange={(e) => setCostPerUnit(Number(e.target.value))} />
                    <p className="text-xs text-muted-foreground">0 = usar B1 + B2 + B3 + B4 automáticos conhecidos. Override permanece explícito e não altera as fontes canônicas.</p>
                  </div>
                  <div className="space-y-1.5"><Label>Margem-alvo %</Label><Input type="number" min={0} max={95} step="1" value={targetMarginPct} onChange={(e) => setTargetMarginPct(Number(e.target.value))} /></div>
                  <div className="space-y-1.5 col-span-2"><Label>Preço baseline para TCE-BE</Label><Input type="number" min={0} step="0.01" value={baselinePrice} onChange={(e) => setBaselinePrice(Number(e.target.value))} /></div>
                </div>
                {effectiveCostPerUnit <= 0 && <p className="text-xs text-amber-600">Custo direto econômico ainda pendente. PMR, margem e TCE-BE permanecem desativados.</p>}
                {effectiveCostPerUnit > 0 && <p className="text-xs text-muted-foreground">Custo direto usado no cenário: {money(effectiveCostPerUnit)} · fonte {b1CostSource === 'manual_override' ? 'override manual' : 'B1 + B2 + B3 + B4 operacionais conhecidos'}.</p>}
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
                <p className="pt-1 text-xs text-muted-foreground">B5 via ShopeeAdapter · cada componente é arredondado para centavos antes da soma. Estado: {b5Composition.blocks.B5.completeness}.</p>
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
                {!nextWall && <p className="text-sm text-muted-foreground">Sem nova parede versionada acima da faixa atual.</p>}
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
                <div className="flex justify-between"><span className="text-muted-foreground">Custo direto usado</span><span>{effectiveCostPerUnit > 0 ? money(effectiveCostPerUnit) : 'PENDENTE'}</span></div>
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
                    TSI, paredes, taxas e regimes são consumidos pelo ShopeeAdapter a partir da regra versionada. Quando a data estiver fora da vigência, permanecem referência histórica; a transação real continua decidindo a reconciliação.
                  </p>
                  {snapshotError && <p className="mt-2 text-xs text-destructive">{snapshotError}</p>}
                  {lastSnapshotId && (
                    <p className="mt-2 text-xs text-emerald-600">
                      Previsão congelada como snapshot imutável: {lastSnapshotId}.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <EconomicReconciliationDialog
        open={reconciliationOpen}
        onOpenChange={setReconciliationOpen}
        channelAccountId={accountId || null}
        productId={productId || null}
      />
    </div>
  );
}
