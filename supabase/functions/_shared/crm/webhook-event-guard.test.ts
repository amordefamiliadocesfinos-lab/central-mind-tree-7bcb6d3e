import { decideCrmWebhookConversationEffect as decide } from './webhook-event-guard.ts';

function assert(condition: unknown, reason: string) {
  if (!condition) throw new Error('webhook-event-guard: ' + reason);
}

const snapshot = {
  last_message_at: '2026-11-04T10:00:00.000Z',
  last_inbound_at: '2026-11-04T09:00:00.000Z',
  last_outbound_at: '2026-11-04T10:00:00.000Z',
  status: 'open',
  resolved_at: null,
};
const input = (overrides: Partial<Parameters<typeof decide>[0]> = {}) =>
  decide({ direction: 'inbound', occurredAt: '2026-11-04T10:01:00Z', messageType: 'text', snapshot, ...overrides });

assert(!input({ messageType: 'reaction' }).apply, 'reação não reabre conversa');
assert(!input({ duplicateMessage: true }).apply, 'mensagem duplicada não reabre conversa');
assert(input({ messageType: 'audio' }).apply, 'áudio real do cliente continua acionável');
assert(input({ messageType: 'image' }).apply, 'imagem real do cliente continua acionável');
assert(input({ messageType: 'document' }).apply, 'documento real continua acionável');
assert(input({ occurredAt: '2026-11-04T09:59:00Z' }).reason === 'stale_message',
  'inbound atrasado não desfaz outbound posterior');
assert(input({ direction: 'outbound', occurredAt: '2026-11-04T09:59:00Z' }).reason === 'stale_message',
  'eco outbound antigo não apaga resposta atual');
assert(input({ occurredAt: '2026-11-04T10:00:00Z' }).apply,
  'mensagens diferentes no mesmo segundo são permitidas');
assert(!input({ occurredAt: 'inválido' }).apply, 'horário inválido não autoriza gravação');
const resolved = { ...snapshot, status: 'resolved', resolved_at: '2026-11-04T10:05:00.000Z' };
assert(!input({ snapshot: resolved, occurredAt: '2026-11-04T10:02:00Z' }).apply,
  'evento anterior à conclusão não pode reabrir atendimento');
assert(input({ snapshot: resolved, occurredAt: '2026-11-04T10:06:00Z' }).apply,
  'nova mensagem real após conclusão reabre normalmente');
console.log('webhook-event-guard.test: OK');
