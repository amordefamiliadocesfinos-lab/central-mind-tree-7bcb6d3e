import { resolveCrmKnowledgeContext, shouldQueryCrmKnowledge, type CrmKnowledgeItem } from './knowledgeContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const items: CrmKnowledgeItem[] = [
  { id: '1', question: 'Quantos alfajores vêm na caixa?', answer: 'A caixa contém 12 alfajores.', category: 'produto', keywords: ['alfajor', 'caixa', 'quantidade'], platformId: null },
  { id: '2', question: 'Qual a validade da trufa?', answer: 'A validade é informada na embalagem.', category: 'produto', keywords: ['trufa', 'validade'], platformId: null },
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
  assert(a.matched && a.items[0]?.id === '1', 'A: quantidade por caixa deve encontrar item pertinente.');
  const b = await resolveCrmKnowledgeContext({ message: 'Qual é a validade da trufa?', platformId: 'whatsapp' }, fetcher);
  assert(b.matched && b.items[0]?.id === '2', 'B: validade deve encontrar item estável.');
  const c = await resolveCrmKnowledgeContext({ message: 'Manda a chave PIX', platformId: 'whatsapp' }, fetcher);
  assert(c.matched && c.items[0]?.id === '3', 'C: chave PIX deve usar item do canal atual.');
  const beforeThanks = calls;
  const d = await resolveCrmKnowledgeContext({ message: 'Obrigado!', platformId: 'whatsapp' }, fetcher);
  assert(!d.matched && calls === beforeThanks, 'D: agradecimento não deve consultar a base.');
  const e = await resolveCrmKnowledgeContext({ message: 'Tem estoque agora?', platformId: 'whatsapp' }, fetcher);
  assert(!e.matched && calls === beforeThanks, 'E: estoque dinâmico não deve consultar FAQ.');
  const f = await resolveCrmKnowledgeContext({ message: 'Quais sabores vocês têm?', platformId: 'whatsapp' }, fetcher);
  assert(!f.matched, 'F: item de outra plataforma não deve vencer item global/canal atual.');
  const g = await resolveCrmKnowledgeContext({ message: 'Qual a validade?', platformId: 'whatsapp' }, async () => { throw new Error('indisponível'); });
  assert(!g.matched, 'G: falha na consulta deve preservar fallback vazio.');
  assert(!shouldQueryCrmKnowledge('Vou pensar e te aviso.'), 'H: decisão comercial sem pergunta factual não consulta.');
  console.log('knowledgeContext.test: OK');
}

run();
