/** CRM–UX 02 B-02: ficha integral em consulta, antes da ativação da edição. */
import type { Contact } from '@/hooks/useContacts';
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

export function ContactProfileOverview({ contact }: { contact: Contact | null }) {
  if (!contact) return <p className="p-3 text-xs text-muted-foreground">Carregando ficha completa...</p>;
  return (
    <div className="space-y-2" aria-label="Ficha completa do contato em consulta">
      <div className="flex items-center gap-2 rounded-lg border p-2">
        <ContactAvatar name={contact.name} photoUrl={contact.photo_url} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{contact.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{contact.whatsapp || contact.phone || 'Sem telefone'}</p>
        </div>
      </div>
      {SECTIONS.map((section, index) => (
        <Collapsible key={contact.id + '-' + section.key} defaultOpen={index === 0} className="rounded-lg border">
          <CollapsibleTrigger asChild>
            <button type="button" className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-muted/60"
              aria-label={'Expandir ou recolher ' + section.title}>
              <span>{section.title}</span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 border-t px-3 py-3">
            {section.fields.map(([key, label]) => (
              <div key={key} className="grid gap-0.5">
                <span className="text-[10px] text-muted-foreground">{label}</span>
                <span className="break-words text-xs whitespace-pre-wrap">{showValue(contact, key)}</span>
              </div>
            ))}
            {section.orders && <ContactOrdersList contactId={contact.id} />}
          </CollapsibleContent>
        </Collapsible>
      ))}
      <p className="text-[10px] text-muted-foreground">Consulta cadastral. A edição integrada será habilitada na etapa seguinte.</p>
    </div>
  );
}
