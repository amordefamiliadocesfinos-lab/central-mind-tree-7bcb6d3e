import { CRM_GLOBAL_ENTRY_PATH, CRM_SECTION_PATHS, getCrmInboxContactSwitchBlockReason, getCrmInboxNavigationBlockReason, isGlobalNavigationItemActive } from './crmGlobalNavigation';
function assert(value: unknown, why: string): asserts value { if (!value) throw Error('CRM E-01: ' + why); }

assert(CRM_GLOBAL_ENTRY_PATH === '/contatos/inbox', 'link global CRM não inicia atendimento');
assert(!CRM_GLOBAL_ENTRY_PATH.includes('contact=') && !CRM_GLOBAL_ENTRY_PATH.includes('attend='), 'sem início automático via URL');
assert(CRM_SECTION_PATHS.length === 3, 'somente três rotas CRM vigentes');
for(const path of CRM_SECTION_PATHS) assert(isGlobalNavigationItemActive(path, CRM_GLOBAL_ENTRY_PATH), 'CRM destacado em '+path);
for(const path of ['/operacoes','/contatos-extra','/contatos/inbox/outro','/dashboard','/financeiro']) {
  assert(!isGlobalNavigationItemActive(path, CRM_GLOBAL_ENTRY_PATH), 'não destacar CRM fora da seção: '+path);
}
assert(isGlobalNavigationItemActive('/dashboard','/dashboard'), 'outros módulos preservam rota exata');
assert(!isGlobalNavigationItemActive('/dashboard/extra','/dashboard'), 'não criar destaque genérico em outros módulos');

const safe = { editingProfile:false, pendingChatDraftOrSend:false, attendanceWriting:false, actionFormOpen:false, saleFlowOpen:false };
assert(getCrmInboxNavigationBlockReason(safe) === null, 'navegação sem pendências permitida');
for(const key of Object.keys(safe) as (keyof typeof safe)[]) {
  const reason = getCrmInboxNavigationBlockReason({ ...safe, [key]: true });
  assert(Boolean(reason && reason.length > 12), 'proteger pendência '+key);
}
assert(getCrmInboxNavigationBlockReason({ ...safe, editingProfile:true, attendanceWriting:true })?.includes('ficha'),
  'explicação de edição priorizada');

const switchState = { ...safe, actionFormOpen: true };
assert(getCrmInboxContactSwitchBlockReason(switchState, 'a', 'b')?.includes('Resultado/Adiar'),
  'E-03.2: impedir trocar de contato com Resultado/Adiar aberto');
assert(getCrmInboxContactSwitchBlockReason({ ...safe, saleFlowOpen: true }, 'a', null) !== null,
  'E-03.2: impedir voltar à Start durante confirmação comercial');
assert(getCrmInboxContactSwitchBlockReason({ ...safe, pendingChatDraftOrSend: true }, 'a', 'b') !== null,
  'E-03.2: proteger rascunho antes de abrir a conversa seguinte');
assert(getCrmInboxContactSwitchBlockReason(switchState, 'a', 'a') === null,
  'E-03.2: não bloquear permanência no mesmo contato');
assert(getCrmInboxContactSwitchBlockReason(switchState, 'a', 'b', true) === null,
  'E-03.2: manter passagem pós-commit ao próximo contato');
console.log('crmGlobalNavigation.test: OK');
