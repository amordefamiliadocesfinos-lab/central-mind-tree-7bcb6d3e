import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;
const MAX_KNOWLEDGE_ITEMS = 5;
const MAX_CANDIDATES = 40;

export interface CrmKnowledgeItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
  platformId: string | null;
}

export interface CrmKnowledgeContext {
  items: CrmKnowledgeItem[];
  matched: boolean;
  /** Resposta estável diretamente aplicável; nunca representa fato dinâmico. */
  authoritativeAnswer: string | null;
}

export interface CrmKnowledgeLookupInput {
  message: string | null | undefined;
  platformId?: string | null;
}

export type CrmKnowledgeFetcher = (platformId?: string | null) => Promise<CrmKnowledgeItem[]>;

const EMPTY_CONTEXT: CrmKnowledgeContext = { items: [], matched: false, authoritativeAnswer: null };

// Informações dinâmicas continuam exclusivamente nas fontes canônicas.
const DYNAMIC_ONLY = /\b(estoque|disponibilidade|disponivel|preco|quanto custa|desconto|pedido|pagamento confirmado|ja foi pago|já foi pago|prazo hoje)\b/i;
const STABLE_HINTS = /\b(quantos|quantidade|caixa|validade|sabores?|sabor|embalagem|pix|chave|retir\w*|entrega|envio|dados|frete|uber|motorista|transportadora|shopee|evento|formas? de pagamento|pagamento|catalogo|catálogo|endereco|endereço|link|politica|política)\b/i;
const FACTUAL_REQUEST = /\?|\b(qual|quais|quanto|quantos|como|onde|manda|envi[ae]|preciso|pode|aceita|tem)\b/i;

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function tokens(value: string): string[] {
  return normalize(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(token => token.length >= 3);
}

/** Evita uma consulta quando a mensagem não pede conhecimento factual estável. */
export function shouldQueryCrmKnowledge(message: string | null | undefined): boolean {
  const text = String(message ?? '').trim();
  if (!text || DYNAMIC_ONLY.test(normalize(text))) return false;
  return STABLE_HINTS.test(normalize(text)) && FACTUAL_REQUEST.test(normalize(text));
}

function scoreItem(item: CrmKnowledgeItem, queryTokens: string[], platformId?: string | null): number {
  const questionTokens = new Set(tokens(item.question));
  const categoryTokens = new Set(tokens(item.category));
  const keywordTokens = new Set((item.keywords ?? []).flatMap(tokens));
  let score = 0;
  for (const token of queryTokens) {
    if ([...keywordTokens].some(itemToken => sameKnowledgeToken(token, itemToken))) score += 8;
    if ([...questionTokens].some(itemToken => sameKnowledgeToken(token, itemToken))) score += 3;
    if ([...categoryTokens].some(itemToken => sameKnowledgeToken(token, itemToken))) score += 1;
  }
  if (platformId && item.platformId === platformId) score += 2;
  return score;
}

const GENERIC_QUERY_TOKENS = new Set([
  'qual', 'quais', 'quantos', 'quanto', 'como', 'tem', 'vem', 'voces', 'voces',
  'validade', 'sabor', 'sabores', 'pagamento', 'entrega', 'produto', 'produtos',
]);

function singular(value: string): string {
  return value.endsWith('s') && value.length > 3 ? value.slice(0, -1) : value;
}

function sameKnowledgeToken(left: string, right: string): boolean {
  const normalizedLeft = singular(left);
  const normalizedRight = singular(right);
  return normalizedLeft === normalizedRight
    || (normalizedLeft.startsWith('retir') && normalizedRight.startsWith('retir'));
}

/**
 * Retorna os identificadores concretos da pergunta que uma FAQ atende. Termos
 * genéricos como "validade" nunca bastam para promover uma resposta sozinhos.
 */
function directStableTokens(item: CrmKnowledgeItem, queryTokens: string[]): string[] {
  const itemTokens = new Set([
    ...tokens(item.question),
    ...(item.keywords ?? []).flatMap(tokens),
  ].map(singular));
  return queryTokens
    .filter(token => !GENERIC_QUERY_TOKENS.has(token) && [...itemTokens].some(itemToken => sameKnowledgeToken(token, itemToken)))
    .map(singular);
}

/**
 * O formulário de dados para envio é relacionado à entrega, mas só pode ser
 * apresentado quando o cliente o pedir. Uma pergunta sobre retirada/endereço
 * não autoriza acrescentar dados pessoais que não foram solicitados.
 */
function requiresExplicitShippingDataRequest(item: CrmKnowledgeItem): boolean {
  const itemText = normalize(`${item.question} ${(item.keywords ?? []).join(' ')}`);
  return /\b(dados?.{0,12}envio|envio.{0,12}dados?|nome completo|cpf|complemento)\b/.test(itemText);
}

function isDirectlyRequested(item: CrmKnowledgeItem, queryTokens: string[]): boolean {
  if (!requiresExplicitShippingDataRequest(item)) return true;
  const explicitRequestTokens = new Set(['dado', 'dados', 'envio', 'nome', 'telefone', 'email', 'cpf', 'complemento']);
  return queryTokens.some(token => explicitRequestTokens.has(singular(token)));
}

/** Um item menos específico não deve duplicar outro que explica os mesmos termos. */
function isSupersededByMoreSpecificMatch(
  candidate: { score: number; directTokens: string[] },
  ranked: Array<{ score: number; directTokens: string[] }>,
): boolean {
  return ranked.some(other => other !== candidate
    && other.score > candidate.score
    && candidate.directTokens.every(token => other.directTokens.includes(token)));
}

export async function defaultCrmKnowledgeFetcher(platformId?: string | null): Promise<CrmKnowledgeItem[]> {
  let query = db.from('digital_knowledge_base')
    .select('id, question, answer, category, keywords, platform_id')
    .eq('is_active', true)
    .limit(MAX_CANDIDATES);
  // Itens globais sempre podem ser usados; itens de outro canal não competem.
  if (platformId) query = query.or(`platform_id.is.null,platform_id.eq.${platformId}`);
  else query = query.is('platform_id', null);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
    category: row.category ?? 'geral',
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    platformId: row.platform_id ?? null,
  }));
}

/**
 * Busca pequena e não bloqueante. Falha ou ausência de correspondência nunca
 * impede a sugestão de resposta do CRM.
 */
export async function resolveCrmKnowledgeContext(
  input: CrmKnowledgeLookupInput,
  fetcher: CrmKnowledgeFetcher = defaultCrmKnowledgeFetcher,
): Promise<CrmKnowledgeContext> {
  if (!shouldQueryCrmKnowledge(input.message)) return EMPTY_CONTEXT;
  try {
    const queryTokens = tokens(String(input.message));
    const ranked = (await fetcher(input.platformId))
      .filter(item => isDirectlyRequested(item, queryTokens))
      .map(item => ({ item, score: scoreItem(item, queryTokens, input.platformId) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.item.question.localeCompare(b.item.question));
    const withDirectTokens = ranked.map(entry => ({
      ...entry,
      directTokens: directStableTokens(entry.item, queryTokens),
    }));
    const authoritativeAnswer = [...new Set(withDirectTokens
      .filter(entry => entry.directTokens.length > 0 && !isSupersededByMoreSpecificMatch(entry, withDirectTokens))
      .slice(0, 3)
      .map(entry => entry.item.answer))]
      .join('\n\n') || null;
    return {
      items: ranked.slice(0, MAX_KNOWLEDGE_ITEMS).map(({ item }) => item),
      matched: ranked.length > 0,
      authoritativeAnswer,
    };
  } catch {
    return EMPTY_CONTEXT;
  }
}
