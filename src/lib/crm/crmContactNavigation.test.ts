import {
  getCrmContactAttendanceUrl, getCrmContactConsultationUrl, isExplicitCrmAttendanceLink,
} from './crmContactNavigation';

function assert(ok: unknown, why: string): asserts ok { if (!ok) throw Error('CRM E-02: ' + why); }
for (const unsafe of [
  '', 'contact=c-123', 'attend=1', 'contact=c-123&attend=0',
  'contact=c-123&attend=true', 'contact=c-123&attend=', 'contact=%20&attend=1',
  'contact=c-123&attend=01',
]) {
  assert(!isExplicitCrmAttendanceLink(new URLSearchParams(unsafe)), 'sem intenção operacional explícita: '+unsafe);
}
assert(isExplicitCrmAttendanceLink(new URLSearchParams('contact=c-123&attend=1')), 'atendimento explícito permitido');
assert(isExplicitCrmAttendanceLink(new URLSearchParams('other=x&attend=1&contact=c-123')), 'ordem de parâmetros irrelevante');
const id = '5b9c2d7e-42f0-4a4b-9f81-0000abc12345';
const passive = new URL(getCrmContactConsultationUrl(id), 'https://example.test');
const active = new URL(getCrmContactAttendanceUrl(id), 'https://example.test');
assert(passive.pathname === '/contatos', 'consulta no cadastro oficial');
assert(passive.searchParams.get('contact') === id, 'consultar mantém identidade do contato');
assert(!isExplicitCrmAttendanceLink(passive.searchParams), 'consulta nunca aciona atendimento');
assert(active.pathname === '/contatos/inbox', 'atendimento na Inbox');
assert(isExplicitCrmAttendanceLink(active.searchParams), 'atendimento requer e carrega attend=1');
assert(active.searchParams.get('contact') === id, 'atendimento mantém contato correto');
assert(active.searchParams.size === 2 && passive.searchParams.size === 1, 'URLs sem parâmetros excedentes');
console.log('crmContactNavigation.test: OK');
