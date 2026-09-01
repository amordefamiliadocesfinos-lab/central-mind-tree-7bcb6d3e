/**
 * FRENTE 3.2 — Elegibilidade de destinatários de Campanha CRM.
 *
 * Regra central: a janela de 24h do WhatsApp NÃO é critério de exclusão.
 * Ela apenas definirá, em fase futura, o delivery_mode (api | manual).
 */

import { normalizeBRPhone } from '@/lib/whatsapp';

export type RecipientStatus = 'pending' | 'excluded';
export type ExclusionReason = 'commercial_opt_out' | 'missing_phone' | 'invalid_phone' | 'duplicate' | 'supplier';

export interface EligibilityContact {
  id: string;
  name?: string | null;
  phone?: string | null;
  mobile?: string | null;
  whatsapp?: string | null;
  commercial_opt_out?: boolean | null;
  /** 'cliente' | 'fornecedor' | 'ambos' — fornecedor puro não é alvo comercial. */
  type?: string | null;
}

export interface EvaluatedRecipient {
  contact_id: string;
  contact_name: string;
  phone_normalized: string | null;
  status: RecipientStatus;
  exclusion_reason: ExclusionReason | null;
}

export const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  commercial_opt_out: 'Opt-out comercial',
  missing_phone: 'Sem telefone',
  invalid_phone: 'Telefone inválido',
  duplicate: 'Duplicidade de telefone',
};

/** Um telefone BR válido tem DDI + DDD + 8/9 dígitos (12 a 13 dígitos normalizados). */
function isUsablePhone(normalized: string | null): boolean {
  if (!normalized) return false;
  return normalized.length >= 12 && normalized.length <= 15;
}

export function evaluateRecipients(contacts: EligibilityContact[]): EvaluatedRecipient[] {
  const seenPhones = new Set<string>();
  const seenContacts = new Set<string>();
  const result: EvaluatedRecipient[] = [];

  for (const contact of contacts) {
    // Respeita o unique (campaign_id, contact_id): o mesmo contato entra uma única vez.
    if (seenContacts.has(contact.id)) continue;
    seenContacts.add(contact.id);

    const raw = contact.whatsapp || contact.mobile || contact.phone || '';
    const normalized = normalizeBRPhone(raw);
    const name = (contact.name || 'Sem nome').trim();

    let status: RecipientStatus = 'pending';
    let reason: ExclusionReason | null = null;

    if (contact.commercial_opt_out === true) {
      status = 'excluded';
      reason = 'commercial_opt_out';
    } else if (!raw.replace(/\D/g, '')) {
      status = 'excluded';
      reason = 'missing_phone';
    } else if (!isUsablePhone(normalized)) {
      status = 'excluded';
      reason = 'invalid_phone';
    } else if (normalized && seenPhones.has(normalized)) {
      status = 'excluded';
      reason = 'duplicate';
    }

    if (status === 'pending' && normalized) seenPhones.add(normalized);

    result.push({
      contact_id: contact.id,
      contact_name: name,
      phone_normalized: normalized,
      status,
      exclusion_reason: reason,
    });
  }

  return result;
}

export function summarize(recipients: EvaluatedRecipient[]) {
  const total_selected = recipients.length;
  const total_eligible = recipients.filter(r => r.status === 'pending').length;
  return { total_selected, total_eligible, total_excluded: total_selected - total_eligible };
}
