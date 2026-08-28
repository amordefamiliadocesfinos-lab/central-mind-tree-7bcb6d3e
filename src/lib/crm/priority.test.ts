import { getCrmPriority, type CrmPriorityInput } from './priority';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`CRM priority: ${message}`);
}

const now = new Date('2026-08-27T20:08:00.000Z');
const waitingBase: CrmPriorityInput = {
  status: 'open',
  attendance_state: 'aguardando_resposta',
  attendance_state_updated_at: '2026-08-27T20:00:00.000Z',
  last_outbound_at: '2026-08-27T19:59:00.000Z',
  last_message_at: '2026-08-27T19:59:00.000Z',
  last_inbound_at: '2026-08-27T19:50:00.000Z',
  needs_reply: true,
  no_response_status: 'follow_up_urgente',
  // Resultado canônico já registrado depois da última entrada do cliente.
  last_result_at: '2026-08-27T19:58:00.000Z',
};

const res003 = getCrmPriority(waitingBase, now);
assert(res003.level === 'P4' && res003.reason === 'waiting_customer' && !res003.operational,
  'RES-003 aguardando resposta, sem próxima ação e sem nova mensagem deve sair da Prioridade.');

const replied = getCrmPriority({
  ...waitingBase,
  attendance_state_updated_at: '2026-08-27T20:05:00.000Z',
  last_inbound_at: '2026-08-27T20:05:00.000Z',
  last_message_at: '2026-08-27T20:05:00.000Z',
}, now);
assert(replied.operational && replied.reason === 'needs_reply',
  'nova mensagem do cliente deve voltar à atenção.');

const overdueReturn = getCrmPriority({
  ...waitingBase,
  needs_reply: false,
  return_at: '2026-08-27T20:05:00.000Z',
}, now);
assert(overdueReturn.operational,
  'return_at vencido e posterior ao início da espera deve voltar à atenção.');

const overdueAction = getCrmPriority({
  ...waitingBase,
  needs_reply: false,
  next_action_date: '2026-08-27T20:05:00.000Z',
}, now);
assert(overdueAction.operational,
  'próxima ação vencida e posterior ao início da espera deve voltar à atenção.');

const residualAction = getCrmPriority({
  ...waitingBase,
  next_action_date: '2026-08-27T12:00:00.000Z',
  next_contact_date: '2026-08-27T12:00:00.000Z',
}, now);
assert(residualAction.level === 'P4' && !residualAction.operational,
  'datas residuais anteriores ao início da espera não podem reativar a Prioridade.');

const pendingResult = getCrmPriority({ ...waitingBase, needs_reply: false, last_result_at: null }, now);
assert(pendingResult.operational && pendingResult.reason === 'pending_result',
  'resposta do cliente ainda sem Resultado registrado deve permanecer acessível após o envio.');

const noInboundPending = getCrmPriority({ ...waitingBase, needs_reply: false, last_inbound_at: null, last_result_at: null }, now);
assert(!noInboundPending.operational,
  'envio sem nenhuma resposta pendente continua saindo da Prioridade.');

const futureReactivation = getCrmPriority({ status: 'resolved', reactivation_at: '2026-09-15T09:00:00.000Z' }, now);
assert(!futureReactivation.operational,
  'reativação futura não pode colocar cliente encerrado na Prioridade agora.');

const dueReactivation = getCrmPriority({ status: 'resolved', reactivation_at: '2026-08-27T09:00:00.000Z' }, now);
assert(dueReactivation.operational && dueReactivation.reason === 'reactivation_today',
  'reativação vencida hoje deve trazer o cliente encerrado de volta à atenção.');
