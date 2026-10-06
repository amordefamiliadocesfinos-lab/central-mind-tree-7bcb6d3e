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
        <TabsList className="grid h-auto w-full grid-cols-4">
          <TabsTrigger
            value="produce"
            className="min-h-12 gap-2 rounded-lg bg-emerald-600 px-2 font-semibold text-white shadow-sm hover:bg-emerald-700 data-[state=active]:bg-emerald-700 data-[state=active]:text-white"
          >
            <Factory className="h-4 w-4" />
            <span>Produzir</span>
          </TabsTrigger>
          <TabsTrigger value="real" className="min-h-12 gap-1 px-2">
            <CalendarDays className="h-4 w-4" />
            <span>Produção Real</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="min-h-12 gap-1 px-2">
            <ClipboardList className="h-4 w-4" />
            <span>OPs</span>
          </TabsTrigger>
          <TabsTrigger value="closing" className="min-h-12 gap-1 px-2">
            <DollarSign className="h-4 w-4" />
            <span>Fechamento</span>
          </TabsTrigger>
        </TabsList>

        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-end">
          <span className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Apoio e configuração</span>
          <TabsList className="grid h-auto grid-cols-3 sm:w-auto">
            <TabsTrigger value="adjustments" className="min-h-9 gap-1 px-3 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Ajustes</span>
            </TabsTrigger>
            <TabsTrigger value="processes" className="min-h-9 gap-1 px-3 text-xs">
              <Cog className="h-3.5 w-3.5" />
              <span>Configurações</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="min-h-9 gap-1 px-3 text-xs">
              <FileText className="h-3.5 w-3.5" />
              <span>Histórico</span>
            </TabsTrigger>
          </TabsList>
        </div>

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
        <TabsContent value="orders"><ProductionOrdersTab products={products} /></TabsContent>
        <TabsContent value="closing"><ProductionClosingTab /></TabsContent>

        <TabsContent value="adjustments" className="mt-4"><OperationsIncidentsPanel /></TabsContent>
        <TabsContent value="processes" className="space-y-4">
          <ProductProcessesManager products={products} />
          <ProcessesManager />
        </TabsContent>
        <TabsContent value="logs"><LegacyProductionReport /></TabsContent>
      </Tabs>
    </div>
  );
}
