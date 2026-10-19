import { getCrmRouteBlockReason, registerCrmRouteGuard } from './crmRouteNavigationGuards';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error('E-03.3: ' + message); }
assert(getCrmRouteBlockReason() === null, 'sem pendência, libera navegação');
const releaseInbox = registerCrmRouteGuard(() => 'Resultado aberto');
assert(getCrmRouteBlockReason() === 'Resultado aberto', 'proteção disponível para pesquisa global');
const releaseOverlay = registerCrmRouteGuard(() => 'Formulário não salvo');
assert(getCrmRouteBlockReason() === 'Formulário não salvo', 'overlays mais recentes prevalecem');
releaseOverlay();
assert(getCrmRouteBlockReason() === 'Resultado aberto', 'remover overlay restaura a proteção anterior');
releaseInbox();
assert(getCrmRouteBlockReason() === null, 'navegação normal após limpeza');
console.log('crmRouteNavigationGuards.test: OK');
