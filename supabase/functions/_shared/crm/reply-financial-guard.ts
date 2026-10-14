/**
 * CRM C2 — Identificadores financeiros têm autoridade na KB oficial ativa.
 * Compartilhado por Inbox e Edge Function; NUNCA contém dados Pix concretos.
 */
export interface CrmReplyMessage {
  direction?: string | null;
  content?: string | null;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Detecta uma SOLICITAÇÃO de chave, não simples menção a Pix/pagamento. */
export function isExplicitPixKeyRequest(content: string | null | undefined): boolean {
  const text = normalize(String(content ?? '').trim());
  if (!text.includes('pix')) return false;
  return /\b(?:chave|dados|numero|telefone|celular|cnpj|cpf|e-?mail)\b.{0,50}\bpix\b/.test(text)
    || /\bpix\b.{0,50}\b(?:chave|dados|numero|telefone|celular|cnpj|cpf|e-?mail)\b/.test(text)
    || /\bqual\s+(?:(?:e|seria)\s+)?(?:(?:o|seu|da|do)\s+)?pix\b/.test(text)
    || /\b(?:manda|mandar|envia|enviar|passa|passar|informa|informar|fornece|fornecer|diz|da|de)\s+(?:(?:o|a|seu|sua|meu|minha)\s+)?pix\b/.test(text)
    || /\bpix\b\s+(?:da|do|de)\s+(?:empresa|loja|voces|vossa)\b/.test(text);
}

export function isPixMethodChoice(
  messages: CrmReplyMessage[] | null | undefined,
): boolean {
  const all = messages ?? [];
  const last = all[all.length - 1];
  if (last?.direction !== 'inbound' || !/^\s*pix[.!]?\s*$/i.test(String(last.content ?? ''))) return false;
  const previous = [...all.slice(0, -1)].reverse().find(m => m?.direction === 'outbound');
  return Boolean(previous && /\b(forma|meio|modo|opcao|opção).{0,35}pagamento\b|\bpagamento.{0,35}(forma|meio|modo|opcao|opção)\b|\b(pix|cartao|cartão)\b/i.test(String(previous.content ?? '')));
}

/** Só considera o bloco inbound atual. Um outbound posterior encerra a solicitação anterior. */
export function requiresOfficialPixKnowledge(
  messages: CrmReplyMessage[] | null | undefined,
): boolean {
  const all = messages ?? [];
  if (all[all.length - 1]?.direction !== 'inbound') return false;
  if (isPixMethodChoice(all)) return true;
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i]?.direction === 'outbound') break;
    if (all[i]?.direction === 'inbound' && isExplicitPixKeyRequest(all[i]?.content)) return true;
  }
  return false;
}

/**
 * Outra resposta gerada ou KB não verificada não pode expor números bancários,
 * chave Pix ou identificadores completos. Não impede a frase "aceitamos Pix".
 */
export function hasUnverifiedFinancialIdentifier(text: string | null | undefined): boolean {
  const body = normalize(String(text ?? ''));
  if (!/\b(pix|chave|cnpj|cpf|conta|agencia|banco|deposito)\b/.test(body)) return false;
  const longNumber = /\b\d[\d\s.()/-]{7,}\d\b/.test(body);
  const emailKey = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/.test(body);
  const randomKey = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/.test(body);
  const labeled = /\b(?:chave(?:\s+pix)?|pix\s+(?:celular|telefone|cpf|cnpj|e-?mail|aleatoria)|cnpj|conta|agencia)\s*[:=-]\s*[^\s.,;!?]+/.test(body);
  return longNumber || emailKey || randomKey || labeled;
}

export interface OfficialPixKnowledgeItem {
  question: string;
  answer: string;
  category?: string | null;
  platformId?: string | null;
}

export function verifiedOfficialPixReply(
  items: OfficialPixKnowledgeItem[],
  platformId?: string | null,
): string | null {
  const candidates = items.filter(item =>
    normalize(String(item.question ?? '').trim()).replace(/\?+$/, '').trim() === 'qual e o pix'
    && normalize(String(item.category ?? '').trim()) === 'pagamento'
    && (!item.platformId || item.platformId === platformId),
  );
  // Duplicações e fontes divergentes exigem revisão humana.
  if (candidates.length !== 1) return null;
  const answer = String(candidates[0].answer ?? '').trim();
  if (!answer || answer.length > 800 || /\[|\]|x{3,}|0{8,}|exemplo|placeholder|preencher/i.test(answer)) return null;
  const match = answer.match(/^PIX\s+(celular|telefone|cpf|cnpj|e-?mail|chave\s+aleat[oó]ria)\s*:\s*([^\r\n]+)$/im);
  if (!match) return null;
  const type = normalize(match[1]);
  const value = match[2].trim();
  const digits = value.replace(/\D/g, '');
  if (/^(celular|telefone)$/.test(type) && !/^\d{10,13}$/.test(digits)) return null;
  if (type === 'cpf' && !/^\d{11}$/.test(digits)) return null;
  if (type === 'cnpj' && !/^\d{14}$/.test(digits)) return null;
  if (/e-?mail/.test(type) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  if (type.startsWith('chave') && !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(value.toLowerCase())) return null;
  return answer;
}
