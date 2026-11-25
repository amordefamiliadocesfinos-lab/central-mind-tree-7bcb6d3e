import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Jornada SKU V1.3: leitura consultiva por mapping_id. Não é resolvedor de pedidos.
// Este hook só deve ser acionado após a implantação autorizada da migração G03.
export type SellerSkuObservationKind = 'UNKNOWN' | 'BLANK' | 'VALUE';
export type SellerSkuReconciliationStatus =
  | 'PLANEJADO' | 'PREPARADO_NO_CORE' | 'PRONTO_PARA_PUBLICAR'
  | 'PUBLICADO_A_CONFERIR' | 'PUBLICADO_CONFERIDO'
  | 'DIVERGENTE' | 'LEGADO_PRESERVADO' | 'BLOQUEADO_LOCAL';

export type ShopeeSellerSkuState = {
  mapping_id: string;
  offer_family: string;
  offer_architecture: string;
  canonical_sku: string;
  canonical_decision_source: string;
  canonical_decided_at: string | null;
  observation_kind: SellerSkuObservationKind;
  observed_sku: string | null;
  observed_source: string | null;
  observed_at: string | null;
  reconciliation_status: SellerSkuReconciliationStatus;
  last_evidence_ref: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
};

const db = supabase as any;
const FIELDS = [
  'mapping_id','offer_family','offer_architecture','canonical_sku',
  'canonical_decision_source','canonical_decided_at','observation_kind',
  'observed_sku','observed_source','observed_at','reconciliation_status',
  'last_evidence_ref','revision','created_at','updated_at',
].join(',');

/** Apenas consulta: SKU planejado nunca é considerado observado sem evidência. */
export async function readShopeeSellerSkuStates(mappingIds: readonly string[]) {
  const ids = [...new Set(mappingIds.filter(Boolean))];
  const rows: ShopeeSellerSkuState[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const { data, error } = await db.from('marketplace_seller_sku_state')
      .select(FIELDS)
      .in('mapping_id', ids.slice(i, i + 50));
    if (error) throw error;
    rows.push(...((data ?? []) as ShopeeSellerSkuState[]));
  }
  return new Map(rows.map(row => [row.mapping_id, row]));
}

/** Opt-in: a tela existente de ofertas permanece intacta até o schema estar publicado. */
export function useShopeeSellerSkuRegistry(mappingIds: readonly string[], enabled = false) {
  const [states, setStates] = useState<Map<string, ShopeeSellerSkuState>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = mappingIds.join('|');
  const ids = useMemo(() => key ? key.split('|').filter(Boolean) : [], [key]);

  const refetch = useCallback(async () => {
    if (!enabled || ids.length === 0) {
      setStates(new Map()); setError(null); setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setStates(await readShopeeSellerSkuStates(ids));
    } catch (err) {
      setStates(new Map());
      setError(err instanceof Error ? err.message : 'Falha ao consultar SKUs comerciais.');
    } finally {
      setLoading(false);
    }
  }, [enabled, ids]);

  useEffect(() => { void refetch(); }, [refetch]);
  return { states, loading, error, refetch };
}
