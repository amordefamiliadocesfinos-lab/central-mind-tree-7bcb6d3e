import {
  getCrmInboxAttendanceTone, getCrmInboxBadgeToneClass,
  getCrmInboxPriorityRailClass, getCrmInboxPriorityTone, getCrmInboxStageTone,
  type CrmInboxTone,
} from './inboxVisualHierarchy';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error('UX-CRM-03A: ' + message);
}

// P0 por resposta não é automaticamente vencimento; vermelho é reservado a fatos críticos.
assert(getCrmInboxPriorityTone({ level: 'P0', reason: 'needs_reply' }) === 'warning', 'responder recebe âmbar');
for (const reason of ['return_overdue', 'next_action_overdue', 'reactivation_overdue', 'follow_up_urgent'] as const) {
  assert(getCrmInboxPriorityTone({ level: 'P0', reason }) === 'danger', 'urgência crítica em ' + reason);
}
assert(getCrmInboxPriorityTone({ level: 'P1', reason: 'pending_result' }) === 'warning', 'registrar resultado em âmbar');
assert(getCrmInboxPriorityTone({ level: 'P1', reason: 'return_today' }) === 'warning', 'retorno hoje em âmbar');
assert(getCrmInboxPriorityTone({ level: 'P2', reason: 'cooling' }) === 'info', 'esfriando em azul');
assert(getCrmInboxPriorityTone({ level: 'P3', reason: 'normal' }) === 'neutral', 'normal não parece crítico');
assert(getCrmInboxPriorityTone({ level: 'P4', reason: 'waiting_customer' }) === 'neutral', 'espera fora da fila não parece urgência');
assert(getCrmInboxStageTone('novo_lead') === 'info', 'novo lead identificado');
assert(getCrmInboxStageTone('fechado') === 'success', 'fechado identificado');
assert(getCrmInboxStageTone('proposta_enviada') === 'commercial', 'proposta não é sucesso concluído');
assert(getCrmInboxStageTone('perdido') === 'neutral', 'perdido não vira urgência de atendimento');
assert(getCrmInboxAttendanceTone('em_atendimento') === 'info', 'atendimento ativo');
assert(getCrmInboxAttendanceTone('aguardando_cliente') === 'warning', 'aguardando é atenção e não atraso');
assert(getCrmInboxAttendanceTone('concluido') === 'success', 'concluído verde');
assert(getCrmInboxAttendanceTone(null) === 'neutral', 'estado ausente sem alerta falso');
for (const tone of ['danger','warning','info','success','commercial','neutral'] as CrmInboxTone[]) {
  assert(getCrmInboxBadgeToneClass(tone).includes('border-') && getCrmInboxBadgeToneClass(tone).includes('text-'), 'badge legível: ' + tone);
}
assert(getCrmInboxPriorityRailClass('danger').includes('red'), 'marcador lateral vermelho só para crítico');
assert(getCrmInboxPriorityRailClass('neutral').includes('transparent'), 'sem marcador lateral urgente neutro');
console.log('inboxVisualHierarchy.test: OK');
