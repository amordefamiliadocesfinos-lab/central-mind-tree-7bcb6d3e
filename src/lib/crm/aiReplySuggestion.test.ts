import { suggestCrmReplyFromContext, normalizeReplyResponse } from './aiReplySuggestion';
import type { CrmAiContext } from './aiContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FRENTE 4.4 — Resposta sugerida: ${message}`);
}

function context(overrides: Partial<CrmAiContext> = {}, messages: any[] = []): CrmAiContext {
  return {
    generatedAt: new Date().toISOString(),
    contact: { id: 'c1', name: 'Amor', stage: 'negociacao', origin: 'whatsapp', optOut: false, temperature: 'quente' } as any,
    conversation: { id: 'conv1', state: 'em_atendimento', status: 'open', needsReply: true, returnAt: null, lastInboundAt: null, lastOutboundAt: null } as any,
    messages: messages as any,
    history: [], lastResult: null, lastResultAt: null, nextAction: null, tasks: [],
    purchases: { paidOrdersCount: 0, lifetimeValue: null, lastOrders: [] },
    tags: [], campaign: null,
    catalogs: { results: [], nextActions: [] },
    limits: { messages: 15, historyEvents: 8, tasks: 3, orders: 3 } as any,
    ...overrides,
  } as CrmAiContext;
}

const inbound = (content: string) => ({ id: 'm1', direction: 'inbound', content, createdAt: new Date().toISOString() });
const outbound = (content: string) => ({ id: 'm2', direction: 'outbound', content, createdAt: new Date().toISOString() });

async function run() {
  let lastPayload: any = null;
  const stub = (response: any) => async (payload: unknown) => { lastPayload = payload; return response; };

  // A. Cliente demonstra interesse → resposta coerente que avança a conversa.
  const a = await suggestCrmReplyFromContext(
    context({}, [inbound('Gostei! Como faço para comprar?')]),
    { result: { code: 'CRM-RES-002', label: 'Interesse demonstrado' }, invoke: stub({ suggested_reply: 'Que ótimo! Posso já reservar o seu pedido.', reason: 'Avançar', tone: 'consultivo' }) },
  );
  assert(a.reply && a.reply.length > 0, 'A: deve sugerir resposta com interesse demonstrado.');
  assert((lastPayload as any).mode === 'reply', 'A: deve usar o modo reply do crm-ai-assistant.');
  assert((lastPayload as any).context === undefined || (lastPayload as any).context.contact.id === 'c1', 'A: deve enviar o CrmAiContext.');

  // B. Cliente vai analisar → sem pressão indevida (respeita a IA e o contexto).
  const b = await suggestCrmReplyFromContext(
    context({}, [inbound('Vou analisar e te falo.')]),
    { result: { code: 'CRM-RES-008', label: 'Proposta em análise' }, invoke: stub({ suggested_reply: 'Claro, fico à disposição. Qualquer dúvida é só chamar.', reason: 'Sem pressão' }) },
  );
  assert(b.reply?.includes('disposição'), 'B: resposta deve ser sem pressão.');
  assert(lastPayload.result.code === 'CRM-RES-008', 'B: Resultado deve ir no payload.');

  // C. Pagamento confirmado → resposta coerente com próximo passo.
  const c = await suggestCrmReplyFromContext(
    context({}, [inbound('Fiz o pix agora')]),
    {
      result: { code: 'CRM-RES-020', label: 'Pagamento confirmado' },
      nextAction: { nextActionCode: null, nextActionLabel: null },
      invoke: stub({ suggested_reply: 'Pagamento confirmado! Já entrou na produção.', reason: 'Reconhecer e orientar' }),
    },
  );
  assert(c.reply && lastPayload.nextAction.code === null, 'C: ausência de próxima ação deve ser transmitida.');

  // D. Campanha respondida → contexto de campanha vai no payload.
  const d = await suggestCrmReplyFromContext(
    context({ campaign: { campaignId: 'x', campaignName: 'TESTE CAMPANHA 03', sentAt: '2026-08-30', responded: true } as any }, [inbound('Oi, vi a promoção')]),
    { invoke: stub({ suggested_reply: 'Oi! Que bom que viu nossa novidade.', reason: 'Campanha' }) },
  );
  assert(d.reply && lastPayload.context.campaign?.campaignName === 'TESTE CAMPANHA 03', 'D: contexto de campanha deve ser enviado.');

  // E. Aguardando cliente (último outbound) → pode retornar null.
  const e = await suggestCrmReplyFromContext(
    context({}, [outbound('Enviei os valores, qualquer coisa me chama.')]),
    { invoke: stub({ suggested_reply: null, reason: 'Aguardando retorno do cliente.' }) },
  );
  assert(e.reply === null, 'E: deve poder retornar null aguardando cliente.');

  // F. Opt-out sem inbound → null sem sequer chamar a IA.
  lastPayload = null;
  const f = await suggestCrmReplyFromContext(
    context({ contact: { id: 'c1', name: 'Amor', stage: 'perdido', optOut: true } as any }, [outbound('Tudo bem?')]),
    { invoke: stub({ suggested_reply: 'Aproveite nossa promoção!', reason: 'x' }) },
  );
  assert(f.reply === null && lastPayload === null, 'F: opt-out sem inbound deve bloquear localmente.');

  // F.1 A decisão canônica deve bloquear antes de qualquer FAQ ou gateway.
  lastPayload = null;
  const decisionBlocked = await suggestCrmReplyFromContext(
    context({}, [inbound('Pode me passar mais detalhes?')]),
    {
      decision: { shouldReply: false, reason: 'Atendimento encerrado.', decisionState: 'closed' } as any,
      invoke: stub({ suggested_reply: 'não pode ser chamado' }),
    },
  );
  assert(decisionBlocked.reply === null && lastPayload === null, 'F.1: shouldReply=false deve retornar null sem chamar reply.');

  // G. Opt-out + inbound recente → pode sugerir resposta.
  const g = await suggestCrmReplyFromContext(
    context({ contact: { id: 'c1', name: 'Amor', stage: 'perdido', optOut: true } as any }, [inbound('Preciso da segunda via da nota')]),
    { invoke: stub({ suggested_reply: 'Claro, já te envio a segunda via.', reason: 'Resposta ao inbound do cliente.' }) },
  );
  assert(g.reply?.includes('segunda via'), 'G: opt-out com inbound pode responder.');

  // H. Fato FAQ forte bypassa a IA: dez execuções devem permanecer idênticas.
  const faqItems = [
    { id: 'chocoim', question: 'Qual a validade do Chocoim?', answer: 'O Chocoim 34g tem validade de 60 dias, quando armazenado corretamente.', category: 'Validade', keywords: ['chocoim', 'validade', '34g'], platformId: null },
    { id: 'alfajor', question: 'Quantos alfajores vêm em cada bandeja?', answer: 'Cada bandeja de Alfajor 60g contém 18 unidades.', category: 'Produtos', keywords: ['alfajor', 'bandeja', 'quantidade', '18 unidades'], platformId: null },
    { id: 'retirada', question: 'Onde posso retirar meu pedido?', answer: 'Estr. Fernando Ferrari, 1300 - Vila Imperial\nParada 107 de Gravataí\nGravataí - RS\nCEP 94130-220', category: 'Retirada', keywords: ['endereço', 'retirada', 'fábrica', 'gravataí'], platformId: null },
    { id: 'dados-envio', question: 'Quais dados preciso mandar para envio?', answer: 'Precisamos dos dados para envio:\n\nNome completo:\nTelefone:\nE-mail:\nCPF:\nEndereço completo:\nCEP:\nComplemento (se houver):\nAlguma observação na sua entrega?', category: 'Entrega', keywords: ['dados para envio', 'envio', 'cpf', 'endereço'], platformId: null },
    { id: 'uber', question: 'Como funciona a entrega por Uber?', answer: 'Para entrega por Uber, o cliente pode solicitar o serviço para acompanhar a entrega.', category: 'Entrega', keywords: ['uber', 'motorista', 'entrega'], platformId: null },
    { id: 'frete', question: 'Como calculam o frete?', answer: 'Para calcular o frete, precisamos dos produtos, quantidades e CEP.', category: 'Entrega', keywords: ['frete', 'cep', 'quantidade'], platformId: null },
  ];
  const factualCases = [
    ['Qual a validade do Chocoim?', '60 dias'],
    ['Quantos alfajores vêm por bandeja?', '18 unidades'],
    ['Qual o endereço para retirada?', 'CEP 94130-220'],
    ['Qual a validade do Chocoim, quantos alfajores vêm por bandeja e qual o endereço para retirada?', 'Estr. Fernando Ferrari'],
  ] as const;
  for (const [question, expected] of factualCases) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      let invoked = false;
      const factual = await suggestCrmReplyFromContext(context({}, [inbound(question)]), {
        knowledgeFetcher: async () => faqItems,
        invoke: async () => { invoked = true; return { suggested_reply: 'X dias' }; },
      });
      assert(factual.reply?.includes(expected), `H: ${question} deve manter ${expected} na execução ${attempt + 1}.`);
      assert(!invoked, `H: FAQ factual não deve chamar geração livre na execução ${attempt + 1}.`);
      assert(!/\b(?:X dias|Y unidades|\[endereço\])\b/i.test(factual.reply ?? ''), 'H: resposta factual não pode conter placeholder.');
    }
  }

  // I. Perguntas factuais consecutivas, sem outbound entre elas, formam um
  // único bloco pendente e devem retornar os três fatos solicitados.
  const pendingBlock = await suggestCrmReplyFromContext(context({}, [
    inbound('Qual a validade do Chocoim?'),
    inbound('Quantos alfajores vêm por bandeja?'),
    inbound('Qual o endereço para retirada?'),
  ]), { knowledgeFetcher: async () => faqItems, invoke: async () => ({ suggested_reply: 'não deve chamar' }) });
  assert(pendingBlock.reply?.includes('60 dias') && pendingBlock.reply?.includes('18 unidades') && pendingBlock.reply?.includes('Estr. Fernando Ferrari'), 'I: três perguntas consecutivas devem combinar os três fatos pendentes.');
  assert(!pendingBlock.reply?.includes('Precisamos dos dados para envio'), 'I: endereço para retirada não pode promover formulário de envio.');

  // J/K. Endereço e dados para envio são temas próximos, porém cada resposta
  // só aparece quando a pergunta correspondente foi feita explicitamente.
  const addressOnly = await suggestCrmReplyFromContext(context({}, [inbound('Qual endereço para retirada?')]), { knowledgeFetcher: async () => faqItems, invoke: async () => ({}) });
  assert(addressOnly.reply?.includes('Estr. Fernando Ferrari') && !addressOnly.reply?.includes('Precisamos dos dados para envio'), 'J: retirada deve retornar somente o endereço.');
  const shippingData = await suggestCrmReplyFromContext(context({}, [inbound('Quais dados preciso mandar para envio?')]), { knowledgeFetcher: async () => faqItems, invoke: async () => ({}) });
  assert(shippingData.reply?.includes('Precisamos dos dados para envio') && shippingData.reply?.includes('CPF:'), 'K: dados para envio deve retornar o formulário.');

  // L. Pergunta já coberta por outbound e problema encerrado não podem trazer
  // FAQ antiga de volta; uma nova pergunta explícita continua funcionando.
  const resolvedUber = await suggestCrmReplyFromContext(context({}, [
    inbound('Como funciona a entrega por Uber?'),
    outbound('Para entrega por Uber, o cliente pode solicitar o serviço para acompanhar a entrega.'),
    inbound('Resolvido, obrigada.'),
  ]), { knowledgeFetcher: async () => faqItems, invoke: async () => ({ suggested_reply: null }) });
  assert(resolvedUber.reply === null, 'L: problema de entrega resolvido não deve ressuscitar FAQ Uber.');
  const newQuestionOnly = await suggestCrmReplyFromContext(context({}, [
    inbound('Como funciona a entrega por Uber?'),
    outbound('Para entrega por Uber, o cliente pode solicitar o serviço para acompanhar a entrega.'),
    inbound('Como retiro?'),
  ]), { knowledgeFetcher: async () => faqItems, invoke: async () => ({}) });
  assert(newQuestionOnly.reply?.includes('Estr. Fernando Ferrari') && !newQuestionOnly.reply?.includes('Uber'), 'L: pergunta nova deve responder somente o fato atual.');
  const freight = await suggestCrmReplyFromContext(context({}, [inbound('Como calculam o frete?')]), { knowledgeFetcher: async () => faqItems, invoke: async () => ({}) });
  assert(freight.reply?.includes('produtos, quantidades e CEP'), 'L: frete deve retornar sua regra de cálculo.');
  const closedDecision = await suggestCrmReplyFromContext(context({}, [inbound('Como funciona a entrega por Uber?')]), {
    decision: { situation: 'resolvido', perceivedIntent: null, responsibility: 'customer', suggestedResult: { code: null, confidence: 1 }, nextAction: { code: null, source: 'none' }, shouldReply: false, ambiguity: 'none', riskFlags: ['no_immediate_action'], reason: 'Problema resolvido.', commercialIntent: 'unknown', decisionState: 'closed', paymentState: 'none' },
    knowledgeFetcher: async () => faqItems,
    invoke: async () => ({ suggested_reply: null }),
  });
  assert(closedDecision.reply === null, 'L: decisão encerrada não deve usar FAQ histórica.');

  // M. Normalização nunca envia mensagem nem inventa texto.
  const empty = normalizeReplyResponse({ suggested_reply: '   ', reason: '' });
  assert(empty.reply === null, 'H/I: resposta vazia vira null; nada é enviado automaticamente.');
}

run().then(() => console.log('aiReplySuggestion.test: OK'));
