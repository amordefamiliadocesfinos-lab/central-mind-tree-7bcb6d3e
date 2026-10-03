import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProductionClosingFinancialEntry {
  id: string;
  closing_id: string;
  employee_name: string;
  financial_entry_id: string;
  financial_entry?: {
    id: string;
    description: string;
    value: number;
    value_paid: number;
    due_date: string;
    payment_date: string | null;
    lifecycle_status: string;
  } | null;
}

export interface ProductionClosingItem {
  id: string;
  closing_id: string;
  employee_name: string;
  employee_user_id?: string | null;
  process_id: string | null;
  process_name_snapshot?: string | null;
  total_quantity: number;
  total_value: number;
  process?: { id: string; name: string } | null;
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
  financial_links?: ProductionClosingFinancialEntry[];
}

export const CLOSING_STATUS = {
  aberto: { label: 'Em preparação', color: 'bg-blue-500' },
  a_pagar: { label: 'A pagar', color: 'bg-amber-500' },
  parcialmente_pago: { label: 'Parcialmente pago', color: 'bg-orange-500' },
  pago: { label: 'Pago', color: 'bg-green-600' },
  revisao_financeira: { label: 'Revisar financeiro', color: 'bg-red-600' },
  fechado_sem_valor: { label: 'Fechado sem valor', color: 'bg-slate-500' },
} as const;

export function useProductionClosing() {
  const [closings, setClosings] = useState<ProductionClosing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClosings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('production_closings')
      .select(`
        *,
        items:production_closing_items(
          *,
          process:processes(id, name)
        ),
        financial_links:production_closing_financial_entries(
          id,closing_id,employee_name,financial_entry_id,
          financial_entry:financial_entries(
            id,description,value,value_paid,due_date,payment_date,lifecycle_status
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching closings:', error);
    else setClosings((data || []) as ProductionClosing[]);
    setLoading(false);
  }, []);

  const createClosing = useCallback(async (startDate: string, endDate: string, notes?: string) => {
    const { data, error } = await (supabase.rpc as any)('create_production_closing', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_notes: notes || null,
    });

    if (error) {
      console.error('Erro ao criar fechamento:', error);
      toast.error(error.message || 'Erro ao criar fechamento');
      return null;
    }

    const result = data as { success?: boolean; reason?: string; closing_id?: string; source_count?: number; total_value?: number } | null;
    if (!result?.success) {
      if (result?.reason === 'no_unclosed_entries') toast.error('Nenhum apontamento ainda não fechado foi encontrado nesse período.');
      else if (result?.reason === 'invalid_period') toast.error('Período inválido.');
      else toast.error('Não foi possível gerar o fechamento.');
      return null;
    }

    toast.success(`Fechamento criado com ${result.source_count || 0} apontamento(s).`);
    await fetchClosings();
    return result;
  }, [fetchClosings]);

  const confirmClosing = useCallback(async (id: string, dueDate: string) => {
    const { data, error } = await (supabase.rpc as any)('confirm_production_closing', {
      p_closing_id: id,
      p_due_date: dueDate,
    });

    if (error) {
      console.error('Erro ao confirmar fechamento:', error);
      toast.error(error.message || 'Não foi possível confirmar o fechamento.');
      return false;
    }

    const result = data as { success?: boolean; reason?: string; financial_entries?: number; already_confirmed?: boolean; status?: string } | null;
    if (!result?.success) {
      if (result?.reason === 'salary_category_missing') toast.error('Categoria financeira Salários não encontrada.');
      else if (result?.reason === 'due_date_required') toast.error('Informe o vencimento das contas a pagar.');
      else if (result?.reason === 'closing_not_open') toast.error('Este fechamento não está mais em preparação.');
      else toast.error('Não foi possível enviar o fechamento ao Financeiro.');
      return false;
    }

    if (result.already_confirmed) toast.success('Este fechamento já estava ligado ao Financeiro.');
    else if ((result.financial_entries || 0) > 0) toast.success(`${result.financial_entries} conta(s) a pagar criada(s) no Financeiro.`);
    else toast.success('Fechamento concluído sem valor financeiro.');
    await fetchClosings();
    return true;
  }, [fetchClosings]);

  const deleteClosing = useCallback(async (id: string) => {
    const { data, error } = await (supabase.rpc as any)('delete_production_closing', {
      p_closing_id: id,
    });
    if (error) {
      toast.error(error.message || 'Erro ao excluir fechamento');
      return false;
    }

    const result = data as { success?: boolean; reason?: string } | null;
    if (!result?.success) {
      if (result?.reason === 'financialized_production_closing') toast.error('Fechamento já enviado ao Financeiro não pode ser excluído.');
      else if (result?.reason === 'closing_not_open') toast.error('Somente fechamento em preparação pode ser excluído.');
      else if (result?.reason === 'closing_not_found') toast.error('Fechamento não encontrado.');
      else toast.error('Erro ao excluir fechamento');
      return false;
    }

    toast.success('Fechamento excluído. Os apontamentos voltaram a ficar disponíveis.');
    setClosings(prev => prev.filter(c => c.id !== id));
    return true;
  }, []);

  const getClosingSummaryByEmployee = useCallback((closing: ProductionClosing) => {
    const byEmployee: Record<string, { total: number; items: ProductionClosingItem[]; financial?: ProductionClosingFinancialEntry }> = {};
    (closing.items || []).forEach(item => {
      const key = item.employee_name.trim().toLocaleLowerCase('pt-BR');
      if (!byEmployee[key]) {
        const financial = (closing.financial_links || []).find(link => link.employee_name.trim().toLocaleLowerCase('pt-BR') === key);
        byEmployee[key] = { total: 0, items: [], financial };
      }
      byEmployee[key].total += Number(item.total_value || 0);
      byEmployee[key].items.push(item);
    });
    return byEmployee;
  }, []);

  useEffect(() => { void fetchClosings(); }, [fetchClosings]);

  return {
    closings,
    loading,
    fetchClosings,
    createClosing,
    confirmClosing,
    deleteClosing,
    getClosingSummaryByEmployee,
  };
}
