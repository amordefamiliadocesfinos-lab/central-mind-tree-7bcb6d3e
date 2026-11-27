import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty } from '@/components/ui/command';
import { FinancialEntry, FinancialCategory, FinancialAccount } from '@/hooks/useFinancial';
import { format, parseISO, addMonths, addWeeks, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, CalendarIcon, CreditCard, RefreshCw, Paperclip, Info, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FinancialEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: FinancialEntry;
  type: 'pagar' | 'receber';
  categories: FinancialCategory[];
  accounts: FinancialAccount[];
  onSave: (data: any) => Promise<void>;
}

const RECURRENCE_TYPES = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

export function FinancialEntryForm({
  open,
  onOpenChange,
  entry,
  type,
  categories,
  accounts,
  onSave,
}: FinancialEntryFormProps) {
  const purchaseProtected = Boolean(entry?.purchase_order_id);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pagamento');
  const [contact, setContact] = useState<{ id: string; name: string } | undefined>(undefined);
  const [form, setForm] = useState({
    description: '',
    value: '',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    issue_date: format(new Date(), 'yyyy-MM-dd'),
    competence_date: format(new Date(), 'yyyy-MM-dd'),
    category_id: '',
    account_id: '',
    document_number: '',
    notes: '',
    // Recurrence fields
    recurrence_type: '',
    recurrence_day: '',
    recurrence_end_date: '',
    recurrence_use_business_days: false,
  });

  useEffect(() => {
    if (entry) {
      setForm({
        description: entry.description,
        value: entry.value.toString(),
        due_date: entry.due_date,
        issue_date: (entry as any).issue_date || format(new Date(), 'yyyy-MM-dd'),
        competence_date: (entry as any).competence_date || format(new Date(), 'yyyy-MM-dd'),
        category_id: entry.category_id || '',
        account_id: entry.account_id || '',
        document_number: entry.document_number || '',
        notes: entry.notes || '',
        recurrence_type: (entry as any).recurrence_type || '',
        recurrence_day: (entry as any).recurrence_day?.toString() || '',
        recurrence_end_date: (entry as any).recurrence_end_date || '',
        recurrence_use_business_days: (entry as any).recurrence_use_business_days || false,
      });
      // Preload linked contact — fetch by id when the embedded relation is missing
      if (entry.contact && entry.contact.id) {
        setContact({ id: entry.contact.id, name: entry.contact.name });
      } else if (entry.contact_id) {
        supabase
          .from('contacts')
          .select('id, name')
          .eq('id', entry.contact_id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setContact({ id: data.id, name: data.name });
          });
      } else {
        setContact(undefined);
      }
    } else {
      setForm({
        description: '',
        value: '',
        due_date: format(new Date(), 'yyyy-MM-dd'),
        issue_date: format(new Date(), 'yyyy-MM-dd'),
        competence_date: format(new Date(), 'yyyy-MM-dd'),
        category_id: '',
        account_id: '',
        document_number: '',
        notes: '',
        recurrence_type: '',
        recurrence_day: '',
        recurrence_end_date: '',
        recurrence_use_business_days: false,
      });
      setContact(undefined);
      setActiveTab('pagamento');
    }
  }, [entry, open]);

  // Auto-set recurrence day when due_date changes
  useEffect(() => {
    if (form.due_date && !form.recurrence_day) {
      const date = parseISO(form.due_date);
      setForm(prev => ({ ...prev, recurrence_day: date.getDate().toString() }));
    }
  }, [form.due_date]);

  const handleSubmit = async (e: React.FormEvent, saveAndPay = false) => {
    e.preventDefault();
    if (!form.description || !form.value) return;
    if (form.recurrence_type && !form.recurrence_end_date) {
      setActiveTab('ocorrencia');
      toast.error('Informe a data final para gerar a recorrência.');
      return;
    }

    setLoading(true);
    try {
      await onSave({
        type,
        description: form.description,
        value: parseFloat(form.value),
        due_date: form.due_date,
        issue_date: form.issue_date || null,
        competence_date: form.competence_date || null,
        category_id: form.category_id || null,
        account_id: form.account_id || null,
        contact_id: contact?.id || null,
        document_number: form.document_number || null,
        notes: form.notes || null,
        recurrence_type: form.recurrence_type || null,
        recurrence_day: form.recurrence_day ? parseInt(form.recurrence_day) : null,
        recurrence_end_date: form.recurrence_end_date || null,
        recurrence_use_business_days: form.recurrence_use_business_days,
        saveAndPay,
      });
      onOpenChange(false);
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Não foi possível salvar o lançamento.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(c => c.type === type || c.type === 'ambos');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entry ? 'Editar' : 'Nova'} {type === 'pagar' ? 'Conta a Pagar' : 'Conta a Receber'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
          {purchaseProtected && <p role="note" className="rounded-md border p-3 text-sm text-muted-foreground">Compra vinculada: valor e vencimento são protegidos. Para corrigir a compra, use a regularização em Compras quando permitida. Se já houve pagamento, não altere a obrigação para ajustar o movimento; confira o comprovante e solicite a retificação financeira.</p>}
          {/* Main fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label>{type === 'pagar' ? 'Fornecedor' : 'Cliente'} / Descrição *</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={type === 'pagar' ? 'Nome do fornecedor' : 'Nome do cliente'}
                required
              />
            </div>
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                readOnly={purchaseProtected}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          {/* Contato (Cliente/Fornecedor) */}
          <div className="space-y-2">
            <Label>{type === 'pagar' ? 'Fornecedor' : 'Cliente'} vinculado</Label>
            <ContactPicker value={contact} onChange={setContact} type={type} />
          </div>

          {/* Date fields */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Emissão *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.issue_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.issue_date ? format(parseISO(form.issue_date), "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.issue_date ? parseISO(form.issue_date) : undefined}
                    onSelect={(date) => setForm({ ...form, issue_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Competência *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.competence_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.competence_date ? format(parseISO(form.competence_date), "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.competence_date ? parseISO(form.competence_date) : undefined}
                    onSelect={(date) => setForm({ ...form, competence_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Vencimento *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.due_date && "text-muted-foreground"
                    )}
                    disabled={purchaseProtected}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.due_date ? format(parseISO(form.due_date), "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.due_date ? parseISO(form.due_date) : undefined}
                    onSelect={(date) => { if (!purchaseProtected) setForm({ ...form, due_date: date ? format(date, 'yyyy-MM-dd') : '' }); }}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Histórico / Notes */}
          <div className="space-y-2">
            <Label>Histórico</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Descrição do lançamento..."
              rows={2}
            />
          </div>

          {/* Tabs: Pagamento, Recorrência, Anexos */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pagamento" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Pagamento
              </TabsTrigger>
              <TabsTrigger value="ocorrencia" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Recorrência
              </TabsTrigger>
              <TabsTrigger value="anexos" className="gap-2">
                <Paperclip className="h-4 w-4" />
                Anexos
              </TabsTrigger>
            </TabsList>

            {/* Pagamento Tab */}
            <TabsContent value="pagamento" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conta</Label>
                  <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nº Documento</Label>
                <Input
                  value={form.document_number}
                  onChange={(e) => setForm({ ...form, document_number: e.target.value })}
                  placeholder="NF, boleto, etc"
                />
              </div>
            </TabsContent>

            {/* Recorrência Tab */}
            <TabsContent value="ocorrencia" className="space-y-4 mt-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Tipo de Recorrência</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Configure a recorrência para gerar lançamentos automaticamente</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select 
                  value={form.recurrence_type || 'none'} 
                  onValueChange={(v) => setForm({ ...form, recurrence_type: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar tipo de recorrência..." />
                  </SelectTrigger>
                  <SelectContent className="pointer-events-auto">
                    <SelectItem value="none">Sem recorrência</SelectItem>
                    {RECURRENCE_TYPES.map((rec) => (
                      <SelectItem key={rec.value} value={rec.value}>
                        {rec.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.recurrence_type && form.recurrence_type !== 'none' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label>Dia de vencimento *</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Dia do mês em que o lançamento vence</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={form.recurrence_day}
                        onChange={(e) => setForm({ ...form, recurrence_day: e.target.value })}
                        placeholder="Ex: 10"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label>Data limite</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Data final para geração de parcelas</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !form.recurrence_end_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {form.recurrence_end_date 
                              ? format(parseISO(form.recurrence_end_date), "dd/MM/yyyy", { locale: ptBR }) 
                              : "Selecionar"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                          <Calendar
                            mode="single"
                            selected={form.recurrence_end_date ? parseISO(form.recurrence_end_date) : undefined}
                            onSelect={(date) => setForm({ ...form, recurrence_end_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                            locale={ptBR}
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="business-days" className="cursor-pointer">Considerar dias úteis</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Ajusta o vencimento para o próximo dia útil quando cair em fim de semana ou feriado</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Switch
                      id="business-days"
                      checked={form.recurrence_use_business_days}
                      onCheckedChange={(checked) => setForm({ ...form, recurrence_use_business_days: checked })}
                    />
                  </div>

                  {/* Summary info */}
                  {entry && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <div className="grid grid-cols-5 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Venc. original</span>
                          <p className="font-medium text-primary">
                            {(entry as any).original_due_date 
                              ? format(parseISO((entry as any).original_due_date), 'dd/MM/yyyy')
                              : format(parseISO(entry.due_date), 'dd/MM/yyyy')}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Valor original</span>
                          <p className="font-medium">{formatCurrency(entry.value)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Juros</span>
                          <p className="font-medium">R$ 0,00</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Multa</span>
                          <p className="font-medium">R$ 0,00</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Valor total</span>
                          <p className="font-medium">{formatCurrency(entry.value)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {(!form.recurrence_type || form.recurrence_type === 'none') && (
                <div className="text-center py-6 text-muted-foreground">
                  <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    Selecione um tipo de recorrência acima para configurar lançamentos automáticos
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Anexos Tab */}
            <TabsContent value="anexos" className="space-y-4 mt-4">
              <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                <Paperclip className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Arraste arquivos aqui ou clique para selecionar
                </p>
                <Button variant="outline" size="sm" className="mt-2" type="button">
                  Selecionar arquivo
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="button" 
              variant="secondary"
              onClick={(e) => handleSubmit(e as any, true)}
              disabled={loading || Boolean(entry && Number(entry.value_paid) >= Number(entry.value))}
            >
              Salvar e dar baixa
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContactPicker({
  value,
  onChange,
  type,
}: {
  value?: { id: string; name: string };
  onChange: (v?: { id: string; name: string }) => void;
  type: 'pagar' | 'receber';
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<{ id: string; name: string; type?: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      let q = supabase
        .from('contacts')
        .select('id, name, type')
        .eq('is_active', true)
        .order('name')
        .limit(20);
      if (search.trim().length >= 2) {
        q = q.or(
          `name.ilike.%${search}%,fantasy_name.ilike.%${search}%,document.ilike.%${search}%`
        );
      }
      const { data } = await q;
      setResults((data as any) || []);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [search, open]);

  const placeholder = type === 'pagar' ? 'Selecionar fornecedor...' : 'Selecionar cliente...';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start font-normal"
        >
          {value ? (
            <span className="flex items-center gap-2 min-w-0">
              <User className="h-4 w-4 shrink-0" />
              <span className="truncate">{value.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" /> {placeholder}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nome, fantasia ou documento..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground text-center">Buscando...</div>
            ) : (
              <>
                {value && (
                  <CommandGroup>
                    <CommandItem
                      value="__clear__"
                      onSelect={() => {
                        onChange(undefined);
                        setOpen(false);
                      }}
                    >
                      <X className="h-3 w-3 mr-2" /> Remover vínculo
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup>
                  {results.length === 0 ? (
                    <CommandEmpty>Nenhum contato encontrado</CommandEmpty>
                  ) : (
                    results.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.id}
                        onSelect={() => {
                          onChange({ id: c.id, name: c.name });
                          setOpen(false);
                        }}
                      >
                        <User className="h-3 w-3 mr-2" />
                        <span className="truncate">{c.name}</span>
                        {c.type && (
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {c.type}
                          </span>
                        )}
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
