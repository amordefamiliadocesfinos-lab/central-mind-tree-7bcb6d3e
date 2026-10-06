import { useState } from 'react';
import { AlertTriangle, CalendarDays, ClipboardList, Cog, DollarSign, Factory, FileText } from 'lucide-react';
import type { Product } from '@/hooks/useOrders';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductionFactMobile } from './ProductionFactMobile';
import { IntermediateBatchProduction } from './IntermediateBatchProduction';
import { ProductionRealHistory } from './ProductionRealHistory';
import { OperationsIncidentsPanel } from './OperationsIncidentsPanel';
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
  const [intermediateProductId, setIntermediateProductId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-8 sm:grid-cols-7">
          <TabsTrigger
            value="produce"
            className="col-span-2 min-h-14 gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-black uppercase tracking-wide text-white shadow-sm hover:bg-emerald-700 data-[state=active]:bg-emerald-700 data-[state=active]:text-white sm:col-span-1 sm:min-h-11 sm:gap-1 sm:px-1 sm:text-xs sm:font-semibold sm:normal-case sm:tracking-normal"
          >
            <Factory className="h-6 w-6 sm:h-4 sm:w-4" />
            <span>Produzir</span>
          </TabsTrigger>
          <TabsTrigger value="real" className="min-h-11 gap-1 px-1"><CalendarDays className="h-4 w-4" /><span className="hidden sm:inline">Produção Real</span></TabsTrigger>
          <TabsTrigger value="adjustments" className="min-h-11 gap-1 px-1"><AlertTriangle className="h-4 w-4" /><span className="hidden sm:inline">Ajustes</span></TabsTrigger>
          <TabsTrigger value="orders" className="min-h-11 gap-1 px-1"><ClipboardList className="h-4 w-4" /><span className="hidden sm:inline">OPs</span></TabsTrigger>
          <TabsTrigger value="processes" className="min-h-11 gap-1 px-1"><Cog className="h-4 w-4" /><span className="hidden sm:inline">Processos</span></TabsTrigger>
          <TabsTrigger value="closing" className="min-h-11 gap-1 px-1"><DollarSign className="h-4 w-4" /><span className="hidden sm:inline">Fechamento</span></TabsTrigger>
          <TabsTrigger value="logs" className="min-h-11 gap-1 px-1"><FileText className="h-4 w-4" /><span className="hidden sm:inline">Legado</span></TabsTrigger>
        </TabsList>

        <TabsContent value="produce" className="mt-4">
          {intermediateProductId ? (
            <IntermediateBatchProduction
              initialProductId={intermediateProductId}
              onExit={() => setIntermediateProductId(null)}
            />
          ) : (
            <ProductionFactMobile
              products={products}
              onExit={() => setActiveSubTab('real')}
              onIntermediateProduct={setIntermediateProductId}
            />
          )}
        </TabsContent>
        <TabsContent value="real" className="mt-4"><ProductionRealHistory /></TabsContent>
        <TabsContent value="adjustments" className="mt-4"><OperationsIncidentsPanel /></TabsContent>
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
