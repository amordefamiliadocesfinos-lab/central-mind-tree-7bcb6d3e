import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isWithinOperationalPeriod } from '@/lib/operationalStart';
import { useAppStore, Order, Product, InventoryItem } from './appStore';

type ProductVariant = {
  id: string;
  product_id: string;
  variant_name: string;
  sku: string;
};

export interface LowStockIdentity {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string;
  unit: string;
  balance: number;
  minStock: number;
}

export function isOperationalOrder(order: Pick<Order, 'created_at' | 'order_date' | 'operational_status'>): boolean {
  return isWithinOperationalPeriod(order.created_at || order.order_date)
    && (order.operational_status ?? 'todo') !== 'cancelled';
}

export function getOperationalOrders(orders: Order[]): Order[] {
  return orders.filter(isOperationalOrder);
}

// ====== KPI Selectors ======
export interface KPIs {
  totalOrders: number;
  totalValue: number;
  avgTicket: number;
  lowStock: LowStockIdentity[];
  byChannel: Record<string, number>;
  byStatus: Record<string, number>;
}

export function useKPIsSelector(): KPIs {
  const orders = useAppStore((state) => state.orders);
  const products = useAppStore((state) => state.products);
  const inventory = useAppStore((state) => state.inventory);
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  const masterIds = useMemo(
    () => products
      .filter((product) => product.variation_mode === 'variacoes_fisicas')
      .map((product) => product.id),
    [products],
  );
  const masterIdsKey = masterIds.join(',');

  useEffect(() => {
    if (masterIds.length === 0) {
      setVariants([]);
      return;
    }

    let active = true;
    void supabase
      .from('product_variants')
      .select('id, product_id, variant_name, sku')
      .in('product_id', masterIds)
      .eq('is_active', true)
      .then(({ data, error }) => {
        if (!active || error) return;
        setVariants((data ?? []) as ProductVariant[]);
      });

    return () => {
      active = false;
    };
  }, [masterIdsKey]);

  const operationalOrders = getOperationalOrders(orders);

  const totalOrders = operationalOrders.length;
  const totalValue = operationalOrders.reduce((acc, o) => acc + (o.total_value || 0), 0);
  const avgTicket = totalOrders > 0 ? totalValue / totalOrders : 0;

  const byChannel = operationalOrders.reduce((acc, o) => {
    const channel = o.channel || 'direto';
    acc[channel] = (acc[channel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const byStatus = operationalOrders.reduce((acc, o) => {
    const status = o.operational_status ?? 'todo';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getBalance = (productId: string, variantId: string | null) =>
    inventory
      .filter((item) => item.product_id === productId && (item.variant_id ?? null) === variantId)
      .reduce((total, item) => total + (Number(item.quantity) || 0), 0);

  // Masters are catalog containers, never stock identities. The current schema
  // has no variant-level min_stock, so active physical variants inherit the
  // existing minimum configured on their master product.
  const lowStock = products.flatMap((product): LowStockIdentity[] => {
    const minStock = Number(product.min_stock) || 0;
    if (minStock <= 0) return [];

    if (product.variation_mode === 'variacoes_fisicas') {
      return variants
        .filter((variant) => variant.product_id === product.id)
        .map((variant) => ({
          id: variant.id,
          productId: product.id,
          variantId: variant.id,
          productName: product.name,
          variantName: variant.variant_name,
          sku: variant.sku,
          unit: product.unit,
          balance: getBalance(product.id, variant.id),
          minStock,
        }))
        .filter((identity) => identity.balance <= identity.minStock);
    }

    const balance = getBalance(product.id, null);
    return balance <= minStock
      ? [{
          id: product.id,
          productId: product.id,
          variantId: null,
          productName: product.name,
          variantName: null,
          sku: product.sku,
          unit: product.unit,
          balance,
          minStock,
        }]
      : [];
  });

  return {
    totalOrders,
    totalValue,
    avgTicket,
    lowStock,
    byChannel,
    byStatus,
  };
}

// ====== Stock Value Selectors ======
export interface StockValueData {
  totalStockValue: number;
  totalStockQuantity: number;
  productValues: Record<string, { quantity: number; avgCost: number; value: number }>;
}

/**
 * Calcula o valor total em estoque usando custo médio ponderado.
 * - Usa o custo (cost) do produto cadastrado como fallback
 * - Se não houver custo, considera R$ 0
 */
export function useStockValueSelector(): StockValueData {
  const products = useAppStore((state) => state.products);
  const productBalances = useAppStore((state) => state.productBalances);

  // Para cada produto, calcular valor = saldo * custo médio
  const productValues: Record<string, { quantity: number; avgCost: number; value: number }> = {};
  let totalStockValue = 0;
  let totalStockQuantity = 0;

  for (const product of products) {
    const quantity = productBalances[product.id] || 0;
    
    // Usar o custo cadastrado no produto como custo médio
    // (em implementações futuras, pode calcular média ponderada a partir dos movimentos)
    const avgCost = product.cost || 0;
    const value = quantity * avgCost;

    productValues[product.id] = {
      quantity,
      avgCost,
      value,
    };

    totalStockValue += value;
    totalStockQuantity += quantity;
  }

  return {
    totalStockValue,
    totalStockQuantity,
    productValues,
  };
}

// ====== Filtered Data Selectors ======
export function useFilteredOrders(): Order[] {
  const orders = useAppStore((state) => state.orders);
  const searchTerm = useAppStore((state) => state.searchTerm);
  const statusFilter = useAppStore((state) => state.statusFilter);

  return orders.filter((order) => {
    const matchesSearch =
      !searchTerm ||
      order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.internal_order_number?.toLowerCase().includes(searchTerm.toLowerCase());

    // Fase 1: a tela de Pedidos filtra pela dimensão operacional.
    const operationalStatus = order.operational_status ?? 'todo';
    const matchesStatus =
      statusFilter === 'all' ||
      operationalStatus === statusFilter ||
      order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });
}

export function useFilteredProducts(): Product[] {
  const products = useAppStore((state) => state.products);
  const searchTerm = useAppStore((state) => state.searchTerm);
  const categoryFilter = useAppStore((state) => state.categoryFilter);

  return products.filter((product) => {
    const matchesSearch =
      !searchTerm ||
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      categoryFilter === 'all' || product.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });
}

// ====== Product Balance Selector ======
export function useProductBalance(productId: string): number {
  return useAppStore((state) => state.productBalances[productId] || 0);
}

// ====== Convenience Hooks ======
export function useOperationsTab() {
  const operationsTab = useAppStore((state) => state.operationsTab);
  const setOperationsTab = useAppStore((state) => state.setOperationsTab);
  return { operationsTab, setOperationsTab };
}

export function useSearchFilters() {
  const searchTerm = useAppStore((state) => state.searchTerm);
  const categoryFilter = useAppStore((state) => state.categoryFilter);
  const statusFilter = useAppStore((state) => state.statusFilter);
  const setSearchTerm = useAppStore((state) => state.setSearchTerm);
  const setCategoryFilter = useAppStore((state) => state.setCategoryFilter);
  const setStatusFilter = useAppStore((state) => state.setStatusFilter);
  const resetFilters = useAppStore((state) => state.resetFilters);

  return {
    searchTerm,
    categoryFilter,
    statusFilter,
    setSearchTerm,
    setCategoryFilter,
    setStatusFilter,
    resetFilters,
  };
}
