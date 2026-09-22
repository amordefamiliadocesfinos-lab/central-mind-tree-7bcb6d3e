import { normalizeSuggestionResponse, normalizeSuggestionTemporalReason, suggestCrmResult } from './aiResultSuggestion';
import type { CrmAiContextSources } from './aiContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FRENTE 4.2 — sugestão de Resultado: ${message}`);
}

const sources: CrmAiContextSources = {
  loadContact: async () => ({ id: 'c1', name: 'Amor', funnel_status: 'negociacao', origem_lead: 'whatsapp', temperatura_lead: 'quente', commercial_opt_out: false, paid_orders_count: 1, lifetime_value: 100, next_action_date: null }),
  loadConversation: async () => ({ id: 'conv1', attendance_state: 'aguardando_cliente', status: 'open', needs_reply: false, return_at: null, last_inbound_at: null, last_outbound_at: null }),
  loadMessages: async () => [],
  loadHistory: async () => [],
  loadTasks: async () => [],
  loadOrders: async () => [],
  loadTags: async () => [],
  loadCampaign: async () => null,
};

async function run() {
  // Validação do código canônico
  assert(normalizeSuggestionResponse({ suggested_result_code: 'CRM-RES-020', confidence: 0.9, reason: 'ok' }).code === 'CRM-RES-020', 'código canônico válido deve ser aceito.');
  const invented = normalizeSuggestionResponse({ suggested_result_code: 'CRM-RES-999', confidence: 0.9, reason: 'x' });
  assert(invented.code === null && invented.confidence === 0, 'código fora do catálogo deve ser descartado.');

  // Null legítimo
  const nulled = normalizeSuggestionResponse({ suggested_result_code: null, confidence: 0, reason: 'Ainda aguardando resposta do cliente.' });
  assert(nulled.code === null && nulled.reason.includes('aguardando'), 'a IA deve poder retornar null com motivo.');

  // Confiança normalizada (0–100 → 0–1) e resposta malformada
  assert(normalizeSuggestionResponse({ suggested_result_code: 'CRM-RES-008', confidence: 80, reason: 'r' }).confidence === 0.8, 'confiança em 0–100 deve ser normalizada.');
  const broken = normalizeSuggestionResponse({ nonsense: true });
  assert(broken.code === null && broken.confidence === 0, 'resposta malformada não pode quebrar a Inbox.');

  // D2 — evidência rastreável: normalizada, deduplicada e limitada a 3 trechos.
  const withEvidence = normalizeSuggestionResponse({
    suggested_result_code: 'CRM-RES-020',
    confidence: 0.9,
    reason: 'ok',
    evidence_quotes: ['  vou pagar hoje  ', 'vou pagar hoje', 'pode separar', 12, 'já fiz o pix', 'mais um trecho'],
  });
  assert(withEvidence.evidenceQuotes.length === 3, 'evidências devem ser limitadas a 3.');
  assert(withEvidence.evidenceQuotes[0] === 'vou pagar hoje', 'evidência deve ser aparada e deduplicada.');
  assert(withEvidence.evidenceQuotes.every(quote => quote.length <= 180), 'evidência deve respeitar 180 caracteres.');

  // Ausência ou formato inválido do campo gera lista vazia (respostas antigas).
  assert(normalizeSuggestionResponse({ suggested_result_code: 'CRM-RES-020', confidence: 0.9, reason: 'ok' }).evidenceQuotes.length === 0, 'resposta sem evidências deve gerar [].');
  assert(normalizeSuggestionResponse({ suggested_result_code: 'CRM-RES-020', confidence: 0.9, reason: 'ok', evidence_quotes: 'texto' }).evidenceQuotes.length === 0, 'evidência fora de array deve ser descartada.');

  // Baixa confiança (hipótese) preserva as evidências para leitura.
  const tentative = normalizeSuggestionResponse({ suggested_result_code: 'CRM-RES-020', confidence: 0.3, reason: 'ok', evidence_quotes: ['vou pensar'] });
  assert(tentative.code === null && tentative.tentativeCode === 'CRM-RES-020' && tentative.evidenceQuotes.length === 1, 'hipótese de baixa confiança deve preservar evidências.');

  // Uso real: um horário posterior no mesmo dia operacional não pode ser descrito como "data futura".
  const sameOperationalDay = normalizeSuggestionTemporalReason(
    { code: null, label: null, confidence: 0, reason: 'Existe retorno para uma data futura.', evidenceQuotes: [] },
    {
      generatedAt: '2026-09-21T23:00:00.000Z',
      conversation: {
        id: 'conv1', platformId: null, state: 'aguardando_cliente', status: 'open', needsReply: false,
        returnAt: '2026-09-22T00:30:00.000Z', lastInboundAt: null, lastOutboundAt: null,
      },
    },
  );
  assert(sameOperationalDay.reason.includes('programado para hoje'), 'retorno no mesmo dia de São Paulo deve ser apresentado como hoje.');

  const nextOperationalDay = normalizeSuggestionTemporalReason(
    { code: null, label: null, confidence: 0, reason: 'Existe retorno para uma data futura.', evidenceQuotes: [] },
    {
      generatedAt: '2026-09-21T20:00:00.000Z',
      conversation: {
        id: 'conv1', platformId: null, state: 'aguardando_cliente', status: 'open', needsReply: false,
        returnAt: '2026-09-22T15:00:00.000Z', lastInboundAt: null, lastOutboundAt: null,
      },
    },
  );
  assert(nextOperationalDay.reason.includes('data futura'), 'retorno em outro dia deve preservar a classificação futura.');

  // Fluxo completo com invoke simulado
  const suggestion = await suggestCrmResult('c1', 'conv1', {
    sources,
    invoke: async () => ({ suggested_result_code: 'CRM-RES-019', confidence: 0.7, reason: 'Cliente informou o pagamento.' }),
  });
  assert(suggestion.code === 'CRM-RES-019' && suggestion.label === 'Pagamento informado', 'a sugestão deve trazer código e label canônicos.');

  // Erro controlado da função
  let failed = false;
  try {
    await suggestCrmResult('c1', 'conv1', { sources, invoke: async () => ({ error: 'Créditos de IA esgotados.' }) });
  } catch { failed = true; }
  assert(failed, 'erro da Edge Function deve ser propagado de forma controlada.');
}

run().then(() => console.log('aiResultSuggestion.test: OK'));
