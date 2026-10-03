import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProductionClosingItem {
  id: string;
  closing_id: string;
  employee_name: string;
  process_id: string | null;
  total_quantity: number;
  total_value: number;
  process?: { id: string; name: string };
}

export interface ProductionClosing {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  total_value: number;
  notes: string | null;
  created_at: string;
  closed_at: string | null;
  items?: ProductionClosingItem[];
}

export const CLOSING_STATUS = {
  aberto: { label: 'Aberto', color: 'bg-blue-500' },
  pago: { label: 'Pago', color: 'bg-green-500' },
};

export function useProductionClosing() {
  const [closings, setClosings] = useState<ProductionClosing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClosings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('production_closings')
      .select(`
        *,
        items:production_closing_items(
          *,
          process:processes(id, name)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching closings:', error);
    else setClosings(data || []);
    setLoading(false);
  }, []);

  // Combina apontamentos de OP, Fato Real de Produção e legado.
  const createClosing = useCallback(async (startDate: string, endDate: string, notes?: string) => {
    const [opRes, factRes, legacyRes] = await Promise.all([
      supabase
        .from('production_entries')
        .select(`employee_name, process_id, quantity, total_value, process:processes(id, name)`)
        .gte('date', startDate)
        .lte('date', endDate),
      (supabase as any)
        .from('production_fact_process_entries')
        .select(`operator_name, process_id, quantity, total_value, process:processes(id, name)`)
        .gte('occurred_at', `${startDate}T00:00:00`)
        .lte('occurred_at', `${endDate}T23:59:59.999`),
      supabase
        .from('production_logs')
        .select(`employee_name, process, quantity`)
        .gte('date', startDate)
        .lte('date', endDate),
    ]);

    if (opRes.error || factRes.error || legacyRes.error) {
      console.error('Erro ao buscar lançamentos para fechamento:', opRes.error || factRes.error || legacyRes.error);
      toast.error('Erro ao buscar lançamentos');
      return null;
    }

    const opEntries = opRes.data || [];
    const factEntries = factRes.data || [];
    const legacyLogs = legacyRes.data || [];

    if (opEntries.length === 0 && factEntries.length === 0 && legacyLogs.length === 0) {
      toast.error('Nenhum lançamento no período');
      return null;
    }

    const aggregated: Record<string, { employee_name: string; process_id: string | null; process_name: string; total_quantity: number; total_value: number }> = {};
    let grandTotal = 0;

    const addEntry = (employeeName: string, processId: string | null, processName: string, quantity: number, totalValue: number, keySuffix?: string) => {
      const key = `${employeeName}|${processId || keySuffix || processName}`;
      if (!aggregated[key]) {
        aggregated[key] = {
          employee_name: employeeName,
          process_id: processId,
          process_name: processName,
          total_quantity: 0,
          total_value: 0,
        };
      }
      aggregated[key].total_quantity += Number(quantity) || 0;
      aggregated[key].total_value += Number(totalValue) || 0;
      grandTotal += Number(totalValue) || 0;
    };

    opEntries.forEach((entry: any) => {
      addEntry(entry.employee_name, entry.process_id, entry.process?.name || 'Processo', entry.quantity, entry.total_value || 0);
    });

    factEntries.forEach((entry: any) => {
      addEntry(entry.operator_name, entry.process_id, entry.process?.name || 'Processo', entry.quantity, entry.total_value || 0);
    });

    legacyLogs.forEach((log: any) => {
      addEntry(log.employee_name, null, log.process, log.quantity, 0, `legacy-${log.process}`);
    });

    const { data: closing, error: closingError } = await supabase
      .from('production_closings')
      .insert({ start_date: startDate, end_date: endDate, status: 'aberto', total_value: grandTotal, notes })
      .select()
      .single();

    if (closingError) {
      toast.error('Erro ao criar fechamento');
      return null;
    }

    const items = Object.values(aggregated).map(item => ({
      closing_id: closing.id,
      employee_name: item.employee_name,
      process_id: item.process_id,
      total_quantity: item.total_quantity,
      total_value: item.total_value,
    }));

    const { error: itemsError } = await supabase
      .from('production_closing_items')
      .insert(items);

    if (itemsError) console.error('Error inserting closing items:', itemsError);

    toast.success('Fechamento criado');
    fetchClosings();
    return closing;
  }, [fetchClosings]);

  const markAsPaid = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('production_closings')
      .update({ status: 'pago', closed_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao marcar como pago');
      return false;
    }

    toast.success('Fechamento marcado como pago');
    fetchClosings();
    return true;
  }, [fetchClosings]);

  const deleteClosing = useCallback(async (id: string) => {
    const { error } = await supabase.from('production_closings').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir fechamento');
      return false;
    }
    toast.success('Fechamento excluído');
    setClosings(prev => prev.filter(c => c.id !== id));
    return true;
  }, []);

  const getClosingSummaryByEmployee = useCallback((closing: ProductionClosing) => {
    const byEmployee: Record<string, { total: number; items: ProductionClosingItem[] }> = {};
    (closing.items || []).forEach(item => {
      if (!byEmployee[item.employee_name]) byEmployee[item.employee_name] = { total: 0, items: [] };
      byEmployee[item.employee_name].total += item.total_value;
      byEmployee[item.employee_name].items.push(item);
    });
    return byEmployee;
  }, []);

  useEffect(() => { fetchClosings(); }, [fetchClosings]);

  return {
    closings,
    loading,
    fetchClosings,
    createClosing,
    markAsPaid,
    deleteClosing,
    getClosingSummaryByEmployee,
  };
}
