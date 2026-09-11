import { resolveCrmKnowledgeContext, shouldQueryCrmKnowledge, type CrmKnowledgeItem } from './knowledgeContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const items: CrmKnowledgeItem[] = [
  { id: '1', question: 'Quantos alfajores vêm em cada bandeja?', answer: 'Cada bandeja de Alfajor 60g contém 18 unidades.', category: 'produto', keywords: ['alfajor', 'bandeja', 'quantidade', '18 unidades'], platformId: null },
  { id: '2', question: 'Qual a validade da Trufa 30g?', answer: 'A Trufa 30g tem validade de 60 dias.', category: 'produto', keywords: ['trufa', '30g', 'validade'], platformId: null },
  { id: '5', question: 'Qual a validade da Trufa 40g?', answer: 'A Trufa 40g tem validade de 60 dias.', category: 'produto', keywords: ['trufa', '40g', 'validade'], platformId: null },
  { id: '6', question: 'Qual a validade do Alfajor 60g?', answer: 'O Alfajor 60g tem validade de 45 dias.', category: 'produto', keywords: ['alfajor', '60g', 'validade'], platformId: null },
  { id: '7', question: 'Qual a validade do Chocoim?', answer: 'O Chocoim 34g tem validade de 60 dias.', category: 'produto', keywords: ['chocoim', 'validade', '34g'], platformId: null },
  { id: '8', question: 'Onde posso retirar meu pedido?', answer: 'Estr. Fernando Ferrari, 1300 - Vila Imperial\nParada 107 de Gravataí\nGravataí - RS\nCEP 94130-220', category: 'retirada', keywords: ['endereço', 'retirada', 'fábrica', 'gravataí'], platformId: null },
  { id: '3', question: 'Vocês aceitam PIX?', answer: 'Aceitamos PIX.', category: 'pagamento', keywords: ['pix', 'chave pix'], platformId: 'whatsapp' },
  { id: '4', question: 'Sabores disponíveis', answer: 'Consulte os sabores cadastrados.', category: 'produto', keywords: ['sabores'], platformId: 'instagram' },
];

async function run() {
  let calls = 0;
  const fetcher = async (platformId?: string | null) => {
    calls += 1;
    return items.filter(item => !item.platformId || item.platformId === platformId);
  };
  const a = await resolveCrmKnowledgeContext({ message: 'Quantos alfajores vêm na caixa?', platformId: 'whatsapp' }, fetcher);
  assert(a.matched && a.items[0]?.id === '1' && a.authoritativeAnswer?.includes('18 unidades'), 'A: quantidade por caixa deve usar 18 unidades.');
  const b = await resolveCrmKnowledgeContext({ message: 'Qual é a validade da Trufa 30g?', platformId: 'whatsapp' }, fetcher);
  assert(b.matched && b.items[0]?.id === '2' && b.authoritativeAnswer?.includes('60 dias'), 'B: Trufa 30g deve usar 60 dias.');
  const b2 = await resolveCrmKnowledgeContext({ message: 'Qual a validade do Alfajor?', platformId: 'whatsapp' }, fetcher);
  assert(b2.items[0]?.id === '6' && b2.authoritativeAnswer?.includes('45 dias'), 'B2: Alfajor deve usar 45 dias.');
  const b3 = await resolveCrmKnowledgeContext({ message: 'Qual a validade do Chocoim?', platformId: 'whatsapp' }, fetcher);
  assert(b3.items[0]?.id === '7' && b3.authoritativeAnswer?.includes('60 dias'), 'B3: Chocoim deve usar 60 dias.');
  const b4 = await resolveCrmKnowledgeContext({ message: 'Qual o endereço para retirada?', platformId: 'whatsapp' }, fetcher);
  assert(b4.authoritativeAnswer?.includes('Estr. Fernando Ferrari') && b4.authoritativeAnswer?.includes('CEP 94130-220'), 'B4: retirada deve informar o endereço completo.');
  const b5 = await resolveCrmKnowledgeContext({ message: 'Qual a validade do Chocoim, quantos alfajores vêm por bandeja e qual o endereço para retirada?', platformId: 'whatsapp' }, fetcher);
  assert(b5.authoritativeAnswer?.includes('60 dias') && b5.authoritativeAnswer?.includes('18 unidades') && b5.authoritativeAnswer?.includes('Estr. Fernando Ferrari'), 'B5: múltiplas perguntas devem combinar os fatos recuperados.');
  const c = await resolveCrmKnowledgeContext({ message: 'Manda a chave PIX', platformId: 'whatsapp' }, fetcher);
  assert(c.matched && c.items[0]?.id === '3', 'C: chave PIX deve usar item do canal atual.');
  const beforeThanks = calls;
  const d = await resolveCrmKnowledgeContext({ message: 'Obrigado!', platformId: 'whatsapp' }, fetcher);
  assert(!d.matched && calls === beforeThanks, 'D: agradecimento não deve consultar a base.');
  const e = await resolveCrmKnowledgeContext({ message: 'Tem estoque agora?', platformId: 'whatsapp' }, fetcher);
  assert(!e.matched && calls === beforeThanks, 'E: estoque dinâmico não deve consultar FAQ.');
  const f = await resolveCrmKnowledgeContext({ message: 'Quais sabores vocês têm?', platformId: 'whatsapp' }, fetcher);
  assert(f.items.every(item => item.id !== '4'), 'F: item de outra plataforma não deve entrar na resposta.');
  const g = await resolveCrmKnowledgeContext({ message: 'Qual a validade?', platformId: 'whatsapp' }, async () => { throw new Error('indisponível'); });
  assert(!g.matched, 'G: falha na consulta deve preservar fallback vazio.');
  assert(!shouldQueryCrmKnowledge('Vou pensar e te aviso.'), 'H: decisão comercial sem pergunta factual não consulta.');
  console.log('knowledgeContext.test: OK');
}

run();
