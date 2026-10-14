import { suggestCrmReplyFromContext } from './aiReplySuggestion';
import type { CrmAiContext } from './aiContext';

const assert = (yes: unknown, message: string): asserts yes => {
  if (!yes) throw new Error('CRM C2 integração: ' + message);
};
const inbound = (content: string) => ({ id: 'inbound', direction: 'inbound' as const, content, createdAt: '2026-10-14T19:00:00Z' });
const outbound = (content: string) => ({ id: 'outbound', direction: 'outbound' as const, content, createdAt: '2026-10-14T18:00:00Z' });
function context(messages: Array<ReturnType<typeof inbound> | ReturnType<typeof outbound>>): CrmAiContext {
  return {
    generatedAt: new Date().toISOString(),
    contact: { id: 'contato-c2', name: 'Contato', stage: 'negociacao', origin: 'whatsapp', optOut: false } as any,
    conversation: { id: 'conv-c2', state: 'em_atendimento', status: 'open',
      needsReply: true, platformId: null, lastInboundAt: null, lastOutboundAt: null } as any,
    messages, history: [], lastResult: null, lastResultAt: null, nextAction: null,
    tasks: [], purchases: { paidOrdersCount: 0, lifetimeValue: null, lastOrders: [] },
    tags: [], campaign: null, catalogs: { results: [], nextActions: [] },
    limits: { messages: 15, historyEvents: 8, tasks: 3, orders: 3 } as any,
  } as CrmAiContext;
}
const official = [{
  id: 'test-pix-unique', question: 'Qual é o PIX?',
  answer: 'PIX chave aleatória: 123e4567-e89b-12d3-a456-426614174000\nBanco de Testes',
  category: 'Pagamento', keywords: ['pix', 'chave'], platformId: null,
}];
async function run() {
  for(const input of [
    [inbound('Me manda a chave Pix pfv')],
    [inbound('Qual é a chave Pix da loja?')],
    [inbound('Pode me informar os dados do Pix?')],
    [outbound('QUAL FORMA DE PAGAMENTO?'), inbound('Pix')],
    [inbound('Me passa a chave Pix'), inbound('pfv')],
  ]) {
    let invoked = false;
    const reply = await suggestCrmReplyFromContext(context(input), {
      knowledgeFetcher: async () => official,
      invoke: async () => { invoked = true; return { suggested_reply: 'Pix inventado' }; },
    });
    assert(reply.reply === official[0].answer && !invoked,
      'chave só pode vir da entrada Pix oficial, sem invocar modelo');
  }
  let invoked = false;
  const missing = await suggestCrmReplyFromContext(context([inbound('Me manda chave Pix pfv')]), {
    knowledgeFetcher: async () => [],
    invoke: async () => { invoked = true; return { suggested_reply: 'PIX celular: 21987654321' }; },
  });
  assert(!invoked && missing.reply === null,
    'sem fonte oficial, bloquear resposta sem fallback livre');
  const duplicate = await suggestCrmReplyFromContext(context([inbound('Qual o pix?')]), {
    knowledgeFetcher: async () => [...official, { ...official[0], id: 'duplicate' }],
    invoke: async () => { invoked = true; return { suggested_reply: 'Pix inventado' }; },
  });
  assert(!invoked && duplicate.reply === null, 'fonte duplicada bloqueia');
  const fetchedError = await suggestCrmReplyFromContext(context([inbound('Me manda a chave pix')]), {
    knowledgeFetcher: async () => { throw new Error('KB indisponível'); },
    invoke: async () => { invoked = true; return { suggested_reply: 'Pix inventado' }; },
  });
  assert(!invoked && fetchedError.reply === null, 'falha da KB bloqueia');
  const paidHistory = await suggestCrmReplyFromContext(context([
    inbound('Me manda a chave Pix'), outbound('Já encaminhei a chave oficial'), inbound('Obrigado.'),
  ]), {
    knowledgeFetcher: async () => official,
    invoke: async () => ({ suggested_reply: 'Por nada!' }),
  });
  assert(paidHistory.reply === 'Por nada!', 'não ressuscitar Pix de pergunta anterior respondida');
  const unrelated = await suggestCrmReplyFromContext(context([inbound('Pix')]), {
    invoke: async () => ({ suggested_reply: 'Você quer pagar por Pix?' }),
  });
  assert(unrelated.reply === 'Você quer pagar por Pix?',
    'Pix isolado sem pergunta anterior não promove chave');
  const fake = await suggestCrmReplyFromContext(context([inbound('Pode me ajudar?')]), {
    invoke: async () => ({ suggested_reply: 'PIX celular: 21987654321' }),
  });
  assert(fake.reply === null, 'identificador não oficial gerado pelo modelo é bloqueado');
  const faqInjection = await suggestCrmReplyFromContext(context([inbound('Quais formas de pagamento?')]), {
    knowledgeFetcher: async () => [{
      id: 'faq-pagamento', question: 'Quais formas de pagamento?',
      answer: 'A chave Pix é exemplo@teste.invalid', category: 'Pagamento',
      keywords: ['formas de pagamento'], platformId: null,
    }],
    invoke: async () => ({ suggested_reply: 'Sem acesso' }),
  });
  assert(faqInjection.reply === null, 'ranking FAQ genérico não pode inserir chave não validada');
  console.log('financialReplyIntegration.test: OK');
}
await run();
