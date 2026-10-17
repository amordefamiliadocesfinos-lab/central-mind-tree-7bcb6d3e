import {
  CRM_START_INTENT_PARAM,
  buildCrmStartDestination,
  parseCrmStartIntent,
  removeCrmStartIntent,
  type CrmStartIntent,
} from './startOpportunityNavigation';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('CRM C2-03: ' + message);
}
const known: CrmStartIntent[] = ['post_sale', 'repurchase', 'segment', 'campaigns'];
for (const intent of known) {
  const url = buildCrmStartDestination(intent);
  assert(url.startsWith('/contatos?'), 'Destino restrito à Gestão: ' + intent);
  assert(!url.includes('attend=1') && !url.includes('/inbox'), 'Link nunca pode iniciar atendimento');
  const parsed = new URL(url, 'https://example.local');
  assert(parseCrmStartIntent(parsed.searchParams) === intent, 'Destino reconhecido: ' + intent);
  assert(parsed.searchParams.size === 1, 'Link carrega apenas intenção, sem efeitos laterais');
  const consumed = removeCrmStartIntent(parsed.searchParams);
  assert(parseCrmStartIntent(consumed) === null, 'Intenção consumida uma vez: ' + intent);
  assert(parsed.searchParams.get(CRM_START_INTENT_PARAM) === intent, 'Não mutar o objeto original');
}
const mixed = new URLSearchParams('contact=c-1&tab=kanban&crm_start=segment&note=teste');
const consumed = removeCrmStartIntent(mixed);
assert(consumed.get('contact') === 'c-1' && consumed.get('tab') === 'kanban'
  && consumed.get('note') === 'teste', 'Preservar outros parâmetros da Gestão');
assert(mixed.get(CRM_START_INTENT_PARAM) === 'segment', 'Não alterar referência recebida');
assert(parseCrmStartIntent(new URLSearchParams('crm_start=unknown')) === null,
  'Intenção inválida não abre nada');
assert(parseCrmStartIntent(new URLSearchParams('crm_start=attend')) === null,
  'Não existe intenção automática de atendimento');
assert(parseCrmStartIntent(new URLSearchParams('contact=c-1')) === null,
  'Link de cadastro existente permanece independente');
console.log('startOpportunityNavigation.test: OK');
