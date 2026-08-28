import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format, isBefore, startOfDay, parseISO, addDays, addWeeks, addMonths, addYears, isWeekend } from 'date-fns';
import { buildRecurrenceDueDates } from '@/lib/financial/recurrence';

export interface FinancialCategory {
  id: string;
  name: string;
  type: 'pagar' | 'receber' | 'ambos';
  color: string;
  is_active: boolean;
}

export interface FinancialAccount {
  id: string;
  name: string;
  type: 'caixa' | 'banco' | 'cartao';
  initial_balance: number;
  current_balance: number;
  bank_name?: string;
  agency?: string;
  account_number?: string;
  is_active: boolean;
}

export interface FinancialEntry {
  id: string;
  type: 'pagar' | 'receber';
  description: string;
  value: number;
  value_paid: number;
  due_date: string;
  payment_date?: string;
  category_id?: string;
  account_id?: string;
  contact_id?: string;
  order_id?: string;
  document_number?: string;
  notes?: string;
  is_conciliated: boolean;
  conciliated_at?: string;
  created_at: string;
  updated_at: string;
  category?: FinancialCategory;
  account?: FinancialAccount;
  contact?: { id: string; name: string };
  sales_channel?: string;
  marketplace_account?: string;
  payment_method?: string;
  // Recurrence fields
  recurrence_type?: string;
  recurrence_day?: number;
  recurrence_end_date?: string;
  recurrence_use_business_days?: boolean;
  parent_entry_id?: string;
  original_due_date?: string;
  issue_date?: string;
  competence_date?: string;
  recurrence_series_id?: string;
  recurrence_sequence?: number;
}

export interface FinancialMovement {
  id: string;
  entry_id: string;
  account_id?: string;
  value: number;
  movement_date: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  account?: FinancialAccount;
}

export type EntryStatus = 'atrasada' | 'parcial' | 'pago' | 'em_aberto';

export interface FinancialSummary {
  total_open: number;
  total_overdue: number;
  total_paid: number;
  count_open: number;
  count_overdue: number;
  count_paid: number;
  count_partial: number;
}

export interface FinancialFilters {
  type?: 'pagar' | 'receber';
  status?: EntryStatus | 'all';
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  accountId?: string;
  salesChannel?: string;
  marketplaceAccount?: string;
  dateBasis?: 'due_date' | 'competence_date' | 'payment_date';
  search?: string;
}

export function getEntryStatus(entry: FinancialEntry): EntryStatus {
  const today = startOfDay(new Date());
  // Use parseISO to respect local timezone (avoids UTC shift for YYYY-MM-DD strings)
  const dueDate = startOfDay(parseISO(entry.due_date));

  if (entry.value_paid >= entry.value) {
    return 'pago';
  }
  if (entry.value_paid > 0 && entry.value_paid < entry.value) {
    return 'parcial';
  }
  if (isBefore(dueDate, today) && entry.value_paid < entry.value) {
    return 'atrasada';
  }
  return 'em_aberto';
}

export function useFinancial() {
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FinancialFilters>({
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
    status: 'all',
  });

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('financial_categories')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setCategories(data as FinancialCategory[]);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    const { data, error } = await supabase
      .from('financial_accounts')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setAccounts(data as FinancialAccount[]);
    }
  }, []);

  const fetchEntries = useCallback(async (customFilters?: FinancialFilters) => {
    setLoading(true);
    const activeFilters = customFilters || filters;

    let query = supabase
      .from('financial_entries')
      .select(`
        *,
        category:financial_categories(*),
        account:financial_accounts(*),
        contact:contacts(id, name)
      `)
      .order('due_date', { ascending: true });

    if (activeFilters.type) {
      query = query.eq('type', activeFilters.type);
    }

    const dateColumn = activeFilters.dateBasis || 'due_date';
    if (activeFilters.startDate) {
      query = query.gte(dateColumn, format(activeFilters.startDate, 'yyyy-MM-dd'));
    }

    if (activeFilters.endDate) {
      query = query.lte(dateColumn, format(activeFilters.endDate, 'yyyy-MM-dd'));
    }

    if (activeFilters.categoryId) {
      query = query.eq('category_id', activeFilters.categoryId);
    }

    if (activeFilters.accountId) {
      query = query.eq('account_id', activeFilters.accountId);
    }
    if (activeFilters.salesChannel) query = query.eq('sales_channel', activeFilters.salesChannel);
    if (activeFilters.marketplaceAccount) query = query.eq('marketplace_account', activeFilters.marketplaceAccount);

    if (activeFilters.search) {
      query = query.ilike('description', `%${activeFilters.search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching entries:', error);
      setLoading(false);
      return;
    }

    let filteredData = (data || []) as FinancialEntry[];

    // Filter by status in memory (since it's calculated)
    if (activeFilters.status && activeFilters.status !== 'all') {
      filteredData = filteredData.filter(e => getEntryStatus(e) === activeFilters.status);
    }

    setEntries(filteredData);
    setLoading(false);
  }, [filters]);

  const createEntry = async (entry: Omit<FinancialEntry, 'id' | 'value_paid' | 'is_conciliated' | 'created_at' | 'updated_at'> & { saveAndPay?: boolean }) => {
    const recurrenceSeriesId = entry.recurrence_type ? crypto.randomUUID() : null;
    const { data, error } = await supabase
      .from('financial_entries')
      .insert({
        type: entry.type,
        description: entry.description,
        value: entry.value,
        due_date: entry.due_date,
        payment_date: entry.payment_date,
        category_id: entry.category_id,
        account_id: entry.account_id,
        contact_id: entry.contact_id,
        order_id: entry.order_id,
        document_number: entry.document_number,
        notes: entry.notes,
        sales_channel: entry.sales_channel,
        marketplace_account: entry.marketplace_account,
        payment_method: entry.payment_method,
        recurrence_type: entry.recurrence_type,
        recurrence_day: entry.recurrence_day,
        recurrence_end_date: entry.recurrence_end_date,
        recurrence_use_business_days: entry.recurrence_use_business_days,
        issue_date: entry.issue_date,
        competence_date: entry.competence_date,
        original_due_date: entry.due_date,
        recurrence_series_id: recurrenceSeriesId,
        recurrence_sequence: recurrenceSeriesId ? 0 : null,
      } as any)
      .select()
      .single();

    if (error) {
      console.error('Error creating entry:', error);
      throw error;
    }

    // If saveAndPay is true, register a full payment
    if (entry.saveAndPay && data) {
      await registerPayment(data.id, entry.value, entry.account_id);
    }

    if (data && entry.recurrence_type && entry.recurrence_end_date && recurrenceSeriesId) {
      const dueDates = buildRecurrenceDueDates(entry.due_date, {
        recurrence_type: entry.recurrence_type,
        recurrence_day: entry.recurrence_day,
        recurrence_end_date: entry.recurrence_end_date,
        recurrence_use_business_days: entry.recurrence_use_business_days,
      });
      const occurrences = dueDates.map((due, index) => ({
        type: entry.type, description: entry.description, value: entry.value,
        due_date: due, original_due_date: due,
        issue_date: entry.issue_date || null, competence_date: due,
        category_id: entry.category_id || null, account_id: entry.account_id || null,
        contact_id: entry.contact_id || null, order_id: entry.order_id || null,
        document_number: entry.document_number || null, notes: entry.notes || null,
        recurrence_type: entry.recurrence_type, recurrence_day: entry.recurrence_day || null,
        recurrence_end_date: entry.recurrence_end_date,
        recurrence_use_business_days: !!entry.recurrence_use_business_days,
        recurrence_series_id: recurrenceSeriesId, recurrence_sequence: index + 1,
        parent_entry_id: data.id,
      }));
      if (occurrences.length) {
        const { error: recurrenceError } = await supabase.from('financial_entries').insert(occurrences as any);
        if (recurrenceError) throw recurrenceError;
      }
    }


    fetchEntries();
    return data;
  };

  const updateEntry = async (id: string, updates: Partial<FinancialEntry>) => {
    // Whitelist all editable fields so form edits are not silently dropped
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    const editable: (keyof FinancialEntry)[] = [
      'type', 'description', 'value', 'due_date', 'payment_date',
      'category_id', 'account_id', 'contact_id', 'order_id',
      'document_number', 'notes',
      'sales_channel', 'marketplace_account', 'payment_method',
      'recurrence_type', 'recurrence_day', 'recurrence_end_date', 'recurrence_use_business_days',
      'issue_date', 'competence_date',
    ];
    for (const key of editable) {
      if (key in updates) payload[key] = updates[key] as unknown;
    }

    const { error } = await supabase
      .from('financial_entries')
      .update(payload as any)
      .eq('id', id);

    if (error) {
      console.error('Error updating entry:', error);
      throw error;
    }

    await syncRecurrenceSeries(id);

    fetchEntries();
  };

  /**
   * Consolida a recorrência de um lançamento existente: quando a regra está ativa,
   * (re)gera as ocorrências futuras da série sem tocar nas já pagas.
   */
  const syncRecurrenceSeries = async (id: string) => {
    const { data: row, error } = await supabase
      .from('financial_entries')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !row) return;

    const entry = row as any;
    // Editar uma ocorrência filha não regenera a série.
    if (entry.parent_entry_id) return;
    if (!entry.recurrence_type || !entry.recurrence_end_date) return;

    let seriesId: string = entry.recurrence_series_id;
    if (!seriesId) {
      seriesId = crypto.randomUUID();
      await supabase
        .from('financial_entries')
        .update({ recurrence_series_id: seriesId, recurrence_sequence: 0 } as any)
        .eq('id', id);
    }

    // Remove ocorrências futuras ainda não pagas para reaplicar a regra atual.
    await supabase
      .from('financial_entries')
      .delete()
      .eq('parent_entry_id', id)
      .eq('value_paid', 0)
      .is('payment_date', null);

    const { data: remaining } = await supabase
      .from('financial_entries')
      .select('due_date')
      .eq('parent_entry_id', id);
    const existingDates = new Set((remaining || []).map((r: any) => r.due_date));

    const dueDates = buildRecurrenceDueDates(entry.due_date, entry).filter(d => !existingDates.has(d));
    if (!dueDates.length) return;

    const occurrences = dueDates.map((due, index) => ({
      type: entry.type, description: entry.description, value: entry.value,
      due_date: due, original_due_date: due,
      issue_date: entry.issue_date || null, competence_date: due,
      category_id: entry.category_id || null, account_id: entry.account_id || null,
      contact_id: entry.contact_id || null, order_id: entry.order_id || null,
      document_number: entry.document_number || null, notes: entry.notes || null,
      recurrence_type: entry.recurrence_type, recurrence_day: entry.recurrence_day || null,
      recurrence_end_date: entry.recurrence_end_date,
      recurrence_use_business_days: !!entry.recurrence_use_business_days,
      recurrence_series_id: seriesId, recurrence_sequence: index + 1,
      parent_entry_id: id,
    }));

    const { error: insertError } = await supabase.from('financial_entries').insert(occurrences as any);
    if (insertError) console.error('Error generating recurrence occurrences:', insertError);
  };


  const deleteEntry = async (id: string) => {
    const { error } = await supabase
      .from('financial_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting entry:', error);
      throw error;
    }

    fetchEntries();
  };

  const registerPayment = async (entryId: string, value: number, accountId?: string, notes?: string, paymentDate?: string) => {
    if (!accountId) throw new Error('Selecione a conta financeira da baixa.');
    const { data: current, error: currentError } = await supabase
      .from('financial_entries').select('value,value_paid').eq('id', entryId).single();
    if (currentError) throw currentError;
    const remaining = Number(current.value) - Number(current.value_paid || 0);
    if (value <= 0 || value > remaining + 0.005) throw new Error(`A baixa não pode superar o saldo de ${remaining.toFixed(2)}.`);
    const movementDate = paymentDate || format(new Date(), 'yyyy-MM-dd');
    const { error } = await supabase
      .from('financial_movements')
      .insert({
        entry_id: entryId,
        account_id: accountId,
        value,
        movement_date: movementDate,
        notes,
      });

    if (error) {
      console.error('Error registering payment:', error);
      throw error;
    }

    // Update payment_date if fully paid
    if (Number(current.value_paid || 0) + value >= Number(current.value) - 0.005) {
      await supabase
        .from('financial_entries')
        .update({ payment_date: movementDate })
        .eq('id', entryId);
    }

    fetchEntries();
    fetchAccounts();
  };

  const registerBatchPayment = async (payments: { id: string; value: number; accountId?: string }[]) => {
    for (const payment of payments) {
      await registerPayment(payment.id, payment.value, payment.accountId);
    }
  };

  const conciliateEntry = async (id: string) => {
    const { error } = await supabase
      .from('financial_entries')
      .update({
        is_conciliated: true,
        conciliated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error conciliating entry:', error);
      throw error;
    }

    fetchEntries();
  };

  const getSummary = useCallback((type: 'pagar' | 'receber'): FinancialSummary => {
    const typeEntries = entries.filter(e => e.type === type);
    const realizedEntries = typeEntries.filter(e => Number(e.value_paid || 0) > 0);
    
    return {
      total_open: typeEntries.filter(e => getEntryStatus(e) === 'em_aberto').reduce((sum, e) => sum + (e.value - e.value_paid), 0),
      total_overdue: typeEntries.filter(e => getEntryStatus(e) === 'atrasada').reduce((sum, e) => sum + (e.value - e.value_paid), 0),
      // Resultado realizado inclui somente baixas efetivas, inclusive parciais.
      total_paid: realizedEntries.reduce((sum, e) => sum + Number(e.value_paid || 0), 0),
      count_open: typeEntries.filter(e => getEntryStatus(e) === 'em_aberto').length,
      count_overdue: typeEntries.filter(e => getEntryStatus(e) === 'atrasada').length,
      count_paid: typeEntries.filter(e => getEntryStatus(e) === 'pago').length,
      count_partial: typeEntries.filter(e => getEntryStatus(e) === 'parcial').length,
    };
  }, [entries]);

  const getDashboardSummary = useCallback(() => {
    const pagar = getSummary('pagar');
    const receber = getSummary('receber');

    const sumBy = (type: 'pagar' | 'receber', field: 'value' | 'value_paid') =>
      entries.filter(e => e.type === type).reduce((sum, e) => sum + Number(e[field] || 0), 0);

    // Caixa real do período: tudo que foi efetivamente pago/recebido,
    // incluindo pagamentos parciais (antes só lançamentos 100% quitados entravam).
    const recebido = sumBy('receber', 'value_paid');
    const pago = sumBy('pagar', 'value_paid');
    const previstoEntradas = sumBy('receber', 'value');
    const previstoSaidas = sumBy('pagar', 'value');

    return {
      pagar,
      receber,
      totalEntradas: recebido,
      totalSaidas: pago,
      saldo: recebido - pago,
      previstoEntradas,
      previstoSaidas,
      abertoEntradas: Math.max(0, previstoEntradas - recebido),
      abertoSaidas: Math.max(0, previstoSaidas - pago),
      totalAccountsBalance: accounts.reduce((sum, a) => sum + a.current_balance, 0),
    };
  }, [getSummary, accounts, entries]);


  // Export to CSV
  const exportToCSV = useCallback((type?: 'pagar' | 'receber') => {
    const dataToExport = type ? entries.filter(e => e.type === type) : entries;
    
    const headers = ['Descrição', 'Tipo', 'Valor', 'Valor Pago', 'Vencimento', 'Status', 'Categoria', 'Conta'];
    const rows = dataToExport.map(e => [
      e.description,
      e.type === 'pagar' ? 'A Pagar' : 'A Receber',
      e.value.toFixed(2),
      e.value_paid.toFixed(2),
      format(parseISO(e.due_date), 'dd/MM/yyyy'),
      getEntryStatus(e),
      e.category?.name || '',
      e.account?.name || '',
    ]);

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `financeiro_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  }, [entries]);

  // Create/Update Category
  const saveCategory = async (category: Partial<FinancialCategory> & { name: string; type: string }) => {
    if (category.id) {
      await supabase.from('financial_categories').update(category).eq('id', category.id);
    } else {
      await supabase.from('financial_categories').insert(category);
    }
    fetchCategories();
  };

  // Create/Update Account
  const saveAccount = async (account: Partial<FinancialAccount> & { name: string; type: string }) => {
    if (account.id) {
      await supabase.from('financial_accounts').update(account).eq('id', account.id);
    } else {
      await supabase.from('financial_accounts').insert({
        ...account,
        current_balance: account.initial_balance || 0,
      });
    }
    fetchAccounts();
  };

  useEffect(() => {
    Promise.all([fetchCategories(), fetchAccounts()]).then(() => {
      fetchEntries();
    });
  }, []);

  return {
    entries,
    categories,
    accounts,
    loading,
    filters,
    setFilters,
    fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    registerPayment,
    registerBatchPayment,
    conciliateEntry,
    getSummary,
    getDashboardSummary,
    exportToCSV,
    saveCategory,
    saveAccount,
    fetchAccounts,
    getEntryStatus,
  };
}
