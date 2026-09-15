import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProductListItem {
  id: string;
  name: string;
  sku: string;
  cover_image_url: string | null;
  price: number | null;
  cost: number | null;
  category: string | null;
  description: string | null;
  media_urls: string[];
  unit: string;
  variation_mode: 'sem_variacao' | 'variacoes_fisicas';
}

export function useProductsList() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, cover_image_url, price, cost, category, description, media_urls, unit, variation_mode')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name');

      if (!error && data) {
        setProducts(data as ProductListItem[]);
      }
      setLoading(false);
    };

    fetch();
  }, []);

  return { products, loading };
}
