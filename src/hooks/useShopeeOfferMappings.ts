import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ShopeeOfferMapping = {
  id: string;
  channel_account_id: string | null;
  marketplace: string;
  marketplace_account: string;
  external_item_key: string;
  external_product_title: string | null;
  external_variation: string | null;
  product_id: string | null;
  variant_id: string | null;
  physical_multiplier: number;
};

export type ShopeeOfferMappingItem = {
  id: string;
  mapping_id: string;
  product_id: string;
  variant_id: string | null;
  physical_multiplier: number;
  position: number | null;
};

export type ResolvedShopeeOffer = {
  mapping: ShopeeOfferMapping;
  items: ShopeeOfferMappingItem[];
  match: 'direct' | 'composition';
};

const db = supabase as any;

function matchesIdentity(
  productId: string,
  variantId: string | null,
  row: { product_id: string | null; variant_id: string | null },
) {
  if (row.product_id !== productId) return false;
  if (!variantId) return row.variant_id === null || row.variant_id === undefined;
  return row.variant_id === variantId;
}

export function useShopeeOfferMappings(
  channelAccountId: string | null,
  productId: string | null,
  variantId: string | null,
) {
  const [offers, setOffers] = useState<ResolvedShopeeOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    if (!channelAccountId || !productId) {
      setOffers([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const { data: mappings, error: mappingsError } = await db
      .from('marketplace_product_mappings')
      .select('*')
      .eq('channel_account_id', channelAccountId)
      .ilike('marketplace', 'shopee');

    if (mappingsError) {
      setOffers([]);
      setError(mappingsError.message || 'Não foi possível carregar as Ofertas Shopee.');
      setLoading(false);
      return;
    }

    const normalizedMappings = (mappings ?? []) as ShopeeOfferMapping[];
    const mappingIds = normalizedMappings.map((mapping) => mapping.id);

    let mappingItems: ShopeeOfferMappingItem[] = [];
    if (mappingIds.length > 0) {
      const { data: items, error: itemsError } = await db
        .from('marketplace_product_mapping_items')
        .select('*')
        .in('mapping_id', mappingIds)
        .order('position');

      if (itemsError) {
        setOffers([]);
        setError(itemsError.message || 'Não foi possível carregar a composição das Ofertas Shopee.');
        setLoading(false);
        return;
      }
      mappingItems = (items ?? []) as ShopeeOfferMappingItem[];
    }

    const itemsByMapping = new Map<string, ShopeeOfferMappingItem[]>();
    for (const item of mappingItems) {
      const list = itemsByMapping.get(item.mapping_id) ?? [];
      list.push(item);
      itemsByMapping.set(item.mapping_id, list);
    }

    const resolved = normalizedMappings.flatMap((mapping): ResolvedShopeeOffer[] => {
      const items = itemsByMapping.get(mapping.id) ?? [];
      if (matchesIdentity(productId, variantId, mapping)) {
        return [{ mapping, items, match: 'direct' }];
      }
      if (items.some((item) => matchesIdentity(productId, variantId, item))) {
        return [{ mapping, items, match: 'composition' }];
      }
      return [];
    });

    resolved.sort((a, b) => {
      const titleA = a.mapping.external_product_title ?? a.mapping.external_item_key;
      const titleB = b.mapping.external_product_title ?? b.mapping.external_item_key;
      return titleA.localeCompare(titleB, 'pt-BR');
    });

    setOffers(resolved);
    setLoading(false);
  }, [channelAccountId, productId, variantId]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  const byId = useMemo(
    () => new Map(offers.map((offer) => [offer.mapping.id, offer])),
    [offers],
  );

  return { offers, byId, loading, error, refetch: fetchOffers };
}