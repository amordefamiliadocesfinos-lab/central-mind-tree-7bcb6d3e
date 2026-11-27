import { getResultConfirmationContext } from './resultConfirmationContext';
import { CRM_CANONICAL_RESULTS } from './canonical/results';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`CRM UX U2: ${message}`);
}

for (const result of CRM_CANONICAL_RESULTS) {
  const context = getResultConfirmationContext(result.code, 'P1 Registrar resultado');
  assert(Boolean(context), `contexto ausente para ${result.code}`);
  assert(Boolean(context?.evidence && context.consequence && context.warning),
    `campos de orientação incompletos para ${result.code}`);
}
assert(getResultConfirmationContext('CRM-RES-003')?.warning.includes('não significa sem interesse'),
  'silêncio não pode virar recusa');
assert(getResultConfirmationContext('CRM-RES-019')?.warning.includes('não equivale a pagamento confirmado'),
  'informação de pagamento não prova recebimento');
assert(getResultConfirmationContext('CRM-RES-021')?.warning.includes('não cria Pedido'),
  'resultado comercial não cria pedido');
assert(getResultConfirmationContext('CRM-RES-022')?.warning.includes('acordo real'),
  'retorno exige compromisso real');
assert(getResultConfirmationContext('CRM-RES-033')?.warning.includes('opt-out canônico'),
  'pedido de não contato preserva opt-out');
assert(getResultConfirmationContext('CRM-RES-001')?.evidence.includes('abertura comercial real'),
  'uso deve preservar a descrição canônica');
console.log('resultConfirmationContext.test: OK');
