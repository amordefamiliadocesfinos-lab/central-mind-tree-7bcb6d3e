import { getCrmPriority } from './priority';
import {
  getCrmOperationalTaskDueAt,
  projectCrmOperationalState,
  toCrmOperationalPriorityInput,
  type CrmOperationalSource,
} from './operationalProjection';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`CRM F1-A: ${message}`);
}

const now = new Date('2026-10-12T14:00:00.000Z');

/** Regressões com a tipologia observada em uso real (sem copiar dados privados). */
for (const caseName of ['Lurdes', 'Graciela', 'Armando']) {
  const source: CrmOperationalSource = {
    contactId: caseName,
    conversationId: `conversation-${caseName}`,
    funnel_status: 'fechado',
    status: 'open',
    attendance_state: 'em_atendimento',
    needs_reply: false,
    last_result_code: 'CRM-RES-021',
    last_result_at: '2026-10-09T17:21:32.000Z',
    handoff_required: true,
  };
  const projection = projectCrmOperationalState(source, now);
  assert(projection.contactId === caseName && projection.conversationId === `conversation-${caseName}`,
    `${caseName}: nunca reutilizar identidade de outro atendimento.`);
  assert(projection.lastResultCode === 'CRM-RES-021' && projection.resultResponsibility === 'operator',
    `${caseName}: usar Resultado e responsabilidade canônicos.`);
  assert(projection.handoffRequired === true && projection.handoffVerified === false,
    `${caseName}: declarar handoff, sem inventar seu recebimento em Operações.`);
  assert(projection.obligation === null,
    `${caseName}: Resultado confirmado não cria tarefa comercial fictícia.`);
  assert(projection.priority.level === getCrmPriority(toCrmOperationalPriorityInput(source), now).level,
    `${caseName}: prioridade deve vir do motor único.`);
}

const felipe: CrmOperationalSource = {
  contactId: 'Felipe',
  conversationId: 'conv-felipe',
  funnel_status: 'negociacao',
  status: 'open',
  attendance_state: 'em_atendimento',
  needs_reply: false,
  last_result_code: 'CRM-RES-005',
  last_result_at: '2026-10-09T17:00:00Z',
  next_action_text: 'Elaborar/atualizar proposta',
  next_action_date: null,
};
const pFelipe = projectCrmOperationalState(felipe, now);
assert(pFelipe.obligation?.title === 'Elaborar/atualizar proposta'
  && pFelipe.obligation?.source === 'contact' && pFelipe.obligation.dueAt === null,
  'Felipe: Próxima Ação sem data é trabalho registrado, não tarefa vencida ou inventada.');
assert(pFelipe.priority.reason === getCrmPriority(toCrmOperationalPriorityInput(felipe), now).reason,
  'Felipe: a nova projeção não pode divergir do motor de prioridade.');

const dueAt = getCrmOperationalTaskDueAt({ scheduled_date: '2026-10-12', scheduled_time: '09:00:00' });
assert(dueAt !== null && dueAt === new Date('2026-10-12T09:00:00').toISOString(),
  'Horário da tarefa oficial deve preservar dia e hora locais, inclusive segundos do PostgreSQL.');
const leonardo: CrmOperationalSource = {
  contactId: 'Leonardo',
  conversationId: 'conv-leonardo',
  funnel_status: 'pos_venda',
  status: 'open',
  attendance_state: 'aguardando_cliente',
  attendance_state_updated_at: '2026-10-09T18:02:00Z',
  last_result_code: 'CRM-RES-020',
  last_result_at: '2026-10-09T17:00:00Z',
  last_inbound_at: '2026-10-09T18:00:00Z',
  last_outbound_at: '2026-10-09T18:02:00Z',
  last_message_at: '2026-10-09T18:02:00Z',
  needs_reply: false,
  next_action_text: 'Acompanhar pós-venda',
  next_action_title: 'Acompanhar pós-venda',
  next_action_date: dueAt,
  official_task_present: true,
};
const pLeonardo = projectCrmOperationalState(leonardo, now);
assert(pLeonardo.obligation?.source === 'official_task' && pLeonardo.obligation.dueAt === dueAt,
  'Leonardo: manter tarefa oficial futura com horário real, sem duplicar agendamento.');
assert(pLeonardo.priority.reason === 'next_action_today',
  'Leonardo: tarefa oficial de hoje mantém a precedência vigente no motor.');
const beforeDue = projectCrmOperationalState(leonardo, new Date('2026-10-10T14:00:00.000Z'));
assert(beforeDue.priority.reason === 'pending_result',
  'Leonardo: antes do vencimento, mensagem nova após Resultado exige revisão canônica.');
assert(pLeonardo.handoffVerified === false,
  'Leonardo: pagamento registrado não prova handoff financeiro ou operacional.');
assert(!getCrmOperationalTaskDueAt({scheduled_date:'2026-10-12',scheduled_time:'invalido'}),
  'Tarefa com horário inválido não pode receber prazo fabricado.');

const isolated = projectCrmOperationalState({ ...felipe, contactId: 'Outro contato', conversationId: null }, now);
assert(isolated.contactId !== pFelipe.contactId && isolated.conversationId === null,
  'Projeção de outro contato não pode herdar a identidade anterior.');

assert(projectCrmOperationalState({
  contactId: 'Indefinido', status: 'open', last_result_code: 'código inválido',
}).lastResultCode === null, 'Resultado desconhecido deve permanecer ausente.');
console.log('operationalProjection.test: OK');
