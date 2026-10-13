import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  buildB2Components,
  buildB3Components,
  type EconomicConfigComponentInput,
  type EconomicConfigInput,
} from '@/lib/economic-engine/b2b3';

const db = supabase as any;

type PresentationConfigRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  commercial_presentation_id: string | null;
  code: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
  zero_confirmed: boolean;
  notes: string | null;
};

type FulfillmentConfigRow = {
  id: string;
  code: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
  zero_confirmed: boolean;
  notes: string | null;
};

type ConfigComponentRow = {
  id: string;
  config_id: string;
  component_product_id: string;
  component_variant_id: string | null;
  quantity: number;
  incidence?: string | null;
  native_grain?: string | null;
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

export type ResolvedEconomicConfig = {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  zeroConfirmed: boolean;
  components: EconomicConfigComponentInput[];
  economicComponents: ReturnType<typeof buildB2Components>;
};

function identityKey(productId: string, variantId: string | null) {
  return productId + ':' + (variantId ?? 'base');
}

function positive(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function useEconomicB2B3(
  productId: string | null,
  variantId: string | null,
  commercialPresentationId: string | null,
  effectiveAt?: string | null,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [b2Rows, setB2Rows] = useState<PresentationConfigRow[]>([]);
  const [b2ComponentRows, setB2ComponentRows] = useState<ConfigComponentRow[]>([]);
  const [b3Rows, setB3Rows] = useState<FulfillmentConfigRow[]>([]);
  const [b3ComponentRows, setB3ComponentRows] = useState<ConfigComponentRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);

  useEffect(() => {
    if (!productId) {
      setB2Rows([]);
      setB2ComponentRows([]);
      setB3Rows([]);
      setB3ComponentRows([]);
      setPurchases([]);
      setError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      let b2Query = db.from('economic_presentation_configs')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true);

      b2Query = variantId
        ? b2Query.eq('variant_id', variantId)
        : b2Query.is('variant_id', null);

      b2Query = commercialPresentationId
        ? b2Query.eq('commercial_presentation_id', commercialPresentationId)
        : b2Query.is('commercial_presentation_id', null);

      const [b2Result, b3Result] = await Promise.all([
        b2Query.order('is_default', { ascending: false }).order('name'),
        db.from('economic_fulfillment_configs')
          .select('*')
          .eq('is_active', true)
          .order('is_default', { ascending: false })
          .order('name'),
      ]);

      if (cancelled) return;
      const firstError = b2Result.error || b3Result.error;
      if (firstError) {
        setError(firstError.message || 'Não foi possível carregar configurações B2/B3.');
        setLoading(false);
        return;
      }

      const loadedB2 = (b2Result.data ?? []) as PresentationConfigRow[];
      const loadedB3 = (b3Result.data ?? []) as FulfillmentConfigRow[];
      const b2Ids = loadedB2.map((row) => row.id);
      const b3Ids = loadedB3.map((row) => row.id);

      const [b2ComponentsResult, b3ComponentsResult] = await Promise.all([
        b2Ids.length === 0
          ? Promise.resolve({ data: [], error: null })
          : db.from('economic_presentation_config_components')
              .select(`
                id,config_id,component_product_id,component_variant_id,quantity,
                component:products!economic_presentation_config_components_component_product_id_fkey(id,name,unit,cost),
                component_variant:product_variants!economic_presentation_config_components_component_variant_id_fkey(id,variant_name,unit,cost_override)
              `)
              .in('config_id', b2Ids),
        b3Ids.length === 0
          ? Promise.resolve({ data: [], error: null })
          : db.from('economic_fulfillment_config_components')
              .select(`
                id,config_id,component_product_id,component_variant_id,quantity,incidence,native_grain,
                component:products!economic_fulfillment_config_components_component_product_id_fkey(id,name,unit,cost),
                component_variant:product_variants!economic_fulfillment_config_components_component_variant_id_fkey(id,variant_name,unit,cost_override)
              `)
              .in('config_id', b3Ids),
      ]);

      if (cancelled) return;
      const componentsError = b2ComponentsResult.error || b3ComponentsResult.error;
      if (componentsError) {
        setError(componentsError.message || 'Não foi possível carregar componentes B2/B3.');
        setLoading(false);
        return;
      }

      const loadedB2Components = (b2ComponentsResult.data ?? []) as ConfigComponentRow[];
      const loadedB3Components = (b3ComponentsResult.data ?? []) as ConfigComponentRow[];
      const componentIds = Array.from(new Set(
        [...loadedB2Components, ...loadedB3Components].map((row) => row.component_product_id),
      ));

      let purchaseRows: PurchaseRow[] = [];
      if (componentIds.length > 0) {
        const purchaseResult = await db.from('purchase_order_items')
          .select(`
            id,product_id,variant_id,unit_price,conversion_factor,
            order:purchase_orders!purchase_order_items_purchase_order_id_fkey(status,ordered_at,created_at)
          `)
          .in('product_id', componentIds);

        if (cancelled) return;
        if (purchaseResult.error) {
          setError(purchaseResult.error.message || 'Não foi possível carregar custos das configurações B2/B3.');
          setLoading(false);
          return;
        }

        purchaseRows = (purchaseResult.data ?? []) as PurchaseRow[];
      }

      setB2Rows(loadedB2);
      setB2ComponentRows(loadedB2Components);
      setB3Rows(loadedB3);
      setB3ComponentRows(loadedB3Components);
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
        map.set(key, {
          unitCost: price / factor,
          occurredAt,
          sourceId: row.id,
        });
      }
    }

    return map;
  }, [purchases, effectiveAt]);

  const toConfigComponents = (rows: ConfigComponentRow[]): EconomicConfigComponentInput[] =>
    rows.map((row) => {
      const purchase = latestPurchases.get(identityKey(row.component_product_id, row.component_variant_id)) ?? null;
      const variantOverride = positive(row.component_variant?.cost_override);
      const productCost = positive(row.component?.cost);

      return {
        id: row.id,
        componentProductId: row.component_product_id,
        componentVariantId: row.component_variant_id,
        componentName: row.component?.name ?? 'Componente',
        componentVariantName: row.component_variant?.variant_name ?? null,
        unit: row.component_variant?.unit ?? row.component?.unit ?? null,
        quantity: Number(row.quantity) || 0,
        incidence: (row.incidence as any) ?? undefined,
        nativeGrain: row.native_grain ?? null,
        latestPurchase: purchase ? {
          source: 'latest_purchase',
          unitCost: purchase.unitCost,
          sourceId: purchase.sourceId,
          occurredAt: purchase.occurredAt,
        } : null,
        variantOverride: variantOverride !== null ? {
          source: 'variant_override',
          unitCost: variantOverride,
          sourceId: row.component_variant_id,
        } : null,
        productCost: productCost !== null ? {
          source: 'product_cost',
          unitCost: productCost,
          sourceId: row.component_product_id,
        } : null,
      };
    });

  const b2Configs = useMemo<ResolvedEconomicConfig[]>(() => {
    if (!commercialPresentationId) {
      const config: EconomicConfigInput = {
        id: '__b2_no_additional__',
        code: 'SEM_APRESENTACAO_ADICIONAL',
        name: 'Sem apresentação adicional',
        zeroConfirmed: true,
        components: [],
      };
      return [{
        id: config.id,
        code: config.code,
        name: config.name,
        isDefault: true,
        zeroConfirmed: true,
        components: [],
        economicComponents: buildB2Components(config),
      }];
    }

    return b2Rows.map((row) => {
      const components = toConfigComponents(b2ComponentRows.filter((item) => item.config_id === row.id));
      const config: EconomicConfigInput = {
        id: row.id,
        code: row.code,
        name: row.name,
        zeroConfirmed: row.zero_confirmed,
        components,
      };
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        isDefault: row.is_default,
        zeroConfirmed: row.zero_confirmed,
        components,
        economicComponents: buildB2Components(config),
      };
    });
  }, [commercialPresentationId, b2Rows, b2ComponentRows, latestPurchases]);

  const b3Configs = useMemo<ResolvedEconomicConfig[]>(() =>
    b3Rows.map((row) => {
      const components = toConfigComponents(b3ComponentRows.filter((item) => item.config_id === row.id));
      const config: EconomicConfigInput = {
        id: row.id,
        code: row.code,
        name: row.name,
        zeroConfirmed: row.zero_confirmed,
        components,
      };
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        isDefault: row.is_default,
        zeroConfirmed: row.zero_confirmed,
        components,
        economicComponents: buildB3Components(config),
      };
    }),
  [b3Rows, b3ComponentRows, latestPurchases]);

  return { loading, error, b2Configs, b3Configs };
}
