import { getCrmInboxFilterClass, type CrmInboxVisualFilter } from './inboxFilterVisualHierarchy';
function assert(value: unknown, message: string): asserts value {
  if (!value) throw Error('UX-CRM-03B: ' + message);
}
const filters: CrmInboxVisualFilter[] = ['priority', 'needs_reply', 'today', 'overdue', 'cooling'];
const activeStyles = new Set<string>();
for (const key of filters) {
  const active = getCrmInboxFilterClass(key, true);
  const inactive = getCrmInboxFilterClass(key, false);
  assert(active !== inactive, key + ' distingue filtro ativo/inativo');
  assert(active.includes('border-') && active.includes('text-') && active.includes('dark:'), key + ' legível em temas claro/escuro');
  assert(!inactive.includes('bg-red-') && !inactive.includes('bg-amber-'), 'inativos sem falsas prioridades');
  activeStyles.add(active);
}
assert(activeStyles.size === filters.length, 'cada filtro ativo tem identidade de cor');
assert(getCrmInboxFilterClass('overdue', true).includes('bg-red-'), 'atrasados em vermelho somente quando selecionado');
assert(getCrmInboxFilterClass('needs_reply', true).includes('bg-amber-'), 'responder em âmbar, não urgência vencida');
assert(getCrmInboxFilterClass('priority', false).includes('bg-white'), 'filtro inativo neutro');
console.log('inboxFilterVisualHierarchy.test: OK');
