import { hasCrmUnansweredInbound, resolveCrmCanonicalReplyState } from './pendingReply';
import { getCrmPriority } from './priority';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`CRM C1: ${message}`);
}
const before = '2026-10-14T15:36:00Z';
const after = '2026-10-14T15:39:00Z';
// C1-A: cliente pergunta preço / registra interesse ANTES de resposta.
const customerWaiting = { needsReply: true, lastInboundAt: after, lastOutboundAt: before };
const interest = resolveCrmCanonicalReplyState({
  timeline: customerWaiting, resolvesConversation: false,
  waitingForCustomer: false, hasReturnAt: false,
});
assert(interest.needsReply && interest.attendanceState === 'em_atendimento',
  'Interesse demonstrado não consome obrigação de responder (P0 preservado)');
const priorityAfterResult = getCrmPriority({
  status: 'open',
  needs_reply: interest.needsReply,
  attendance_state: interest.attendanceState,
  last_inbound_at: customerWaiting.lastInboundAt,
  last_outbound_at: customerWaiting.lastOutboundAt,
  last_message_at: customerWaiting.lastInboundAt,
  last_result_at: '2026-10-14T15:40:00Z',
}, new Date('2026-10-14T15:41:00Z'));
assert(priorityAfterResult.level === 'P0' && priorityAfterResult.reason === 'needs_reply',
  'Resultado mantém P0 até a mensagem de saída realmente ocorrer');

// Corrige flag legada falsamente negativa se a entrada é posterior à saída.
assert(hasCrmUnansweredInbound({ ...customerWaiting, needsReply: false }),
  'inbound recente supera needs_reply=false desatualizado');

// C1-B: uma saída confirmada após entrada permite desmarcar a pendência.
const answered = resolveCrmCanonicalReplyState({
  timeline: { needsReply: true, lastInboundAt: before, lastOutboundAt: after },
  resolvesConversation: false, waitingForCustomer: true, hasReturnAt: false,
});
assert(!answered.needsReply && answered.attendanceState === 'aguardando_cliente',
  'resposta efetiva devolve iniciativa ao cliente, não mantém P0 indevido');

const scheduled = resolveCrmCanonicalReplyState({
  timeline: customerWaiting, resolvesConversation: false, waitingForCustomer: true, hasReturnAt: true,
});
assert(scheduled.needsReply && scheduled.attendanceState === 'em_atendimento',
  'retorno futuro não esconde mensagem nova ainda pendente');

const closed = resolveCrmCanonicalReplyState({
  timeline: customerWaiting, resolvesConversation: true, waitingForCustomer: true, hasReturnAt: false,
});
assert(!closed.needsReply && closed.attendanceState === 'concluido',
  'Resultado explícito que encerra atendimento não permanece P0');

const noMessage = resolveCrmCanonicalReplyState({
  timeline: { needsReply: false, lastInboundAt: null, lastOutboundAt: null },
  resolvesConversation: false, waitingForCustomer: false, hasReturnAt: true,
});
assert(!noMessage.needsReply && noMessage.attendanceState === 'retornar_em',
  'sem mensagem não inventar resposta pendente');

assert(hasCrmUnansweredInbound({ needsReply: true, lastInboundAt: null, lastOutboundAt: null }),
  'flag de outro canal deve ser preservada sem timestamps');
assert(hasCrmUnansweredInbound({ needsReply: true, lastInboundAt: before, lastOutboundAt: before }),
  'empate temporal não cancela flag pendente');
assert(!hasCrmUnansweredInbound({ needsReply: false, lastInboundAt: before, lastOutboundAt: before }),
  'empate sem flag não inventa pendência');
assert(hasCrmUnansweredInbound({ needsReply: true, lastInboundAt: 'data inválida', lastOutboundAt: after }),
  'dado temporal inválido não apaga pendência explícita');
console.log('pendingReply.test: OK');
