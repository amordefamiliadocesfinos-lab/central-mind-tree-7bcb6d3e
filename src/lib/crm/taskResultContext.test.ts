import { getTaskContextResultCodes } from './taskResultContext';

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

console.log('taskResultContext.test: OK');
