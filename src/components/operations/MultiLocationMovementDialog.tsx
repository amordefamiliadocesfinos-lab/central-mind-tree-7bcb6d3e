import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMultiLocationInventory, LocationInventory } from '@/hooks/useMultiLocationInventory';
import { useStorageLocations } from '@/hooks/useStorageLocations';
import { ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, Wrench } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface MultiLocationMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  /** Variante física obrigatória para Produtos Mestres; nula para produtos simples. */
  variantId?: string | null;
  productName: string;
  onSuccess: () => void;
}

type TabType = 'entry' | 'exit' | 'transfer' | 'adjust';

export function MultiLocationMovementDialog({
  open,
  onOpenChange,
  productId,
  variantId = null,
  productName,
  onSuccess,
}: MultiLocationMovementDialogProps) {
  const { locations } = useStorageLocations();
  const { 
    createEntry, 
    createExit, 
    createTransfer, 
    adjustInventory,
    getProductInventoryByLocation,
    loading 
  } = useMultiLocationInventory();

  const [activeTab, setActiveTab] = useState<TabType>('entry');
  const [location, setLocation] = useState('');
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [inventoryByLocation, setInventoryByLocation] = useState<LocationInventory[]>([]);

  useEffect(() => {
    if (open && productId) {
      getProductInventoryByLocation(productId, variantId).then(setInventoryByLocation);
    }
  }, [open, productId, variantId, getProductInventoryByLocation]);

  useEffect(() => {
    if (locations.length > 0 && !location) {
      setLocation(locations[0].name);
      setFromLocation(locations[0].name);
      if (locations.length > 1) {
        setToLocation(locations[1].name);
      }
    }
  }, [locations, location]);

  const getBalanceForLocation = (loc: string) => {
    const inv = inventoryByLocation.find(i => i.location === loc);
    return inv?.quantity || 0;
  };

  const totalBalance = inventoryByLocation.reduce((sum, inv) => sum + inv.quantity, 0);

  const handleSubmit = async () => {
    let success = false;

    switch (activeTab) {
      case 'entry':
        success = await createEntry(productId, location, quantity, notes || undefined, variantId);
        break;
      case 'exit':
        success = await createExit(productId, location, quantity, notes || undefined, variantId);
        break;
      case 'transfer':
        success = await createTransfer(productId, fromLocation, toLocation, quantity, notes || undefined, variantId);
        break;
      case 'adjust':
        success = await adjustInventory(productId, location, quantity, notes || undefined, variantId);
        break;
    }

    if (success) {
      onSuccess();
      onOpenChange(false);
      setQuantity(1);
      setNotes('');
    }
  };

  const renderLocationBalances = () => (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {locations.map(loc => {
        const balance = getBalanceForLocation(loc.name);
        return (
          <Card key={loc.id} className="shrink-0 min-w-[80px]">
            <CardContent className="p-2 text-center">
              <p className="text-lg font-bold">{balance}</p>
              <p className="text-[10px] text-muted-foreground">{loc.name}</p>
            </CardContent>
          </Card>
        );
      })}
      <Card className="shrink-0 min-w-[80px] border-primary">
        <CardContent className="p-2 text-center">
          <p className="text-lg font-bold text-primary">{totalBalance}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Movimentar Estoque</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="font-medium">{productName}</p>
            {renderLocationBalances()}
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="entry" className="gap-1 text-xs">
                <ArrowDownCircle className="h-3 w-3 text-green-500" />
                Entrada
              </TabsTrigger>
              <TabsTrigger value="exit" className="gap-1 text-xs">
                <ArrowUpCircle className="h-3 w-3 text-red-500" />
                Saída
              </TabsTrigger>
              <TabsTrigger value="transfer" className="gap-1 text-xs">
                <ArrowRightLeft className="h-3 w-3 text-purple-500" />
                Transf.
              </TabsTrigger>
              <TabsTrigger value="adjust" className="gap-1 text-xs">
                <Wrench className="h-3 w-3 text-blue-500" />
                Ajuste
              </TabsTrigger>
            </TabsList>

            <TabsContent value="entry" className="space-y-4 mt-4">
              <div>
                <Label>Local de Destino</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Selecione o local" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.name}>
                        {loc.name} (saldo: {getBalanceForLocation(loc.name)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  step="any"
                  min={0.000001}
                  className="h-12"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Novo saldo em {location}:</p>
                <p className="text-2xl font-bold text-green-600">
                  {getBalanceForLocation(location) + quantity}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="exit" className="space-y-4 mt-4">
              <div>
                <Label>Local de Origem</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Selecione o local" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.name}>
                        {loc.name} (saldo: {getBalanceForLocation(loc.name)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  step="any"
                  min={0.000001}
                  max={getBalanceForLocation(location)}
                  className="h-12"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Novo saldo em {location}:</p>
                <p className="text-2xl font-bold text-red-600">
                  {Math.max(0, getBalanceForLocation(location) - quantity)}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="transfer" className="space-y-4 mt-4">
              <div>
                <Label>De</Label>
                <Select value={fromLocation} onValueChange={setFromLocation}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.name} disabled={loc.name === toLocation}>
                        {loc.name} (saldo: {getBalanceForLocation(loc.name)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Para</Label>
                <Select value={toLocation} onValueChange={setToLocation}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.name} disabled={loc.name === fromLocation}>
                        {loc.name} (saldo: {getBalanceForLocation(loc.name)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  step="any"
                  min={0.000001}
                  max={getBalanceForLocation(fromLocation)}
                  className="h-12"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">{fromLocation}</p>
                  <p className="text-xl font-bold text-red-600">
                    {Math.max(0, getBalanceForLocation(fromLocation) - quantity)}
                  </p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">{toLocation}</p>
                  <p className="text-xl font-bold text-green-600">
                    {getBalanceForLocation(toLocation) + quantity}
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="adjust" className="space-y-4 mt-4">
              <div>
                <Label>Local</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Selecione o local" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.name}>
                        {loc.name} (saldo atual: {getBalanceForLocation(loc.name)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Novo Saldo</Label>
                <Input
                  type="number"
                  step="any"
                  min={0}
                  className="h-12"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  Diferença: {quantity - getBalanceForLocation(location) >= 0 ? '+' : ''}
                  {quantity - getBalanceForLocation(location)}
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div>
            <Label>Observações (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Motivo ou referência..."
              rows={2}
            />
          </div>

          <Button onClick={handleSubmit} disabled={loading} className="w-full h-12 text-base">
            {loading ? 'Registrando...' : 'Confirmar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
