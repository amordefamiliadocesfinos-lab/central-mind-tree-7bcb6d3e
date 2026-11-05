import { getTaskContextResultCodes, getTaskContextQuickResultCodes } from './taskResultContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`CRM task/result context: ${message}`);
}

const postSale = getTaskContextResultCodes('Realizar pós-venda');
assert(postSale.includes('CRM-RES-023') && postSale.includes('CRM-RES-032'),
  'pós-venda deve priorizar recebimento/experiência/reposição.');
assert(!postSale.includes('CRM-RES-021'),
  'Pedido confirmado continua disponível no catálogo geral, mas não deve ser destacado como resultado típico de pós-venda.');

const objection = getTaskContextResultCodes('Tratar objeção');
assert(objection.includes('CRM-RES-010') && objection.includes('CRM-RES-016'),
  'tratamento de objeção deve priorizar a família de objeção/decisão.');

const followUp = getTaskContextResultCodes('Verificar resposta no WhatsApp');
assert(followUp.includes('CRM-RES-003') && followUp.includes('CRM-RES-022'),
  'follow-up deve priorizar silêncio e retorno combinado sem presumir fechamento.');

assert(getTaskContextResultCodes('Ação desconhecida').length === 0,
  'tarefa sem mapeamento não pode restringir nem inventar contexto.');

const postSaleQuick = getTaskContextQuickResultCodes('Realizar pós-venda');
assert(postSaleQuick.length === 4 && postSaleQuick.every(code => postSale.includes(code)),
  'atalhos de pós-venda são até 4 resultados canônicos prioritários; as demais opções permanecem disponíveis.');
const followUpQuick = getTaskContextQuickResultCodes('Verificar resposta no WhatsApp');
assert(followUpQuick.length === 4 && followUpQuick[0] === 'CRM-RES-001',
  'follow-up deve priorizar resultados pertinentes sem selecionar automaticamente.');
assert(getTaskContextQuickResultCodes('Ação desconhecida').length === 0,
  'tarefa desconhecida não pode fabricar resultados rápidos.');

console.log('taskResultContext.test: OK');
