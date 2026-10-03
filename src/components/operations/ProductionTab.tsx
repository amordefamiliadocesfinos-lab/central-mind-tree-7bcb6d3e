import { useState } from 'react';
import { AlertTriangle, CalendarDays, ClipboardList, Cog, DollarSign, Factory, FileText } from 'lucide-react';
import type { Product } from '@/hooks/useOrders';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductionFactMobile } from './ProductionFactMobile';
import { ProductionRealHistory } from './ProductionRealHistory';
import { ProductionMaterialPendingPanel } from './ProductionMaterialPendingPanel';
import { ProductionOrdersTab } from './ProductionOrdersTab';
import { ProductProcessesManager } from './ProductProcessesManager';
import { ProcessesManager } from './ProcessesManager';
import { ProductionClosingTab } from './ProductionClosingTab';
import { LegacyProductionReport } from './LegacyProductionReport';

interface ProductionTabProps {
  products: Product[];
  onRefetch?: () => void;
}

export function ProductionTab({ products }: ProductionTabProps) {
  const [activeSubTab, setActiveSubTab] = useState('produce');

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-7">
          <TabsTrigger value="produce" className="min-h-11 gap-1 px-1"><Factory className="h-4 w-4" /><span className="hidden sm:inline">Produzir</span></TabsTrigger>
          <TabsTrigger value="real" className="min-h-11 gap-1 px-1"><CalendarDays className="h-4 w-4" /><span className="hidden sm:inline">Produção Real</span></TabsTrigger>
          <TabsTrigger value="adjustments" className="min-h-11 gap-1 px-1"><AlertTriangle className="h-4 w-4" /><span className="hidden sm:inline">Ajustes</span></TabsTrigger>
          <TabsTrigger value="orders" className="min-h-11 gap-1 px-1"><ClipboardList className="h-4 w-4" /><span className="hidden sm:inline">OPs</span></TabsTrigger>
          <TabsTrigger value="processes" className="min-h-11 gap-1 px-1"><Cog className="h-4 w-4" /><span className="hidden sm:inline">Processos</span></TabsTrigger>
          <TabsTrigger value="closing" className="min-h-11 gap-1 px-1"><DollarSign className="h-4 w-4" /><span className="hidden sm:inline">Fechamento</span></TabsTrigger>
          <TabsTrigger value="logs" className="min-h-11 gap-1 px-1"><FileText className="h-4 w-4" /><span className="hidden sm:inline">Legado</span></TabsTrigger>
        </TabsList>

        <TabsContent value="produce" className="mt-4">
          <ProductionFactMobile products={products} onExit={() => setActiveSubTab('real')} />
        </TabsContent>
        <TabsContent value="real" className="mt-4"><ProductionRealHistory /></TabsContent>
        <TabsContent value="adjustments" className="mt-4"><ProductionMaterialPendingPanel /></TabsContent>
        <TabsContent value="orders"><ProductionOrdersTab products={products} /></TabsContent>
        <TabsContent value="processes" className="space-y-4">
          <ProductProcessesManager products={products} />
          <ProcessesManager />
        </TabsContent>
        <TabsContent value="closing"><ProductionClosingTab /></TabsContent>
        <TabsContent value="logs"><LegacyProductionReport /></TabsContent>
      </Tabs>
    </div>
  );
}
