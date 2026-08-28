import { useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, MessageCircle, Phone, CalendarClock, FileText, Ban, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { ContactAvatar } from '@/components/crm/ContactAvatar';
import { ContactTimeline } from '@/components/crm/ContactTimeline';
import { ContactTasksPanel } from '@/components/crm/ContactTasksPanel';
import { ContactChatPanel } from '@/components/crm/ContactChatPanel';
import { LeadOriginPicker } from '@/components/crm/LeadOriginPicker';
import { NextBestAction } from '@/components/crm/NextBestAction';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Contact } from '@/hooks/useContacts';
import { getCrmStageLabel } from '@/lib/crm/model';
import { Button } from '@/components/ui/button';

interface LeadDetailDrawerProps {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<Contact>) => Promise<any>;
  onOpenFull?: () => void;
}

type FormState = {
  name: string;
  phone: string;
  whatsapp: string;
  city: string;
  company_name: string;
  origem_lead: string;
  valor_estimado: string;
  salesperson: string;
  notes: string;
};

const toForm = (c: Contact): FormState => ({
  name: c.name || '',
  phone: c.phone || '',
  whatsapp: c.whatsapp || '',
  city: c.city || '',
  company_name: c.company_name || '',
  origem_lead: c.origem_lead || '',
  valor_estimado: c.valor_estimado != null ? String(c.valor_estimado) : '',
  salesperson: c.salesperson || '',
  notes: c.notes || '',
});

const formatDate = (s?: string) => {
  if (!s) return '—';
  try { return format(parseISO(s), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); } catch { return s; }
};

const formatDateShort = (s?: string) => {
  if (!s) return '—';
  try { return format(parseISO(s), 'dd/MM/yyyy', { locale: ptBR }); } catch { return s; }
};

export function LeadDetailDrawer({ contact, open, onOpenChange, onSave, onOpenFull }: LeadDetailDrawerProps) {
  const [form, setForm] = useState<FormState>(() => contact ? toForm(contact) : toForm({} as Contact));
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  const debounceRef = useRef<Record<string, any>>({});
  const baselineRef = useRef<FormState | null>(null);

  useEffect(() => {
    if (contact) {
      const next = toForm(contact);
      setForm(next);
      baselineRef.current = next;
    }
  }, [contact?.id]);

  if (!contact) return null;

  const commit = async (field: keyof FormState, value: string) => {
    if (!contact) return;
    if (baselineRef.current && baselineRef.current[field] === value) return;
    setSavingField(field);
    const updates: Partial<Contact> = {};
    if (field === 'valor_estimado') {
      const num = value === '' ? undefined : Number(value.replace(',', '.'));
      (updates as any).valor_estimado = Number.isFinite(num) ? num : undefined;
    } else {
      (updates as any)[field] = value;
    }
    try {
      await onSave(contact.id, updates);
      if (baselineRef.current) baselineRef.current = { ...baselineRef.current, [field]: value };
      setSavedField(field);
      setTimeout(() => setSavedField((f) => (f === field ? null : f)), 1200);
    } finally {
      setSavingField((f) => (f === field ? null : f));
    }
  };

  const handleChange = (field: keyof FormState, value: string, debounceMs = 700) => {
    setForm((s) => ({ ...s, [field]: value }));
    if (debounceRef.current[field]) clearTimeout(debounceRef.current[field]);
    debounceRef.current[field] = setTimeout(() => commit(field, value), debounceMs);
  };

  const handleBlur = (field: keyof FormState) => {
    if (debounceRef.current[field]) {
      clearTimeout(debounceRef.current[field]);
      delete debounceRef.current[field];
    }
    commit(field, form[field]);
  };

  const setCommercialOptOut = async (value: boolean) => {
    setSavingField('commercial_opt_out');
    try {
      await onSave(contact.id, { commercial_opt_out: value });
      contact.commercial_opt_out = value;
      toast.success(value ? 'Contato marcado como Não deseja contato' : 'Opt-out comercial removido');
    } finally {
      setSavingField(null);
    }
  };

  const FieldStatus = ({ field }: { field: keyof FormState }) => {
    if (savingField === field) return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
    if (savedField === field) return <Check className="h-3 w-3 text-emerald-600" />;
    return null;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-background border-b">
          <SheetHeader className="p-4">
            <div className="flex items-start gap-3">
              <ContactAvatar photoUrl={contact.photo_url} name={contact.name} size="md" />
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-left text-base truncate">{form.name || 'Lead'}</SheetTitle>
                <SheetDescription className="text-left text-xs">
                  Edição rápida • salvamento automático
                </SheetDescription>
                <div className="flex flex-wrap gap-1 mt-2">
                  {contact.funnel_status && <Badge variant="secondary" className="text-[10px]">{getCrmStageLabel(contact.funnel_status)}</Badge>}
                  {contact.temperatura_lead && <Badge variant="outline" className="text-[10px] capitalize">{contact.temperatura_lead}</Badge>}
                  {contact.client_classification && <Badge variant="outline" className="text-[10px] capitalize">{contact.client_classification}</Badge>}
                  {contact.commercial_opt_out && <Badge variant="destructive" className="text-[10px] gap-1"><Ban className="h-3 w-3" /> Não deseja contato</Badge>}
                </div>
              </div>
            </div>
          </SheetHeader>
        </div>

        <Tabs defaultValue="detalhes" className="w-full">
          <div className="px-4 pt-3">
            <TabsList className="grid w-full grid-cols-4 h-9">
              <TabsTrigger value="detalhes" className="text-xs">Detalhes</TabsTrigger>
              <TabsTrigger value="tarefas" className="text-xs">Tarefas</TabsTrigger>
              <TabsTrigger value="atendimento" className="text-xs">Atendimento</TabsTrigger>
              <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="detalhes" className="p-4 space-y-4 mt-0">
            <NextBestAction contact={contact} />

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <CalendarClock className="h-4 w-4" /> Próxima ação
              </div>
              <p className="mt-1 text-sm font-medium">{contact.next_action_text || 'Nenhuma ação definida'}</p>
              <p className="text-xs text-muted-foreground">{formatDate(contact.next_action_date || contact.next_contact_date)}</p>
            </div>

            <div className={contact.commercial_opt_out ? 'rounded-lg border border-destructive/30 bg-destructive/5 p-3' : 'rounded-lg border p-3'}>
              <p className="text-xs font-semibold">Opt-out comercial</p>
              <p className="mt-1 text-xs text-muted-foreground">{contact.commercial_opt_out ? 'Não receberá reativações ou campanhas comerciais até a reversão manual.' : 'Pode receber contatos comerciais.'}</p>
              <Button size="sm" variant={contact.commercial_opt_out ? 'outline' : 'secondary'} className="mt-2 h-7 text-xs" disabled={savingField === 'commercial_opt_out'} onClick={() => setCommercialOptOut(!contact.commercial_opt_out)}>
                {contact.commercial_opt_out ? <><Undo2 className="mr-1 h-3 w-3" /> Remover opt-out</> : 'Marcar como não deseja contato'}
              </Button>
            </div>

            <Field label="Nome" status={<FieldStatus field="name" />}>
              <Input value={form.name} onChange={(e) => handleChange('name', e.target.value)} onBlur={() => handleBlur('name')} placeholder="Nome do lead" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefone" status={<FieldStatus field="phone" />} icon={<Phone className="h-3 w-3" />}>
                <Input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} onBlur={() => handleBlur('phone')} placeholder="(00) 0000-0000" />
              </Field>
              <Field label="WhatsApp" status={<FieldStatus field="whatsapp" />} icon={<MessageCircle className="h-3 w-3" />}>
                <Input value={form.whatsapp} onChange={(e) => handleChange('whatsapp', e.target.value)} onBlur={() => handleBlur('whatsapp')} placeholder="(00) 90000-0000" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Cidade" status={<FieldStatus field="city" />}>
                <Input value={form.city} onChange={(e) => handleChange('city', e.target.value)} onBlur={() => handleBlur('city')} placeholder="Cidade" />
              </Field>
              <Field label="Empresa" status={<FieldStatus field="company_name" />}>
                <Input value={form.company_name} onChange={(e) => handleChange('company_name', e.target.value)} onBlur={() => handleBlur('company_name')} placeholder="Empresa" />
              </Field>
            </div>

            <Field label="Origem do Lead (interno)" status={<FieldStatus field="origem_lead" />}>
              <LeadOriginPicker
                value={form.origem_lead}
                onChange={(v) => handleChange('origem_lead', v, 300)}
                onBlur={() => handleBlur('origem_lead')}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Rastreado internamente. Não aparece nos cards do funil.
              </p>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor potencial (R$)" status={<FieldStatus field="valor_estimado" />}>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.valor_estimado}
                  onChange={(e) => handleChange('valor_estimado', e.target.value)}
                  onBlur={() => handleBlur('valor_estimado')}
                  placeholder="0,00"
                />
              </Field>
              <Field label="Responsável" status={<FieldStatus field="salesperson" />}>
                <Input value={form.salesperson} onChange={(e) => handleChange('salesperson', e.target.value)} onBlur={() => handleBlur('salesperson')} placeholder="Nome" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <ReadOnly label="Criado em" value={formatDate(contact.created_at)} />
              <ReadOnly label="Último contato" value={formatDateShort(contact.ultimo_contato)} />
            </div>

            <Field label="Observações" status={<FieldStatus field="notes" />}>
              <Textarea
                value={form.notes}
                onChange={(e) => handleChange('notes', e.target.value, 1000)}
                onBlur={() => handleBlur('notes')}
                placeholder="Notas internas sobre o lead..."
                rows={5}
              />
            </Field>

            <p className="text-[10px] text-muted-foreground text-center pt-2">
              As alterações são salvas automaticamente.
            </p>

            {onOpenFull && (
              <Button variant="outline" className="w-full gap-2" onClick={onOpenFull}>
                <FileText className="h-4 w-4" /> Abrir cadastro completo
              </Button>
            )}
          </TabsContent>

          <TabsContent value="tarefas" className="p-4 mt-0">
            <ContactTasksPanel contactId={contact.id} commercialOptOut={Boolean(contact.commercial_opt_out)} />
          </TabsContent>

          <TabsContent value="atendimento" className="p-4 mt-0">
            <ContactChatPanel
              contactId={contact.id}
              contactName={contact.name}
              contactHandle={contact.whatsapp || contact.phone || contact.mobile || contact.email}
              contactAvatar={contact.photo_url}
              funnelStage={contact.funnel_status}
            />
          </TabsContent>


          <TabsContent value="historico" className="p-4 mt-0">
            <ContactTimeline contactId={contact.id} createdAt={contact.created_at} searchable />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children, status, icon }: { label: string; children: React.ReactNode; status?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        {icon}
        <span>{label}</span>
        <span className="ml-auto">{status}</span>
      </Label>
      {children}
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="h-9 px-3 flex items-center text-sm rounded-md border bg-muted/30 text-foreground/80">{value}</div>
    </div>
  );
}
