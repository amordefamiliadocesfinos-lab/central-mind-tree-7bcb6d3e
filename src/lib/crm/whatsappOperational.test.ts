import { getWhatsAppContactUrl, isMetaCustomerServiceWindowOpen } from './whatsappOperational';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`CRM WhatsApp operacional: ${message}`);
}

const now = Date.parse('2026-09-21T18:00:00.000Z');

assert(
  isMetaCustomerServiceWindowOpen('2026-09-20T18:00:00.000Z', now),
  'exatamente 24h ainda pertence à janela de atendimento.',
);
assert(
  !isMetaCustomerServiceWindowOpen('2026-09-20T17:59:59.999Z', now),
  'mais de 24h deve bloquear mensagem livre.',
);
assert(!isMetaCustomerServiceWindowOpen(null, now), 'sem inbound não há janela livre comprovada.');
assert(!isMetaCustomerServiceWindowOpen('inválido', now), 'timestamp inválido não pode liberar envio.');

assert(
  getWhatsAppContactUrl('(51) 99999-8888') === 'https://wa.me/5551999998888',
  'telefone brasileiro sem DDI deve receber 55.',
);
assert(
  getWhatsAppContactUrl('+55 51 99999-8888') === 'https://wa.me/5551999998888',
  'telefone já normalizado não pode duplicar o DDI.',
);
assert(getWhatsAppContactUrl(null) === null, 'contato sem telefone não deve gerar URL.');

console.log('whatsappOperational.test: OK');
