import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  buildConfiguredBlockComponents,
  type EconomicConfiguration,
  type EconomicConfigurationLine,
} from '@/lib/economic-engine/configuration';
import { composeEconomicResult } from '@/lib/economic-engine/composer';

const db = supabase as any;

type ConfigurationRow = {
  id: string;
  block: 'B2' | 'B3';
  product_id: string;
  variant_id: string | null;
  commercial_presentation_id: string | null;
  code: string;
  name: string;
  is_active: boolean;
  is_zero_confirmed: boolean;
  notes: string | null;
};

type ConfigurationComponentRow = {
  id: string;
  configuration_id: string;
  component_product_id: string;
  component_variant_id: string | null;
  subcategory: string | null;
  quantity: number;
  incidence: 'I-A' | 'I-P' | 'I-V' | 'I-H' | 'I-E' | 'I-Q';
  notes: string | null;
  component?: { id: string; name: string; unit: string | null; cost: number | null } | null;
  component_variant?: { id: string; variant_name: string; unit: string | null; cost_override: number | null } | null;
};

type PurchaseRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  unit_price: number | null;
  conversion_factor: number | null;
  order?: { status: string; ordered_at: string | null; created_at: string } | null;
};

function identityKey(productId: string, variantId: string | null) {
  return productId + ':' + (variantId ?? 'base');
}

function positive(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toConfiguration(row: ConfigurationRow): EconomicConfiguration {
  return {
    id: row.id,
    block: row.block,
    code: row.code,
    name: row.name,
    isZeroConfirmed: row.is_zero_confirmed,
    productId: row.product_id,
    variantId: row.variant_id,
    commercialPresentationId: row.commercial_presentation_id,
    notes: row.notes,
  };
}

export function useEconomicB2B3(
  productId: string | null,
  variantId: string | null,
  commercialPresentationId: string | null,
  effectiveAt: string | null,
  b2ConfigurationId: string | null,
  b3ConfigurationId: string | null,
  commercialQuantityQ: number,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configurations, setConfigurations] = useState<ConfigurationRow[]>([]);
  const [configurationComponents, setConfigurationComponents] = useState<ConfigurationComponentRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);

  useEffect(() => {
    if (!productId) {
      setConfigurations([]);
      setConfigurationComponents([]);
      setPurchases([]);
      setError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const configurationResult = await db
        .from('economic_cost_configurations')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .in('block', ['B2', 'B3'])
        .order('block')
        .order('name');

      if (cancelled) return;
      if (configurationResult.error) {
        setError(configurationResult.error.message || 'Não foi possível carregar configurações B2/B3.');
        setLoading(false);
        return;
      }

      const rows = ((configurationResult.data ?? []) as ConfigurationRow[]).filter((row) => {
        if (row.variant_id !== variantId) return false;
        if (row.block === 'B2') return row.commercial_presentation_id === commercialPresentationId;
        return row.commercial_presentation_id === null;
      });

      const configurationIds = rows.map((row) => row.id);
      let componentRows: ConfigurationComponentRow[] = [];

      if (configurationIds.length > 0) {
        const componentsResult = await db
          .from('economic_cost_configuration_components')
          .select(`
            id,configuration_id,component_product_id,component_variant_id,subcategory,quantity,incidence,notes,
            component:products!economic_cost_configuration_components_component_product_id_fkey(id,name,unit,cost),
            component_variant:product_variants!economic_cost_configuration_components_component_variant_id_fkey(id,variant_name,unit,cost_override)
          `)
          .in('configuration_id', configurationIds)
          .order('sort_order');

        if (cancelled) return;
        if (componentsResult.error) {
          setError(componentsResult.error.message || 'Não foi possível carregar componentes B2/B3.');
          setLoading(false);
          return;
        }
        componentRows = (componentsResult.data ?? []) as ConfigurationComponentRow[];
      }

      const componentProductIds = Array.from(new Set(componentRows.map((row) => row.component_product_id)));
      let purchaseRows: PurchaseRow[] = [];

      if (componentProductIds.length > 0) {
        const purchaseResult = await db
          .from('purchase_order_items')
          .select(`
            id,product_id,variant_id,unit_price,conversion_factor,
            order:purchase_orders!purchase_order_items_purchase_order_id_fkey(status,ordered_at,created_at)
          `)
          .in('product_id', componentProductIds);

        if (cancelled) return;
        if (purchaseResult.error) {
          setError(purchaseResult.error.message || 'Não foi possível carregar custos dos componentes B2/B3.');
          setLoading(false);
          return;
        }
        purchaseRows = (purchaseResult.data ?? []) as PurchaseRow[];
      }

      setConfigurations(rows);
      setConfigurationComponents(componentRows);
      setPurchases(purchaseRows);
      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [productId, variantId, commercialPresentationId]);

  const latestPurchases = useMemo(() => {
    const map = new Map<string, { unitCost: number; occurredAt: string; sourceId: string }>();

    for (const row of purchases) {
      if (!row.order || row.order.status === 'rascunho' || row.order.status === 'cancelado') continue;
      const price = positive(row.unit_price);
      const factor = positive(row.conversion_factor);
      if (price === null || factor === null) continue;

      const occurredAt = row.order.ordered_at ?? row.order.created_at;
      const timestamp = new Date(occurredAt).getTime();
      if (!Number.isFinite(timestamp)) continue;

      if (effectiveAt) {
        const cutoff = new Date(effectiveAt.slice(0, 10) + 'T23:59:59.999Z').getTime();
        if (Number.isFinite(cutoff) && timestamp > cutoff) continue;
      }

      const key = identityKey(row.product_id, row.variant_id);
      const current = map.get(key);
      if (!current || new Date(current.occurredAt).getTime() < timestamp) {
        map.set(key, { unitCost: price / factor, occurredAt, sourceId: row.id });
      }
    }

    return map;
  }, [purchases, effectiveAt]);

  const resolved = useMemo(() => {
    const b2Configurations = configurations.filter((row) => row.block === 'B2').map(toConfiguration);
    const b3Configurations = configurations.filter((row) => row.block === 'B3').map(toConfiguration);

    const resolve = (configurationId: string | null, block: 'B2' | 'B3') => {
      if (!configurationId) return null;
      const row = configurations.find((item) => item.id === configurationId && item.block === block);
      if (!row) return null;

      const lines: EconomicConfigurationLine[] = configurationComponents
        .filter((item) => item.configuration_id === row.id)
        .map((item) => {
          const purchase = latestPurchases.get(identityKey(item.component_product_id, item.component_variant_id)) ?? null;
          const override = positive(item.component_variant?.cost_override);
          const stored = positive(item.component?.cost);

          return {
            id: item.id,
            componentProductId: item.component_product_id,
            componentVariantId: item.component_variant_id,
            componentName: item.component?.name ?? 'Componente',
            componentVariantName: item.component_variant?.variant_name ?? null,
            unit: item.component_variant?.unit ?? item.component?.unit ?? null,
            quantity: Number(item.quantity) || 0,
            incidence: item.incidence,
            subcategory: item.subcategory,
            latestPurchase: purchase ? {
              source: 'latest_purchase',
              unitCost: purchase.unitCost,
              occurredAt: purchase.occurredAt,
              sourceId: purchase.sourceId,
            } : null,
            variantOverride: override !== null ? {
              source: 'variant_override',
              unitCost: override,
              sourceId: item.component_variant_id,
            } : null,
            productCost: stored !== null ? {
              source: 'product_cost',
              unitCost: stored,
              sourceId: item.component_product_id,
            } : null,
          };
        });

      const configuration = toConfiguration(row);
      const occurrenceMultiplier = block === 'B2'
        ? Math.max(1, Number.isFinite(commercialQuantityQ) ? commercialQuantityQ : 1)
        : 1;
      const components = buildConfiguredBlockComponents({
        configuration,
        lines,
        occurrenceMultiplier,
      });
      const composition = composeEconomicResult({ components });
      return { configuration, components, composition };
    };

    return {
      b2Configurations,
      b3Configurations,
      b2: resolve(b2ConfigurationId, 'B2'),
      b3: resolve(b3ConfigurationId, 'B3'),
    };
  }, [
    configurations,
    configurationComponents,
    latestPurchases,
    b2ConfigurationId,
    b3ConfigurationId,
    commercialQuantityQ,
  ]);

  return { loading, error, ...resolved };
}
