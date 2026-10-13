import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildB1Components, type B1BomLine, type B1LossMode, type B1Process } from '@/lib/economic-engine/b1';
import { composeEconomicResult } from '@/lib/economic-engine/composer';

const db = supabase as any;

type ProductRow = {
  id: string;
  name: string;
  is_manufactured: boolean;
  variation_mode: string;
};

type BomRow = {
  id: string;
  component_id: string;
  variant_id: string | null;
  product_variant_id: string | null;
  qty_per_unit: number;
  component?: { id: string; name: string; category: string | null; unit: string | null; cost: number | null } | null;
  component_variant?: { id: string; variant_name: string; unit: string | null; cost_override: number | null } | null;
};

type ProcessRow = {
  id: string;
  process_id: string;
  cost_per_unit: number | null;
  is_active: boolean;
  process?: { id: string; name: string } | null;
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
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function useEconomicB1(
  productId: string | null,
  variantId: string | null,
  lossMode: B1LossMode = 'unknown',
  effectiveAt?: string | null,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductRow | null>(null);
  const [bom, setBom] = useState<BomRow[]>([]);
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);

  useEffect(() => {
    if (!productId) {
      setProduct(null);
      setBom([]);
      setProcesses([]);
      setPurchases([]);
      setError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const [productResult, bomResult, processResult] = await Promise.all([
        db.from('products')
          .select('id,name,is_manufactured,variation_mode')
          .eq('id', productId)
          .single(),
        db.from('product_components')
          .select(`
            id,component_id,variant_id,product_variant_id,qty_per_unit,
            component:products!product_components_component_id_fkey(id,name,category,unit,cost),
            component_variant:product_variants!product_components_variant_id_fkey(id,variant_name,unit,cost_override)
          `)
          .eq('product_id', productId),
        db.from('product_processes')
          .select('id,process_id,cost_per_unit,is_active,process:processes(id,name)')
          .eq('product_id', productId)
          .eq('is_active', true),
      ]);

      if (cancelled) return;
      const firstError = productResult.error || bomResult.error || processResult.error;
      if (firstError) {
        setError(firstError.message || 'Não foi possível resolver o B1.');
        setLoading(false);
        return;
      }

      const loadedBom = (bomResult.data ?? []) as BomRow[];
      const componentIds = Array.from(new Set(loadedBom.map((line) => line.component_id)));

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
          setError(purchaseResult.error.message || 'Não foi possível carregar compras do B1.');
          setLoading(false);
          return;
        }
        purchaseRows = (purchaseResult.data ?? []) as PurchaseRow[];
      }

      setProduct(productResult.data as ProductRow);
      setBom(loadedBom);
      setProcesses((processResult.data ?? []) as ProcessRow[]);
      setPurchases(purchaseRows);
      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [productId]);

  const latestPurchases = useMemo(() => {
    const result = new Map<string, { unitCost: number; occurredAt: string; sourceId: string }>();

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
      const current = result.get(key);
      if (!current || new Date(current.occurredAt).getTime() < timestamp) {
        result.set(key, {
          unitCost: price / factor,
          occurredAt,
          sourceId: row.id,
        });
      }
    }

    return result;
  }, [purchases, effectiveAt]);

  const result = useMemo(() => {
    if (!productId || !product) return null;

    if (!product.is_manufactured) {
      return {
        components: [],
        composition: composeEconomicResult({ components: [] }),
        operationalCfu: null,
        completeCfu: null,
        warning: 'G3 B1 está conectado inicialmente a produtos fabricados.',
      };
    }

    const relevantBom = bom.filter((line) =>
      variantId ? line.product_variant_id === variantId : line.product_variant_id === null,
    );

    const bomLines: B1BomLine[] = relevantBom.map((line) => {
      const purchase = latestPurchases.get(identityKey(line.component_id, line.variant_id)) ?? null;
      const override = positive(line.component_variant?.cost_override);
      const stored = positive(line.component?.cost);

      return {
        id: line.id,
        componentId: line.component_id,
        componentVariantId: line.variant_id,
        componentName: line.component?.name ?? 'Componente',
        componentVariantName: line.component_variant?.variant_name ?? null,
        category: line.component?.category ?? null,
        unit: line.component_variant?.unit ?? line.component?.unit ?? null,
        qtyPerUnit: Number(line.qty_per_unit) || 0,
        latestPurchase: purchase ? {
          source: 'latest_purchase',
          unitCost: purchase.unitCost,
          occurredAt: purchase.occurredAt,
          sourceId: purchase.sourceId,
        } : null,
        variantOverride: override !== null ? {
          source: 'variant_override',
          unitCost: override,
          sourceId: line.variant_id,
        } : null,
        productCost: stored !== null ? {
          source: 'product_cost',
          unitCost: stored,
          sourceId: line.component_id,
        } : null,
      };
    });

    const processInputs: B1Process[] = processes.map((row) => ({
      id: row.id,
      processId: row.process_id,
      processName: row.process?.name ?? 'Processo',
      costPerUnit: row.cost_per_unit === null ? null : Number(row.cost_per_unit),
      isActive: row.is_active,
    }));

    const components = buildB1Components({
      productId,
      variantId,
      bomLines,
      processes: processInputs,
      lossMode,
    });

    const composition = composeEconomicResult({ components });
    const b1 = composition.blocks.B1;

    return {
      components,
      composition,
      operationalCfu: b1.knownNetAmount,
      completeCfu: b1.amount,
      warning: b1.completeness === 'COMPLETE'
        ? null
        : 'CFU operacional usa somente componentes conhecidos; há pendências explícitas no B1.',
    };
  }, [productId, variantId, product, bom, processes, latestPurchases, lossMode]);

  return { loading, error, product, result };
}
