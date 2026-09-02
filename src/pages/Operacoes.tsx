import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useContacts } from '@/hooks/useContacts';
import { useContactHistory } from '@/hooks/useContactHistory';
import { ContactFormDialog } from '@/components/financial/ContactFormDialog';
import { useOrders } from '@/hooks/useOrders';
import { useMRP } from '@/hooks/useMRP';
import { useStorageLocations } from '@/hooks/useStorageLocations';
import { useMultiLocationInventory } from '@/hooks/useMultiLocationInventory';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/components/ui/decimal-input';
import { parseDecimalInput } from '@/lib/decimal';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, ShoppingCart, Factory, ArrowLeft, Trash2, AlertTriangle, Warehouse, DollarSign, ClipboardCheck, List, LayoutGrid, CalendarClock, FileSpreadsheet, GitMerge } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { ProductGallery } from '@/components/ProductGallery';
import { ProductMovementHistory } from '@/components/ProductMovementHistory';
import { BOMEditor } from '@/components/BOMEditor';
import { OperationsTab, OperationsBottomNav } from '@/components/operations/OperationsBottomNav';
import { OperationsSearchBar } from '@/components/operations/OperationsSearchBar';
import { OrdersDateFilter, filterOrdersByDate, type OrdersDateFilterValue } from '@/components/operations/OrdersDateFilter';
import { ProductsSubFilters, applyProductsSubFilters, type ProductsSubFiltersValue } from '@/components/operations/ProductsSubFilters';
import { OperationsTopTabs } from '@/components/operations/OperationsTopTabs';
import { OrderCard } from '@/components/operations/OrderCard';
import { OrderGridCard } from '@/components/operations/OrderGridCard';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ProductCard } from '@/components/operations/ProductCard';
import { KPICards } from '@/components/operations/KPICards';
import { MultiLocationMovementDialog } from '@/components/operations/MultiLocationMovementDialog';
import { LocationsManager } from '@/components/operations/LocationsManager';
import { ProductDeleteDialog } from '@/components/operations/ProductDeleteDialog';
import { OrderEditDialog } from '@/components/operations/OrderEditDialog';
import { ProductionTab } from '@/components/operations/ProductionTab';
import { OperationsCalendarTab } from '@/components/operations/OperationsCalendarTab';
import { MRPTab } from '@/components/operations/MRPTab';
import { ProductCostEditor } from '@/components/operations/ProductCostEditor';
import { ProductVariantsPanel } from '@/components/operations/ProductVariantsPanel';
import { ProductCatalogImportExport } from '@/components/operations/ProductCatalogImportExport';
import { ProductionPlanningView } from '@/components/operations/ProductionPlanningView';
import { ContactAutocomplete } from '@/components/operations/ContactAutocomplete';
import { ProductCategoriesManager } from '@/components/operations/ProductCategoriesManager';
import { StockOverviewViewer } from '@/components/operations/StockOverviewViewer';
import { ShopeeOrdersImportDialog } from '@/components/operations/ShopeeOrdersImportDialog';
import { ProductConversionDialog } from '@/components/operations/ProductConversionDialog';
import { useProductCategories } from '@/hooks/useProductCategories';
import { useProductIdeas } from '@/hooks/useProductIdeas';
import { usePlatforms } from '@/hooks/usePlatforms';
import { 
  useAppStore, 
  PRODUCT_CATEGORIES, 
  ORDER_STATUS,
  ORDER_CHANNELS,
  ORDER_TYPES,
  sortProductsByCategory,
  sortOrdersByStatus,
  Product as StoreProduct,
  Order as StoreOrder,
  OrderItem as StoreOrderItem,
} from '@/stores/appStore';
import { useStockCheckStore } from '@/stores/stockCheckStore';
import { useKPIsSelector, useFilteredOrders, useFilteredProducts, useSearchFilters, useStockValueSelector } from '@/stores/selectors';
import type { Order, OrderItem, Product } from '@/hooks/useOrders';
import { supabase } from '@/integrations/supabase/client';
import { useInventorySync } from '@/hooks/useInventorySync';
import { toast } from 'sonner';

const VALID_TABS: OperationsTab[] = ['overview', 'orders', 'products', 'inventory', 'production', 'mrp', 'calendar'];

export default function Operacoes() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const {
    orders: rawOrders,
    products: rawProducts,
    inventory,
    loading,
    createProduct,
    updateProduct,
    deleteProduct,
    createOrder,
    updateOrder,
    updateOrderStatus,
    updateOrderDueDate,
    deleteOrder,
    refetch,
  } = useOrders();

  const { reserveMaterials, consumeMaterials } = useMRP();
  const { locations } = useStorageLocations();
  const { getTotalBalance } = useMultiLocationInventory();

  // Store state
  const setOrders = useAppStore((s) => s.setOrders);
  const setProducts = useAppStore((s) => s.setProducts);
  const setInventory = useAppStore((s) => s.setInventory);
  const setProductBalances = useAppStore((s) => s.setProductBalances);
  const updateProductBalance = useAppStore((s) => s.updateProductBalance);
  const productBalances = useAppStore((s) => s.productBalances);

  // Sync data to store
  useEffect(() => {
    setOrders(rawOrders as StoreOrder[]);
  }, [rawOrders, setOrders]);

  useEffect(() => {
    setProducts(rawProducts as StoreProduct[]);
  }, [rawProducts, setProducts]);

  // Fonte única de saldos (recarrega automaticamente após qualquer movimento)
  useInventorySync();

  // Tab from querystring (stable)
  const tabParam = searchParams.get('tab') as OperationsTab | null;
  const activeTab: OperationsTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'orders';
  const setActiveTab = useCallback((tab: OperationsTab) => {
    setSearchParams({ tab }, { replace: true });
  }, [setSearchParams]);

  // Auto-open order dialog from CRM "Converter em Pedido"
  useEffect(() => {
    if (searchParams.get('newOrder') === 'true') {
      const contactName = searchParams.get('contactName') || '';
      const contactId = searchParams.get('contactId') || null;
      const contactPhone = searchParams.get('contactPhone') || '';
      const contactEmail = searchParams.get('contactEmail') || '';
      const contactNotes = searchParams.get('contactNotes') || '';
      setNewOrder({
        customer_name: contactName,
        contact_id: contactId,
        channel: 'direto',
        order_type: 'production',
        due_date: '',
        items: [],
      });
      setCrmContactId(contactId);
      setShowOrderDialog(true);
      // Clean up URL params
      const newParams = new URLSearchParams({ tab: 'orders' });
      setSearchParams(newParams, { replace: true });
    }

    // Auto-open order from CRM contact orders list
    const orderId = searchParams.get('orderId');
    if (orderId && rawOrders.length > 0) {
      const order = rawOrders.find((o: any) => o.id === orderId);
      if (order) {
        setEditingOrder(order as any);
      }
      const newParams = new URLSearchParams({ tab: 'orders' });
      setSearchParams(newParams, { replace: true });
    }
  }, [rawOrders.length]);

  // Filters from store
  const { searchTerm, categoryFilter, statusFilter, setSearchTerm, setCategoryFilter, setStatusFilter, resetFilters } = useSearchFilters();

  // Stock check
  const openStockCheckWizard = useStockCheckStore((s) => s.openWizard);

  // KPIs from selector
  const kpis = useKPIsSelector();
  const stockValue = useStockValueSelector();

  // Date filter state for orders
  const [ordersDateFilter, setOrdersDateFilter] = useState<OrdersDateFilterValue>({
    preset: 'all',
    field: 'due_date',
  });

  // Filtered and sorted data
  const filteredOrders = sortOrdersByStatus(
    filterOrdersByDate(useFilteredOrders(), ordersDateFilter)
  );
  const [productsSubFilter, setProductsSubFilter] = useState<ProductsSubFiltersValue>({
    sort: 'az',
    periodPreset: 'all',
  });
  const filteredProducts = sortProductsByCategory(useFilteredProducts());
  const { productIdeasMap } = useProductIdeas();
  const productsTabList = applyProductsSubFilters(
    filteredProducts as Product[],
    productsSubFilter,
    (id) => productBalances[id] || 0,
    (id) => (productIdeasMap[id]?.length ?? 0) > 0,
  );

  // Dialog states (local)
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [showSaleDialog, setShowSaleDialog] = useState(false);
  const [showShopeeImport, setShowShopeeImport] = useState(false);
  const [showProductConversion, setShowProductConversion] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [movementProduct, setMovementProduct] = useState<{ id: string; name: string; variantId?: string | null } | null>(null);
  const [masterVariants, setMasterVariants] = useState<Record<string, { id: string; variant_name: string; sku: string }[]>>({});
  const storeInventory = useAppStore((s) => s.inventory);

  // Variant balances by physical identity (product_id + variant_id)
  const getVariantBalance = useCallback((productId: string, variantId: string) =>
    storeInventory
      .filter((i: any) => i.product_id === productId && i.variant_id === variantId)
      .reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0),
  [storeInventory]);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [showCostEditor, setShowCostEditor] = useState(false);
  const [showNewContactFromSale, setShowNewContactFromSale] = useState(false);
  const [ordersViewMode, setOrdersViewMode] = useState<'list' | 'grid' | 'planning'>('list');
  const [showCategoriesManager, setShowCategoriesManager] = useState(false);
  const { categoryNames: dynamicCategories, categories: canonicalFamilies } = useProductCategories();
  const { platforms: allPlatforms } = usePlatforms();
  const platformsById = useMemo(
    () => Object.fromEntries(allPlatforms.map(p => [p.id, p])),
    [allPlatforms]
  );
  const productCategories = dynamicCategories.length > 0 ? dynamicCategories : [...PRODUCT_CATEGORIES];
  const { createContact } = useContacts();
  const { addEntry } = useContactHistory();
  const [crmContactId, setCrmContactId] = useState<string | null>(null);

  const [newProduct, setNewProduct] = useState<Partial<Product>>({ 
    sku: '', 
    name: '', 
    min_stock: 0, 
    price: 0,
    category: '',
    unit: 'un',
    media_urls: [],
    cover_image_url: null,
  });
  const [newProductPriceText, setNewProductPriceText] = useState('');
  const [newProductCostText, setNewProductCostText] = useState('');
  const [newProductHasVariants, setNewProductHasVariants] = useState(false);
  const [newVariantNames, setNewVariantNames] = useState('');
  const [newProductPurchased, setNewProductPurchased] = useState(false);
  const [newProductManufactured, setNewProductManufactured] = useState(false);
  const [newProductIntermediate, setNewProductIntermediate] = useState(false);
  const [savingNewProduct, setSavingNewProduct] = useState(false);

  const [newOrder, setNewOrder] = useState({
    customer_name: '',
    contact_id: null as string | null,
    channel: 'direto',
    order_type: 'production' as 'stock' | 'production',
    due_date: '',
    items: [] as { product_id: string; quantity: number; unit_price: number; _unit_price_text?: string }[],
  });

  const [newSale, setNewSale] = useState({
    customer_name: '',
    contact_id: null as string | null,
    channel: 'direto',
    due_date: '',
    financial_due_date: new Date().toISOString().slice(0, 10),
    payment_status: 'pendente' as 'pendente' | 'pago',
    payment_method: '',
    financial_account_id: '',
    marketplace_account: '',
    discount_amount: 0,
    shipping_amount: 0,
    discount_text: '',
    shipping_text: '',
    items: [] as { product_id: string; quantity: number; unit_price: number; _unit_price_text?: string }[],
  });
  const [financialAccounts, setFinancialAccounts] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    supabase.from('financial_accounts').select('id,name').eq('is_active', true).order('name')
      .then(({ data }) => setFinancialAccounts(data || []));
  }, []);

  const [editingCostText, setEditingCostText] = useState('');
  const [editingPriceText, setEditingPriceText] = useState('');

  // Sync text inputs with the product being edited
  useEffect(() => {
    if (editingProduct) {
      setEditingCostText(editingProduct.cost != null ? String(editingProduct.cost) : '');
      setEditingPriceText(editingProduct.price != null ? String(editingProduct.price) : '');
    } else {
      setEditingCostText('');
      setEditingPriceText('');
    }
  }, [editingProduct?.id]);

  const getProductBalance = (productId: string) => productBalances[productId] || 0;

  const saleSubtotal = newSale.items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  const saleTotal = Math.max(0, saleSubtotal - newSale.discount_amount + newSale.shipping_amount);

  const handleAddProduct = async () => {
    if (!newProduct.name?.trim()) { toast.error('Informe o nome do produto'); return; }
    if (!newProduct.sku?.trim()) { toast.error('Informe um SKU único para o produto'); return; }
    if (!newProduct.category) { toast.error('Selecione uma família válida'); return; }
    if (savingNewProduct) return;
    setSavingNewProduct(true);
    const family_id = canonicalFamilies.find(family => family.name === newProduct.category)?.id || null;
    if (!family_id) { toast.error('Selecione uma família válida'); setSavingNewProduct(false); return; }
    const result = await createProduct({ ...newProduct, family_id, variation_mode: newProductHasVariants ? 'variacoes_fisicas' : 'sem_variacao', is_purchased: newProductPurchased, is_manufactured: newProductManufactured, is_intermediate: newProductManufactured && newProductIntermediate, is_active: newProduct.is_active !== false });
    if (result) {
      const names = newVariantNames.split(/\n|,/).map(name => name.trim()).filter(Boolean);
      if (newProductHasVariants && names.length) {
        const { error } = await supabase.from('product_variants').insert(names.map((variant_name, index) => ({ product_id: result.id, variant_name, sku: `${result.sku}-${index + 1}`, attributes: {}, is_active: true })) as any);
        if (error) { toast.error('Produto criado, mas não foi possível criar as variações'); setSavingNewProduct(false); return; }
      }
      setNewProduct({ sku: '', name: '', min_stock: 0, price: 0, category: '', unit: 'un', media_urls: [], cover_image_url: null });
      setNewProductPriceText('');
      setNewProductCostText('');
      setNewProductHasVariants(false); setNewVariantNames(''); setNewProductPurchased(false); setNewProductManufactured(false); setNewProductIntermediate(false);
      setShowProductDialog(false);
    }
    setSavingNewProduct(false);
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    // Parse current text inputs to ensure latest values are saved even if blur didn't fire
    const parsedCost = parseDecimalInput(editingCostText, { min: 0, maxDecimals: 10 });
    const parsedPrice = parseDecimalInput(editingPriceText, { min: 0, maxDecimals: 10 });
    const payload = {
      ...editingProduct,
      cost: editingCostText.trim() === '' ? null : (parsedCost ? parsedCost.number : editingProduct.cost),
      price: editingPriceText.trim() === '' ? null : (parsedPrice ? parsedPrice.number : editingProduct.price),
    };
    await updateProduct(editingProduct.id, payload);
    setEditingProduct(null);
  };

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    await deleteProduct(deletingProduct.id);
    setDeletingProduct(null);
    setEditingProduct(null);
  };

  const handleAddOrder = async () => {
    const { items, ...orderData } = newOrder;
    const result = await createOrder(
      { ...orderData, contact_id: newOrder.contact_id || undefined },
      items as Partial<OrderItem>[]
    );
    
    // Log timeline event if order was created from CRM
    if (result && crmContactId && newOrder.contact_id) {
      const orderNum = result.order_number || result.id.slice(0, 8);
      await addEntry(
        crmContactId,
        'conversao',
        `🧾 Lead convertido em pedido #${orderNum}`,
        new Date().toISOString()
      );
      setCrmContactId(null);
    }
    
    setShowOrderDialog(false);
    setNewOrder({ customer_name: '', contact_id: null, channel: 'direto', order_type: 'production', due_date: '', items: [] });
  };

  const handleAddSale = async () => {
    const { items, discount_text, shipping_text, ...saleData } = newSale;
    await createOrder(
      { ...saleData, order_type: 'stock', contact_id: newSale.contact_id || undefined },
      items as Partial<OrderItem>[]
    );
    setShowSaleDialog(false);
    setNewSale({
      customer_name: '',
      contact_id: null,
      channel: 'direto',
      due_date: '',
      financial_due_date: new Date().toISOString().slice(0, 10),
      payment_status: 'pendente',
      payment_method: '',
      financial_account_id: '',
      marketplace_account: '',
      discount_amount: 0,
      shipping_amount: 0,
      discount_text: '',
      shipping_text: '',
      items: [],
    });
  };

  const addItemToOrder = () => {
    setNewOrder({
      ...newOrder,
      items: [...newOrder.items, { product_id: '', quantity: 1, unit_price: 0 }],
    });
  };

  const addItemToSale = () => {
    setNewSale({
      ...newSale,
      items: [...newSale.items, { product_id: '', quantity: 1, unit_price: 0 }],
    });
  };

  const updateOrderItem = (index: number, field: string, value: string | number) => {
    const items = [...newOrder.items];
    (items[index] as Record<string, string | number>)[field] = value;
    
    if (field === 'product_id') {
      const product = rawProducts.find(p => p.id === value);
      if (product?.price) {
        items[index].unit_price = product.price;
      }
    }
    
    setNewOrder({ ...newOrder, items });
  };

  const updateSaleItem = (index: number, field: string, value: string | number) => {
    const items = [...newSale.items];
    (items[index] as Record<string, string | number>)[field] = value;
    
    if (field === 'product_id') {
      const product = rawProducts.find(p => p.id === value);
      if (product?.price) {
        items[index].unit_price = product.price;
      }
    }
    
    setNewSale({ ...newSale, items });
  };

  const removeOrderItem = (index: number) => {
    const items = newOrder.items.filter((_, i) => i !== index);
    setNewOrder({ ...newOrder, items });
  };

  const removeSaleItem = (index: number) => {
    const items = newSale.items.filter((_, i) => i !== index);
    setNewSale({ ...newSale, items });
  };

  const handleStatusChange = useCallback(async (order: Order, newStatus: string) => {
    const oldStatus = order.status;
    const items = order.items?.map(i => ({ product_id: i.product_id, quantity: i.quantity })) || [];
    
    if (oldStatus === 'rascunho' && newStatus === 'confirmado' && items.length > 0) {
      await reserveMaterials(order.id, items);
    }
    
    if ((oldStatus === 'confirmado' || oldStatus === 'rascunho') && newStatus === 'producao' && items.length > 0) {
      await consumeMaterials(order.id, items);
    }
    
    await updateOrderStatus(order.id, newStatus);
    refetch();
  }, [reserveMaterials, consumeMaterials, updateOrderStatus, refetch]);

  const handleTabChange = useCallback((tab: OperationsTab) => {
    setActiveTab(tab);
    resetFilters();
  }, [setActiveTab, resetFilters]);

  const statusList = Object.entries(ORDER_STATUS).map(([key, value]) => ({ key, label: value.label }));

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando operações...</p>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-4">
            <KPICards kpis={kpis} stockValue={stockValue} />
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pedidos Recentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sortOrdersByStatus(rawOrders).slice(0, 3).map(order => (
                  <OrderCard 
                    key={order.id}
                    order={order}
                    orderStatus={ORDER_STATUS}
                    orderChannels={ORDER_CHANNELS}
                    onStatusChange={handleStatusChange}
                  />
                ))}
                {rawOrders.length > 3 && (
                  <Button 
                    variant="ghost" 
                    className="w-full"
                    onClick={() => handleTabChange('orders')}
                  >
                    Ver todos ({rawOrders.length})
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Estoque Baixo ({kpis.lowStock.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {kpis.lowStock.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Nenhum produto com estoque baixo
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sortProductsByCategory(kpis.lowStock as Product[])
                      .slice(0, 3)
                      .map(product => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          balance={getProductBalance(product.id)}
                          onEdit={setEditingProduct}
                          linkedIdeas={productIdeasMap[product.id]}
                          platformsMap={platformsById}
                        />
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <StockOverviewViewer
              products={rawProducts as Product[]}
              getBalance={getProductBalance}
              categories={productCategories}
            />

            <LocationsManager />
          </div>
        );

      case 'orders':
        return (
          <div className="space-y-3">
            <OperationsSearchBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              categories={productCategories}
              statuses={statusList}
              placeholder="Buscar pedidos..."
              showCategoryFilter={false}
            />

            <OrdersDateFilter value={ordersDateFilter} onChange={setOrdersDateFilter} />
            
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Pedidos ({filteredOrders.length})</h2>
              <div className="flex gap-2">
                <Button size="lg" variant="outline" className="h-12 px-5" onClick={() => setShowShopeeImport(true)}>
                  <FileSpreadsheet className="h-5 w-5 mr-1" />
                  Importar Pedidos
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="h-12 px-5 border-green-500 text-green-700 hover:bg-green-50"
                  onClick={() => setShowSaleDialog(true)}
                >
                  <DollarSign className="h-5 w-5 mr-1" />
                  Venda
                </Button>
                <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="h-12 px-6">
                      <Plus className="h-5 w-5 mr-2" />
                      Novo
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[calc(100vw-1rem)] max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[85vh] flex flex-col gap-0 overflow-hidden p-0">
                    <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-6">
                      <DialogTitle>Novo Pedido</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                      <div className="space-y-4 pb-4">
                      <div>
                        <Label>Cliente</Label>
                        <ContactAutocomplete
                          value={newOrder.customer_name}
                          contactId={newOrder.contact_id}
                          onSelect={(contact, manualName) => {
                            if (contact) {
                              setNewOrder({ 
                                ...newOrder, 
                                customer_name: contact.name,
                                contact_id: contact.id,
                              });
                            } else {
                              setNewOrder({ 
                                ...newOrder, 
                                customer_name: manualName || '',
                                contact_id: null,
                              });
                            }
                          }}
                          placeholder="Digite o nome do cliente..."
                        />
                      </div>
                      <div>
                        <Label>Tipo de Pedido</Label>
                        <Select
                          value={newOrder.order_type}
                          onValueChange={(v: 'stock' | 'production') => setNewOrder({ ...newOrder, order_type: v })}
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ORDER_TYPES).map(([key, { label, description }]) => (
                              <SelectItem key={key} value={key}>
                                <div className="flex flex-col">
                                  <span>{label}</span>
                                  <span className="text-xs text-muted-foreground">{description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {newOrder.order_type === 'stock' && (
                          <p className="text-xs text-amber-600 mt-1">
                            ℹ️ A baixa física será registrada somente na expedição
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>Canal</Label>
                        <Select
                          value={newOrder.channel}
                          onValueChange={(v) => setNewOrder({ ...newOrder, channel: v })}
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ORDER_CHANNELS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Prazo de Entrega</Label>
                        <Input
                          type="date"
                          className="h-12"
                          value={newOrder.due_date}
                          onChange={(e) => setNewOrder({ ...newOrder, due_date: e.target.value })}
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <Label>Itens</Label>
                          <Button size="sm" variant="outline" onClick={addItemToOrder}>
                            <Plus className="h-3 w-3 mr-1" />
                            Item
                          </Button>
                        </div>
                        {newOrder.items.map((item, i) => (
                          <div key={i} className="flex gap-2 mb-2">
                            <Select
                              value={item.product_id}
                              onValueChange={(v) => updateOrderItem(i, 'product_id', v)}
                            >
                              <SelectTrigger className="flex-1 h-10">
                                <SelectValue placeholder="Produto" />
                              </SelectTrigger>
                              <SelectContent>
                                {sortProductsByCategory(rawProducts).map((p) => (
                                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              className="w-16 h-10"
                              placeholder="Qtd"
                              value={item.quantity}
                              onChange={(e) => updateOrderItem(i, 'quantity', parseInt(e.target.value) || 1)}
                            />
                            <DecimalInput
                              className="w-20 h-10"
                              placeholder="R$"
                              value={(item as any)._unit_price_text ?? String(item.unit_price ?? '')}
                              onValueChange={(v) => {
                                const items = [...newOrder.items];
                                (items[i] as any)._unit_price_text = v;
                                setNewOrder({ ...newOrder, items });
                              }}
                              onValueCommit={(parsed) => {
                                updateOrderItem(i, 'unit_price', parsed?.number ?? 0);
                              }}
                              min={0}
                              maxDecimals={10}
                            />
                            <Button size="icon" variant="ghost" className="h-10 w-10" onClick={() => removeOrderItem(i)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      </div>
                    </div>
                    <div className="shrink-0 border-t bg-background px-4 py-3 pb-safe-bottom sm:px-6">
                      <Button onClick={handleAddOrder} className="w-full h-12 text-base">
                        Criar Pedido
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Sale Dialog */}
            <Dialog open={showSaleDialog} onOpenChange={setShowSaleDialog}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    Nova Venda
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs text-green-700">
                      <strong>Venda de Estoque:</strong> Os itens serão consumidos diretamente do estoque acabado e o valor será registrado no Financeiro (A Receber).
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>Cliente</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-green-700 hover:text-green-800 hover:bg-green-50"
                        onClick={() => setShowNewContactFromSale(true)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Novo Cliente
                      </Button>
                    </div>
                    <ContactAutocomplete
                      value={newSale.customer_name}
                      contactId={newSale.contact_id}
                      onSelect={(contact, manualName) => {
                        if (contact) {
                          setNewSale({ 
                            ...newSale, 
                            customer_name: contact.name,
                            contact_id: contact.id,
                          });
                        } else {
                          setNewSale({ 
                            ...newSale, 
                            customer_name: manualName || '',
                            contact_id: null,
                          });
                        }
                      }}
                      placeholder="Digite o nome do cliente..."
                    />
                    <ContactFormDialog
                      open={showNewContactFromSale}
                      onOpenChange={setShowNewContactFromSale}
                      onSave={async (data) => {
                        const newContact = await createContact({ ...data, type: 'cliente' });
                        if (newContact) {
                          setNewSale({
                            ...newSale,
                            customer_name: newContact.name,
                            contact_id: newContact.id,
                          });
                          setShowNewContactFromSale(false);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label>Canal</Label>
                    <Select
                      value={newSale.channel}
                      onValueChange={(v) => setNewSale({ ...newSale, channel: v })}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ORDER_CHANNELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Prazo de Entrega</Label>
                    <Input
                      type="date"
                      className="h-12"
                      value={newSale.due_date}
                      onChange={(e) => setNewSale({ ...newSale, due_date: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Vencimento Financeiro</Label>
                      <Input type="date" className="h-12" value={newSale.financial_due_date}
                        onChange={e => setNewSale({ ...newSale, financial_due_date: e.target.value })} />
                    </div>
                    <div>
                      <Label>Situação</Label>
                      <Select value={newSale.payment_status} onValueChange={v => setNewSale({ ...newSale, payment_status: v as 'pendente' | 'pago' })}>
                        <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="pendente">A receber</SelectItem><SelectItem value="pago">Já recebido</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Forma de Pagamento</Label>
                      <Select value={newSale.payment_method} onValueChange={v => setNewSale({ ...newSale, payment_method: v })}>
                        <SelectTrigger className="h-12"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent><SelectItem value="pix">PIX</SelectItem><SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="cartao">Cartão</SelectItem><SelectItem value="boleto">Boleto</SelectItem><SelectItem value="marketplace">Marketplace</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{newSale.payment_status === 'pago' ? 'Conta que recebeu' : 'Conta prevista'}</Label>
                      <Select value={newSale.financial_account_id} onValueChange={v => setNewSale({ ...newSale, financial_account_id: v })}>
                        <SelectTrigger className="h-12"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{financialAccounts.map(account => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(newSale.channel === 'marketplace' || newSale.payment_method === 'marketplace') && <div>
                    <Label>Conta do Marketplace</Label>
                    <Input className="h-12" value={newSale.marketplace_account}
                      onChange={e => setNewSale({ ...newSale, marketplace_account: e.target.value })}
                      placeholder="Ex.: Shopee Viviane" />
                  </div>}

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label>Itens</Label>
                      <Button size="sm" variant="outline" onClick={addItemToSale}>
                        <Plus className="h-3 w-3 mr-1" />
                        Item
                      </Button>
                    </div>
                    {newSale.items.map((item, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <Select
                          value={item.product_id}
                          onValueChange={(v) => updateSaleItem(i, 'product_id', v)}
                        >
                          <SelectTrigger className="flex-1 h-10">
                            <SelectValue placeholder="Produto" />
                          </SelectTrigger>
                          <SelectContent>
                            {sortProductsByCategory(rawProducts).map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          className="w-16 h-10"
                          placeholder="Qtd"
                          value={item.quantity}
                          onChange={(e) => updateSaleItem(i, 'quantity', parseInt(e.target.value) || 1)}
                        />
                        <DecimalInput
                          className="w-20 h-10"
                          placeholder="R$"
                          value={(item as any)._unit_price_text ?? String(item.unit_price ?? '')}
                          onValueChange={(v) => {
                            const items = [...newSale.items];
                            (items[i] as any)._unit_price_text = v;
                            setNewSale({ ...newSale, items });
                          }}
                          onValueCommit={(parsed) => {
                            updateSaleItem(i, 'unit_price', parsed?.number ?? 0);
                          }}
                          min={0}
                          maxDecimals={10}
                        />
                        <Button size="icon" variant="ghost" className="h-10 w-10" onClick={() => removeSaleItem(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div>
                        <Label>Desconto</Label>
                        <DecimalInput
                          className="h-10"
                          placeholder="0,00"
                          value={newSale.discount_text}
                          onValueChange={(v) => setNewSale({ ...newSale, discount_text: v })}
                          onValueCommit={(parsed) => {
                            setNewSale((prev) => ({
                              ...prev,
                              discount_amount: parsed?.number ?? 0,
                              discount_text: parsed?.normalized ?? '',
                            }));
                          }}
                          min={0}
                          maxDecimals={2}
                        />
                      </div>
                      <div>
                        <Label>Frete</Label>
                        <DecimalInput
                          className="h-10"
                          placeholder="0,00"
                          value={newSale.shipping_text}
                          onValueChange={(v) => setNewSale({ ...newSale, shipping_text: v })}
                          onValueCommit={(parsed) => {
                            setNewSale((prev) => ({
                              ...prev,
                              shipping_amount: parsed?.number ?? 0,
                              shipping_text: parsed?.normalized ?? '',
                            }));
                          }}
                          min={0}
                          maxDecimals={2}
                        />
                      </div>
                    </div>

                    {newSale.items.length > 0 && (
                      <div className="mt-3 space-y-1 text-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Subtotal</span>
                          <span>{formatCurrency(saleSubtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Desconto</span>
                          <span>- {formatCurrency(newSale.discount_amount)}</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Frete</span>
                          <span>{formatCurrency(newSale.shipping_amount)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t font-medium">
                          <span>Total</span>
                          <span>{formatCurrency(saleTotal)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <Button 
                    onClick={handleAddSale} 
                    className="w-full h-12 text-base bg-green-600 hover:bg-green-700"
                  >
                    Registrar Venda
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* View toggle */}
            <div className="flex justify-end">
              <ToggleGroup type="single" value={ordersViewMode} onValueChange={(v) => v && setOrdersViewMode(v as 'list' | 'grid' | 'planning')}>
                <ToggleGroupItem value="list" aria-label="Lista" className="gap-1.5 text-xs">
                  <List className="h-4 w-4" />
                  Lista
                </ToggleGroupItem>
                <ToggleGroupItem value="grid" aria-label="Cards" className="gap-1.5 text-xs">
                  <LayoutGrid className="h-4 w-4" />
                  Cards
                </ToggleGroupItem>
                <ToggleGroupItem value="planning" aria-label="Planejamento" className="gap-1.5 text-xs">
                  <CalendarClock className="h-4 w-4" />
                  Planejamento
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {ordersViewMode === 'planning' ? (
              <ProductionPlanningView
                orders={filteredOrders as Order[]}
                orderStatus={ORDER_STATUS}
                onStatusChange={handleStatusChange}
                onClick={(o) => setEditingOrder(rawOrders.find(ord => ord.id === o.id) || null)}
              />
            ) : filteredOrders.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== 'all' ? 'Nenhum pedido encontrado.' : 'Nenhum pedido ainda.'}
                </p>
              </Card>
            ) : ordersViewMode === 'list' ? (
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order as Order}
                    orderStatus={ORDER_STATUS}
                    orderChannels={ORDER_CHANNELS}
                    onStatusChange={handleStatusChange}
                    onClick={(o) => setEditingOrder(rawOrders.find(ord => ord.id === o.id) || null)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredOrders.map((order) => (
                  <OrderGridCard
                    key={order.id}
                    order={order as Order}
                    orderStatus={ORDER_STATUS}
                    orderChannels={ORDER_CHANNELS}
                    onStatusChange={handleStatusChange}
                    onClick={(o) => setEditingOrder(rawOrders.find(ord => ord.id === o.id) || null)}
                  />
                ))}
              </div>
            )}
          </div>
        );

      case 'products':
        return (
          <div className="space-y-3">
            <OperationsSearchBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              categories={productCategories}
              onManageCategories={() => setShowCategoriesManager(true)}
              statuses={[]}
              placeholder="Buscar produtos..."
              showStatusFilter={false}
            />

            <ProductsSubFilters
              value={productsSubFilter}
              onChange={setProductsSubFilter}
            />

            <div className="flex flex-wrap justify-between items-center gap-2">
              <h2 className="text-lg font-semibold">Produtos ({productsTabList.length})</h2>
              <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setShowProductConversion(true)}>
                <GitMerge className="mr-2 h-4 w-4" />
                Converter em Mestre + Variantes
              </Button>
              <ProductCatalogImportExport products={rawProducts as Product[]} categories={productCategories} onImported={refetch} />
              <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
                <DialogTrigger asChild>
                  <Button size="lg" className="h-12 px-6">
                    <Plus className="h-5 w-5 mr-2" />
                    Novo
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Novo Produto</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>SKU</Label>
                        <Input
                          className="h-12"
                          value={newProduct.sku || ''}
                          onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                          placeholder="Código único"
                        />
                      </div>
                      <div>
                        <Label>Unidade</Label>
                        <Select
                          value={newProduct.unit || 'un'}
                          onValueChange={(v) => setNewProduct({ ...newProduct, unit: v })}
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="un">Unidade</SelectItem>
                            <SelectItem value="kg">Quilograma</SelectItem>
                            <SelectItem value="g">Grama</SelectItem>
                            <SelectItem value="l">Litro</SelectItem>
                            <SelectItem value="ml">Mililitro</SelectItem>
                            <SelectItem value="cx">Caixa</SelectItem>
                            <SelectItem value="pct">Pacote</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Nome</Label>
                      <Input
                        className="h-12"
                        value={newProduct.name || ''}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Categoria</Label>
                      <Select
                        value={newProduct.category || ''}
                        onValueChange={(v) => setNewProduct({ ...newProduct, category: v })}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {productCategories.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Textarea
                        value={newProduct.description || ''}
                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Estoque Mínimo</Label>
                        <Input
                          type="number"
                          className="h-12"
                          value={newProduct.min_stock || 0}
                          onChange={(e) => setNewProduct({ ...newProduct, min_stock: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label>Preço (R$)</Label>
                        <DecimalInput
                          className="h-12"
                          value={newProductPriceText}
                          onValueChange={setNewProductPriceText}
                          onValueCommit={(parsed) => {
                            setNewProduct({ ...newProduct, price: parsed ? parsed.number : null });
                          }}
                          min={0}
                          maxDecimals={10}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Custo (R$)</Label>
                      <DecimalInput
                        className="h-12"
                        value={newProductCostText}
                        onValueChange={setNewProductCostText}
                        onValueCommit={(parsed) => {
                          setNewProduct({ ...newProduct, cost: parsed ? parsed.number : null });
                        }}
                        min={0}
                        maxDecimals={10}
                      />
                    </div>
                    <div className="rounded-lg border p-3 space-y-3">
                      <p className="font-medium">Como este produto funciona?</p>
                      <div className="flex items-center justify-between gap-3"><Label>Comprado de fornecedor</Label><Switch checked={newProductPurchased} onCheckedChange={setNewProductPurchased} /></div>
                      <div className="flex items-center justify-between gap-3"><Label>Fabricado por nós</Label><Switch checked={newProductManufactured} onCheckedChange={(value) => { setNewProductManufactured(value); if (!value) setNewProductIntermediate(false); }} /></div>
                      {newProductManufactured && <div className="flex items-center justify-between gap-3"><Label>Usado como componente de outros produtos</Label><Switch checked={newProductIntermediate} onCheckedChange={setNewProductIntermediate} /></div>}
                    </div>
                    <div className="rounded-lg border p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3"><div><p className="font-medium">Possui versões físicas diferentes?</p><p className="text-xs text-muted-foreground">Ex.: sabores, pesos ou embalagens.</p></div><Switch checked={newProductHasVariants} onCheckedChange={setNewProductHasVariants} /></div>
                      {newProductHasVariants && <div><Label>Variantes iniciais</Label><Textarea value={newVariantNames} onChange={(e) => setNewVariantNames(e.target.value)} placeholder="Uma por linha ou separadas por vírgula&#10;Brigadeiro&#10;Morango" rows={3} /><p className="mt-1 text-xs text-muted-foreground">Você poderá complementar SKU, preço e atributos depois em Variações.</p></div>}
                    </div>
                    <div className="flex items-center justify-between gap-3"><Label>Ativar ao salvar</Label><Switch checked={newProduct.is_active !== false} onCheckedChange={(is_active) => setNewProduct({ ...newProduct, is_active })} /></div>
                    <Button onClick={handleAddProduct} disabled={savingNewProduct} className="w-full h-12 text-base">
                      {savingNewProduct ? 'Salvando...' : 'Salvar produto'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              </div>
            </div>

            <div className="grid gap-3 grid-cols-1">
              {productsTabList.length === 0 ? (
                <Card className="p-8 text-center col-span-full">
                  <p className="text-muted-foreground">
                    {searchTerm || categoryFilter !== 'all' ? 'Nenhum produto encontrado.' : 'Nenhum produto ainda.'}
                  </p>
                </Card>
              ) : (
                productsTabList.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product as Product}
                    balance={getProductBalance(product.id)}
                    onEdit={setEditingProduct}
                    linkedIdeas={productIdeasMap[product.id]}
                    platformsMap={platformsById}
                  />
                ))
              )}
            </div>
          </div>
        );

      case 'inventory':
        return (
          <div className="space-y-3">
            <OperationsSearchBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              categories={productCategories}
              onManageCategories={() => setShowCategoriesManager(true)}
              statuses={[]}
              placeholder="Buscar no estoque..."
              showStatusFilter={false}
            />

            <div className="flex gap-2 overflow-x-auto pb-2">
              {locations.map(loc => (
                <Badge key={loc.id} variant="secondary" className="shrink-0">
                  <Warehouse className="h-3 w-3 mr-1" />
                  {loc.name}
                </Badge>
              ))}
            </div>
            
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Estoque ({filteredProducts.length})</h2>
              <Button 
                onClick={openStockCheckWizard}
                variant="outline"
                className="h-10 gap-2 border-amber-500 text-amber-600 hover:bg-amber-50"
              >
                <ClipboardCheck className="h-4 w-4" />
                Atualizar Estoque
              </Button>
            </div>

            <div className="space-y-3">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product as Product}
                  balance={getProductBalance(product.id)}
                  onEdit={setEditingProduct}
                  onMovement={(p) => setMovementProduct({ id: p.id, name: p.name })}
                  onHistory={setHistoryProductId}
                  showInventoryActions
                  linkedIdeas={productIdeasMap[product.id]}
                  platformsMap={platformsById}
                />
              ))}
            </div>
          </div>
        );

      case 'production':
        return <ProductionTab products={rawProducts} onRefetch={refetch} />;

      case 'mrp':
        return (
          <MRPTab 
            orders={rawOrders} 
            onReserve={async (order) => {
              const items = order.items?.map(i => ({ product_id: i.product_id, quantity: i.quantity })) || [];
              if (items.length > 0) {
                await reserveMaterials(order.id, items);
                await updateOrderStatus(order.id, 'confirmado');
                refetch();
              }
            }}
            onConsume={async (order) => {
              const items = order.items?.map(i => ({ product_id: i.product_id, quantity: i.quantity })) || [];
              if (items.length > 0) {
                await consumeMaterials(order.id, items);
                await updateOrderStatus(order.id, 'producao');
                refetch();
              }
            }}
          />
        );

      case 'calendar':
        return (
          <OperationsCalendarTab
            orders={rawOrders}
            orderStatus={ORDER_STATUS}
            onOrderClick={setEditingOrder}
            onDateChange={updateOrderDueDate}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background no-overflow-x">
      {/* Header - Sticky with safe area */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b safe-area-pt">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-lg sm:text-xl font-bold truncate">Operações</h1>
          </div>
          <div className="hidden sm:block">
            <KPICards kpis={kpis} compact />
          </div>
        </div>
      </header>

      {/* Main Content - with bottom padding for fixed nav */}
      <main className="px-4 pt-2 pb-bottom-nav space-y-4 no-overflow-x">
        <OperationsTopTabs activeTab={activeTab} onTabChange={handleTabChange} />
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      <OperationsBottomNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-4">
              <ProductGallery
                productId={editingProduct.id}
                mediaUrls={editingProduct.media_urls || []}
                coverImageUrl={editingProduct.cover_image_url}
                onUpdate={(urls, cover) => setEditingProduct({
                  ...editingProduct,
                  media_urls: urls,
                  cover_image_url: cover,
                })}
              />

              <div className="border-t pt-4">
                <BOMEditor
                  productId={editingProduct.id}
                  productName={editingProduct.name}
                  availableComponents={rawProducts.map(p => ({
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    unit: p.unit,
                  }))}
                />
              </div>

              <ProductVariantsPanel product={editingProduct} />
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>SKU</Label>
                  <Input
                    className="h-12"
                    value={editingProduct.sku}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Unidade</Label>
                  <Select
                    value={editingProduct.unit}
                    onValueChange={(v) => setEditingProduct({ ...editingProduct, unit: v })}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">Unidade</SelectItem>
                      <SelectItem value="kg">Quilograma</SelectItem>
                      <SelectItem value="g">Grama</SelectItem>
                      <SelectItem value="l">Litro</SelectItem>
                      <SelectItem value="ml">Mililitro</SelectItem>
                      <SelectItem value="cx">Caixa</SelectItem>
                      <SelectItem value="pct">Pacote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label>Nome</Label>
                <Input
                  className="h-12"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                />
              </div>
              
              <div>
                <Label>Categoria</Label>
                <Select
                  value={editingProduct.category || ''}
                  onValueChange={(v) => setEditingProduct({ ...editingProduct, category: v })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {productCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  rows={2}
                />
              </div>
              
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Mínimo</Label>
                    <Input
                      type="number"
                      className="h-12"
                      value={editingProduct.min_stock}
                      onChange={(e) => setEditingProduct({ 
                        ...editingProduct, 
                        min_stock: parseInt(e.target.value) || 0 
                      })}
                    />
                  </div>
                  <div>
                    <Label>Custo</Label>
                    <DecimalInput
                      className="h-12"
                      value={editingCostText}
                      onValueChange={setEditingCostText}
                      onValueCommit={(parsed) => {
                        setEditingProduct({
                          ...editingProduct,
                          cost: parsed ? parsed.number : null,
                        });
                      }}
                      min={0}
                      maxDecimals={10}
                    />
                  </div>
                  <div>
                    <Label>Preço</Label>
                    <DecimalInput
                      className="h-12"
                      value={editingPriceText}
                      onValueChange={setEditingPriceText}
                      onValueCommit={(parsed) => {
                        setEditingProduct({
                          ...editingProduct,
                          price: parsed ? parsed.number : null,
                        });
                      }}
                      min={0}
                      maxDecimals={10}
                    />
                  </div>
                </div>

              <div className="rounded-lg border p-3 space-y-2">
                <Label className="text-sm font-semibold">Dimensões e Peso</Label>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs">Altura (cm)</Label>
                    <Input
                      type="number"
                      step="any"
                      min={0}
                      className="h-10"
                      value={editingProduct.height_cm ?? ''}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        height_cm: e.target.value === '' ? null : parseFloat(e.target.value),
                      })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Largura (cm)</Label>
                    <Input
                      type="number"
                      step="any"
                      min={0}
                      className="h-10"
                      value={editingProduct.width_cm ?? ''}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        width_cm: e.target.value === '' ? null : parseFloat(e.target.value),
                      })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Comprimento (cm)</Label>
                    <Input
                      type="number"
                      step="any"
                      min={0}
                      className="h-10"
                      value={editingProduct.length_cm ?? ''}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        length_cm: e.target.value === '' ? null : parseFloat(e.target.value),
                      })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Peso (g)</Label>
                    <Input
                      type="number"
                      step="any"
                      min={0}
                      className="h-10"
                      value={editingProduct.weight_g ?? ''}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        weight_g: e.target.value === '' ? null : parseFloat(e.target.value),
                      })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="h-12"
                  onClick={() => setShowCostEditor(true)}
                >
                  <DollarSign className="h-5 w-5 mr-2" />
                  Custos
                </Button>
                <Button onClick={handleUpdateProduct} className="flex-1 h-12 text-base">
                  Salvar Alterações
                </Button>
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="h-12 w-12"
                  onClick={() => setDeletingProduct(editingProduct)}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Product Cost Editor */}
      {editingProduct && (
        <ProductCostEditor
          productId={editingProduct.id}
          productName={editingProduct.name}
          open={showCostEditor}
          onOpenChange={setShowCostEditor}
          onCostUpdated={refetch}
        />
      )}

      {/* Multi-Location Movement Dialog */}
      {movementProduct && (
        <MultiLocationMovementDialog
          open={!!movementProduct}
          onOpenChange={(open) => !open && setMovementProduct(null)}
          productId={movementProduct.id}
          productName={movementProduct.name}
          onSuccess={() => {
            refetch();
            setMovementProduct(null);
            getTotalBalance(movementProduct.id).then(balance => {
              updateProductBalance(movementProduct.id, balance);
            });
          }}
        />
      )}

      {/* Movement History Dialog */}
      <Dialog open={!!historyProductId} onOpenChange={(open) => !open && setHistoryProductId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Histórico de Movimentos</DialogTitle>
          </DialogHeader>
          {historyProductId && (
            <ProductMovementHistory productId={historyProductId} />
          )}
        </DialogContent>
      </Dialog>

      {/* Product Delete Dialog */}
      <ProductDeleteDialog
        open={!!deletingProduct}
        onOpenChange={(open) => !open && setDeletingProduct(null)}
        productName={deletingProduct?.name || ''}
        onConfirm={handleDeleteProduct}
      />

      {/* Order Edit Dialog */}
      <OrderEditDialog
        open={!!editingOrder}
        onOpenChange={(open) => !open && setEditingOrder(null)}
        order={editingOrder}
        products={rawProducts}
        orderStatus={ORDER_STATUS}
        orderChannels={ORDER_CHANNELS}
        onSave={updateOrder}
        onDelete={deleteOrder}
      />

      <ProductCategoriesManager
        open={showCategoriesManager}
        onOpenChange={setShowCategoriesManager}
      />

      <ShopeeOrdersImportDialog
        open={showShopeeImport}
        onOpenChange={setShowShopeeImport}
        products={rawProducts.map(product => ({ id: product.id, name: product.name, sku: product.sku }))}
        onImported={refetch}
      />
      <ProductConversionDialog
        open={showProductConversion}
        onOpenChange={setShowProductConversion}
        products={rawProducts as Product[]}
        onConverted={refetch}
      />
    </div>
  );
}
