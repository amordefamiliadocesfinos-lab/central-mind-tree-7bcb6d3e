import { useMemo, useState } from 'react';
import { useRealizedCash } from '@/hooks/useRealizedCash';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plus, Search, TrendingUp, TrendingDown, Wallet, Receipt, MoreVertical,
  Edit, Trash2, CheckCircle2, FileText, Tag, Users, ArrowLeft, CalendarIcon,
  DollarSign, ChevronRight, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn, formatCurrency } from '@/lib/utils';
import {
  FinancialEntry, EntryStatus, getEntryStatus, FinancialCategory, FinancialAccount,
} from '@/hooks/useFinancial';
import { PaymentDialog } from './PaymentDialog';
import {
  FinancialDashboard, AccountsManager, CategoriesManager, ContactsManager, InvoicesManager,
} from './index';
import { SALES_CHANNELS, salesChannelLabel } from '@/lib/salesChannels';

interface Props {
  entries: FinancialEntry[];
  categories: FinancialCategory[];
  accounts: FinancialAccount[];
  loading: boolean;
  filters: any;
  onPeriodChange: (start: Date | undefined, end: Date | undefined) => void;
  onCreateEntry: (data: any) => Promise<any>;
  onUpdateEntry: (id: string, data: any) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  onRegisterPayment: (id: string, value: number, accountId?: string, notes?: string) => Promise<void>;
  onSaveAccount: (data: any) => Promise<any>;
  onSaveCategory: (data: any) => Promise<any>;
}

type Section = 'resumo' | 'receber' | 'pagar' | 'mais';
type SubSection = 'notas' | 'contas' | 'contatos' | 'categorias';

const STATUS_COLORS: Record<EntryStatus, string> = {
  atrasada: 'bg-destructive text-destructive-foreground',
  parcial: 'bg-amber-500 text-white',
  pago: 'bg-emerald-500 text-white',
  em_aberto: 'bg-blue-500 text-white',
};

const STATUS_LABELS: Record<EntryStatus, string> = {
  atrasada: 'Atrasada',
  parcial: 'Parcial',
  pago: 'Pago',
  em_aberto: 'Aberta',
};

export function MobileFinancialView({
  entries, categories, accounts, filters,
  onPeriodChange, onCreateEntry, onUpdateEntry, onDeleteEntry, onRegisterPayment,
  onSaveAccount, onSaveCategory,
}: Props) {
  const [section, setSection] = useState<Section>('resumo');
  const [subSection, setSubSection] = useState<SubSection | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EntryStatus | 'all'>('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [channelAccountFilter, setChannelAccountFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialEntry | null>(null);
  const purchaseProtected = Boolean(editing?.purchase_order_id);
  const [paymentEntry, setPaymentEntry] = useState<FinancialEntry | null>(null);
  const [formType, setFormType] = useState<'pagar' | 'receber'>('receber');

  // Quick form
  const [form, setForm] = useState({
    contact_name: '',
    value: '',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    category_id: '',
    account_id: '',
    notes: '',
    sales_channel: '', marketplace_account: '',
  });

  const resetForm = () => {
    setForm({
      contact_name: '',
      value: '',
      due_date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      category_id: '',
      account_id: '',
      notes: '',
      sales_channel: '', marketplace_account: '',
    });
    setEditing(null);
  };

  const openCreate = (type: 'pagar' | 'receber') => {
    resetForm();
    setFormType(type);
    setFormOpen(true);
  };

  const openEdit = (entry: FinancialEntry) => {
    setEditing(entry);
    setFormType(entry.type);
    setForm({
      contact_name: entry.contact?.name || '',
      value: String(entry.value),
      due_date: entry.due_date?.slice(0, 10) || format(new Date(), 'yyyy-MM-dd'),
      description: entry.description || '',
      category_id: entry.category_id || '',
      account_id: entry.account_id || '',
      notes: entry.notes || '',
      sales_channel: entry.sales_channel || '', marketplace_account: entry.marketplace_account || '',
    });
    setFormOpen(true);
  };

  const submitForm = async () => {
    const value = parseFloat(form.value.replace(',', '.'));
    if (!value || !form.description) return;
    const payload: any = {
      type: formType,
      description: form.description,
      value,
      due_date: form.due_date,
      issue_date: form.due_date,
      competence_date: form.due_date,
      category_id: form.category_id || null,
      account_id: form.account_id || null,
      notes: form.notes || null,
      sales_channel: form.sales_channel || null, marketplace_account: form.marketplace_account || null,
    };
    if (editing) {
      // Editing must not silently replace the original issue/competence dates.
      delete payload.issue_date;
      delete payload.competence_date;
    }
    try {
      if (editing) await onUpdateEntry(editing.id, payload);
      else await onCreateEntry(payload);
      setFormOpen(false);
      resetForm();
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Não foi possível salvar o lançamento.';
      toast.error(message);
    }
  };

  // Filtered entries
  const visibleEntries = useMemo(() => {
    let list = entries;
    if (section === 'receber') list = list.filter(e => e.type === 'receber');
    if (section === 'pagar') list = list.filter(e => e.type === 'pagar');
    if (statusFilter !== 'all') list = list.filter(e => getEntryStatus(e) === statusFilter);
    if (channelFilter !== 'all') list = list.filter(e => e.sales_channel === channelFilter);
    if (channelAccountFilter !== 'all') list = list.filter(e => e.marketplace_account === channelAccountFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.description?.toLowerCase().includes(q) ||
        e.contact?.name?.toLowerCase().includes(q) ||
        e.document_number?.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  }, [entries, section, statusFilter, channelFilter, channelAccountFilter, search]);
  const channelAccounts = Array.from(new Set(entries.map(e => e.marketplace_account).filter(Boolean))) as string[];

  const cash = useRealizedCash(filters, entries);
  // Totals
  const totals = useMemo(() => {
    let entradas = 0, saidas = 0, recebido = 0, pago = 0;
    for (const e of entries) {
      if (e.type === 'receber') {
        entradas += e.value;
        recebido += e.value_paid;
      } else {
        saidas += e.value;
        pago += e.value_paid;
      }
    }
    return {
      entradas, saidas, recebido, pago,
      resultado: entradas - saidas,
      saldo: recebido - pago,
    };
  }, [entries]);

  const periodLabel = filters.startDate && filters.endDate
    ? `${format(filters.startDate, 'dd/MM', { locale: ptBR })} – ${format(filters.endDate, 'dd/MM', { locale: ptBR })}`
    : 'Período';

  // === Sub-pages (full-screen overlays) ===
  if (subSection) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
          <div className="flex items-center gap-2 p-3">
            <Button variant="ghost" size="icon" onClick={() => setSubSection(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="font-semibold text-base">
              {subSection === 'notas' && 'Notas Fiscais'}
              {subSection === 'contas' && 'Caixas/Bancos'}
              {subSection === 'contatos' && 'Clientes/Forn.'}
              {subSection === 'categorias' && 'Categorias'}
            </h2>
          </div>
        </div>
        <div className="p-3">
          {subSection === 'notas' && <InvoicesManager />}
          {subSection === 'contas' && (
            <AccountsManager
              accounts={accounts}
              onSave={onSaveAccount}
              startDate={filters.startDate}
              endDate={filters.endDate}
              onPeriodChange={onPeriodChange}
            />
          )}
          {subSection === 'contatos' && <ContactsManager />}
          {subSection === 'categorias' && (
            <CategoriesManager categories={categories} onSave={onSaveCategory} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky header: title + period */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center justify-between px-3 py-2.5 gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight">Financeiro</h1>
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-xs text-muted-foreground inline-flex items-center gap-1 active:opacity-60">
                  <CalendarIcon className="h-3 w-3" /> {periodLabel}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                <CalendarComponent
                  mode="range"
                  selected={{ from: filters.startDate, to: filters.endDate }}
                  onSelect={(r) => onPeriodChange(r?.from, r?.to)}
                  locale={ptBR}
                />
                <div className="p-2 border-t flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => {
                    onPeriodChange(startOfMonth(new Date()), endOfMonth(new Date()));
                  }}>
                    Este mês
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Section content */}
      {section === 'resumo' && (
        <ResumoView totals={totals} cash={cash} onOpenDashboard={() => {/* dashboard tab */}} />
      )}

      {section === 'mais' && (
        <MaisView onOpen={setSubSection} />
      )}

      {(section === 'receber' || section === 'pagar' || section === 'resumo') && (
        <>
          {/* Quick totals strip (always visible on list sections) */}
          {(section === 'receber' || section === 'pagar') && (
            <div className="px-3 pt-3 grid grid-cols-2 gap-2">
              <MiniStat
                label={section === 'receber' ? 'A receber' : 'A pagar'}
                value={section === 'receber' ? totals.entradas - totals.recebido : totals.saidas - totals.pago}
                tone={section === 'receber' ? 'positive' : 'negative'}
              />
              <MiniStat
                label={section === 'receber' ? 'Recebido' : 'Pago'}
                value={section === 'receber' ? totals.recebido : totals.pago}
                tone="muted"
              />
            </div>
          )}

          {section === 'resumo' && (
            <div className="px-3 pb-3">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-1">
                Próximos vencimentos
              </h3>
            </div>
          )}

          {/* Search + status filter */}
          {(section === 'receber' || section === 'pagar') && (
            <div className="px-3 pt-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar descrição, contato..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-11"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-3 px-3 scrollbar-none">
                {(['all', 'em_aberto', 'atrasada', 'parcial', 'pago'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      statusFilter === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border',
                    )}
                  >
                    {s === 'all' ? 'Todos' : STATUS_LABELS[s as EntryStatus]}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2"><Select value={channelFilter} onValueChange={setChannelFilter}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os canais</SelectItem>{SALES_CHANNELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select><Select value={channelAccountFilter} onValueChange={setChannelAccountFilter}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as lojas</SelectItem>{channelAccounts.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
            </div>
          )}

          {/* Entries list as cards */}
          <div className="px-3 py-3 space-y-2">
            {(section === 'resumo'
              ? [...entries].filter(e => getEntryStatus(e) !== 'pago')
                  .sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
                  .slice(0, 8)
              : visibleEntries
            ).length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Nenhum lançamento.
              </div>
            ) : (
              (section === 'resumo'
                ? [...entries].filter(e => getEntryStatus(e) !== 'pago')
                    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
                    .slice(0, 8)
                : visibleEntries
              ).map(entry => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onEdit={() => openEdit(entry)}
                  onDelete={() => onDeleteEntry(entry.id)}
                  onPay={() => setPaymentEntry(entry)}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* FAB */}
      {section !== 'mais' && (
        <button
          onClick={() => openCreate(section === 'pagar' ? 'pagar' : 'receber')}
          className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Novo lançamento"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-20 bg-background/95 backdrop-blur border-t pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4 h-16">
          <NavBtn icon={<Wallet className="h-5 w-5" />} label="Resumo" active={section==='resumo'} onClick={() => setSection('resumo')} />
          <NavBtn icon={<TrendingUp className="h-5 w-5" />} label="Receber" active={section==='receber'} onClick={() => { setSection('receber'); setStatusFilter('all'); }} />
          <NavBtn icon={<TrendingDown className="h-5 w-5" />} label="Pagar" active={section==='pagar'} onClick={() => { setSection('pagar'); setStatusFilter('all'); }} />
          <NavBtn icon={<MoreVertical className="h-5 w-5" />} label="Mais" active={section==='mais'} onClick={() => setSection('mais')} />
        </div>
      </nav>

      {/* Quick entry form (sheet) */}
      <Sheet open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) resetForm(); }}>
        <SheetContent side="bottom" className="h-[92vh] rounded-t-2xl p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-2 border-b">
            <SheetTitle className="text-left flex items-center gap-2">
              {editing ? 'Editar lançamento' : 'Novo lançamento'}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {purchaseProtected && <p role="note" className="rounded-md border p-3 text-sm text-muted-foreground">Compra vinculada: tipo, valor e vencimento são protegidos. Corrija a compra pelo fluxo de regularização, quando permitido. Pagamentos já registrados exigem retificação financeira, não alteração da obrigação.</p>}
            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={purchaseProtected}
                onClick={() => setFormType('receber')}
                className={cn(
                  'h-12 rounded-lg border-2 font-semibold text-sm flex items-center justify-center gap-2 transition-colors',
                  formType === 'receber' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border text-muted-foreground',
                )}
              >
                <TrendingUp className="h-4 w-4" /> A receber
              </button>
              <button
                disabled={purchaseProtected}
                onClick={() => setFormType('pagar')}
                className={cn(
                  'h-12 rounded-lg border-2 font-semibold text-sm flex items-center justify-center gap-2 transition-colors',
                  formType === 'pagar' ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'border-border text-muted-foreground',
                )}
              >
                <TrendingDown className="h-4 w-4" /> A pagar
              </button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Valor *</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                readOnly={purchaseProtected}
                value={form.value}
                onChange={(e) => setForm(f => ({ ...f, value: e.target.value }))}
                className="h-14 text-2xl font-bold text-center"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descrição *</Label>
              <Input
                placeholder="Ex.: Venda mesa de jantar"
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                className="h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Vencimento</Label>
                <Input
                  type="date"
                  readOnly={purchaseProtected}
                  value={form.due_date}
                  onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm(f => ({ ...f, category_id: v }))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.type === formType).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Conta</Label>
              <Select value={form.account_id} onValueChange={(v) => setForm(f => ({ ...f, account_id: v }))}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Caixa / banco" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2"><div className="space-y-1.5"><Label className="text-xs">Canal</Label><Select value={form.sales_channel || 'none'} onValueChange={v => setForm(f => ({ ...f, sales_channel: v === 'none' ? '' : v }))}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Não se aplica</SelectItem>{SALES_CHANNELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label className="text-xs">Conta do canal</Label><Input className="h-11" value={form.marketplace_account} onChange={e => setForm(f => ({ ...f, marketplace_account: e.target.value }))} placeholder="Ex.: Shopee Viviane" /></div></div>

            <div className="space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className="p-3 border-t bg-background flex gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button variant="outline" className="flex-1 h-12" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1 h-12 font-semibold" onClick={submitForm}>
              {editing ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Payment dialog */}
      {paymentEntry && (
        <PaymentDialog
          open={!!paymentEntry}
          onOpenChange={(o) => !o && setPaymentEntry(null)}
          entry={paymentEntry}
          accounts={accounts}
          onConfirm={async (value, accountId, notes, paymentDate) => {
            await onRegisterPayment(paymentEntry.id, value, accountId, notes, paymentDate);
            setPaymentEntry(null);
          }}
        />
      )}
    </div>
  );
}

// ============ Sub-components ============

function NavBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors active:scale-95',
        active ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: 'positive' | 'negative' | 'muted' }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn(
        'text-base font-bold tabular-nums leading-tight mt-0.5',
        tone === 'positive' && 'text-emerald-600 dark:text-emerald-400',
        tone === 'negative' && 'text-rose-600 dark:text-rose-400',
      )}>
        {formatCurrency(value)}
      </div>
    </Card>
  );
}

function ResumoView({ totals, cash }: { totals: any; cash: ReturnType<typeof useRealizedCash>; onOpenDashboard: () => void }) {
  return (
    <div className="p-3 space-y-3">
      {/* Saldo hero */}
      <Card className={cn(
        'p-4 border-l-4',
        totals.resultado >= 0 ? 'border-l-emerald-500' : 'border-l-rose-500',
      )}>
        <div className="text-xs text-muted-foreground uppercase tracking-wide">Resultado das obrigações do período</div>
        <div className={cn(
          'text-3xl font-bold tabular-nums mt-1',
          totals.resultado >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
        )}>
          {formatCurrency(totals.resultado)}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          Caixa realizado (data do movimento): <span className="font-medium text-foreground">{cash.report ? formatCurrency(cash.report.net) : cash.loading ? 'Consultando…' : 'Indisponível'}</span>
          {cash.error && <p role="alert">{cash.error}</p>}
        </div>
      </Card>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium uppercase">Entradas</span>
          </div>
          <div className="text-lg font-bold tabular-nums mt-1">{formatCurrency(totals.entradas)}</div>
          <div className="text-[10px] text-muted-foreground">Recebido no caixa: {cash.report ? formatCurrency(cash.report.incoming) : '—'}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
            <TrendingDown className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium uppercase">Saídas</span>
          </div>
          <div className="text-lg font-bold tabular-nums mt-1">{formatCurrency(totals.saidas)}</div>
          <div className="text-[10px] text-muted-foreground">Pago no caixa: {cash.report ? formatCurrency(cash.report.outgoing) : '—'}</div>
        </Card>
      </div>
    </div>
  );
}

function MaisView({ onOpen }: { onOpen: (s: SubSection) => void }) {
  const items: { id: SubSection; icon: React.ReactNode; label: string; hint: string }[] = [
    { id: 'notas', icon: <FileText className="h-5 w-5" />, label: 'Notas Fiscais', hint: 'Emitir, validar e baixar' },
    { id: 'contas', icon: <Wallet className="h-5 w-5" />, label: 'Caixas e Bancos', hint: 'Saldos por conta' },
    { id: 'contatos', icon: <Users className="h-5 w-5" />, label: 'Clientes e Fornecedores', hint: 'Cadastro e histórico' },
    { id: 'categorias', icon: <Tag className="h-5 w-5" />, label: 'Categorias', hint: 'Plano de contas' },
  ];
  return (
    <div className="p-3 space-y-2">
      {items.map(i => (
        <button
          key={i.id}
          onClick={() => onOpen(i.id)}
          className="w-full flex items-center gap-3 p-4 rounded-lg bg-card border active:bg-muted/60 transition-colors text-left"
        >
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {i.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{i.label}</div>
            <div className="text-xs text-muted-foreground">{i.hint}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

function EntryCard({
  entry, onEdit, onDelete, onPay,
}: {
  entry: FinancialEntry;
  onEdit: () => void;
  onDelete: () => void;
  onPay: () => void;
}) {
  const status = getEntryStatus(entry);
  const isReceber = entry.type === 'receber';
  const remaining = entry.value - entry.value_paid;
  return (
    <Card className={cn(
      'p-3 border-l-4 active:bg-muted/30 transition-colors',
      isReceber ? 'border-l-emerald-500' : 'border-l-rose-500',
    )}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0" onClick={onEdit}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <Badge className={cn('text-[9px] py-0 h-4 px-1.5', STATUS_COLORS[status])}>
              {STATUS_LABELS[status]}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              Vence {format(parseISO(entry.due_date), 'dd/MM', { locale: ptBR })}
            </span>
          </div>
          <div className="text-sm font-semibold truncate">{entry.description || 'Sem descrição'}</div>
          {entry.contact?.name && (
            <div className="text-xs text-muted-foreground truncate">{entry.contact.name}</div>
          )}
          {(entry.sales_channel || entry.marketplace_account) && <div className="text-[11px] text-muted-foreground">{salesChannelLabel(entry.sales_channel)}{entry.marketplace_account ? ` · ${entry.marketplace_account}` : ''}</div>}
          <div className={cn(
            'text-lg font-bold tabular-nums mt-1',
            isReceber ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
          )}>
            {isReceber ? '+' : '−'} {formatCurrency(entry.value)}
          </div>
          {entry.value_paid > 0 && status !== 'pago' && (
            <div className="text-[10px] text-muted-foreground">
              Pago {formatCurrency(entry.value_paid)} • Resta {formatCurrency(remaining)}
            </div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-popover z-50">
            {status !== 'pago' && (
              <DropdownMenuItem onClick={onPay}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Registrar pagamento
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => { if (confirm('Excluir este lançamento?')) onDelete(); }}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
