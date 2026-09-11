import { useAppStore, Order, Product, InventoryItem } from './appStore';

// ====== KPI Selectors ======
export interface KPIs {
  totalOrders: number;
  totalValue: number;
  avgTicket: number;
  lowStock: Product[];
  byChannel: Record<string, number>;
  byStatus: Record<string, number>;
}

export function useKPIsSelector(): KPIs {
  const orders = useAppStore((state) => state.orders);
  const products = useAppStore((state) => state.products);
  const productBalances = useAppStore((state) => state.productBalances);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthOrders = orders.filter((o) => o.order_date?.startsWith(thisMonth));

  const totalOrders = monthOrders.length;
  const totalValue = monthOrders.reduce((acc, o) => acc + (o.total_value || 0), 0);
  const avgTicket = totalOrders > 0 ? totalValue / totalOrders : 0;

  const byChannel = monthOrders.reduce((acc, o) => {
    const channel = o.channel || 'direto';
    acc[channel] = (acc[channel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const byStatus = orders.reduce((acc, o) => {
    const status = o.status || 'rascunho';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Low stock calculation using productBalances
  const lowStock = products.filter((p) => {
    const balance = productBalances[p.id] || 0;
    return balance <= (p.min_stock || 0);
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
