/** CRM–UX 02 B-01: interface única de persistência para a futura ficha integrada. */
import { supabase } from '@/integrations/supabase/client';
import type { Contact } from '@/hooks/useContacts';
import { clearCrmNextAction, setCrmNextAction } from './nextAction';
import {
  buildContactProfilePatch, ContactEditConflictError,
  getContactPatchConflicts, isCrmNextActionChanged,
} from './contactEditContract';

export interface ContactProfileSaveResult {
  contact: Contact;
  changedFields: string[];
}

export async function readContactProfile(contactId: string): Promise<Contact> {
  if (!contactId) throw new Error('Contato não identificado.');
  const { data, error } = await supabase.from('contacts').select('*').eq('id', contactId).single();
  if (error || !data) throw error ?? new Error('Contato não encontrado.');
  return data as unknown as Contact;
}

/**
 * Salva somente diferenças cadastrais, nunca campos de resultado, fila ou tarefa.
 * Conferência de campos + updated_at controla concorrência sem criar migration.
 */
export async function saveContactProfile(input: {
  contactId: string;
  baseline: Contact;
  draft: Partial<Contact>;
}): Promise<ContactProfileSaveResult> {
  if (input.baseline.id !== input.contactId) throw new Error('Contato alterado durante a edição.');
  const patch = buildContactProfilePatch(input.baseline, input.draft);
  const changedFields = Object.keys(patch);
  const latest = await readContactProfile(input.contactId);
  if (!changedFields.length) return { contact: latest, changedFields };

  const conflicts = getContactPatchConflicts(input.baseline, latest, patch);
  if (conflicts.length) throw new ContactEditConflictError(conflicts);
  const { data, error } = await supabase.from('contacts')
    .update({ ...patch, updated_at: new Date().toISOString() } as any)
    .eq('id', input.contactId)
    .eq('updated_at', latest.updated_at)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ContactEditConflictError(['updated_at']);
  return { contact: data as unknown as Contact, changedFields };
}

/** Opt-out não é escrito indiretamente pela ficha. */
export async function updateContactCommercialOptOut(input: {
  contactId: string;
  baseline: Contact;
  value: boolean;
}): Promise<Contact> {
  if (input.baseline.id !== input.contactId) throw new Error('Contato alterado durante a edição.');
  const latest = await readContactProfile(input.contactId);
  if (Boolean(latest.commercial_opt_out) === input.value) return latest;
  if (Boolean(input.baseline.commercial_opt_out) !== Boolean(latest.commercial_opt_out)) {
    throw new ContactEditConflictError(['commercial_opt_out']);
  }
  const { data, error } = await supabase.from('contacts').update({
    commercial_opt_out: input.value,
    updated_at: new Date().toISOString(),
  }).eq('id', input.contactId).eq('updated_at', latest.updated_at).select('*').maybeSingle();
  if (error) throw error;
  if (!data) throw new ContactEditConflictError(['updated_at']);
  return data as unknown as Contact;
}

/** Próxima Ação mantém único escritor canônico, tarefa oficial e retorno. */
export async function updateContactOfficialNextAction(input: {
  contactId: string;
  baseline: Contact;
  title: string | null;
  dueAt: string | null;
  conversationId?: string | null;
}): Promise<Contact> {
  if (input.baseline.id !== input.contactId) throw new Error('Contato alterado durante a edição.');
  const latest = await readContactProfile(input.contactId);
  const desired = { title: input.title?.trim() || null, dueAt: input.dueAt || null };
  if (!isCrmNextActionChanged(latest, desired)) return latest;
  const snapshot = {
    title: latest.next_action_text?.trim() || null,
    dueAt: latest.next_action_date || latest.next_contact_date || null,
  };
  if (isCrmNextActionChanged(input.baseline, snapshot)) {
    throw new ContactEditConflictError(['next_action_text', 'next_action_date']);
  }
  if (Boolean(desired.title) !== Boolean(desired.dueAt)) {
    throw new Error('Próxima Ação exige título e data, ou ambos vazios para cancelamento.');
  }
  try {
    if (desired.title && desired.dueAt) {
      await setCrmNextAction({
        contactId: input.contactId,
        title: desired.title,
        dueAt: desired.dueAt,
        ...(input.conversationId ? { conversationId: input.conversationId, syncConversationReturn: true } : {}),
      });
    } else {
      await clearCrmNextAction(input.contactId, input.conversationId ?? null);
    }
  } catch (error) {
    // Funções atuais escrevem contatos, tarefas e histórico em etapas distintas.
    // A operação pode ter sido parcialmente aplicada: UI deve recarregar o estado oficial.
    throw new Error('Não foi possível confirmar toda a Próxima Ação. Recarregue a ficha antes de tentar novamente.', { cause: error });
  }
  return readContactProfile(input.contactId);
}


/** Situação do cadastro: ação administrativa explícita e protegida contra concorrência. */
export async function updateContactActiveState(input: {
  contactId: string;
  baseline: Contact;
  isActive: boolean;
}): Promise<Contact> {
  if (input.baseline.id !== input.contactId) throw new Error('Contato alterado durante a edição.');
  const latest = await readContactProfile(input.contactId);
  if (latest.is_active === input.isActive) return latest;
  if (input.baseline.is_active !== latest.is_active) {
    throw new ContactEditConflictError(['is_active']);
  }
  const { data, error } = await supabase.from('contacts')
    .update({ is_active: input.isActive, updated_at: new Date().toISOString() })
    .eq('id', input.contactId)
    .eq('updated_at', latest.updated_at)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ContactEditConflictError(['updated_at']);
  return data as unknown as Contact;
}
