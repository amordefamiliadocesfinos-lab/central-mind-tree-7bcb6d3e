import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { formatCurrency, cn } from '@/lib/utils';
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Plus, Search, MoreVertical, Download, DollarSign, CheckCircle, Trash2, 
  Edit, Filter, Printer, FileText, RefreshCw, X, Calendar, ChevronDown,
  CreditCard, Paperclip, List, LayoutGrid, CalendarPlus

} from 'lucide-react';
import { FinancialEntry, EntryStatus, getEntryStatus, FinancialCategory, FinancialAccount } from '@/hooks/useFinancial';
import { PaymentDialog } from './PaymentDialog';
import { AdvancedPaymentDialog } from './AdvancedPaymentDialog';
import { AddToRoutineDialog } from '@/components/routine/AddToRoutineDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { FinancialEntryForm } from './FinancialEntryForm';
import { SALES_CHANNELS } from '@/lib/salesChannels';

interface FinancialEntriesListProps {
  entries: FinancialEntry[];
  type: 'pagar' | 'receber';
  categories: FinancialCategory[];
  accounts: FinancialAccount[];
  loading: boolean;
  onCreateEntry: (data: any) => Promise<any>;
  onUpdateEntry: (id: string, data: any) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  onRegisterPayment: (id: string, value: number, accountId?: string, notes?: string, paymentDate?: string) => Promise<void>;
  onConciliate: (id: string) => Promise<void>;
  onExport: () => void;
  statusFilter: EntryStatus | 'all';
  onStatusFilterChange: (status: EntryStatus | 'all') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const statusLabels: Record<EntryStatus, string> = {
  atrasada: 'Atrasada',
  parcial: 'Parcial',
  pago: 'Pago',
  em_aberto: 'Em aberto',
};

const statusColors: Record<EntryStatus, string> = {
  atrasada: 'bg-red-500 text-white',
  parcial: 'bg-amber-500 text-white',
  pago: 'bg-emerald-500 text-white',
  em_aberto: 'bg-blue-500 text-white',
};

export function FinancialEntriesList({
  entries,
  type,
  categories,
  accounts,
  loading,
  onCreateEntry,
  onUpdateEntry,
  onDeleteEntry,
  onRegisterPayment,
  onConciliate,
  onExport,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
}: FinancialEntriesListProps) {
  const isMobile = useIsMobile();
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | undefined>();
  const [paymentEntry, setPaymentEntry] = useState<FinancialEntry | undefined>();
  const [advancedPaymentEntries, setAdvancedPaymentEntries] = useState<FinancialEntry[]>([]);
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [routineEntry, setRoutineEntry] = useState<FinancialEntry | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(!isMobile);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [channelAccountFilter, setChannelAccountFilter] = useState<string>('all');
  const [formTab, setFormTab] = useState('pagamento');
  
  // Period picker state
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState<Date | undefined>(startOfMonth(new Date()));
  const [periodEnd, setPeriodEnd] = useState<Date | undefined>(endOfMonth(new Date()));
  const [tempPeriodStart, setTempPeriodStart] = useState<Date | undefined>(periodStart);
  const [tempPeriodEnd, setTempPeriodEnd] = useState<Date | undefined>(periodEnd);

  // Form state
  const [form, setForm] = useState({
    contact_name: '',
    value: '',
    issue_date: format(new Date(), 'yyyy-MM-dd'),
    competence_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: '',
    description: '',
    payment_method: '',
    account_id: '',
    category_id: '',
    document_number: '',
    interest_rate: '',
    penalty_rate: '',
    notes: '',
  });

  const title = type === 'pagar' ? 'Contas a pagar' : 'Contas a receber';
  const typeEntries = entries.filter(e => e.type === type);

  // Period preset functions
  const applyPeriodPreset = (preset: string) => {
    const today = new Date();
    let start: Date;
    let end: Date;

    switch (preset) {
      case 'today':
        start = startOfDay(today);
        end = endOfDay(today);
        break;
      case 'thisWeek':
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case 'lastWeek':
        start = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
        end = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
        break;
      case 'thisMonth':
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case 'lastMonth':
        start = startOfMonth(subMonths(today, 1));
        end = endOfMonth(subMonths(today, 1));
        break;
      default:
        return;
    }
    
    setTempPeriodStart(start);
    setTempPeriodEnd(end);
  };

  const handleApplyPeriod = () => {
    setPeriodStart(tempPeriodStart);
    setPeriodEnd(tempPeriodEnd);
    setPeriodPickerOpen(false);
  };

  const handleCancelPeriod = () => {
    setTempPeriodStart(periodStart);
    setTempPeriodEnd(periodEnd);
    setPeriodPickerOpen(false);
  };

  // Apply filters
  const filteredEntries = useMemo(() => {
    let filtered = [...typeEntries];

    // Filter by period
    if (periodStart && periodEnd) {
      filtered = filtered.filter(e => {
        const dueDate = parseISO(e.due_date);
        return dueDate >= startOfDay(periodStart) && dueDate <= endOfDay(periodEnd);
      });
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(e => getEntryStatus(e) === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.description?.toLowerCase().includes(query) ||
        e.contact?.name?.toLowerCase().includes(query)
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(e => e.category_id === categoryFilter);
    }

    if (selectedAccount !== 'all') {
      filtered = filtered.filter(e => e.account_id === selectedAccount);
    }
    if (channelFilter !== 'all') filtered = filtered.filter(e => e.sales_channel === channelFilter);
    if (channelAccountFilter !== 'all') filtered = filtered.filter(e => e.marketplace_account === channelAccountFilter);

    return filtered;
  }, [typeEntries, statusFilter, searchQuery, categoryFilter, selectedAccount, channelFilter, channelAccountFilter, periodStart, periodEnd]);

  // Summary
  const summary = useMemo(() => {
    const total = filteredEntries.reduce((sum, e) => sum + (e.value - e.value_paid), 0);
    
    // Calculate selected items summary
    const selectedItems = filteredEntries.filter(e => selectedIds.includes(e.id));
    const selectedValue = selectedItems.reduce((sum, e) => sum + e.value, 0);
    
    return {
      count: filteredEntries.length,
      total,
      selectedCount: selectedIds.length,
      selectedValue,
    };
  }, [filteredEntries, selectedIds]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredEntries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEntries.map(e => e.id));
    }
  };

  const handleBatchPayment = async () => {
    const selected = filteredEntries.filter(e => selectedIds.includes(e.id) && getEntryStatus(e) !== 'pago');
    for (const entry of selected) {
      await onRegisterPayment(entry.id, entry.value - entry.value_paid);
    }
    setSelectedIds([]);
  };

  const handleEdit = (entry: FinancialEntry) => {
    setEditingEntry(entry);
    setForm({
      contact_name: entry.contact?.name || '',
      value: entry.value.toString(),
      issue_date: format(new Date(), 'yyyy-MM-dd'),
      competence_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: entry.due_date,
      description: entry.description || '',
      payment_method: '',
      account_id: entry.account_id || '',
      category_id: entry.category_id || '',
      document_number: entry.document_number || '',
      interest_rate: '',
      penalty_rate: '',
      notes: entry.notes || '',
    });
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditingEntry(undefined);
    setForm({
      contact_name: '',
      value: '',
      issue_date: format(new Date(), 'yyyy-MM-dd'),
      competence_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: '',
      description: '',
      payment_method: '',
      account_id: '',
      category_id: '',
      document_number: '',
      interest_rate: '',
      penalty_rate: '',
      notes: '',
    });
    setFormTab('pagamento');
    setFormOpen(true);
  };

  const handleSave = async (saveAndPay: boolean = false) => {
    const data = {
      type,
      description: form.description || form.contact_name,
      value: parseFloat(form.value) || 0,
      due_date: form.due_date,
      category_id: form.category_id || null,
      account_id: form.account_id || null,
      document_number: form.document_number || null,
      notes: form.notes || null,
    };

    if (editingEntry) {
      await onUpdateEntry(editingEntry.id, data);
    } else {
      const newEntry = await onCreateEntry(data);
      if (saveAndPay && newEntry) {
        await onRegisterPayment(newEntry.id, parseFloat(form.value), form.account_id || undefined);
      }
    }
    setFormOpen(false);
    setEditingEntry(undefined);
  };

  const handleUnifiedSave = async (data: any) => {
    if (editingEntry) {
      await onUpdateEntry(editingEntry.id, data);
      if (data.saveAndPay) await onRegisterPayment(editingEntry.id, editingEntry.value - editingEntry.value_paid, data.account_id);
    } else await onCreateEntry(data);
    setEditingEntry(undefined);
  };

  const clearFilters = () => {
    onStatusFilterChange('all');
    setCategoryFilter('all');
    setSelectedAccount('all');
    setChannelFilter('all'); setChannelAccountFilter('all');
    onSearchChange('');
  };

  const getStatusLabel = (status: EntryStatus) => {
    if (status === 'pago') {
      return type === 'pagar' ? 'Paga' : 'Recebida';
    }
    return statusLabels[status];
  };

  const filteredCategories = categories.filter(c => c.type === type || c.type === 'ambos');
  const channelAccounts = Array.from(new Set(typeEntries.map(e => e.marketplace_account).filter(Boolean))) as string[];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todas as contas financeiras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas financeiras</SelectItem>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleNew} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-1" />
          Incluir conta
        </Button>
      </div>

      <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-[220px_1fr_260px]")}>
        {/* Left Sidebar - Filters */}
        {showFilters && (
          <Card className="p-4 space-y-4 h-fit">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-1">
                <Filter className="h-4 w-4" /> Filtrar
              </span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowFilters(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Opção</Label>
                <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as EntryStatus | 'all')}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="em_aberto">Em aberto</SelectItem>
                    <SelectItem value="atrasada">Atrasadas</SelectItem>
                    <SelectItem value="parcial">Parcial</SelectItem>
                    <SelectItem value="pago">{type === 'pagar' ? 'Pagas' : 'Recebidas'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Categoria</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas categorias</SelectItem>
                    {filteredCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tipo de pagamento</Label>
                <Select defaultValue="all">
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Canal de venda</Label><Select value={channelFilter} onValueChange={setChannelFilter}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os canais</SelectItem>{SALES_CHANNELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Conta do canal</Label><Select value={channelAccountFilter} onValueChange={setChannelAccountFilter}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as lojas</SelectItem>{channelAccounts.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>

              <div className="space-y-1">
                <Label className="text-xs">Forma de pagamento</Label>
                <Select defaultValue="all">
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Valor</Label>
                  <Input placeholder="" className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">N° documento</Label>
                  <Input placeholder="" className="h-9" />
                </div>
              </div>

              <Button variant="outline" size="sm" className="w-full" onClick={clearFilters}>
                Filtrar
              </Button>
            </div>
          </Card>
        )}

        {/* Main Content */}
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquise por nome, e-mail, CPF/CNPJ ou histórico"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Popover open={periodPickerOpen} onOpenChange={setPeriodPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="h-4 w-4 mr-1" />
                  {periodStart && periodEnd ? (
                    `${format(periodStart, "dd/MM/yyyy")} até ${format(periodEnd, "dd/MM/yyyy")}`
                  ) : (
                    'Selecionar período'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="flex">
                  {/* Calendars */}
                  <div className="p-4 border-r">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Início do período</Label>
                          <Input 
                            type="text" 
                            value={tempPeriodStart ? format(tempPeriodStart, "dd/MM/yyyy") : ''} 
                            readOnly 
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Fim do período</Label>
                          <Input 
                            type="text" 
                            value={tempPeriodEnd ? format(tempPeriodEnd, "dd/MM/yyyy") : ''} 
                            readOnly 
                            className="h-9"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <CalendarComponent
                          mode="single"
                          selected={tempPeriodStart}
                          onSelect={setTempPeriodStart}
                          locale={ptBR}
                          className="pointer-events-auto"
                        />
                        <CalendarComponent
                          mode="single"
                          selected={tempPeriodEnd}
                          onSelect={setTempPeriodEnd}
                          locale={ptBR}
                          className="pointer-events-auto"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button variant="outline" size="sm" onClick={handleCancelPeriod}>
                          Cancelar
                        </Button>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleApplyPeriod}>
                          Filtrar
                        </Button>
                      </div>
                    </div>
                  </div>
                  {/* Presets */}
                  <div className="p-4 space-y-1 min-w-[160px]">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => applyPeriodPreset('today')}
                    >
                      Hoje
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => applyPeriodPreset('thisWeek')}
                    >
                      Esta semana
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => applyPeriodPreset('lastWeek')}
                    >
                      Semana passada
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => applyPeriodPreset('thisMonth')}
                    >
                      Este mês
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => applyPeriodPreset('lastMonth')}
                    >
                      Mês passado
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="w-full justify-start bg-emerald-600 hover:bg-emerald-700 mt-2"
                    >
                      Período customizado
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon">
              <Printer className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={onExport}>
              <Trash2 className="h-4 w-4" />
            </Button>
            {!showFilters && (
              <Button variant="outline" size="icon" onClick={() => setShowFilters(true)}>
                <Filter className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Active filters indicator */}
          {(statusFilter !== 'all' || categoryFilter !== 'all' || selectedIds.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {statusFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {getStatusLabel(statusFilter as EntryStatus)}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => onStatusFilterChange('all')} />
                </Badge>
              )}
              {categoryFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {categories.find(c => c.id === categoryFilter)?.name}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setCategoryFilter('all')} />
                </Badge>
              )}
              {selectedIds.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  Selecionados: {selectedIds.length} cadastros
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedIds([])} />
                </Badge>
              )}
              <Button variant="link" size="sm" className="h-auto p-0" onClick={clearFilters}>
                Limpar
              </Button>
            </div>
          )}

          {/* Table */}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.length === filteredEntries.length && filteredEntries.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>
                    <RefreshCw className="h-4 w-4" />
                  </TableHead>
                  <TableHead>{type === 'pagar' ? 'Fornecedor' : 'Cliente'}</TableHead>
                  <TableHead>Histórico</TableHead>
                  <TableHead>Forma de pagamento</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum lançamento encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.map((entry) => {
                    const status = getEntryStatus(entry);
                    return (
                      <TableRow 
                        key={entry.id}
                        className={cn(selectedIds.includes(entry.id) && "bg-emerald-50 dark:bg-emerald-950")}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(entry.id)}
                            onCheckedChange={() => toggleSelect(entry.id)}
                          />
                        </TableCell>
                        <TableCell>
                          {entry.is_conciliated && (
                            <span className="text-xs">🔄</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {entry.contact?.name || entry.description?.split(' ').slice(0, 2).join(' ') || '-'}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{entry.description}</span>
                        </TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>
                          {format(parseISO(entry.due_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(entry.value)}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", statusColors[status])}>
                            {getStatusLabel(status)}
                          </Badge>
                          {entry.is_conciliated && (
                            <span className="ml-1 text-muted-foreground">🔄</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {status !== 'pago' && (
                                <>
                                  <DropdownMenuItem onClick={() => {
                                    setPaymentEntry(entry);
                                    setIsPartialPayment(false);
                                  }}>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Baixa total do {type === 'receber' ? 'recebimento' : 'pagamento'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setPaymentEntry(entry);
                                    setIsPartialPayment(true);
                                  }}>
                                    <DollarSign className="mr-2 h-4 w-4" />
                                    Baixa parcial do {type === 'receber' ? 'recebimento' : 'pagamento'}
                                  </DropdownMenuItem>
                                </>
                              )}
                              {status === 'pago' && !entry.is_conciliated && (
                                <DropdownMenuItem onClick={() => onConciliate(entry.id)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Conciliar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleEdit(entry)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setRoutineEntry(entry)}>
                                <CalendarPlus className="mr-2 h-4 w-4" />
                                Adicionar à Rotina
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onDeleteEntry(entry.id)} className="text-red-500">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Right Sidebar */}
        {!isMobile && (
          <div className="space-y-4">
            {/* Actions */}
            <Card className="p-4 space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                disabled={selectedIds.length === 0}
                onClick={handleBatchPayment}
              >
                <CheckCircle className="h-4 w-4" />
                Baixar selecionados
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Printer className="h-4 w-4" />
                Imprimir agrupado por {type === 'pagar' ? 'fornecedor' : 'cliente'}
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <FileText className="h-4 w-4" />
                Gerar recibos
              </Button>
            </Card>

            {/* Summary */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Quantidade de registros</span>
                <span className="font-medium text-blue-600">{summary.count}</span>
              </div>
              {summary.selectedCount > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Valor</span>
                    <span className={cn(
                      "font-bold text-lg",
                      type === 'pagar' ? 'text-red-500' : 'text-emerald-600'
                    )}>
                      {formatCurrency(summary.selectedValue)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Selecionados</span>
                    <span className="font-medium text-blue-600">{summary.selectedCount}</span>
                  </div>
                </>
              )}
              {summary.selectedCount === 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Valor total</span>
                  <span className={cn(
                    "font-bold text-lg",
                    type === 'pagar' ? 'text-red-500' : 'text-emerald-600'
                  )}>
                    {formatCurrency(summary.total)}
                  </span>
                </div>
              )}
            </Card>

            {/* Tools */}
            <Card className="p-4">
              <span className="font-medium text-sm">Ferramentas de apoio</span>
            </Card>
          </div>
        )}
      </div>

      <FinancialEntryForm
        open={formOpen}
        onOpenChange={setFormOpen}
        entry={editingEntry}
        type={type}
        categories={categories}
        accounts={accounts}
        onSave={handleUnifiedSave}
      />

      {/* Formulário legado mantido temporariamente fora da renderização. */}
      <Dialog open={false} onOpenChange={() => undefined}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{type === 'pagar' ? 'Conta a pagar' : 'Conta a receber'}</DialogTitle>
            <p className="text-xs text-muted-foreground">Digite parte do nome e pressione ENTER</p>
          </DialogHeader>

          <div className="space-y-4">
            {/* Main fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{type === 'pagar' ? 'Fornecedor' : 'Cliente'} *</Label>
                <div className="relative">
                  <Input
                    value={form.contact_name}
                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                    placeholder={`Nome do ${type === 'pagar' ? 'fornecedor' : 'cliente'}`}
                    className="pr-12"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Plus className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Emissão *</Label>
                <Input
                  type="date"
                  value={form.issue_date}
                  onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Competência *</Label>
                <Input
                  type="date"
                  value={form.competence_date}
                  onChange={(e) => setForm({ ...form, competence_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Histórico</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição do lançamento..."
                rows={3}
              />
            </div>

            {/* Tabs */}
            <Tabs value={formTab} onValueChange={setFormTab}>
              <TabsList>
                <TabsTrigger value="pagamento" className="gap-1">
                  <CreditCard className="h-4 w-4" />
                  Pagamento
                </TabsTrigger>
                <TabsTrigger value="ocorrencia" className="gap-1">
                  <Calendar className="h-4 w-4" />
                  Ocorrência
                </TabsTrigger>
                <TabsTrigger value="anexos" className="gap-1">
                  <Paperclip className="h-4 w-4" />
                  Anexos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pagamento" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Forma de Pagamento</Label>
                    <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="cartao">Cartão</SelectItem>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="transferencia">Transferência</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Conta Financeira</Label>
                    <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sem categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>N° documento</Label>
                    <Input
                      value={form.document_number}
                      onChange={(e) => setForm({ ...form, document_number: e.target.value })}
                      placeholder=""
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Juros mensal (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.interest_rate}
                      onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Multa (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.penalty_rate}
                      onChange={(e) => setForm({ ...form, penalty_rate: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                </div>

                {/* Summary row */}
                <div className="grid grid-cols-5 gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Vencimento original</p>
                    <p className="font-medium">{form.due_date ? format(parseISO(form.due_date), 'dd/MM/yyyy') : '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Valor original</p>
                    <p className="font-medium">{formatCurrency(parseFloat(form.value) || 0)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Juros</p>
                    <p className="font-medium">{formatCurrency(0)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Multa</p>
                    <p className="font-medium">{formatCurrency(0)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Valor total</p>
                    <p className="font-medium">{formatCurrency(parseFloat(form.value) || 0)}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="ocorrencia" className="mt-4">
                <p className="text-sm text-muted-foreground">Configurações de recorrência...</p>
              </TabsContent>

              <TabsContent value="anexos" className="mt-4">
                <p className="text-sm text-muted-foreground">Anexar arquivos...</p>
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="ghost" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button variant="outline" onClick={() => handleSave(true)}>
                Salvar e dar baixa
              </Button>
              <Button onClick={() => handleSave(false)} className="bg-emerald-600 hover:bg-emerald-700">
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {paymentEntry && (
        <PaymentDialog
          open={!!paymentEntry}
          onOpenChange={(open) => !open && setPaymentEntry(undefined)}
          entry={paymentEntry}
          accounts={accounts}
          partial={isPartialPayment}
          onAdvanced={() => { setAdvancedPaymentEntries([paymentEntry]); setPaymentEntry(undefined); }}
          onConfirm={async (value, accountId, notes, paymentDate) => {
            await onRegisterPayment(paymentEntry.id, value, accountId, notes, paymentDate);
            setPaymentEntry(undefined);
          }}
        />
      )}

      {advancedPaymentEntries.length > 0 && (
        <AdvancedPaymentDialog
          open={advancedPaymentEntries.length > 0}
          onOpenChange={(open) => !open && setAdvancedPaymentEntries([])}
          entries={advancedPaymentEntries}
          accounts={accounts}
          categories={categories}
          isPartial={isPartialPayment}
          onConfirm={async (id, value, accountId, notes, paymentDate) => {
            await onRegisterPayment(id, value, accountId, notes, paymentDate);
          }}
          onUpdateEntry={onUpdateEntry}
        />
      )}

      {routineEntry && (
        <AddToRoutineDialog
          open={!!routineEntry}
          onOpenChange={(o) => !o && setRoutineEntry(null)}
          source={{ kind: 'financial/entry', id: routineEntry.id, label: routineEntry.description }}
          defaultTitle={`💰 ${routineEntry.type === 'receber' ? 'Receber' : 'Pagar'}: ${routineEntry.description}`}
          defaultFocus="pessoal"
          defaultDurationMin={15}
          defaultNotes={`Valor: ${formatCurrency(routineEntry.value)}`}
        />
      )}
    </div>
  );
}
