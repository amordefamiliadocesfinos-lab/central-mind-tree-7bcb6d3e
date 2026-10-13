import { prepareExternalWhatsAppDraft } from './externalWhatsAppPreparation';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`CRM F0-A: ${message}`);
}

const calls: Array<{ phone: string; text: string }> = [];
const prepared = prepareExternalWhatsAppDraft('5551999999999', 'Texto sugerido', (phone, text) => {
  calls.push({ phone, text });
  return true;
});
assert(prepared === 'opened_unconfirmed', 'Abrir WhatsApp não é confirmação de envio.');
assert(calls.length === 1 && calls[0].phone === '5551999999999'
  && calls[0].text === 'Texto sugerido',
  'A preparação deve abrir exatamente uma vez com o rascunho correto.');

let attemptCount = 0;
const blocked = prepareExternalWhatsAppDraft('5551888888888', 'Outra sugestão', () => {
  attemptCount += 1;
  return false;
});
assert(blocked === 'blocked' && attemptCount === 1,
  'Popup bloqueado não pode ser registrado como mensagem preparada/enviada.');
assert(!('sent' === prepared) && !('sent' === blocked),
  'Nenhum retorno do opener equivale a envio ou entrega confirmado.');

console.log('externalWhatsAppPreparation.test: OK');
