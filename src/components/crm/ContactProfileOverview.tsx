/** CRM–UX 02 B-02: ficha integral em consulta, antes da ativação da edição. */
import type { Contact } from '@/hooks/useContacts';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { usePlatforms } from '@/hooks/usePlatforms';
import { PlatformHierarchicalPicker } from '@/components/digital/PlatformHierarchicalPicker';
import { PROFILE_EDITABLE_KEYS } from '@/lib/crm/contactEditContract';
import { saveContactProfile } from '@/lib/crm/contactProfileWriter';
import { toast } from 'sonner';

import { ContactAvatar } from './ContactAvatar';
import { ContactOrdersList } from './ContactOrdersList';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

type Field = readonly [keyof Contact, string];
type Section = { key: string; title: string; fields: readonly Field[]; orders?: boolean };

const SECTIONS: readonly Section[] = [
  { key: 'principal', title: 'Dados principais', fields: [
    ['name', 'Nome'], ['fantasy_name', 'Nome fantasia'], ['company_name', 'Empresa'],
    ['type', 'Cliente / fornecedor'], ['contact_type', 'Tipo de contato'],
    ['client_classification', 'Classificação'], ['whatsapp', 'WhatsApp'],
    ['phone', 'Telefone'], ['city', 'Cidade'], ['notes', 'Observações cadastrais'],
  ] },
  { key: 'fiscal', title: 'Dados cadastrais e fiscais', fields: [
    ['code', 'Código interno'], ['person_type', 'Pessoa física / jurídica'],
    ['document', 'CPF / CNPJ'], ['rg', 'RG'], ['issuing_agency', 'Órgão emissor'],
    ['taxpayer_type', 'Contribuinte'], ['state_registration', 'Inscrição estadual'],
    ['customer_since', 'Cliente desde'], ['default_operation_nature', 'Natureza de operação'],
  ] },
  { key: 'contato', title: 'Meios de contato', fields: [
    ['whatsapp', 'WhatsApp'], ['phone', 'Telefone'], ['mobile', 'Celular'],
    ['landline', 'Telefone fixo'], ['fax', 'Fax'], ['email', 'E-mail'],
    ['nfe_email', 'E-mail NFe'], ['website', 'Website'], ['skype', 'Skype'],
    ['mobile_carrier', 'Operadora'], ['contact_info', 'Informações de contato'],
  ] },
  { key: 'endereco', title: 'Endereço principal', fields: [
    ['zip_code', 'CEP'], ['state', 'UF'], ['city', 'Cidade'], ['neighborhood', 'Bairro'],
    ['address', 'Endereço'], ['address_number', 'Número'], ['address_complement', 'Complemento'],
  ] },
  { key: 'cobranca', title: 'Endereço de cobrança', fields: [
    ['billing_zip_code', 'CEP'], ['billing_state', 'UF'], ['billing_city', 'Cidade'],
    ['billing_neighborhood', 'Bairro'], ['billing_address', 'Endereço'],
    ['billing_number', 'Número'], ['billing_complement', 'Complemento'],
  ] },
  { key: 'comercial', title: 'Dados comerciais', fields: [
    ['funnel_status', 'Etapa comercial'], ['temperatura_lead', 'Temperatura'],
    ['client_classification', 'Classificação do cliente'], ['valor_estimado', 'Valor potencial'],
    ['origem_lead', 'Origem'], ['salesperson', 'Vendedor'],
    ['campaign_idea_id', 'Campanha vinculada'], ['category', 'Categoria'],
    ['sales_channels', 'Canais de venda'],
  ] },
  { key: 'compromissos', title: 'Próxima Ação e compromissos', fields: [
    ['next_action_text', 'Próxima Ação'], ['next_action_date', 'Data da Próxima Ação'],
    ['next_contact_date', 'Próximo contato'], ['next_visit', 'Próxima visita'],
    ['commercial_opt_out', 'Não deseja contato comercial'],
  ] },
  { key: 'financeiro', title: 'Informações financeiras', fields: [
    ['credit_limit_type', 'Tipo de limite de crédito'], ['credit_limit_value', 'Limite de crédito'],
    ['payment_condition', 'Condição de pagamento'], ['lifetime_value', 'Valor total histórico'],
    ['paid_orders_count', 'Pedidos pagos'], ['last_purchase_date', 'Última compra'],
    ['last_payment_date', 'Último pagamento'],
  ] },
  { key: 'adicionais', title: 'Informações adicionais', fields: [
    ['marital_status', 'Estado civil'], ['profession', 'Profissão'], ['gender', 'Sexo'],
    ['birth_date', 'Nascimento'], ['birthplace', 'Naturalidade'],
    ['father_name', 'Nome do pai'], ['father_cpf', 'CPF do pai'],
    ['mother_name', 'Nome da mãe'], ['mother_cpf', 'CPF da mãe'],
    ['avg_load_percentage', 'Percentual médio de carga'],
  ] },
  { key: 'vinculos', title: 'Pessoas e canais relacionados', fields: [
    ['contact_people', 'Pessoas relacionadas'], ['sales_channels', 'Jornada nos canais'],
  ] },
  { key: 'estado', title: 'Situação e histórico cadastral', fields: [
    ['is_active', 'Situação do contato'], ['ultimo_contato', 'Último contato'],
    ['created_at', 'Cadastro criado em'], ['updated_at', 'Última atualização'],
    ['converted_at', 'Conversão'], ['lost_reason', 'Motivo de perda'],
    ['lost_reason_detail', 'Detalhes da perda'], ['lost_at', 'Data da perda'],
  ] },
  { key: 'pedidos', title: 'Pedidos vinculados', fields: [], orders: true },
];

function showValue(contact: Contact, key: keyof Contact): string {
  const value = contact[key];
  if (value == null || value === '') return 'Não informado';
  if (key === 'is_active') return value ? 'Ativo' : 'Inativo';
  if (key === 'commercial_opt_out') return value ? 'Sim' : 'Não';
  if (Array.isArray(value) || typeof value === 'object') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' && ['credit_limit_value', 'valor_estimado', 'lifetime_value'].includes(key)) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }
  if (typeof value === 'string' && (key.endsWith('_date') || key.endsWith('_at') || key === 'birth_date' || key === 'customer_since')) {
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) {
      return new Date(timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: value.includes('T') ? 'short' : undefined });
    }
  }
  return String(value);
}


type SaveState = 'pendente' | 'salvando' | 'salvo' | 'erro';
const BASIC_KEYS = new Set<keyof Contact>([
  'name', 'fantasy_name', 'company_name', 'phone', 'whatsapp', 'mobile',
  'email', 'website', 'notes', 'origem_lead', 'salesperson', 'profession', 'birthplace',
]);
const BASIC_SECTIONS = new Set(['principal', 'contato', 'adicionais']);
const CONTROLLED_SECTIONS = new Set(['fiscal', 'endereco', 'cobranca', 'financeiro', 'comercial', 'vinculos']);
const PROFILE_EDITABLE = new Set<string>(PROFILE_EDITABLE_KEYS as readonly string[]);
const SELECT_OPTIONS: Record<string, readonly [string, string][]> = {
  person_type: [['fisica', 'Pessoa física'], ['juridica', 'Pessoa jurídica']],
  type: [['cliente', 'Cliente'], ['fornecedor', 'Fornecedor'], ['ambos', 'Ambos']],
  credit_limit_type: [['unlimited', 'Ilimitado'], ['custom', 'Personalizado'], ['zero', 'Limite zero']],
  contact_type: [['revendedor', 'Revendedor'], ['cliente_final', 'Cliente final'], ['atacado', 'Atacado']],
  client_classification: [['vip', 'VIP'], ['alto_potencial', 'Alto potencial'], ['medio', 'Médio'], ['baixo_potencial', 'Baixo potencial']],
  taxpayer_type: [['9', 'Não contribuinte'], ['1', 'Contribuinte ICMS'], ['2', 'Contribuinte isento']],
  category: [['sem_categoria', 'Sem categoria'], ['vip', 'VIP'], ['regular', 'Regular'], ['novo', 'Novo']],
};


interface ProfileProps {
  contact: Contact | null;
  onSaved?: (contact: Contact) => void;
  onEditingChange?: (editing: boolean) => void;
}

export function ContactProfileOverview({ contact, onSaved, onEditingChange }: ProfileProps) {
  const [activeEdit, setActiveEdit] = useState<string | null>(null);
  const { activePlatforms } = usePlatforms();
  const [draft, setDraft] = useState<Partial<Contact>>({});
  const [statuses, setStatuses] = useState<Record<string, SaveState>>({});
  const [savingCount, setSavingCount] = useState(0);
  const baselineRef = useRef<Contact | null>(contact);
  const draftRef = useRef<Partial<Contact>>({});
  const pendingRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const queuedRef = useRef<Promise<void>>(Promise.resolve());
  const errorsRef = useRef<Set<string>>(new Set());
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  useEffect(() => {
    Object.values(pendingRef.current).forEach(clearTimeout);
    pendingRef.current = {};
    baselineRef.current = contact;
    draftRef.current = contact ? { ...contact } : {};
    setDraft(draftRef.current);
    setStatuses({});
    setActiveEdit(null);
    errorsRef.current.clear();
  }, [contact?.id]);

  useEffect(() => {
    onEditingChange?.(activeEdit !== null);
  }, [activeEdit, onEditingChange]);

  useEffect(() => () => {
    Object.values(pendingRef.current).forEach(clearTimeout);
  }, []);

  const enqueueSave = (key: keyof Contact, value: string) => {
    const id = contact?.id;
    if (!id) return Promise.resolve();
    if (pendingRef.current[key]) {
      clearTimeout(pendingRef.current[key]);
      delete pendingRef.current[key];
    }
    setStatuses((previous) => ({ ...previous, [key]: 'salvando' }));
    setSavingCount((count) => count + 1);
    const next = queuedRef.current.catch(() => undefined).then(async () => {
      const baseline = baselineRef.current;
      if (!baseline || baseline.id !== id) throw new Error('Contato mudou durante a gravação.');
      const result = await saveContactProfile({
        contactId: id, baseline, draft: { [key]: value },
      });
      baselineRef.current = result.contact;
      if (draftRef.current[key] === value) {
        errorsRef.current.delete(key);
        setStatuses((previous) => ({ ...previous, [key]: 'salvo' }));
      }
      onSavedRef.current?.(result.contact);
    }).catch((error) => {
      errorsRef.current.add(key);
      setStatuses((previous) => ({ ...previous, [key]: 'erro' }));
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar campo do contato.');
    }).finally(() => setSavingCount((count) => Math.max(0, count - 1)));
    queuedRef.current = next;
    return next;
  };

  const changeField = (key: keyof Contact, value: string) => {
    const next = { ...draftRef.current, [key]: value };
    draftRef.current = next;
    setDraft(next);
    errorsRef.current.delete(key);
    setStatuses((previous) => ({ ...previous, [key]: 'pendente' }));
    if (pendingRef.current[key]) clearTimeout(pendingRef.current[key]);
    pendingRef.current[key] = setTimeout(() => {
      void enqueueSave(key, value);
    }, key === 'notes' ? 1100 : 850);
  };

  const flushField = (key: keyof Contact) => {
    if (!pendingRef.current[key]) return;
    clearTimeout(pendingRef.current[key]);
    delete pendingRef.current[key];
    void enqueueSave(key, String(draftRef.current[key] ?? ''));
  };


  const changeControlledField = (key: keyof Contact, value: unknown) => {
    const next = { ...draftRef.current, [key]: value };
    draftRef.current = next;
    setDraft(next);
    errorsRef.current.delete(key);
    setStatuses((previous) => ({ ...previous, [key]: 'pendente' }));
  };

  const saveControlledSection = async (key: string) => {
    if (!contact) return false;
    const section = SECTIONS.find((item) => item.key === key);
    if (!section) return false;
    const changes: Partial<Contact> = {};
    for (const [field] of section.fields) {
      if (!PROFILE_EDITABLE.has(field)) continue;
      if (draftRef.current[field] === undefined) continue;
      (changes as Record<string, unknown>)[field] = draftRef.current[field];
    }
    setSavingCount((count) => count + 1);
    try {
      const base = baselineRef.current;
      if (!base || base.id !== contact.id) throw new Error('Contato alterado durante a edição.');
      const saved = await saveContactProfile({
        contactId: contact.id,
        baseline: base,
        draft: changes,
      });
      baselineRef.current = saved.contact;
      draftRef.current = { ...saved.contact };
      setDraft(draftRef.current);
      errorsRef.current.clear();
      setStatuses({});
      onSavedRef.current?.(saved.contact);
      toast.success('Seção salva.');
      return true;
    } catch (error) {
      errorsRef.current.add(key);
      setStatuses((previous) => ({ ...previous, [key]: 'erro' }));
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar a seção.');
      return false;
    } finally {
      setSavingCount((count) => Math.max(0, count - 1));
    }
  };

  const searchCep = async (billing: boolean) => {
    const prefix = billing ? 'billing_' : '';
    const zipField = (prefix + 'zip_code') as keyof Contact;
    const cep = String(draftRef.current[zipField] ?? '').replace(/\D/g, '');
    if (cep.length !== 8) { toast.error('CEP deve ter 8 dígitos.'); return; }
    setSavingCount((count) => count + 1);
    try {
      const response = await fetch('https://viacep.com.br/ws/' + cep + '/json/');
      if (!response.ok) throw new Error('CEP indisponível.');
      const address = await response.json();
      if (address.erro) throw new Error('CEP não encontrado.');
      const additions = {
        [prefix + 'zip_code']: cep,
        [prefix + 'state']: address.uf,
        [prefix + 'city']: address.localidade,
        [prefix + 'neighborhood']: address.bairro,
        [prefix + 'address']: address.logradouro,
      };
      const next = { ...draftRef.current, ...additions };
      draftRef.current = next;
      setDraft(next);
      toast.success('Endereço consultado. Confirme em Salvar seção.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao consultar CEP.');
    } finally {
      setSavingCount((count) => Math.max(0, count - 1));
    }
  };

  const finishEdit = async () => {
    if (activeEdit && CONTROLLED_SECTIONS.has(activeEdit)) {
      if (await saveControlledSection(activeEdit)) setActiveEdit(null);
      return;
    }
    const keys = Object.keys(pendingRef.current) as Array<keyof Contact>;
    for (const key of keys) {
      clearTimeout(pendingRef.current[key]);
      delete pendingRef.current[key];
      void enqueueSave(key, String(draftRef.current[key] ?? ''));
    }
    await queuedRef.current;
    if (errorsRef.current.size > 0) {
      toast.error('Existem campos com erro. Corrija ou tente salvar novamente antes de sair.');
      return;
    }
    setActiveEdit(null);
  };

  const discardEdit = () => {
    if (savingCount) return;
    Object.values(pendingRef.current).forEach(clearTimeout);
    pendingRef.current = {};
    draftRef.current = baselineRef.current ? { ...baselineRef.current } : {};
    setDraft(draftRef.current);
    setStatuses({});
    errorsRef.current.clear();
    setActiveEdit(null);
  };

  if (!contact) return <p className="p-3 text-xs text-muted-foreground">Carregando ficha completa...</p>;

  return (
    <div className="space-y-2" aria-label="Ficha completa do contato">
      <div className="flex items-center gap-2 rounded-lg border p-2">
        <ContactAvatar name={contact.name} photoUrl={contact.photo_url} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{contact.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{contact.whatsapp || contact.phone || 'Sem telefone'}</p>
        </div>
      </div>
      {activeEdit && (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-md border bg-background p-2 text-xs">
          <span>{savingCount ? 'Salvando...' : 'Edição em andamento — finalize antes de navegar'}</span>
          <div className="flex shrink-0 gap-1">
            <Button type="button" size="sm" variant="outline" disabled={savingCount > 0} onClick={discardEdit}>Cancelar</Button>
            <Button type="button" size="sm" onClick={() => void finishEdit()}>Concluir</Button>
          </div>
        </div>
      )}
      {SECTIONS.map((section, index) => (
        <Collapsible key={contact.id + '-' + section.key} defaultOpen={index === 0} className="rounded-lg border">
          <div className="flex items-center gap-1 pr-2">
            <CollapsibleTrigger asChild>
              <button type="button" className="group flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-muted/60"
                aria-label={'Expandir ou recolher ' + section.title}>
                <span>{section.title}</span>
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            {(BASIC_SECTIONS.has(section.key) || CONTROLLED_SECTIONS.has(section.key)) && (
              <Button type="button" variant="ghost" size="sm"
                disabled={activeEdit !== null && activeEdit !== section.key}
                onClick={() => {
                  if (activeEdit === section.key) void finishEdit();
                  else if (!activeEdit) setActiveEdit(section.key);
                }}>
                {activeEdit === section.key ? 'Concluir' : 'Editar'}
              </Button>
            )}
          </div>
          <CollapsibleContent className="space-y-2 border-t px-3 py-3">
            {section.fields.map(([key, label]) => {
              const controlled = CONTROLLED_SECTIONS.has(section.key);
              const canEdit = activeEdit === section.key && PROFILE_EDITABLE.has(key)
                && (controlled || BASIC_KEYS.has(key));
              const status = statuses[key];
              return (
                <div key={key} className="grid gap-0.5">
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                  {canEdit ? (
                    <>
                      {controlled ? (
                        key === 'sales_channels' ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-1">
                              {((draft.sales_channels || []) as NonNullable<Contact['sales_channels']>).map((channel, i) => {
                                const name = activePlatforms.find((item) => item.id === channel.platform_id)?.name || 'Canal';
                                return (
                                  <Button key={channel.platform_id + i} variant="outline" size="sm" className="h-7 text-xs"
                                    disabled={savingCount > 0}
                                    onClick={() => changeControlledField('sales_channels',
                                      (draft.sales_channels || []).filter((_, idx) => idx !== i))}>
                                    {name} ×
                                  </Button>
                                );
                              })}
                            </div>
                            <PlatformHierarchicalPicker
                              platforms={activePlatforms}
                              value={null}
                              placeholder="+ Adicionar canal"
                              excludedPlatformIds={(draft.sales_channels || []).map((item) => item.platform_id)}
                              onChange={(id) => {
                                if (!id || savingCount) return;
                                changeControlledField('sales_channels', [
                                  ...(draftRef.current.sales_channels || []),
                                  { platform_id: id, added_at: new Date().toISOString() },
                                ]);
                              }}
                              size="sm"
                            />
                          </div>
                        ) : SELECT_OPTIONS[key] ? (
                          <select className="h-9 w-full rounded-md border bg-background px-2 text-xs"
                            value={String(draft[key] ?? '')} disabled={savingCount > 0}
                            onChange={(event) => changeControlledField(key, event.target.value)}>
                            <option value="">Não informado</option>
                            {SELECT_OPTIONS[key].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                          </select>
                        ) : (
                          <Input type={key === 'credit_limit_value' || key === 'valor_estimado' || key === 'avg_load_percentage' ? 'number' :
                            ['customer_since', 'birth_date', 'next_visit'].includes(key) ? 'date' : 'text'}
                            value={String(draft[key] ?? '')}
                            disabled={savingCount > 0}
                            onChange={(event) => changeControlledField(key,
                              ['credit_limit_value', 'valor_estimado', 'avg_load_percentage'].includes(key)
                                ? (event.target.value === '' ? null : Number(event.target.value))
                                : event.target.value)}
                            className="h-8 text-xs" />
                        )
                      ) : key === 'notes' ? (
                        <Textarea value={String(draft[key] ?? '')}
                          disabled={savingCount > 0}
                          onChange={(e) => changeField(key, e.target.value)}
                          onBlur={() => flushField(key)} rows={3} className="text-xs" />
                      ) : (
                        <Input value={String(draft[key] ?? '')} disabled={savingCount > 0}
                          onChange={(e) => changeField(key, e.target.value)}
                          onBlur={() => flushField(key)} className="h-8 text-xs" />
                      )}
                      {status && <span role="status" className="text-[10px] text-muted-foreground">
                        {status === 'erro' ? 'Erro — edite novamente para tentar salvar' :
                          status === 'salvando' ? 'Salvando...' :
                          status === 'pendente' ? 'Pendente' : 'Salvo'}
                      </span>}
                    </>
                  ) : (
                    <span className="break-words whitespace-pre-wrap text-xs">{showValue(contact, key)}</span>
                  )}
                </div>
              );
            })}
            {activeEdit === section.key && (section.key === 'endereco' || section.key === 'cobranca') && (
              <Button type="button" variant="outline" size="sm" className="w-full" disabled={savingCount > 0}
                onClick={() => void searchCep(section.key === 'cobranca')}>Consultar CEP</Button>
            )}
            {activeEdit === section.key && CONTROLLED_SECTIONS.has(section.key) && (
              <p className="text-[10px] text-muted-foreground">Alterações nesta seção exigem Salvar/Concluir. Cancelar descarta alterações não salvas.</p>
            )}
            {section.orders && <ContactOrdersList contactId={contact.id} />}
          </CollapsibleContent>
        </Collapsible>
      ))}
      <p className="text-[10px] text-muted-foreground">
        Consulta por padrão. Dados simples salvam automaticamente; dados fiscais, financeiros, endereços e canais requerem confirmação por seção.
      </p>
    </div>
  );
}
