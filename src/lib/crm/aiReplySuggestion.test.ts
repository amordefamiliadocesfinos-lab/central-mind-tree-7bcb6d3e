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

  // G. Opt-out + inbound recente → pode sugerir resposta.
  const g = await suggestCrmReplyFromContext(
    context({ contact: { id: 'c1', name: 'Amor', stage: 'perdido', optOut: true } as any }, [inbound('Preciso da segunda via da nota')]),
    { invoke: stub({ suggested_reply: 'Claro, já te envio a segunda via.', reason: 'Resposta ao inbound do cliente.' }) },
  );
  assert(g.reply?.includes('segunda via'), 'G: opt-out com inbound pode responder.');

  // H/I. Normalização nunca envia mensagem nem inventa texto.
  const empty = normalizeReplyResponse({ suggested_reply: '   ', reason: '' });
  assert(empty.reply === null, 'H/I: resposta vazia vira null; nada é enviado automaticamente.');
}

run().then(() => console.log('aiReplySuggestion.test: OK'));
