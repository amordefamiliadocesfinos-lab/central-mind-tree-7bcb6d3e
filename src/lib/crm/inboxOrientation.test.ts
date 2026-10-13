import { CRM_INBOX_ORIENTATION_COPY, getCrmInboxOrientation, getCrmOrientationShortcut, prepareCrmSupervisedAction, type CrmOrientationTarget } from './inboxOrientation';
import { projectCrmOperationalState, type CrmOperationalSource } from './operationalProjection';
import { getCrmPriority, type CrmPriorityReason } from './priority';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`CRM F2-A: ${message}`);
}

const now = new Date('2026-10-13T15:00:00.000Z');
const reasons: CrmPriorityReason[] = [
  'needs_reply', 'pending_result', 'return_overdue', 'next_action_overdue',
  'return_today', 'next_action_today', 'reactivation_overdue', 'reactivation_today',
  'follow_up_urgent', 'cooling', 'normal', 'future', 'waiting_customer', 'resolved',
];
assert(Object.keys(CRM_INBOX_ORIENTATION_COPY).length === reasons.length,
  'deve existir uma orientação para cada motivo oficial, sem extensões inventadas.');
for (const reason of reasons) {
  const copy = CRM_INBOX_ORIENTATION_COPY[reason];
  assert(Boolean(copy?.title && copy.explanation) && ['action','verify','waiting'].includes(copy.mode),
    `orientação não coberta para ${reason}`);
}

for (const name of ['Lurdes', 'Graciela', 'Armando']) {
  const source: CrmOperationalSource = {
    contactId: name, conversationId: `conv-${name}`,
    last_result_code: 'CRM-RES-021', handoff_required: true,
    last_result_at: '2026-10-09T17:21:32Z', attendance_state: 'em_atendimento',
    status: 'open', needs_reply: false, funnel_status: 'fechado',
  };
  const projection = projectCrmOperationalState(source, now);
  const orientation = getCrmInboxOrientation(projection);
  assert(orientation.contactId === name && orientation.conversationId === `conv-${name}`,
    `${name}: não trocar contato/conversa na orientação.`);
  assert(orientation.handoffUnverified && projection.handoffVerified === false,
    `${name}: handoff declarado não é conclusão comprovada.`);
  assert(orientation.lastResultResponsibility === 'operator',
    `${name}: responsabilidade deriva exclusivamente do último Resultado.`);
  assert(orientation.priorityLevel === getCrmPriority(source, now).level
    && orientation.priorityLabel === projection.priority.label,
    `${name}: prioridade deve permanecer canônica.`);
  assert(!orientation.obligation, `${name}: não fabricar obrigação comercial.`);
}

const felipe: CrmOperationalSource = {
  contactId: 'Felipe', conversationId: 'conv-felipe',
  last_result_code: 'CRM-RES-005', last_result_at: '2026-10-09T17:00:00Z',
  next_action_text: 'Elaborar/atualizar proposta', next_action_date: null,
  status: 'open', attendance_state: 'em_atendimento', needs_reply: false,
};
const felipeProjection = projectCrmOperationalState(felipe, now);
const felipeOrientation = getCrmInboxOrientation(felipeProjection);
assert(felipeOrientation.obligation?.title === 'Elaborar/atualizar proposta'
  && felipeOrientation.obligation.dueAt === null
  && felipeOrientation.obligation.source === 'contact',
  'Felipe: exibir obrigação sem data, sem alegar tarefa CRM oficial.');

const leonardo: CrmOperationalSource = {
  contactId: 'Leonardo', conversationId: 'conv-leonardo',
  status: 'open', attendance_state: 'aguardando_cliente', needs_reply: false,
  last_result_code: 'CRM-RES-020', last_result_at: '2026-10-09T21:15:00Z',
  last_inbound_at: '2026-10-09T21:17:58Z', last_outbound_at: '2026-10-09T21:18:04Z',
  next_action_title: 'Realizar pós-venda', next_action_date: '2026-10-12T12:00:00Z',
  official_task_present: true,
};
const leonardoProjection = projectCrmOperationalState(leonardo, now);
const leonardoOrientation = getCrmInboxOrientation(leonardoProjection);
assert(leonardoOrientation.obligation?.source === 'official_task'
  && leonardoOrientation.obligation.title === 'Realizar pós-venda'
  && leonardoOrientation.obligation.dueAt === '2026-10-12T12:00:00Z',
  'Leonardo: manter prazo real de pós-venda e origem oficial.');
assert(leonardoOrientation.priorityLevel === leonardoProjection.priority.level
  && leonardoOrientation.priorityLabel === leonardoProjection.priority.label,
  'Leonardo: não recalcular ou substituir a prioridade canônica.');
assert(!leonardoOrientation.handoffUnverified, 'Leonardo: não supor handoff sem metadado comprovado.');

const waitingUndated: CrmOperationalSource = {
  contactId: 'Tarefa-sem-data', status: 'open',
  attendance_state: 'aguardando_cliente',
  last_outbound_at: '2026-10-12T14:00:00Z',
  needs_reply: false, official_task_present: true,
  next_action_title: 'Conferir documentação', next_action_date: null,
};
const waitingProjection = projectCrmOperationalState(waitingUndated, now);
const waitingOrientation = getCrmInboxOrientation(waitingProjection);
assert(waitingOrientation.obligation?.source === 'official_task'
  && waitingOrientation.obligation.dueAt === null
  && waitingOrientation.undatedObligationNeedsReview,
  'Tarefa oficial sem prazo exige visibilidade explícita, sem vencimento inventado.');
assert(waitingOrientation.mode === 'verify' && waitingOrientation.priorityLevel === 'P4'
  && waitingOrientation.priorityLabel === waitingProjection.priority.label,
  'Obrigação sem data merece revisão, mas não entra artificialmente na fila P0–P3.');

const otherContact = getCrmInboxOrientation(projectCrmOperationalState({
  ...felipe, contactId: 'Outro', conversationId: null,
  next_action_text: null, last_result_code: null,
}, now));
assert(otherContact.contactId === 'Outro' && otherContact.conversationId === null
  && otherContact.obligation === null && otherContact.lastResultResponsibility === null,
  'Troca de contato nunca pode reutilizar obrigação ou Resultado anterior.');

// F2-B: os 14 motivos só apontam para controles já existentes.
const expectedShortcuts: Record<CrmPriorityReason, CrmOrientationTarget> = {
  needs_reply: 'reply',
  pending_result: 'result',
  return_overdue: 'history',
  next_action_overdue: 'history',
  return_today: 'history',
  next_action_today: 'history',
  reactivation_overdue: 'history',
  reactivation_today: 'history',
  follow_up_urgent: 'history',
  cooling: 'history',
  normal: 'history',
  future: 'none',
  waiting_customer: 'none',
  resolved: 'none',
};
for (const reason of reasons) {
  const expected = expectedShortcuts[reason];
  const mapped = getCrmOrientationShortcut({
    ...felipeOrientation, priorityReason: reason,
    undatedObligationNeedsReview: false,
  });
  assert((mapped?.target ?? 'none') === expected,
    `F2-B: ${reason} deve encaminhar apenas para ${expected}, sem execução.`);
}
assert(getCrmOrientationShortcut(waitingOrientation)?.target === 'history',
  'Tarefa oficial sem prazo mantém atalho de conferência sem mudar P4.');
assert(getCrmOrientationShortcut({
  ...felipeOrientation, priorityReason: 'pending_result',
})?.label === 'Abrir registro do Resultado',
  'Registrar Resultado usa formulário atual, sem gravar antes de confirmar.');
assert(getCrmOrientationShortcut({
  ...felipeOrientation, priorityReason: 'needs_reply',
})?.label === 'Preparar resposta',
  'Resposta deve ser apenas preparada no campo existente, sem envio.');

// F3-A: a preparação nunca possui autoridade de envio ou gravação.
const forResult = prepareCrmSupervisedAction(
  { ...felipeOrientation, priorityReason: 'pending_result' },
  { target: 'result', label: 'Abrir registro do Resultado' },
  { contactId: 'Felipe', conversationId: 'conv-felipe', busy: false },
);
assert(forResult.status === 'ready' && forResult.target === 'result'
  && forResult.requiresHumanConfirmation
  && forResult.taskContextTitle === 'Elaborar/atualizar proposta'
  && !forResult.analyzeReply,
  'Resultado preparado preserva obrigação e exige seleção/confirmação humana.');
const forReply = prepareCrmSupervisedAction(
  { ...felipeOrientation, priorityReason: 'needs_reply' },
  { target: 'reply', label: 'Preparar resposta' },
  { contactId: 'Felipe', conversationId: 'conv-felipe', busy: false },
);
assert(forReply.status === 'ready' && forReply.analyzeReply
  && forReply.target === 'reply' && forReply.requiresHumanConfirmation,
  'Resposta contextual pode acionar Assistente apenas por clique explícito.');
const replyWithoutConversation = prepareCrmSupervisedAction(
  { ...felipeOrientation, conversationId: null, priorityReason: 'needs_reply' },
  { target: 'reply', label: 'Preparar resposta' },
  { contactId: 'Felipe', conversationId: null, busy: false },
);
assert(replyWithoutConversation.status === 'ready' && !replyWithoutConversation.analyzeReply,
  'Sem conversa identificada, não disparar IA com histórico incerto.');
const changedContact = prepareCrmSupervisedAction(
  { ...felipeOrientation, priorityReason: 'needs_reply' },
  { target: 'reply', label: 'Preparar resposta' },
  { contactId: 'Outro contato', conversationId: 'conv-felipe', busy: false },
);
assert(changedContact.status === 'blocked' && !changedContact.analyzeReply
  && changedContact.target === 'none',
  'Troca de contato bloqueia uma preparação antiga.');
const changedConversation = prepareCrmSupervisedAction(
  { ...felipeOrientation, priorityReason: 'needs_reply' },
  { target: 'reply', label: 'Preparar resposta' },
  { contactId: 'Felipe', conversationId: 'outra-conversa', busy: false },
);
assert(changedConversation.status === 'blocked' && !changedConversation.analyzeReply,
  'Troca de conversa bloqueia a preparação antiga.');
const busyAction = prepareCrmSupervisedAction(
  { ...felipeOrientation, priorityReason: 'pending_result' },
  { target: 'result', label: 'Abrir registro do Resultado' },
  { contactId: 'Felipe', conversationId: 'conv-felipe', busy: true },
);
assert(busyAction.status === 'blocked' && busyAction.target === 'none',
  'Operação comercial em andamento impede nova preparação concorrente.');
const forgedShortcut = prepareCrmSupervisedAction(
  { ...felipeOrientation, priorityReason: 'needs_reply' },
  { target: 'result', label: 'Registrar resultado' },
  { contactId: 'Felipe', conversationId: 'conv-felipe', busy: false },
);
assert(forgedShortcut.status === 'blocked',
  'Atalho divergente do motivo canônico não pode direcionar ação diferente.');
const noAction = prepareCrmSupervisedAction(
  { ...felipeOrientation, priorityReason: 'resolved', undatedObligationNeedsReview: false },
  null,
  { contactId: 'Felipe', conversationId: 'conv-felipe', busy: false },
);
assert(noAction.status === 'blocked' && !noAction.analyzeReply,
  'Atendimento resolvido sem obrigação não prepara ação.');

console.log('inboxOrientation.test: OK');
