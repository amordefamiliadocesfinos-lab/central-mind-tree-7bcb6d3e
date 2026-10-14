import {
  hasUnverifiedFinancialIdentifier, isExplicitPixKeyRequest,
  isPixMethodChoice, requiresOfficialPixKnowledge, verifiedOfficialPixReply,
} from '../../../supabase/functions/_shared/crm/reply-financial-guard';

function assert(ok: unknown, label: string): asserts ok {
  if (!ok) throw new Error('CRM C2: ' + label);
}
const inbound = (content: string) => ({ direction: 'inbound', content });
const outbound = (content: string) => ({ direction: 'outbound', content });
for (const text of [
  'Me manda a chave Pix pfv',
  'Qual a chave PIX da loja?',
  'Qual é o PIX?',
  'Pode me informar os dados do Pix?',
  'Me passa seu pix?',
  'Qual é o número do Pix?',
]) {
  assert(isExplicitPixKeyRequest(text), 'deve reconhecer solicitação natural: ' + text);
  assert(requiresOfficialPixKnowledge([inbound(text)]), 'deve exigir KB: ' + text);
}
for (const text of ['Pagamento pix', 'Paguei com Pix', 'Aceitam pix?', 'Já fiz o Pix', 'Posso pagar por pix?', 'Qual forma de pagamento aceita Pix?', 'Me informa se aceita Pix?']) {
  assert(!isExplicitPixKeyRequest(text), 'não presumir solicitação de chave: ' + text);
}
assert(isPixMethodChoice([outbound('QUAL FORMA DE PAGAMENTO?'), inbound('Pix')]),
  'opção curta após pergunta de pagamento');
assert(requiresOfficialPixKnowledge([outbound('Aceita PIX ou cartão?'), inbound('Pix')]),
  'opção curta com oferta de meio');
assert(!requiresOfficialPixKnowledge([inbound('Pix')]),
  'Pix isolado sem contexto não promove chave');
assert(!requiresOfficialPixKnowledge([
  inbound('Qual é o Pix?'),
  outbound('Já enviei o dado oficial'),
  inbound('Obrigado'),
]), 'pergunta antiga não ressuscita depois de outbound');
assert(requiresOfficialPixKnowledge([
  inbound('Me passa a chave Pix'),
  inbound('pfv'),
]), 'bloco de perguntas pendentes continua ativo');
assert(!requiresOfficialPixKnowledge([
  inbound('Me manda a chave Pix'),
  outbound('Já encaminhei'),
]), 'operador já respondeu bloco');
assert(!hasUnverifiedFinancialIdentifier('Sim, aceitamos Pix.'),
  'explicação genérica do meio de pagamento permanece');
assert(hasUnverifiedFinancialIdentifier('PIX celular: 21987654321'),
  'identificador telefônico não validado deve bloquear modelo');
assert(hasUnverifiedFinancialIdentifier('Minha chave Pix é exemplo@teste.invalid'),
  'identificador email não validado deve bloquear modelo');
assert(hasUnverifiedFinancialIdentifier('CNPJ: 12.345.678/0001-90'),
  'CNPJ não confirmado não pode sair do modelo');
assert(hasUnverifiedFinancialIdentifier('Chave Pix: 123e4567-e89b-12d3-a456-426614174000'),
  'identificador aleatório não confirmado');
const official = {
  question: 'Qual é o PIX?', category: 'Pagamento', platformId: null,
  answer: 'PIX chave aleatória: 123e4567-e89b-12d3-a456-426614174000\nBanco de Testes',
};
assert(verifiedOfficialPixReply([official]) === official.answer,
  'uma única fonte oficial estruturada permite copiar resposta literal');
assert(verifiedOfficialPixReply([official, official]) === null,
  'duas entradas conflitantes devem falhar fechado');
assert(verifiedOfficialPixReply([{ ...official, category: 'Geral' }]) === null,
  'FAQ fora de Pagamento não constitui autoridade');
assert(verifiedOfficialPixReply([{ ...official, answer: 'PIX celular: XXXXXXXX' }]) === null,
  'placeholders não são chave verificada');
assert(verifiedOfficialPixReply([{ ...official, answer: 'PIX celular: 00000000000' }]) === null,
  'chave zerada é inválida');
assert(verifiedOfficialPixReply([{ ...official, platformId: 'plataforma-2' }], 'plataforma-1') === null,
  'fonte de outra plataforma não autoriza retorno');
console.log('replyFinancialGuard.test: OK');
