import { guardCrmResultFactualCoherence, guardShortConfirmationStrongResult, normalizeSuggestionResponse, normalizeSuggestionTemporalReason, suggestCrmResult, suggestCrmResultFromContext } from './aiResultSuggestion';
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

  // F5 — confirmação curta não prova Resultado forte.
  const shortContext = {
    messages: [{ direction: 'inbound', content: 'Sim', createdAt: '2026-10-09T17:50:57.000Z' }],
  } as any;
  const guardedOrder = guardShortConfirmationStrongResult(
    { code: 'CRM-RES-021', label: 'Pedido confirmado', confidence: 0.95, reason: 'Cliente respondeu sim.', evidenceQuotes: ['Sim'] },
    shortContext,
  );
  assert(guardedOrder.code === null && guardedOrder.tentativeCode === 'CRM-RES-021' && guardedOrder.confidence <= 0.5,
    '“Sim” isolado não pode tornar Pedido confirmado acionável.');

  const guardedPayment = guardShortConfirmationStrongResult(
    { code: 'CRM-RES-020', label: 'Pagamento confirmado', confidence: 0.9, reason: 'Cliente respondeu ok.', evidenceQuotes: ['ok'] },
    { messages: [{ direction: 'inbound', content: 'ok', createdAt: '2026-10-09T17:50:57.000Z' }] } as any,
  );
  assert(guardedPayment.code === null && guardedPayment.tentativeCode === 'CRM-RES-020',
    '“ok” isolado não pode confirmar pagamento.');

  const explicitOrder = guardShortConfirmationStrongResult(
    { code: 'CRM-RES-021', label: 'Pedido confirmado', confidence: 0.9, reason: 'Confirmação explícita.', evidenceQuotes: ['Pode fechar o pedido de 1000 unidades'] },
    { messages: [{ direction: 'inbound', content: 'Pode fechar o pedido de 1000 unidades', createdAt: '2026-10-09T17:50:57.000Z' }] } as any,
  );
  assert(explicitOrder.code === 'CRM-RES-021',
    'confirmação específica não deve ser bloqueada pela guarda de resposta curta.');


  // C3: cenário de uso real 14/10 — reabertura apenas com "Oii".
  const greeting = guardCrmResultFactualCoherence(
    { code: 'CRM-RES-001', label: 'Interesse demonstrado', confidence: 0.9,
      reason: 'Retomou compra de trufas.', evidenceQuotes: ['Oii'] },
    { messages: [
      { direction: 'inbound', content: 'Então terça-feira te mando mensagem amigo', createdAt: '2026-10-09T15:14:00Z' },
      { direction: 'outbound', content: 'COMBINADO', createdAt: '2026-10-09T15:15:00Z' },
      { direction: 'inbound', content: 'Oii', createdAt: '2026-10-14T15:34:00Z' },
    ] } as any,
  );
  assert(greeting.code === null && greeting.tentativeCode === 'CRM-RES-001'
    && greeting.confidence <= 0.5 && greeting.evidenceQuotes.length === 0,
    'C3: saudação não é Resultado acionável, histórico antigo não eleva confiança.');

  // C3: pedir Pix não significa "Aguardando pagamento".
  const pixRequest = guardCrmResultFactualCoherence(
    { code: 'CRM-RES-018', label: 'Aguardando pagamento', confidence: 1,
      reason: 'Vai pagar.', evidenceQuotes: ['Me manda a chave Pix pfv'] },
    { messages: [
      { direction: 'inbound', content: 'Pagamento pix', createdAt: '2026-10-14T15:46:00Z' },
      { direction: 'outbound', content: 'Os sabores disponíveis são...', createdAt: '2026-10-14T15:48:00Z' },
      { direction: 'inbound', content: 'Me manda a chave Pix pfv', createdAt: '2026-10-14T15:49:00Z' },
    ] } as any,
  );
  assert(pixRequest.code === null && pixRequest.tentativeCode === 'CRM-RES-018'
    && pixRequest.confidence <= 0.5, 'C3: solicitar chave Pix não prova pagamento já aguardado.');

  const informedNotConfirmed = guardCrmResultFactualCoherence(
    { code: 'CRM-RES-020', label: 'Pagamento confirmado', confidence: 1,
      reason: 'Cliente disse que pagou.', evidenceQuotes: ['Já fiz o pix'] },
    { messages: [{ direction: 'inbound', content: 'Já fiz o pix', createdAt: '2026-10-14T15:50:00Z' }] } as any,
  );
  assert(informedNotConfirmed.code === null && informedNotConfirmed.tentativeCode === 'CRM-RES-020',
    'C3: mensagem de pagamento informado não prova confirmação financeira.');

  const specificNeed = guardCrmResultFactualCoherence(
    { code: 'CRM-RES-001', label: 'Interesse demonstrado', confidence: 0.94,
      reason: 'Solicitou valores para comprar.', evidenceQuotes: ['Quero 50 trufas de 30g'] },
    { messages: [{ direction: 'inbound', content: 'Quero 50 trufas de 30g, quanto fica?', createdAt: '2026-10-14T15:38:00Z' }] } as any,
  );
  assert(specificNeed.code === 'CRM-RES-001' && specificNeed.confidence === 0.94,
    'C3: interesse comercial explícito não deve perder classificação.');

  const paymentInformed = guardCrmResultFactualCoherence(
    { code: 'CRM-RES-019', label: 'Pagamento informado', confidence: 0.84,
      reason: 'Cliente declarou pagamento.', evidenceQuotes: ['Fiz o pix'] },
    { messages: [{ direction: 'inbound', content: 'Fiz o pix agora', createdAt: '2026-10-14T16:02:00Z' }] } as any,
  );
  assert(paymentInformed.code === 'CRM-RES-019',
    'C3: pagamento informado preserva significado sem se tornar confirmado.');

  const outboundLast = guardCrmResultFactualCoherence(
    { code: 'CRM-RES-001', label: 'Interesse demonstrado', confidence: 0.91,
      reason: 'Histórico.', evidenceQuotes: ['Quero trufas'] },
    { messages: [
      { direction: 'inbound', content: 'Quero trufas', createdAt: '2026-10-14T15:40:00Z' },
      { direction: 'outbound', content: 'Pode informar a quantidade?', createdAt: '2026-10-14T15:41:00Z' },
    ] } as any,
  );
  assert(outboundLast.code === null, 'C3: depois do outbound não inventar novo Resultado.');

  const turnContext = (turn: string) => ({
    messages: [{ direction: 'inbound', content: turn, createdAt: '2026-10-14T18:45:00Z' }],
  }) as any;
  const endToEndGreeting = await suggestCrmResultFromContext(
    turnContext('Oii'),
    async () => ({ suggested_result_code: 'CRM-RES-001', confidence: 0.93, reason: 'Retomada pelo histórico.', evidence_quotes: ['Oii'] }),
  );
  assert(endToEndGreeting.code === null && endToEndGreeting.tentativeCode === 'CRM-RES-001',
    'C3 integração: hipótese sem evidência não deve dirigir Próxima Ação.');
  const endToEndPix = await suggestCrmResultFromContext(
    turnContext('Pagamento pix'),
    async () => ({ suggested_result_code: 'CRM-RES-018', confidence: 0.97, reason: 'Vai pagar.', evidence_quotes: ['Pagamento pix'] }),
  );
  assert(endToEndPix.code === null && endToEndPix.tentativeCode === 'CRM-RES-018',
    'C3 integração: escolha do método Pix ainda não prova pagamento aguardado.');
  const endToEndInterest = await suggestCrmResultFromContext(
    turnContext('Quero 50 trufas de 30g e saber o frete'),
    async () => ({ suggested_result_code: 'CRM-RES-001', confidence: 0.92, reason: 'Interesse explícito.', evidence_quotes: ['Quero 50 trufas de 30g'] }),
  );
  assert(endToEndInterest.code === 'CRM-RES-001',
    'C3 integração: pedido explícito mantém Resultado acionável.');

  // Fluxo completo com invoke simulado
  const suggestion = await suggestCrmResult('c1', 'conv1', {
    sources,
    invoke: async () => ({ suggested_result_code: 'CRM-RES-019', confidence: 0.7, reason: 'Cliente informou o pagamento.', evidence_quotes: ['já fiz o pix'] }),
  });
  assert(suggestion.code === 'CRM-RES-019' && suggestion.label === 'Pagamento informado', 'a sugestão deve trazer código e label canônicos.');
  assert(suggestion.evidenceQuotes.length === 1 && suggestion.evidenceQuotes[0] === 'já fiz o pix', 'o fluxo completo deve preservar a evidência rastreável.');

  // Erro controlado da função
  let failed = false;
  try {
    await suggestCrmResult('c1', 'conv1', { sources, invoke: async () => ({ error: 'Créditos de IA esgotados.' }) });
  } catch { failed = true; }
  assert(failed, 'erro da Edge Function deve ser propagado de forma controlada.');
}

run().then(() => console.log('aiResultSuggestion.test: OK'));
