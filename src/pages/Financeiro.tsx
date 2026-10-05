import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MobileHeader } from '@/components/ui/mobile-header';
import { 
  FinancialDashboard, 
  FinancialEntriesList, 
  AccountsManager,
  CategoriesManager,
  ContactsManager,
  PricingManagerV2,
  ShopeeEconomicMotor,
  InvoicesManager,
  StatementImporter,
} from '@/components/financial';
import { MobileFinancialView } from '@/components/financial/MobileFinancialView';
import { useFinancial, EntryStatus } from '@/hooks/useFinancial';
import { Users, DollarSign, FileText, Upload } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Calculator, LayoutDashboard, TrendingDown, TrendingUp, Wallet, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SALES_CHANNELS } from '@/lib/salesChannels';
import { UncategorizedReviewDialog } from '@/components/financial/UncategorizedReviewDialog';
import { FinancialIntegrityDialog } from '@/components/financial/FinancialIntegrityDialog';
import { MarketplaceSettlementDialog } from '@/components/financial/MarketplaceSettlementDialog';
import { useIsMobile } from '@/hooks/use-mobile';
export default function Financeiro() {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [importerOpen, setImporterOpen] = useState(false);
  const [reviewImportedOpen, setReviewImportedOpen] = useState(false);
  const [integrityOpen, setIntegrityOpen] = useState(false);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [pagarStatus, setPagarStatus] = useState<EntryStatus | 'all'>('all');
  const [receberStatus, setReceberStatus] = useState<EntryStatus | 'all'>('all');
  const [pagarSearch, setPagarSearch] = useState('');
  const [receberSearch, setReceberSearch] = useState('');
  
  const {
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
    conciliateEntry,
    exportToCSV,
    saveAccount,
    saveCategory,
    getDashboardSummary,
  } = useFinancial();


  const handleDateRangeChange = (start: Date | undefined, end: Date | undefined) => {
    const newFilters = {
      ...filters,
      startDate: start || startOfMonth(new Date()),
      endDate: end || endOfMonth(new Date()),
    };
    setFilters(newFilters);
    fetchEntries(newFilters);
  };

  const applyGlobalFilter = (updates: Partial<typeof filters>) => {
    const next = { ...filters, ...updates };
    setFilters(next); fetchEntries(next);
  };
  const channelAccounts = Array.from(new Set(entries.map(e => e.marketplace_account).filter(Boolean))) as string[];

  if (isMobile) {
    return (
      <MobileFinancialView
        entries={entries}
        categories={categories}
        accounts={accounts}
        loading={loading}
        filters={filters}
        onPeriodChange={handleDateRangeChange}
        onCreateEntry={createEntry}
        onUpdateEntry={updateEntry}
        onDeleteEntry={deleteEntry}
        onRegisterPayment={registerPayment}
        onSaveAccount={saveAccount}
        onSaveCategory={saveCategory}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title="Financeiro" showBack />

      <div className="container mx-auto p-4 space-y-4">
        {/* Period selector */}
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.startDate && filters.endDate ? (
                  <>
                    {format(filters.startDate, "dd/MM/yyyy", { locale: ptBR })} -{' '}
                    {format(filters.endDate, "dd/MM/yyyy", { locale: ptBR })}
                  </>
                ) : (
                  <span>Selecionar período</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{
                  from: filters.startDate,
                  to: filters.endDate,
                }}
                onSelect={(range) => {
                  handleDateRangeChange(range?.from, range?.to);
                }}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const start = startOfMonth(new Date());
              const end = endOfMonth(new Date());
              handleDateRangeChange(start, end);
            }}
          >
            Este mês
          </Button>
          <Select value={filters.dateBasis || 'due_date'} onValueChange={v => applyGlobalFilter({ dateBasis: v as any })}><SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="due_date">Por vencimento</SelectItem><SelectItem value="competence_date">Por competência</SelectItem><SelectItem value="payment_date">Por caixa realizado</SelectItem></SelectContent></Select>
          <Select value={filters.salesChannel || 'all'} onValueChange={v => applyGlobalFilter({ salesChannel: v === 'all' ? undefined : v, marketplaceAccount: undefined })}><SelectTrigger className="w-[190px]"><SelectValue placeholder="Todos os canais" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os canais</SelectItem>{SALES_CHANNELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select>
          <Select value={filters.marketplaceAccount || 'all'} onValueChange={v => applyGlobalFilter({ marketplaceAccount: v === 'all' ? undefined : v })}><SelectTrigger className="w-[190px]"><SelectValue placeholder="Todas as lojas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as contas do canal</SelectItem>{channelAccounts.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select>

          <Button variant="outline" size="sm" onClick={() => setIntegrityOpen(true)} className="ml-auto">Revisar integrações</Button>
          <Button variant="outline" size="sm" onClick={() => setSettlementOpen(true)}>Conciliar repasse</Button>
          <Button variant="outline" size="sm" onClick={() => setReviewImportedOpen(true)}>Revisar importados</Button>
          <Button variant="outline" size="sm" onClick={() => setImporterOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" /> Importar Extrato
          </Button>
        </div>

        <StatementImporter
          open={importerOpen}
          onOpenChange={setImporterOpen}
          accounts={accounts}
          categories={categories}
          onImported={() => fetchEntries()}
        />
        <UncategorizedReviewDialog open={reviewImportedOpen} onOpenChange={setReviewImportedOpen} categories={categories} onChanged={() => fetchEntries()} />
        <FinancialIntegrityDialog open={integrityOpen} onOpenChange={setIntegrityOpen} onChanged={() => fetchEntries()} />
        <MarketplaceSettlementDialog open={settlementOpen} onOpenChange={setSettlementOpen} onChanged={() => fetchEntries()} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className={cn("grid w-full", isMobile ? "grid-cols-3" : "grid-cols-9")}>
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              {!isMobile && "Dashboard"}
            </TabsTrigger>
            <TabsTrigger value="receber" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              {!isMobile && "A Receber"}
            </TabsTrigger>
            <TabsTrigger value="pagar" className="gap-2">
              <TrendingDown className="h-4 w-4" />
              {!isMobile && "A Pagar"}
            </TabsTrigger>
            {!isMobile && (
              <>
                <TabsTrigger value="notas" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Nota Fiscal
                </TabsTrigger>
                <TabsTrigger value="contas" className="gap-2">
                  <Wallet className="h-4 w-4" />
                  Caixas/Bancos
                </TabsTrigger>
                <TabsTrigger value="contatos" className="gap-2">
                  <Users className="h-4 w-4" />
                  Clientes/Forn.
                </TabsTrigger>
                <TabsTrigger value="categorias" className="gap-2">
                  <Tag className="h-4 w-4" />
                  Categorias
                </TabsTrigger>
                <TabsTrigger value="valores" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  Valores
                </TabsTrigger>
                <TabsTrigger value="motor-shopee" className="gap-2">
                  <Calculator className="h-4 w-4" />
                  Motor Shopee
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {isMobile && (
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="notas" className="gap-2">
                <FileText className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="contas" className="gap-2">
                <Wallet className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="categorias" className="gap-2">
                <Tag className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="valores" className="gap-2">
                <DollarSign className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="dashboard">
            <FinancialDashboard entries={entries} accounts={accounts} summary={getDashboardSummary()} filters={filters} />
          </TabsContent>


          <TabsContent value="receber">
            <FinancialEntriesList
              entries={entries}
              type="receber"
              categories={categories}
              accounts={accounts}
              loading={loading}
              onCreateEntry={createEntry}
              onUpdateEntry={updateEntry}
              onDeleteEntry={deleteEntry}
              onRegisterPayment={registerPayment}
              onConciliate={conciliateEntry}
              onExport={() => exportToCSV('receber')}
              statusFilter={receberStatus}
              onStatusFilterChange={setReceberStatus}
              searchQuery={receberSearch}
              onSearchChange={setReceberSearch}
            />
          </TabsContent>

          <TabsContent value="pagar">
            <FinancialEntriesList
              entries={entries}
              type="pagar"
              categories={categories}
              accounts={accounts}
              loading={loading}
              onCreateEntry={createEntry}
              onUpdateEntry={updateEntry}
              onDeleteEntry={deleteEntry}
              onRegisterPayment={registerPayment}
              onConciliate={conciliateEntry}
              onExport={() => exportToCSV('pagar')}
              statusFilter={pagarStatus}
              onStatusFilterChange={setPagarStatus}
              searchQuery={pagarSearch}
              onSearchChange={setPagarSearch}
            />
          </TabsContent>

          <TabsContent value="contas">
            <AccountsManager 
              accounts={accounts} 
              onSave={saveAccount} 
              startDate={filters.startDate}
              endDate={filters.endDate}
              onPeriodChange={handleDateRangeChange}
            />
          </TabsContent>

          <TabsContent value="contatos">
            <ContactsManager />
          </TabsContent>

          <TabsContent value="categorias">
            <CategoriesManager categories={categories} onSave={saveCategory} />
          </TabsContent>

          <TabsContent value="valores">
            <PricingManagerV2 />
          </TabsContent>

          <TabsContent value="motor-shopee">
            <ShopeeEconomicMotor />
          </TabsContent>

          <TabsContent value="notas">
            <InvoicesManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
