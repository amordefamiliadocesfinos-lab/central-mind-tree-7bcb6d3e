import { useState, useMemo, useCallback, useEffect } from 'react';
import { Check, ChevronLeft, ChevronRight, X, Search, Package, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useStockCheckStore } from '@/stores/stockCheckStore';
import { useStorageLocations } from '@/hooks/useStorageLocations';
import { useMultiLocationInventory, LocationInventory } from '@/hooks/useMultiLocationInventory';
import { supabase } from '@/integrations/supabase/client';
import { getTodayISO } from '@/lib/dateUtils';
import { toast } from 'sonner';

interface ProductForCheck {
  id: string;
  name: string;
  sku: string;
  min_stock: number;
  unit: string | null;
  category: string | null;
  variation_mode?: 'sem_variacao' | 'variacoes_fisicas' | null;
}

/**
 * Identidade física contável: produto simples (sem variante) OU
 * variante ativa de um Produto Mestre. O Mestre nunca é item contável.
 */
interface PhysicalItem {
  key: string; // productId ou productId:variantId
  productId: string;
  variantId: string | null;
  name: string;
  sku: string;
  min_stock: number;
  unit: string | null;
  category: string | null;
}

interface SelectedItem {
  item: PhysicalItem;
  locationBalances: LocationInventory[];
}

interface AdjustmentEntry {
  productId: string;
  variantId: string | null;
  productName: string;
  location: string;
  previousBalance: number;
  countedQuantity: number;
  adjustmentType: 'adjust' | 'in' | 'out';
  justification: string;
  difference: number;
}

type WizardStep = 'locations' | 'items' | 'counting' | 'review';

const STEPS: { key: WizardStep; label: string; progress: number }[] = [
  { key: 'locations', label: 'Locais', progress: 25 },
  { key: 'items', label: 'Itens', progress: 50 },
  { key: 'counting', label: 'Contagem', progress: 75 },
  { key: 'review', label: 'Revisão', progress: 100 },
];

export function StockCheckWizard() {
  const { isWizardOpen, closeWizard, setLastStockCheckDate } = useStockCheckStore();
  const { locations } = useStorageLocations();
  const { getProductInventoryByLocation, adjustInventory, createEntry, createExit, getTotalBalance } = useMultiLocationInventory();
  
  // Local physical items state - fetched directly from Supabase
  const [physicalItems, setPhysicalItems] = useState<PhysicalItem[]>([]);
  const [itemBalances, setItemBalances] = useState<Record<string, number>>({});
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('locations');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [adjustments, setAdjustments] = useState<AdjustmentEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Item selection filters
  const [searchTerm, setSearchTerm] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [hasPreselected, setHasPreselected] = useState(false);

  // Current counting state
  const [countedQuantity, setCountedQuantity] = useState<number>(0);
  const [adjustmentType, setAdjustmentType] = useState<'adjust' | 'in' | 'out'>('adjust');
  const [justification, setJustification] = useState('');
  const [countingLocation, setCountingLocation] = useState('');

  // Fetch products directly when wizard opens
  useEffect(() => {
    if (isWizardOpen) {
      const fetchProducts = async () => {
        setIsLoadingProducts(true);
        try {
          const { data, error } = await supabase
            .from('products')
            .select('id, name, sku, min_stock, unit, category')
            .eq('is_active', true)
            .is('deleted_at', null)
            .order('name');

          if (error) {
            console.error('Error fetching products:', error);
            toast.error('Erro ao carregar produtos');
            return;
          }

          const productsList = (data || []).map(p => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            min_stock: p.min_stock || 0,
            unit: p.unit,
            category: p.category,
          }));
          
          setProducts(productsList);

          // Fetch balances in parallel
          const { data: inventoryData } = await supabase
            .from('inventory')
            .select('product_id, quantity');

          const balances: Record<string, number> = {};
          (inventoryData || []).forEach(item => {
            balances[item.product_id] = (balances[item.product_id] || 0) + item.quantity;
          });
          setProductBalances(balances);
        } catch (err) {
          console.error('Error fetching products:', err);
          toast.error('Erro ao carregar produtos');
        } finally {
          setIsLoadingProducts(false);
        }
      };

      fetchProducts();
    }
  }, [isWizardOpen]);

  const stepInfo = STEPS.find(s => s.key === currentStep)!;

  // Filtered products for selection
  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(search) || 
        p.sku.toLowerCase().includes(search)
      );
    }

    if (lowStockOnly) {
      filtered = filtered.filter(p => {
        const balance = productBalances[p.id] || 0;
        return balance <= (p.min_stock || 0);
      });
    }

    return filtered;
  }, [products, productBalances, searchTerm, lowStockOnly]);

  // Toggle location selection
  const toggleLocation = (locationName: string) => {
    setSelectedLocations(prev => 
      prev.includes(locationName) 
        ? prev.filter(l => l !== locationName)
        : [...prev, locationName]
    );
  };

  // Toggle product selection
  const toggleProduct = async (product: ProductForCheck) => {
    const existing = selectedItems.find(i => i.product.id === product.id);
    if (existing) {
      setSelectedItems(prev => prev.filter(i => i.product.id !== product.id));
    } else {
      const balances = await getProductInventoryByLocation(product.id);
      // Filter to only selected locations
      const filteredBalances = balances.filter(b => 
        selectedLocations.includes(b.location || '')
      );
      setSelectedItems(prev => [...prev, { product, locationBalances: filteredBalances }]);
    }
  };

  // Navigation
  const canGoNext = useCallback(() => {
    switch (currentStep) {
      case 'locations': return selectedLocations.length > 0;
      case 'items': return selectedItems.length > 0;
      case 'counting': return currentItemIndex >= selectedItems.length - 1;
      case 'review': return adjustments.length > 0;
      default: return false;
    }
  }, [currentStep, selectedLocations, selectedItems, currentItemIndex, adjustments]);

  const goNext = async () => {
    const stepIndex = STEPS.findIndex(s => s.key === currentStep);
    if (stepIndex < STEPS.length - 1) {
      if (currentStep === 'locations' && !hasPreselected) {
        // Pre-select ALL products when entering items step
        setLoading(true);
        try {
          const itemsWithBalances = await Promise.all(
            products.map(async (product) => {
              const balances = await getProductInventoryByLocation(product.id);
              const filteredBalances = balances.filter(b => 
                selectedLocations.includes(b.location || '')
              );
              return {
                product: {
                  id: product.id,
                  name: product.name,
                  sku: product.sku,
                  min_stock: product.min_stock || 0,
                  unit: product.unit,
                  category: product.category,
                },
                locationBalances: filteredBalances,
              } as SelectedItem;
            })
          );
          setSelectedItems(itemsWithBalances);
          setHasPreselected(true);
        } finally {
          setLoading(false);
        }
      }
      
      if (currentStep === 'items') {
        // Prepare for counting step
        setCurrentItemIndex(0);
        if (selectedItems.length > 0) {
          const firstItem = selectedItems[0];
          const firstLocation = firstItem.locationBalances[0]?.location || selectedLocations[0] || '';
          setCountingLocation(firstLocation);
          const balance = firstItem.locationBalances.find(b => b.location === firstLocation)?.quantity || 0;
          setCountedQuantity(balance);
        }
      }
      setCurrentStep(STEPS[stepIndex + 1].key);
    }
  };

  const goBack = () => {
    const stepIndex = STEPS.findIndex(s => s.key === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1].key);
    }
  };

  // Handle counting confirmation
  const confirmCounting = () => {
    const currentItem = selectedItems[currentItemIndex];
    const previousBalance = currentItem.locationBalances.find(
      b => b.location === countingLocation
    )?.quantity || 0;

    const difference = adjustmentType === 'adjust'
      ? countedQuantity - previousBalance
      : adjustmentType === 'in'
      ? countedQuantity
      : -countedQuantity;

    const entry: AdjustmentEntry = {
      productId: currentItem.product.id,
      productName: currentItem.product.name,
      location: countingLocation,
      previousBalance,
      countedQuantity: adjustmentType === 'adjust' ? countedQuantity : 
        adjustmentType === 'in' ? previousBalance + countedQuantity : previousBalance - countedQuantity,
      adjustmentType,
      justification,
      difference,
    };

    setAdjustments(prev => [...prev, entry]);

    // Move to next item or step
    if (currentItemIndex < selectedItems.length - 1) {
      const nextIndex = currentItemIndex + 1;
      setCurrentItemIndex(nextIndex);
      const nextItem = selectedItems[nextIndex];
      const nextLocation = nextItem.locationBalances[0]?.location || selectedLocations[0] || '';
      setCountingLocation(nextLocation);
      const balance = nextItem.locationBalances.find(b => b.location === nextLocation)?.quantity || 0;
      setCountedQuantity(balance);
      setJustification('');
      setAdjustmentType('adjust');
    } else {
      setCurrentStep('review');
    }
  };

  // Apply all adjustments
  const applyAdjustments = async () => {
    setLoading(true);
    try {
      for (const adj of adjustments) {
        if (adj.difference === 0) continue;

        if (adj.adjustmentType === 'adjust') {
          await adjustInventory(adj.productId, adj.location, adj.countedQuantity, adj.justification);
        } else if (adj.adjustmentType === 'in') {
          await createEntry(adj.productId, adj.location, Math.abs(adj.difference), adj.justification);
        } else {
          await createExit(adj.productId, adj.location, Math.abs(adj.difference), adj.justification);
        }
      }

      setLastStockCheckDate(getTodayISO());
      toast.success('Estoque atualizado com sucesso!');
      handleClose();
    } catch (error) {
      console.error('Error applying adjustments:', error);
      toast.error('Erro ao aplicar ajustes');
    } finally {
      setLoading(false);
    }
  };

  // Reset and close
  const handleClose = () => {
    setCurrentStep('locations');
    setSelectedLocations([]);
    setSelectedItems([]);
    setCurrentItemIndex(0);
    setAdjustments([]);
    setSearchTerm('');
    setLowStockOnly(false);
    setHasPreselected(false);
    setCountedQuantity(0);
    setAdjustmentType('adjust');
    setJustification('');
    closeWizard();
  };

  const currentItem = selectedItems[currentItemIndex];

  return (
    <Dialog open={isWizardOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">Atualizar Estoque</DialogTitle>
            <Badge variant="outline">{stepInfo.label}</Badge>
          </div>
          <Progress value={stepInfo.progress} className="h-2 mt-2" />
        </DialogHeader>

        <ScrollArea className="flex-1 p-4">
          {/* Step 1: Location Selection */}
          {currentStep === 'locations' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecione os locais que deseja atualizar:
              </p>
              <div className="space-y-2">
                {locations.map((location) => (
                  <div
                    key={location.id}
                    className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedLocations.includes(location.name)
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleLocation(location.name)}
                  >
                    <Checkbox
                      checked={selectedLocations.includes(location.name)}
                      onCheckedChange={() => toggleLocation(location.name)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{location.name}</div>
                      {location.description && (
                        <div className="text-sm text-muted-foreground">{location.description}</div>
                      )}
                    </div>
                  </div>
                ))}
                {locations.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum local cadastrado
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Item Selection */}
          {currentStep === 'items' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-12"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox
                  id="lowStock"
                  checked={lowStockOnly}
                  onCheckedChange={(checked) => setLowStockOnly(!!checked)}
                />
                <Label htmlFor="lowStock" className="text-sm cursor-pointer">
                  Apenas estoque baixo
                </Label>
              </div>

              <div className="text-sm text-muted-foreground">
                {searchTerm || lowStockOnly ? (
                  <>
                    {filteredProducts.filter(p => selectedItems.some(i => i.product.id === p.id)).length} de {filteredProducts.length} exibidos selecionados
                    <span className="ml-2 text-xs">({selectedItems.length} total)</span>
                  </>
                ) : (
                  <>{selectedItems.length} item(s) selecionado(s)</>
                )}
              </div>

              <div className="space-y-2">
                {filteredProducts.map((product) => {
                  const isSelected = selectedItems.some(i => i.product.id === product.id);
                  const balance = productBalances[product.id] || 0;
                  const isLow = balance <= (product.min_stock || 0);

                  return (
                    <div
                      key={product.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleProduct({
                        id: product.id,
                        name: product.name,
                        sku: product.sku,
                        min_stock: product.min_stock || 0,
                        unit: product.unit,
                        category: product.category,
                      })}
                    >
                      <Checkbox checked={isSelected} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{product.name}</div>
                        <div className="text-xs text-muted-foreground">{product.sku}</div>
                      </div>
                      <Badge variant={isLow ? 'destructive' : 'secondary'}>
                        {balance} {product.unit || 'un'}
                      </Badge>
                    </div>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    {lowStockOnly 
                      ? 'Nenhum produto com estoque baixo' 
                      : 'Nenhum produto encontrado'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Counting */}
          {currentStep === 'counting' && currentItem && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground text-center">
                Item {currentItemIndex + 1} de {selectedItems.length}
              </div>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                      <Package className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-semibold">{currentItem.product.name}</div>
                      <div className="text-sm text-muted-foreground">{currentItem.product.sku}</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label>Local</Label>
                      <Select value={countingLocation} onValueChange={(v) => {
                        setCountingLocation(v);
                        const balance = currentItem.locationBalances.find(b => b.location === v)?.quantity || 0;
                        setCountedQuantity(balance);
                      }}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Selecione o local" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedLocations.map((loc) => (
                            <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Saldo Atual</Label>
                        <div className="text-2xl font-bold">
                          {currentItem.locationBalances.find(b => b.location === countingLocation)?.quantity || 0}
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            {currentItem.product.unit || 'un'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <Label>Contagem Física</Label>
                        <Input
                          type="number"
                          step="any"
                          className="h-12 text-lg font-semibold"
                          value={countedQuantity}
                          onChange={(e) => setCountedQuantity(parseFloat(e.target.value) || 0)}
                          min={0}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Tipo de Ajuste</Label>
                      <Select value={adjustmentType} onValueChange={(v: 'adjust' | 'in' | 'out') => setAdjustmentType(v)}>
                        <SelectTrigger className="h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="adjust">Ajuste por contagem</SelectItem>
                          <SelectItem value="in">Entrada</SelectItem>
                          <SelectItem value="out">Saída</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Justificativa</Label>
                      <Textarea
                        placeholder="Descreva o motivo do ajuste..."
                        value={justification}
                        onChange={(e) => setJustification(e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>

                    {adjustmentType === 'adjust' && (
                      <div className="p-3 rounded-lg bg-muted">
                        <div className="text-sm text-muted-foreground">Diferença calculada</div>
                        <div className={`text-xl font-bold ${
                          countedQuantity - (currentItem.locationBalances.find(b => b.location === countingLocation)?.quantity || 0) > 0
                            ? 'text-green-500'
                            : countedQuantity - (currentItem.locationBalances.find(b => b.location === countingLocation)?.quantity || 0) < 0
                            ? 'text-red-500'
                            : ''
                        }`}>
                          {countedQuantity - (currentItem.locationBalances.find(b => b.location === countingLocation)?.quantity || 0) > 0 ? '+' : ''}
                          {countedQuantity - (currentItem.locationBalances.find(b => b.location === countingLocation)?.quantity || 0)} {currentItem.product.unit || 'un'}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 'review' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Revise os ajustes antes de confirmar:
              </p>

              {adjustments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum ajuste registrado
                </p>
              ) : (
                <div className="space-y-2">
                  {adjustments.map((adj, index) => (
                    <Card key={index}>
                      <CardContent className="py-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{adj.productName}</div>
                            <div className="text-sm text-muted-foreground">{adj.location}</div>
                          </div>
                          <Badge variant={adj.difference > 0 ? 'default' : adj.difference < 0 ? 'destructive' : 'secondary'}>
                            {adj.difference > 0 ? '+' : ''}{adj.difference}
                          </Badge>
                        </div>
                        <div className="flex gap-4 mt-2 text-sm">
                          <span className="text-muted-foreground">Antes: {adj.previousBalance}</span>
                          <span>Depois: {adj.countedQuantity}</span>
                        </div>
                        {adj.justification && (
                          <div className="text-sm text-muted-foreground mt-1 italic">
                            "{adj.justification}"
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t flex gap-2">
          {currentStep !== 'locations' && (
            <Button variant="outline" onClick={goBack} className="h-12">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          )}
          
          <Button variant="ghost" onClick={handleClose} className="h-12">
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>

          <div className="flex-1" />

          {currentStep === 'counting' ? (
            <Button onClick={confirmCounting} className="h-12 px-6">
              <Check className="h-4 w-4 mr-1" />
              {currentItemIndex < selectedItems.length - 1 ? 'Confirmar e Próximo' : 'Confirmar e Revisar'}
            </Button>
          ) : currentStep === 'review' ? (
            <Button 
              onClick={applyAdjustments} 
              className="h-12 px-6 bg-green-600 hover:bg-green-700"
              disabled={loading || adjustments.length === 0}
            >
              <Check className="h-4 w-4 mr-1" />
              {loading ? 'Aplicando...' : 'Confirmar e Aplicar'}
            </Button>
          ) : (
            <Button 
              onClick={goNext} 
              className="h-12 px-6"
              disabled={!canGoNext()}
            >
              Avançar
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
