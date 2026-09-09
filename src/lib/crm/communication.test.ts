import { buildCrmCommunicationDecision, DEFAULT_BUILDING_COMMUNICATION_PROFILE, deriveCommercialSignals } from './communication';
import type { CrmAiContext } from './aiContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`IA-02/IA-04.1: ${message}`);
}

const context = (overrides: Partial<CrmAiContext> = {}): CrmAiContext => ({
  generatedAt: new Date().toISOString(),
  contact: { id: 'c1', name: 'Cliente', stage: 'negociacao', origin: 'whatsapp', optOut: false, temperature: null },
  conversation: { id: 'v1', state: 'em_atendimento', status: 'open', needsReply: true, returnAt: null, lastInboundAt: null, lastOutboundAt: null },
  messages: [{ direction: 'inbound', sender: 'customer', content: 'Quero saber mais', createdAt: new Date().toISOString() }],
  history: [], lastResult: null, lastResultAt: null, nextAction: null, tasks: [],
  purchases: { paidOrdersCount: 0, lifetimeValue: null, lastOrders: [] }, tags: [], campaign: null,
  liveContext: null, catalogs: { results: [], nextActions: [] }, limits: { messages: 8, historyEvents: 4, tasks: 3, orders: 2 },
  ...overrides,
});

const result = { code: 'CRM-RES-001', label: 'Interesse demonstrado', confidence: 0.9, reason: 'Cliente pediu mais informações.' } as any;
const action = { nextActionCode: 'CRM-PA-001', noImmediateAction: false, chosenByAi: false, reason: 'Responder cliente.' } as any;

const decision = buildCrmCommunicationDecision(context(), result, action);
assert(decision.shouldReply && decision.responsibility === 'operator', 'inbound atual exige resposta sem gerar texto nesta camada.');
assert(decision.suggestedResult.code === 'CRM-RES-001' && decision.nextAction.code === 'CRM-PA-001', 'contrato carrega somente decisões já canônicas.');
assert(DEFAULT_BUILDING_COMMUNICATION_PROFILE.status === 'building' && DEFAULT_BUILDING_COMMUNICATION_PROFILE.approvedExamples.length === 0, 'perfil padrão permanece neutro e em construção.');

const noReply = buildCrmCommunicationDecision(context({ conversation: { id: 'v1', state: 'aguardando_cliente', status: 'open', needsReply: false, returnAt: null, lastInboundAt: null, lastOutboundAt: null } }), result, { ...action, noImmediateAction: true, nextActionCode: null });
assert(!noReply.shouldReply, 'ausência legítima de ação não gera resposta artificial.');

console.log('communication.test: OK');

function withMessage(content: string, overrides: Partial<CrmAiContext> = {}) {
  return context({ ...overrides, messages: [{ direction: 'inbound', sender: 'customer', content, createdAt: new Date().toISOString() }] as any });
}
assert(deriveCommercialSignals(withMessage('Quanto custa?'), null).commercialIntent === 'information_request', 'A: pergunta simples é dúvida, não interesse.');
assert(deriveCommercialSignals(withMessage('Quero fechar 30 unidades'), null).commercialIntent === 'interest', 'B: intenção concreta é interesse.');
assert(deriveCommercialSignals(withMessage('Achei caro'), null).commercialIntent === 'objection', 'C: barreira explícita é objeção.');
assert(deriveCommercialSignals(withMessage('Vou pensar e te retorno'), null).commercialIntent === 'deferred_decision', 'D: decisão adiada não é recusa.');
assert(deriveCommercialSignals(withMessage('Já fiz o Pix'), null).paymentState === 'informed', 'E: declaração de pagamento não confirma pagamento.');
assert(deriveCommercialSignals(withMessage('ok'), 'CRM-RES-020').paymentState === 'confirmed', 'F: somente fato canônico confirma pagamento.');
assert(deriveCommercialSignals(withMessage('Como está minha entrega?'), 'CRM-RES-023').commercialIntent === 'post_sale', 'G: conversa após compra é pós-venda.');
assert(deriveCommercialSignals(withMessage('Quero fazer novo pedido'), null).commercialIntent === 'repurchase', 'H: cliente antigo com nova intenção é recompra.');
assert(deriveCommercialSignals(withMessage('Olá'), null).commercialIntent !== 'repurchase', 'I: compra antiga sozinha não é recompra.');
assert(buildCrmCommunicationDecision(withMessage('Quanto custa?'), result, { ...action, nextActionCode: null, noImmediateAction: true }).shouldReply, 'J: inbound atual pode exigir resposta sem próxima ação.');
assert(deriveCommercialSignals(withMessage('Quero fechar 30 unidades'), null).commercialIntent === 'interest', 'K: inbound atual prevalece sobre memória antiga.');
