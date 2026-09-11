import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { differenceInDays, startOfDay, parseISO } from 'date-fns';

// ====== Status Constants ======
export const ORDER_STATUS = {
  rascunho: { label: 'Rascunho', color: 'bg-slate-400', order: 0 },
  confirmado: { label: 'Confirmado', color: 'bg-yellow-500', order: 1 },
  producao: { label: 'Em Produção', color: 'bg-orange-500', order: 2 },
  produzido: { label: 'Produzido', color: 'bg-emerald-600', order: 3 },
  pronto: { label: 'Pronto', color: 'bg-green-500', order: 4 },
  enviado: { label: 'Enviado', color: 'bg-blue-500', order: 5 },
  concluido: { label: 'Concluído', color: 'bg-gray-500', order: 6 },
  cancelado: { label: 'Cancelado', color: 'bg-gray-400', order: 7 },
} as const;

export const ORDER_CHANNELS = {
  direto: 'Venda Direta',
  marketplace: 'Marketplace',
  ecommerce: 'E-commerce',
  social: 'Redes Sociais',
} as const;

export const PRODUCT_CATEGORIES = [
  'Estrutural',
  'Alimentos',
  'Bebidas',
  'Doces',
  'Salgados',
  'Embalagens',
  'Insumos',
  'Outros',
] as const;

// ====== Types ======
export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  min_stock: number;
  cost: number | null;
  price: number | null;
  is_active: boolean;
  category: string | null;
  attributes: Record<string, unknown>;
  media_urls: string[];
  cover_image_url: string | null;
  expiry_days: number | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  weight_g: number | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number | null;
  notes: string | null;
  product?: Product;
}

export type OrderType = 'stock' | 'production';

export const ORDER_TYPES: Record<OrderType, { label: string; description: string }> = {
  stock: { label: 'Venda de Estoque', description: 'Consome do estoque acabado, sem gerar produção' },
  production: { label: 'Produção', description: 'Gera ordem de produção e consome matéria-prima' },
};

export interface Order {
  id: string;
  order_number: string | null;
  internal_order_number?: string | null;
  operational_status?: 'todo' | 'preparing' | 'finalized' | 'cancelled';
  customer_name: string | null;
  customer_contact: string | null;
  channel: string;
  status: string;
  total_value: number | null;
  order_date: string;
  due_date: string | null;
  notes: string | null;
  order_type: OrderType;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface InventoryItem {
  id: string;
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  location: string | null;
  location_id: string | null;
  updated_at: string;
}

// ====== Store State ======
interface AppState {
  // Cached data
  orders: Order[];
  products: Product[];
  inventory: InventoryItem[];
  productBalances: Record<string, number>;
  
  // UI State
  operationsTab: string;
  searchTerm: string;
  categoryFilter: string;
  statusFilter: string;
  
  // Actions
  setOrders: (orders: Order[]) => void;
  setProducts: (products: Product[]) => void;
  setInventory: (inventory: InventoryItem[]) => void;
  setProductBalances: (balances: Record<string, number>) => void;
  updateProductBalance: (productId: string, balance: number) => void;
  
  setOperationsTab: (tab: string) => void;
  setSearchTerm: (term: string) => void;
  setCategoryFilter: (filter: string) => void;
  setStatusFilter: (filter: string) => void;
  resetFilters: () => void;
}

// ====== Migration Function ======
const migrate = (persistedState: unknown, version: number): AppState => {
  const defaultState: AppState = {
    orders: [],
    products: [],
    inventory: [],
    productBalances: {},
    operationsTab: 'overview',
    searchTerm: '',
    categoryFilter: 'all',
    statusFilter: 'all',
    setOrders: () => {},
    setProducts: () => {},
    setInventory: () => {},
    setProductBalances: () => {},
    updateProductBalance: () => {},
    setOperationsTab: () => {},
    setSearchTerm: () => {},
    setCategoryFilter: () => {},
    setStatusFilter: () => {},
    resetFilters: () => {},
  };

  if (version === 0 || !persistedState) {
    // Version 0 or no state: return fresh state
    return defaultState;
  }

  if (version === 1) {
    // Migrate from v1 to v2: ensure all new fields exist
    const state = persistedState as Partial<AppState>;
    return {
      ...defaultState,
      ...state,
      productBalances: state.productBalances || {},
      operationsTab: state.operationsTab || 'overview',
    };
  }

  // Version 2 (current): just return as-is with defaults
  return { ...defaultState, ...(persistedState as Partial<AppState>) };
};

// ====== Store ======
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      orders: [],
      products: [],
      inventory: [],
      productBalances: {},
      operationsTab: 'overview',
      searchTerm: '',
      categoryFilter: 'all',
      statusFilter: 'all',

      // Actions
      setOrders: (orders) => set({ orders }),
      setProducts: (products) => set({ products }),
      setInventory: (inventory) => set({ inventory }),
      setProductBalances: (balances) => set({ productBalances: balances }),
      updateProductBalance: (productId, balance) =>
        set((state) => ({
          productBalances: { ...state.productBalances, [productId]: balance },
        })),

      setOperationsTab: (tab) => set({ operationsTab: tab }),
      setSearchTerm: (term) => set({ searchTerm: term }),
      setCategoryFilter: (filter) => set({ categoryFilter: filter }),
      setStatusFilter: (filter) => set({ statusFilter: filter }),
      resetFilters: () =>
        set({ searchTerm: '', categoryFilter: 'all', statusFilter: 'all' }),
    }),
    {
      name: 'app-store',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate,
      partialize: (state) => ({
        // Only persist UI state and balances, not fetched data
        productBalances: state.productBalances,
        operationsTab: state.operationsTab,
      }),
    }
  )
);

// ====== Sorting Utilities ======
export function sortProductsByCategory(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    // "Estrutural" always first
    const catA = a.category || 'Outros';
    const catB = b.category || 'Outros';

    if (catA === 'Estrutural' && catB !== 'Estrutural') return -1;
    if (catB === 'Estrutural' && catA !== 'Estrutural') return 1;

    // Then sort by category order
    const indexA = PRODUCT_CATEGORIES.indexOf(catA as typeof PRODUCT_CATEGORIES[number]);
    const indexB = PRODUCT_CATEGORIES.indexOf(catB as typeof PRODUCT_CATEGORIES[number]);

    if (indexA !== indexB) return indexA - indexB;

    // Finally by name
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

export function sortOrdersByStatus(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    // Primary sort: priority based on due date (urgent first)
    const prioA = getDueDatePrioritySortOrder(a.due_date);
    const prioB = getDueDatePrioritySortOrder(b.due_date);

    if (prioA !== prioB) return prioA - prioB;

    // Secondary sort: operational dimension (Fase 1), legado como fallback
    const OPERATIONAL_ORDER: Record<string, number> = { todo: 0, preparing: 1, finalized: 2, cancelled: 3 };
    const orderA = OPERATIONAL_ORDER[a.operational_status ?? 'todo'] ?? 99;
    const orderB = OPERATIONAL_ORDER[b.operational_status ?? 'todo'] ?? 99;

    if (orderA !== orderB) return orderA - orderB;

    // Then by due date (earliest first)
    if (a.due_date && b.due_date) {
      return parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime();
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;

    // Finally by created date
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function getDueDatePrioritySortOrder(dueDate: string | null | undefined): number {
  if (!dueDate) return 5;
  const today = startOfDay(new Date());
  const due = startOfDay(parseISO(dueDate));
  const diff = differenceInDays(due, today);
  if (diff < 0) return 0;
  if (diff === 0) return 1;
  if (diff === 1) return 2;
  if (diff <= 3) return 3;
  return 4;
}
