/** CRM–UX 02 B-01: contrato puro e auditável de edição cadastral. */
import type { Contact } from '@/hooks/useContacts';

/** Chaves cadastrais aceitas. Eventos, funil, pagamentos e ações oficiais ficam fora deste escritor. */
export const PROFILE_EDITABLE_KEYS: readonly (keyof Contact)[] = [
  'name', 'fantasy_name', 'code', 'type', 'person_type', 'document',
  'customer_since', 'taxpayer_type', 'state_registration', 'rg', 'issuing_agency',
  'zip_code', 'state', 'city', 'neighborhood', 'address', 'address_number', 'address_complement',
  'billing_zip_code', 'billing_state', 'billing_city', 'billing_neighborhood',
  'billing_address', 'billing_number', 'billing_complement',
  'contact_info', 'contact_people', 'phone', 'landline', 'fax', 'mobile',
  'mobile_carrier', 'email', 'nfe_email', 'website', 'skype', 'whatsapp',
  'next_visit', 'avg_load_percentage', 'marital_status', 'profession',
  'gender', 'birth_date', 'birthplace', 'father_name', 'father_cpf',
  'mother_name', 'mother_cpf', 'contact_type', 'salesperson',
  'default_operation_nature', 'credit_limit_type', 'credit_limit_value',
  'payment_condition', 'category', 'sales_channels', 'company_name',
  'notes', 'client_classification', 'campaign_idea_id', 'origem_lead',
  'temperatura_lead', 'valor_estimado',
] as const;

const editable = new Set<string>(PROFILE_EDITABLE_KEYS as readonly string[]);

/** Escritores exclusivos, deliberadamente recusados pela atualização cadastral genérica. */
const special = new Set<string>([
  'id', 'created_at', 'updated_at', 'funnel_status', 'converted_at',
  'lost_reason', 'lost_reason_detail', 'lost_at',
  'next_action_text', 'next_action_date', 'next_contact_date',
  'commercial_opt_out', 'photo_url', 'ultimo_contato', 'is_active',
  'lifetime_value', 'paid_orders_count', 'last_purchase_date', 'last_payment_date',
]);

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export class ContactEditConflictError extends Error {
  constructor(public readonly fields: string[]) {
    super('Dados alterados por outra operação: ' + fields.join(', '));
    this.name = 'ContactEditConflictError';
  }
}

export function buildContactProfilePatch(
  baseline: Partial<Contact>,
  draft: Partial<Contact>,
): Partial<Contact> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(draft)) {
    if (value === undefined || same(value, baseline[key as keyof Contact])) continue;
    if (!editable.has(key)) {
      throw new Error((special.has(key) ? 'Campo com escritor oficial: ' : 'Campo não habilitado: ') + key);
    }
    if (key === 'name' && (typeof value !== 'string' || !value.trim())) {
      throw new Error('Nome do contato é obrigatório.');
    }
    patch[key] = value;
  }
  return patch as Partial<Contact>;
}

/** Compara apenas campos do patch para evitar sobrescrever uma atualização concorrente. */
export function getContactPatchConflicts(
  baseline: Partial<Contact>,
  latest: Partial<Contact>,
  patch: Partial<Contact>,
): string[] {
  return Object.keys(patch).filter((key) => {
    const name = key as keyof Contact;
    return !same(baseline[name], latest[name]) && !same(patch[name], latest[name]);
  });
}

export function isCrmNextActionChanged(
  previous: Pick<Contact, 'next_action_text' | 'next_action_date' | 'next_contact_date'>,
  next: { title: string | null; dueAt: string | null },
) {
  const previousTitle = previous.next_action_text?.trim() || null;
  const previousDueAt = previous.next_action_date || previous.next_contact_date || null;
  return !same(previousTitle, next.title?.trim() || null) || !same(previousDueAt, next.dueAt);
}
