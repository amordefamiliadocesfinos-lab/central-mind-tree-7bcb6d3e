/**
 * CRM UX Real U4-B1: evidence-only extraction from the active contact's conversation.
 * Never sends messages, writes to contacts or interprets conversation instructions.
 * Conservative, labelled examples only; unknown fields stay unproposed.
 */
export const CRM_CONVERSATION_PROFILE_FIELDS = ['name', 'email', 'phone', 'zip_code', 'city', 'address', 'address_number', 'address_complement', 'neighborhood', 'billing_zip_code', 'billing_city', 'billing_address', 'billing_number', 'billing_neighborhood'] as const;
export type CrmConversationProfileField = typeof CRM_CONVERSATION_PROFILE_FIELDS[number];

export interface CrmConversationProfileMessage {
  id: string;
  sender: string;
  content: string | null;
  created_at: string;
}
export interface CrmConversationProfileSuggestion {
  field: CrmConversationProfileField;
  value: string;
  messageId: string;
  createdAt: string;
  evidenceExcerpt: string;
  state: 'empty' | 'same' | 'conflict' | 'ambiguous' | 'unverified';
  /** All candidates are advisory, never automatically persisted. */
  requiresReview: true;
}

const patterns: Record<CrmConversationProfileField, RegExp> = {
  name: /(?:^|\n)\s*(?:meu nome é|me chamo|nome completo\s*:)\s*([^\n,;]{3,80})/i,
  email: /(?:^|\n)\s*(?:meu e-?mail (?:é|:)|e-?mail\s*:)\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  phone: /(?:^|\n)\s*(?:meu (?:telefone|celular) (?:é|:)|telefone\s*:)\s*((?:\+?\d|\(\d{2}\))[\d\s()\-]{7,18}\d)/i,
  zip_code: /(?:^|\n)\s*(?:meu cep (?:é|:)|cep\s*:)\s*(\d{5}-?\d{3})\b/i,
  city: /(?:^|\n)\s*(?:minha cidade (?:é|:)|cidade\s*:)\s*([^\n,;]{2,60})/i,
  address: /(?:^|\n)\s*(?:meu endereço (?:é|:)|endereço principal\s*:)\s*([^\n;]{5,140})/i,
  address_number: /(?:^|\n)\s*(?:número (?:do endereço principal|da residência)|número residencial)\s*:\s*([0-9]{1,8}[A-Za-z]?|s\/?n)\b/i,
  address_complement: /(?:^|\n)\s*complemento (?:do endereço principal|residencial)\s*:\s*([^\n;]{2,80})/i,
  neighborhood: /(?:^|\n)\s*(?:meu bairro (?:é|:)|bairro principal\s*:)\s*([^\n,;]{2,60})/i,
  billing_zip_code: /(?:^|\n)\s*cep (?:de cobrança|para cobrança)\s*:\s*(\d{5}-?\d{3})\b/i,
  billing_city: /(?:^|\n)\s*cidade (?:de cobrança|para cobrança)\s*:\s*([^\n,;]{2,60})/i,
  billing_address: /(?:^|\n)\s*endereço (?:de cobrança|para cobrança)\s*:\s*([^\n;]{5,140})/i,
  billing_number: /(?:^|\n)\s*número (?:de cobrança|do endereço de cobrança)\s*:\s*([0-9]{1,8}[A-Za-z]?|s\/?n)\b/i,
  billing_neighborhood: /(?:^|\n)\s*bairro (?:de cobrança|para cobrança)\s*:\s*([^\n,;]{2,60})/i,
};

const simplify = (value: string): string => value.trim().replace(/\s+/g, ' ');
function normalize(value: string): string {
  return simplify(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Restrict direct-fill candidates; ambiguous data remains for manual review only. */
function validCandidate(field: CrmConversationProfileField, value: string): boolean {
  if (field === 'email') return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value);
  if (field === 'zip_code' || field === 'billing_zip_code') return /^\d{5}-?\d{3}$/.test(value);
  if (field === 'phone') {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 13;
  }
  return !/[<>\x00-\x1f]/.test(value) && value.length <= 140;
}

function comparable(field: CrmConversationProfileField, value: string): string {
  return field === 'phone' || field === 'zip_code' || field === 'billing_zip_code'
    ? value.replace(/\D/g, '') : normalize(value);
}

export function proposeCrmConversationProfileFields(
  messages: readonly CrmConversationProfileMessage[],
  current: Partial<Record<CrmConversationProfileField, unknown>>,
): CrmConversationProfileSuggestion[] {
  const candidates = new Map<CrmConversationProfileField, Array<{ value: string; id: string; date: string; excerpt: string }>>();
  // Trechos sem declaração explícita de titularidade são apenas pistas consultivas.
  const unverified = new Map<'email' | 'zip_code', Array<{ value: string; id: string; date: string; excerpt: string }>>();
  // Only direct inbound customer text. Ignore instructions and quoted/agent/AI content.
  for (const message of messages) {
    if (message.sender !== 'customer' || !message.id || !message.created_at || !message.content) continue;
    const body = message.content.slice(0, 4000);
    // Blocos de terceiros frequentemente têm cabeçalho seguido de rótulos comuns
    // (Nome completo, E-mail, Cidade). Não os atribuir automaticamente ao titular.
    const headerLines = body.split(/\r?\n/);
    const thirdPartyHeader = headerLines.some(line =>
      /^\s*(?:dados|informações|cadastro)\s+(?:d[ao]|de)\s+(?:minha|meu|outra|outro|um|uma|terceiro|terceira|cliente|destinatári[ao]|esposa|marido|mãe|pai|filh[ao]|amig[ao])/i.test(line)
      || /^\s*(?:encaminhada de|mensagem encaminhada|forwarded message|contato de terceiro)\b/i.test(line)
    );
    if (thirdPartyHeader) continue;
    // Linhas citadas, encaminhadas ou rotuladas como dados de terceiro não provam
    // titularidade. São evidências para revisão humana, nunca cadastro automático.
    const lines = body.split(/\r?\n/).filter(line => {
      const trimmed = line.trim();
      return !/^(?:>|"|encaminhad[ao]|dados (?:d[ao]|de) (?:cliente|terceiro|mãe|pai|esposa|marido|amigo)|endereço (?:de entrega|da minha mãe|do meu pai))\b/i.test(trimmed);
    });
    // Percorrer cada linha, não apenas a primeira ocorrência da mensagem:
    // correções conflitantes dentro do mesmo envio também exigem revisão.
    for (const line of lines) {
      // Apenas formatos reconhecíveis; ausência de rótulo não comprova titularidade.
      // Não inferir CEP de cobrança ou endereço principal a partir de um número solto.
      const plainEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(line)?.[0];
      const plainCep = /\b\d{5}-?\d{3}\b/.exec(line)?.[0];
      if (plainEmail && validCandidate('email', plainEmail)) {
        const list = unverified.get('email') ?? [];
        list.push({ value: plainEmail, id: message.id, date: message.created_at, excerpt: simplify(line).slice(0, 160) });
        unverified.set('email', list);
      }
      // CEP explicitamente de cobrança, entrega ou terceiro nunca é pista de CEP principal.
      const cepIsOtherPurpose = /(?:cobrança|entrega|destinatári[ao]|terceir[ao]|mãe|pai|esposa|marido)/i.test(line);
      if (plainCep && !cepIsOtherPurpose && validCandidate('zip_code', plainCep)) {
        const list = unverified.get('zip_code') ?? [];
        list.push({ value: plainCep, id: message.id, date: message.created_at, excerpt: simplify(line).slice(0, 160) });
        unverified.set('zip_code', list);
      }
      for (const field of CRM_CONVERSATION_PROFILE_FIELDS) {
        const found = patterns[field].exec(line);
        if (!found) continue;
        const value = simplify(found[1]);
        if (!value || !validCandidate(field, value) || /(?:ignore|instrução|sistema|assistente|prompt)/i.test(value)) continue;
        const list = candidates.get(field) ?? [];
        list.push({ value, id: message.id, date: message.created_at, excerpt: simplify(line).slice(0, 160) });
        candidates.set(field, list);
      }
    }
  }
  const proposals: CrmConversationProfileSuggestion[] = [];
  for (const field of CRM_CONVERSATION_PROFILE_FIELDS) {
    const entries = candidates.get(field);
    if (!entries?.length) continue;
    const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const latest = ordered[ordered.length - 1];
    const differing = ordered.some(entry => comparable(field, entry.value) !== comparable(field, latest.value));
    const oldValue = String(current[field] ?? '').trim();
    const state = differing ? 'ambiguous'
      : !oldValue ? 'empty'
      : comparable(field, oldValue) === comparable(field, latest.value) ? 'same' : 'conflict';
    proposals.push({
      field, value: latest.value, messageId: latest.id, createdAt: latest.date,
      evidenceExcerpt: latest.excerpt,
      state, requiresReview: true,
    });
  }
  // Evidência de texto livre nunca vira opção de escrita. Se já existe
  // candidato explícito para o campo, ele prevalece sem duplicação.
  for (const field of ['email', 'zip_code'] as const) {
    if (candidates.has(field)) continue;
    const entries = unverified.get(field);
    if (!entries?.length) continue;
    const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const latest = ordered[ordered.length - 1];
    proposals.push({
      field, value: latest.value, messageId: latest.id, createdAt: latest.date,
      evidenceExcerpt: latest.excerpt, state: 'unverified', requiresReview: true,
    });
  }
  return proposals;
}
