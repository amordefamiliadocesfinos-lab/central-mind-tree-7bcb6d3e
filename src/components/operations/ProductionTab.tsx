import { useState, useEffect, useMemo } from 'react';
import { useProductionLogs, ProductionLog, PROCESS_LABELS, PRODUCTION_PERIODS } from '@/hooks/useProductionLogs';
import { useOrders, Product } from '@/hooks/useOrders';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductionLogForm } from './ProductionLogForm';
import { ProductivityCharts } from './ProductivityCharts';
import { ProcessesManager } from './ProcessesManager';
import { ProductionOrdersTab } from './ProductionOrdersTab';
import { ProductionClosingTab } from './ProductionClosingTab';
import { LegacyProductionReport } from './LegacyProductionReport';
import { Plus, Factory, Users, Calendar, ChevronLeft, ChevronRight, Pencil, Download, BarChart3, Cog, ClipboardList, DollarSign, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductionTabProps {
  products: Product[];
  onRefetch?: () => void;
}

export function ProductionTab({ products, onRefetch }: ProductionTabProps) {
  const {
    logs,
    loading,
    fetchLogs,
    createLog,
    updateLog,
    deleteLog,
    getSummary,
  } = useProductionLogs();

  const [activeSubTab, setActiveSubTab] = useState('orders');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [employees, setEmployees] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<ProductionLog | null>(null);
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterProcess, setFilterProcess] = useState('all');
  const [showCharts, setShowCharts] = useState(true);

  // Fetch collaborators from app_users
  const fetchCollaborators = async () => {
    const { data } = await supabase
      .from('app_users')
      .select('name')
      .eq('is_active', true)
      .order('name');
    
    setEmployees((data || []).map(u => u.name));
  };

  useEffect(() => {
    if (activeSubTab === 'logs') {
      fetchLogs(selectedDate);
      fetchCollaborators();
    }
  }, [selectedDate, activeSubTab, fetchLogs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesDate = log.date === selectedDate;
      const matchesEmployee = filterEmployee === 'all' || log.employee_name === filterEmployee;
      const matchesProcess = filterProcess === 'all' || log.process === filterProcess;
      return matchesDate && matchesEmployee && matchesProcess;
    });
  }, [logs, selectedDate, filterEmployee, filterProcess]);

  const summary = useMemo(() => getSummary(filteredLogs), [filteredLogs, getSummary]);

  const navigateDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleExportCSV = () => {
    const headers = ['Data', 'Período', 'Funcionário', 'Processo', 'Produto', 'Quantidade', 'Observações', 'Avisos'];
    const rows = filteredLogs.map(log => [
      log.date,
      PRODUCTION_PERIODS[log.period],
      log.employee_name,
      PROCESS_LABELS[log.process] || log.process,
      log.product?.name || '',
      log.quantity.toString(),
      log.notes || '',
      log.warnings || '',
    ]);

    const csv = [headers, ...rows].map(row => 
      row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `producao-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async (data: Omit<ProductionLog, 'id' | 'created_at' | 'updated_at' | 'product'>) => {
    // Lançamentos legados registram trabalho; consumo e crédito físico são
    // exclusivos da conclusão transacional de uma OP.
    return createLog(data);
  };

  // Callback to refresh employees after adding new one
  const handleRefreshEmployees = () => {
    fetchCollaborators();
  };

  const handleUpdate = async (id: string, data: Partial<ProductionLog>) => {
    const result = await updateLog(id, data);
    setEditingLog(null);
    return result;
  };

  const handleDelete = async (id: string) => {
    const result = await deleteLog(id);
    setEditingLog(null);
    return result;
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs Navigation */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="orders" className="gap-1">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">OPs</span>
          </TabsTrigger>
          <TabsTrigger value="processes" className="gap-1">
            <Cog className="h-4 w-4" />
            <span className="hidden sm:inline">Processos</span>
          </TabsTrigger>
          <TabsTrigger value="closing" className="gap-1">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Fechamento</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Legado</span>
          </TabsTrigger>
        </TabsList>

        {/* Production Orders Tab */}
        <TabsContent value="orders">
          <ProductionOrdersTab products={products} />
        </TabsContent>

        {/* Processes Tab */}
        <TabsContent value="processes">
          <ProcessesManager />
        </TabsContent>

        {/* Closing Tab */}
        <TabsContent value="closing">
          <ProductionClosingTab />
        </TabsContent>

        {/* Legacy Report Tab */}
        <TabsContent value="logs">
          <LegacyProductionReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
