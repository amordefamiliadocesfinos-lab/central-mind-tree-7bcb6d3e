import { suggestCrmReplyFromContext, hasUnverifiedPaymentCredentials, isCrmPixKeyRequest } from './aiReplySuggestion';
import type { CrmAiContext } from './aiContext';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('CRM C2: ' + message);
}
function ctx(messages: Array<{ direction: 'inbound'|'outbound'; content: string }>): CrmAiContext {
  return {
    generatedAt: new Date().toISOString(),
    contact: { id: 'test-contact', name: 'Teste', stage: 'negociacao', origin: 'whatsapp', optOut: false } as any,
    conversation: { id: 'test-conversation', state: 'em_atendimento', status: 'open', needsReply: true, returnAt: null, lastInboundAt: null, lastOutboundAt: null } as any,
    messages: messages.map((m,i)=>({ id: 'm'+i, ...m, createdAt: new Date().toISOString() })) as any,
    history: [], lastResult: null, lastResultAt: null, nextAction: null, tasks: [],
    purchases: { paidOrdersCount: 0, lifetimeValue: null, lastOrders: [] },
    tags: [], campaign: null, catalogs: { results: [], nextActions: [] },
    limits: { messages: 15, historyEvents: 8, tasks: 3, orders: 3 },
  } as CrmAiContext;
}
const inbound = (content: string) => ({ direction: 'inbound' as const, content });
const outbound = (content: string) => ({ direction: 'outbound' as const, content });
async function run() {
  const phrases = ['Me manda a chave Pix pfv', 'Qual é o Pix?', 'Pode passar os dados do Pix?', 'Qual a chave para pagar via Pix?'];
  for (const phrase of phrases) {
    const context = ctx([inbound(phrase)]);
    assert(isCrmPixKeyRequest(context.messages), 'pedido natural reconhecido: '+phrase);
    let modelCalls = 0;
    const options = {
      knowledgeFetcher: async () => [{
        id: 'official-pix', question: 'Qual é o PIX?',
        answer: 'PIX celular: 51981204596\\nEmpresa Exemplo\\nBanco Exemplo',
        category: 'Pagamento', keywords: ['pix'], platformId: null,
      }],
      invoke: async () => { modelCalls++; return { suggested_reply: 'Chave inventada' }; },
    };
    const answer = await suggestCrmReplyFromContext(context, options);
    assert(answer.reply?.includes('51981204596') && modelCalls===0, 'chave apenas da fonte oficial: '+phrase);
    const missing = await suggestCrmReplyFromContext(context, {...options, knowledgeFetcher:async()=>[]});
    assert(missing.reply===null && modelCalls===0, 'falta de fonte bloqueia modelo: '+phrase);
  }
  const pixChoice = ctx([outbound('QUAL FORMA DE PAGAMENTO?'), inbound('Pix')]);
  assert(isCrmPixKeyRequest(pixChoice.messages), 'escolha curta Pix preservada');
  assert(!isCrmPixKeyRequest(ctx([inbound('Já fiz o pix, segue comprovante')]).messages), 'comprovante não é pedido de chave');
  assert(!isCrmPixKeyRequest(ctx([inbound('Pix')]).messages), 'Pix isolado sem pergunta não é solicitação de chave');
  const ambiguity = await suggestCrmReplyFromContext(ctx([inbound('Me manda a chave Pix')]), {
    knowledgeFetcher: async () => [
      { id: 'a', question: 'Qual é o PIX?', answer: 'Pix celular: 51981204596', category: 'Pagamento', keywords: [], platformId: null },
      { id: 'b', question: 'Qual é o PIX?', answer: 'Pix celular: 51999999999', category: 'Pagamento', keywords: [], platformId: null },
    ],
    invoke: async () => { throw Error('modelo não pode ser chamado'); },
  });
  assert(ambiguity.reply===null, 'duplicidade de fontes bloqueia');
  assert(hasUnverifiedPaymentCredentials('Pode transferir para a chave Pix 51988887777 agora.'), 'identificador numérico bloqueado');
  const generated = await suggestCrmReplyFromContext(ctx([inbound('Olá')]), {
    invoke: async () => ({ suggested_reply: 'Pode transferir para a chave Pix 51988887777 agora.' }),
  });
  assert(generated.reply===null, 'chave livre bloqueada');
  const normal = await suggestCrmReplyFromContext(ctx([inbound('Bom dia, tudo bem?')]), {
    invoke: async () => ({ suggested_reply: 'Bom dia! Como posso ajudar?' }),
  });
  assert(normal.reply?.includes('Bom dia'), 'resposta normal preservada');
  console.log('crmPaymentSafety.test: OK');
}
await run();
