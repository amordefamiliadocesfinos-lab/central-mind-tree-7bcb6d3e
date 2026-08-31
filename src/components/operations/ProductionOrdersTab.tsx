import { useState, useEffect, useMemo } from 'react';
import { useProductionOrders, ProductionOrder, ProductionEntry, PRODUCTION_ORDER_STATUS } from '@/hooks/useProductionOrders';
import { useProcesses, Process } from '@/hooks/useProcesses';
import { useOrders, Product } from '@/hooks/useOrders';
import { useInventoryMovements } from '@/hooks/useInventoryMovements';
import { useStorageLocations } from '@/hooks/useStorageLocations';
import { supabase } from '@/integrations/supabase/client';
import { ResponsiveDialog, FullScreenDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Plus, Factory, Package, Users, CheckCircle2, 
  ChevronRight, Clock, Trash2, Play, Check, Pencil, AlertTriangle, PackagePlus,
  List, CalendarDays
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BOMLine } from '@/hooks/useBOM';
import { ProductionWeekView } from './ProductionWeekView';

interface ProductionOrdersTabProps {
  products: Product[];
}

interface ShortageItem extends BOMLine {
  adjustQuantity: number;
}

export function ProductionOrdersTab({ products }: ProductionOrdersTabProps) {
  const { 
    orders, 
    loading, 
    createOrder, 
    updateOrder,
    deleteOrder,
    createEntry, 
    deleteEntry,
    calculateConsolidation,
    completeOrder,
    checkBOMShortages,
    getPaymentSummary,
    fetchOrders,
  } = useProductionOrders();
  const { processes, activeProcesses } = useProcesses();
  const { createMovement } = useInventoryMovements();
  const { locations } = useStorageLocations();
  const defaultLocation = locations[0]?.name || 'Fábrica';
  const [completionLocation, setCompletionLocation] = useState<string>('');
  const effectiveLocation = completionLocation || defaultLocation;


  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedOrderNumber, setEditedOrderNumber] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'week'>('list');
  
  // Stock adjustment state
  const [showShortageDialog, setShowShortageDialog] = useState(false);
  const [shortageItems, setShortageItems] = useState<ShortageItem[]>([]);
  const [pendingCompleteOrderId, setPendingCompleteOrderId] = useState<string | null>(null);

  // Create form state
  const [newOrder, setNewOrder] = useState({
    product_id: '',
    variant_id: '',
    batch_code: '',
    target_quantity: 0,
    notes: '',
    scheduled_date: new Date().toISOString().split('T')[0],
    selectedProcesses: [] as { process_id: string; is_required: boolean }[],
  });
  const [productVariants, setProductVariants] = useState<{ id: string; variant_name: string; sku: string }[]>([]);

  useEffect(() => {
    if (!newOrder.product_id) {
      setProductVariants([]);
      return;
    }
    void supabase.from('product_variants').select('id, variant_name, sku')
      .eq('product_id', newOrder.product_id).eq('is_active', true).order('variant_name')
      .then(({ data }) => setProductVariants(data || []));
  }, [newOrder.product_id]);

  // Entry form state
  const [newEntry, setNewEntry] = useState({
    process_id: '',
    employee_name: '',
    date: new Date().toISOString().split('T')[0],
    period: 'manha',
    quantity: 0,
    notes: '',
  });

  const handleCreateOrder = async () => {
    if (!newOrder.product_id || newOrder.selectedProcesses.length === 0) return;
    if (productVariants.length > 0 && !newOrder.variant_id) {
      toast.error('Selecione a variante final para este produto');
      return;
    }

    await createOrder(
      {
        product_id: newOrder.product_id,
        variant_id: newOrder.variant_id || null,
        batch_code: newOrder.batch_code || null,
        target_quantity: newOrder.target_quantity,
        notes: newOrder.notes || null,
        scheduled_date: newOrder.scheduled_date || null,
      },
      newOrder.selectedProcesses
    );

    setShowCreateDialog(false);
    setNewOrder({
      product_id: '',
      variant_id: '',
      batch_code: '',
      target_quantity: 0,
      notes: '',
      scheduled_date: new Date().toISOString().split('T')[0],
      selectedProcesses: [],
    });
  };


  // Sync selectedOrder when orders change
  useEffect(() => {
    if (selectedOrder) {
      const updated = orders.find(o => o.id === selectedOrder.id);
      if (updated) {
        setSelectedOrder(updated);
      }
    }
  }, [orders]);

  const handleCreateEntry = async () => {
    if (!selectedOrder || !newEntry.process_id || !newEntry.employee_name || newEntry.quantity <= 0) return;

    const process = processes.find(p => p.id === newEntry.process_id);
    
    await createEntry({
      production_order_id: selectedOrder.id,
      process_id: newEntry.process_id,
      employee_name: newEntry.employee_name,
      date: newEntry.date,
      period: newEntry.period,
      quantity: newEntry.quantity,
      value_per_unit: process?.value_per_unit || 0,
      notes: newEntry.notes || null,
    });

    setShowEntryForm(false);
    setShowNewEmployee(false);
    setNewEmployeeName('');
    setNewEntry({
      process_id: '',
      employee_name: '',
      date: new Date().toISOString().split('T')[0],
      period: 'manha',
      quantity: 0,
      notes: '',
    });
  };

  const toggleProcess = (processId: string, isRequired: boolean) => {
    const exists = newOrder.selectedProcesses.find(p => p.process_id === processId);
    if (exists) {
      setNewOrder({
        ...newOrder,
        selectedProcesses: newOrder.selectedProcesses.filter(p => p.process_id !== processId),
      });
    } else {
      setNewOrder({
        ...newOrder,
        selectedProcesses: [...newOrder.selectedProcesses, { process_id: processId, is_required: isRequired }],
      });
    }
  };

  const handleCompleteOrder = async (order: ProductionOrder) => {
    const result = await completeOrder(order.id, false, effectiveLocation);
    
    if (!result.success && result.shortages && result.shortages.length > 0) {
      // Show shortage dialog with adjustment options
      setShortageItems(result.shortages.map(s => ({
        ...s,
        adjustQuantity: s.shortage,
      })));
      setPendingCompleteOrderId(order.id);
      setShowShortageDialog(true);
      return;
    }
    
    // Successfully completed
    if (result.success) {
      setSelectedOrder(null);
    }
  };

  const handleAdjustStockAndComplete = async () => {
    if (!pendingCompleteOrderId) return;

    // Create stock adjustments for each shortage item
    for (const item of shortageItems) {
      if (item.adjustQuantity > 0) {
        await createMovement(
          item.component_id,
          'in',
          item.adjustQuantity,
          `Ajuste para concluir OP - Estoque insuficiente`,
          'production_order',
          pendingCompleteOrderId,
          item.variant_id
        );
      }
    }

    // Now complete the order with shortage check skipped
    const result = await completeOrder(pendingCompleteOrderId, true, effectiveLocation);
    
    if (result.success) {
      setShowShortageDialog(false);
      setShortageItems([]);
      setPendingCompleteOrderId(null);
      setSelectedOrder(null);
    }
  };

  const handleSaveOrderName = async () => {
    if (!selectedOrder || !editedOrderNumber.trim()) return;
    
    const success = await updateOrder(selectedOrder.id, { order_number: editedOrderNumber.trim() });
    if (success) {
      setIsEditingName(false);
    }
  };

  const handleDeleteOrder = async (order: ProductionOrder) => {
    if (confirm('Excluir esta ordem de produção?')) {
      await deleteOrder(order.id);
      setSelectedOrder(null);
    }
  };

  // Fetch collaborators from app_users
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [showNewEmployee, setShowNewEmployee] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');

  const fetchCollaborators = async () => {
    const { data } = await supabase
      .from('app_users')
      .select('name')
      .eq('is_active', true)
      .order('name');
    
    setCollaborators((data || []).map(u => u.name));
  };

  useEffect(() => {
    fetchCollaborators();
  }, []);

  const handleAddNewEmployee = async () => {
    if (newEmployeeName.trim()) {
      const { error } = await supabase
        .from('app_users')
        .insert({ name: newEmployeeName.trim(), is_active: true });
      
      if (error) {
        toast.error('Erro ao adicionar colaborador');
      } else {
        toast.success('Colaborador adicionado!');
        fetchCollaborators();
      }
      
      setNewEntry({ ...newEntry, employee_name: newEmployeeName.trim() });
      setShowNewEmployee(false);
      setNewEmployeeName('');
    }
  };

  if (loading) {
    return <p className="text-muted-foreground text-center py-4">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Factory className="h-5 w-5" />
          Ordens de Produção ({orders.length})
        </h2>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border bg-card p-0.5">
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              className="h-8 px-2.5"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4 mr-1" /> Lista
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              className="h-8 px-2.5"
              onClick={() => setViewMode('week')}
            >
              <CalendarDays className="h-4 w-4 mr-1" /> Semana
            </Button>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova OP
          </Button>
        </div>
      </div>

      {viewMode === 'week' ? (
        <ProductionWeekView
          orders={orders}
          calculateConsolidation={calculateConsolidation}
          onSelectOrder={setSelectedOrder}
          onRefresh={fetchOrders}
        />
      ) : (
      <div className="space-y-2">
        {orders.length === 0 ? (
          <Card className="p-8 text-center">
            <Factory className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Nenhuma ordem de produção</p>
          </Card>
        ) : (
          orders.map((order) => {
            const statusConfig = PRODUCTION_ORDER_STATUS[order.status as keyof typeof PRODUCTION_ORDER_STATUS];
            const consolidated = calculateConsolidation(order);
            const isForStock = !order.source_order_id;
            
            return (
              <Card 
                key={order.id}
                className={cn(
                  "cursor-pointer hover:bg-muted/50 transition-colors border-l-4",
                  isForStock ? "border-l-emerald-500" : "border-l-amber-500"
                )}
                onClick={() => setSelectedOrder(order)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <h3 className="font-semibold text-base truncate flex items-center gap-2">
                        {isForStock ? (
                          <>
                            <PackagePlus className="h-4 w-4 text-emerald-600 shrink-0" />
                            Produção para Estoque
                          </>
                        ) : (
                          order.source_order?.customer_name || order.product?.name || 'Sem cliente'
                        )}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn("text-xs text-white", statusConfig?.color)}>
                          {statusConfig?.label}
                        </Badge>
                        {isForStock ? (
                          <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-700">
                            📦 Para Estoque
                          </Badge>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                            <Factory className="h-3 w-3" />
                            Pedido
                          </span>
                        )}
                        {order.source_order?.order_number && (
                          <Badge variant="outline" className="text-[10px]">
                            {order.source_order.order_number}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Package className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          <span className="font-medium text-foreground">{order.target_quantity}x</span>{' '}
                          {order.product?.name || 'Produto não definido'}{order.variant ? ` · ${order.variant.variant_name}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>Criada: {format(parseISO(order.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                        {order.scheduled_date && (
                          <span className="text-primary font-medium">
                            Programada: {format(parseISO(order.scheduled_date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                        {order.source_order?.due_date && (
                          <span className="text-amber-600 font-medium">
                            Entrega: {format(parseISO(order.source_order.due_date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                        {order.batch_code && <span>Lote: {order.batch_code}</span>}
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2 shrink-0">
                      <div>
                        <p className="text-2xl font-bold leading-tight">{consolidated}</p>
                        <p className="text-[10px] text-muted-foreground">
                          de {order.target_quantity}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
      )}




      {/* Create Order Dialog */}
      <FullScreenDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
        title="Nova Ordem de Produção"
      >
        <div className="space-y-4 p-4">
            {/* Stock destination banner */}
            <div className="flex items-start gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900">
              <PackagePlus className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-emerald-900 dark:text-emerald-200">Produção para Estoque</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300/80">
                  Ao concluir esta OP, a quantidade produzida será adicionada automaticamente ao estoque em{' '}
                  <span className="font-semibold">{effectiveLocation}</span>.
                </p>
              </div>
            </div>

            <div>
              <Label>Local de Destino do Estoque</Label>
              <Select value={effectiveLocation} onValueChange={(v) => setCompletionLocation(v)}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locations.length === 0 && (
                    <SelectItem value="Fábrica">Fábrica</SelectItem>
                  )}
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Produto *</Label>
              <Select
                value={newOrder.product_id}
                onValueChange={(v) => setNewOrder({ ...newOrder, product_id: v, variant_id: '' })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {productVariants.length > 0 && (
              <div>
                <Label>Variante final *</Label>
                <Select value={newOrder.variant_id} onValueChange={(v) => setNewOrder({ ...newOrder, variant_id: v })}>
                  <SelectTrigger className="h-12"><SelectValue placeholder="Selecione a variante produzida" /></SelectTrigger>
                  <SelectContent>{productVariants.map((variant) => <SelectItem key={variant.id} value={variant.id}>{variant.variant_name} ({variant.sku})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Lote</Label>
                <Input
                  className="h-12"
                  value={newOrder.batch_code}
                  onChange={(e) => setNewOrder({ ...newOrder, batch_code: e.target.value })}
                  placeholder="Código do lote"
                />
              </div>
              <div>
                <Label>Meta de Produção</Label>
                <Input
                  type="number"
                  className="h-12"
                  value={newOrder.target_quantity}
                  onChange={(e) => setNewOrder({ ...newOrder, target_quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div>
              <Label>Data Programada</Label>
              <Input
                type="date"
                className="h-12"
                value={newOrder.scheduled_date}
                onChange={(e) => setNewOrder({ ...newOrder, scheduled_date: e.target.value })}
              />
            </div>



            <div>
              <Label>Processos *</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Selecione os processos obrigatórios para esta OP
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                {activeProcesses.map((process) => {
                  const selected = newOrder.selectedProcesses.find(p => p.process_id === process.id);
                  return (
                    <div 
                      key={process.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded border cursor-pointer transition-colors",
                        selected ? "bg-primary/10 border-primary" : "hover:bg-muted"
                      )}
                      onClick={() => toggleProcess(process.id, true)}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox checked={!!selected} />
                        <span>{process.name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(process.value_per_unit)}/{process.unit}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={newOrder.notes}
                onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                rows={2}
              />
            </div>

            <Button 
              className="w-full h-12" 
              onClick={handleCreateOrder}
              disabled={!newOrder.product_id || newOrder.selectedProcesses.length === 0}
            >
              Criar Ordem de Produção
            </Button>
        </div>
      </FullScreenDialog>

      {/* Order Details Dialog */}
      <FullScreenDialog 
        open={!!selectedOrder} 
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrder(null);
            setIsEditingName(false);
          }
        }}
        title={selectedOrder?.order_number}
      >
        {selectedOrder && (
          <div className="p-4">
            {/* Editable Order Name */}
            <div className="flex items-center gap-2 mb-4">
              {isEditingName ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editedOrderNumber}
                    onChange={(e) => setEditedOrderNumber(e.target.value)}
                    className="h-8 font-medium"
                    placeholder="Nome da OP"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleSaveOrderName}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditingName(false)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{selectedOrder.order_number}</span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => {
                      setEditedOrderNumber(selectedOrder.order_number || '');
                      setIsEditingName(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <Badge className={cn(
                "text-xs text-white ml-auto",
                PRODUCTION_ORDER_STATUS[selectedOrder.status as keyof typeof PRODUCTION_ORDER_STATUS]?.color
              )}>
                {PRODUCTION_ORDER_STATUS[selectedOrder.status as keyof typeof PRODUCTION_ORDER_STATUS]?.label}
              </Badge>
            </div>

            <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="entries">Lançamentos</TabsTrigger>
                  <TabsTrigger value="payment">Pagamento</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Produto:</span>
                        <span className="font-medium">{selectedOrder.product?.name}</span>
                      </div>
                      {selectedOrder.batch_code && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Lote:</span>
                          <span>{selectedOrder.batch_code}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Meta:</span>
                        <span>{selectedOrder.target_quantity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Consolidado:</span>
                        <span className="font-bold text-lg">{calculateConsolidation(selectedOrder)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Data programada:</span>
                        <Input
                          type="date"
                          className="h-10 w-[170px]"
                          value={selectedOrder.scheduled_date?.slice(0, 10) || ''}
                          onChange={(e) => updateOrder(selectedOrder.id, { scheduled_date: e.target.value || null })}
                        />
                      </div>

                    </CardContent>
                  </Card>

                  {/* Processes Progress */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Progresso por Processo</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {(selectedOrder.processes || []).map((op) => {
                        const processEntries = (selectedOrder.entries || []).filter(e => e.process_id === op.process_id);
                        const totalQty = processEntries.reduce((sum, e) => sum + e.quantity, 0);
                        const progress = selectedOrder.target_quantity > 0 
                          ? Math.round((totalQty / selectedOrder.target_quantity) * 100)
                          : 0;

                        return (
                          <div key={op.id} className="flex items-center justify-between p-2 border rounded">
                            <div className="flex items-center gap-2">
                              {op.is_required && <Badge variant="destructive" className="text-xs">Obrig.</Badge>}
                              <span>{op.process?.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{totalQty}</span>
                              <span className="text-xs text-muted-foreground">({progress}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  {/* Destination location for stock entry */}
                  {selectedOrder.status === 'producao' && (
                    <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900">
                      <CardContent className="pt-4 space-y-2">
                        <Label className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                          <PackagePlus className="h-4 w-4" />
                          Local de Destino do Estoque
                        </Label>
                        <Select value={effectiveLocation} onValueChange={(v) => setCompletionLocation(v)}>
                          <SelectTrigger className="h-11 bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.length === 0 && (
                              <SelectItem value="Fábrica">Fábrica</SelectItem>
                            )}
                            {locations.map((loc) => (
                              <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300/80">
                          Ao concluir, <span className="font-semibold">{calculateConsolidation(selectedOrder)} un.</span> serão
                          adicionadas em <span className="font-semibold">{effectiveLocation}</span>
                          {selectedOrder.source_order_id ? ' e o pedido será marcado como Produzido.' : '.'}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">

                    {selectedOrder.status === 'aberto' && (
                      <Button 
                        variant="outline"
                        onClick={() => updateOrder(selectedOrder.id, { status: 'producao' })}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Iniciar Produção
                      </Button>
                    )}
                    {selectedOrder.status === 'producao' && (
                      <Button 
                        onClick={() => handleCompleteOrder(selectedOrder)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Concluir OP
                      </Button>
                    )}
                    <Button 
                      variant="destructive"
                      onClick={() => handleDeleteOrder(selectedOrder)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="entries" className="space-y-4">
                  <Button onClick={() => setShowEntryForm(true)} className="w-full h-12">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Lançamento
                  </Button>

                  <div className="space-y-2">
                    {(selectedOrder.entries || []).length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">Nenhum lançamento</p>
                    ) : (
                      (selectedOrder.entries || []).map((entry) => (
                        <Card key={entry.id}>
                          <CardContent className="p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{entry.employee_name}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Badge variant="secondary" className="text-xs">
                                    {entry.process?.name}
                                  </Badge>
                                  <span>{entry.date}</span>
                                </div>
                                {entry.notes && (
                                  <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-bold">{entry.quantity}</p>
                                <p className="text-sm text-green-600">
                                  {formatCurrency(entry.total_value)}
                                </p>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Excluir este lançamento?')) {
                                      deleteEntry(entry.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="payment" className="space-y-4">
                  {(() => {
                    const paymentSummary = getPaymentSummary(selectedOrder.entries || []);
                    const totalPayment = Object.values(paymentSummary).reduce((sum, emp) => sum + emp.total, 0);

                    return (
                      <>
                        <Card>
                          <CardContent className="pt-4 text-center">
                            <p className="text-3xl font-bold text-green-600">
                              {formatCurrency(totalPayment)}
                            </p>
                            <p className="text-sm text-muted-foreground">Total a Pagar</p>
                          </CardContent>
                        </Card>

                        {Object.entries(paymentSummary).map(([employee, data]) => (
                          <Card key={employee}>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                {employee}
                                <Badge className="ml-auto">{formatCurrency(data.total)}</Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1">
                              {Object.entries(data.byProcess).map(([process, info]) => (
                                <div key={process} className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">{process}</span>
                                  <span>{info.qty} un = {formatCurrency(info.value)}</span>
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        ))}
                      </>
                    );
                  })()}
                </TabsContent>
            </Tabs>
          </div>
        )}
      </FullScreenDialog>

      {/* Entry Form Dialog */}
      <ResponsiveDialog 
        open={showEntryForm} 
        onOpenChange={setShowEntryForm}
        title="Novo Lançamento"
      >
        <div className="space-y-4 p-4 sm:p-0">
          <div>
            <Label>Processo *</Label>
              <Select
                value={newEntry.process_id}
                onValueChange={(v) => setNewEntry({ ...newEntry, process_id: v })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione o processo" />
                </SelectTrigger>
                <SelectContent>
                  {(selectedOrder?.processes && selectedOrder.processes.length > 0)
                    ? selectedOrder.processes.map((op) => (
                        <SelectItem key={op.process_id} value={op.process_id}>
                          {op.process?.name}
                        </SelectItem>
                      ))
                    : activeProcesses.map((process) => (
                        <SelectItem key={process.id} value={process.id}>
                          {process.name}
                        </SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Funcionário *</Label>
              {showNewEmployee ? (
                <div className="flex gap-2">
                  <Input
                    className="h-12 flex-1"
                    placeholder="Nome do novo funcionário"
                    value={newEmployeeName}
                    onChange={(e) => setNewEmployeeName(e.target.value)}
                  />
                  <Button onClick={handleAddNewEmployee} className="h-12">
                    Adicionar
                  </Button>
                </div>
              ) : (
                <Select
                  value={newEntry.employee_name || ''}
                  onValueChange={(v) => {
                    if (v === '_new') {
                      setShowNewEmployee(true);
                    } else {
                      setNewEntry({ ...newEntry, employee_name: v });
                    }
                  }}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {collaborators.map((emp) => (
                      <SelectItem key={emp} value={emp}>{emp}</SelectItem>
                    ))}
                    <SelectItem value="_new" className="text-primary">
                      + Novo funcionário
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  className="h-12"
                  value={newEntry.date}
                  onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                />
              </div>
              <div>
                <Label>Período</Label>
                <Select
                  value={newEntry.period}
                  onValueChange={(v) => setNewEntry({ ...newEntry, period: v })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manha">Manhã</SelectItem>
                    <SelectItem value="tarde">Tarde</SelectItem>
                    <SelectItem value="noite">Noite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Quantidade *</Label>
              <Input
                type="number"
                className="h-12 text-xl"
                value={newEntry.quantity || ''}
                onChange={(e) => setNewEntry({ ...newEntry, quantity: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={newEntry.notes}
                onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                rows={2}
              />
            </div>

          <Button 
            className="w-full h-12" 
            onClick={handleCreateEntry}
            disabled={!newEntry.process_id || !newEntry.employee_name || newEntry.quantity <= 0}
          >
            Registrar Lançamento
          </Button>
        </div>
      </ResponsiveDialog>

      {/* Stock Shortage Dialog */}
      <ResponsiveDialog 
        open={showShortageDialog} 
        onOpenChange={(open) => {
          if (!open) {
            setShowShortageDialog(false);
            setShortageItems([]);
            setPendingCompleteOrderId(null);
          }
        }}
        title="Estoque Insuficiente"
      >
        <div className="space-y-4 p-4 sm:p-0">
          <div className="flex items-center gap-2 text-amber-600 mb-4">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Materiais em falta para concluir esta OP</span>
          </div>

          <p className="text-sm text-muted-foreground">
            Ajuste as quantidades abaixo para dar entrada no estoque antes de concluir a ordem.
          </p>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {shortageItems.map((item, index) => (
              <Card key={`${item.component_id}:${item.variant_id || 'simple'}`}>
                <CardContent className="p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{item.component_name}</p>
                      <p className="text-xs text-muted-foreground">{item.component_sku}</p>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      Falta: {item.shortage} {item.unit}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                    <div>
                      <span className="text-muted-foreground">Necessário:</span>
                      <span className="ml-1 font-medium">{item.qty_needed}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Estoque:</span>
                      <span className="ml-1 font-medium">{item.stock_available}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Falta:</span>
                      <span className="ml-1 font-medium text-red-500">{item.shortage}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Qtd. a adicionar:</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={item.adjustQuantity}
                      onChange={(e) => {
                        const newItems = [...shortageItems];
                        newItems[index] = {
                          ...item,
                          adjustQuantity: parseFloat(e.target.value) || 0,
                        };
                        setShortageItems(newItems);
                      }}
                      min={0}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const newItems = [...shortageItems];
                        newItems[index] = {
                          ...item,
                          adjustQuantity: item.shortage,
                        };
                        setShortageItems(newItems);
                      }}
                    >
                      = Falta
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                setShowShortageDialog(false);
                setShortageItems([]);
                setPendingCompleteOrderId(null);
              }}
            >
              Cancelar
            </Button>
            <Button 
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={handleAdjustStockAndComplete}
            >
              <PackagePlus className="h-4 w-4 mr-2" />
              Ajustar e Concluir OP
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
