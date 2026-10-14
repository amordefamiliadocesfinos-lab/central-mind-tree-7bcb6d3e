import { evaluatePostSalePanelOutreach, type PostSalePanelConversationSafety } from './postSalePanelOutreach';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`CRM POS-VENDA 1: ${message}`);
}
const active = { isActive: true, commercialOptOut: false };
const base: PostSalePanelConversationSafety = {
  status: 'open', attendanceState: 'em_atendimento', needsReply: false,
  lastInboundAt: null, lastOutboundAt: null,
};
assert(evaluatePostSalePanelOutreach(active, []).allowed, 'contato regular sem conversa');
assert(evaluatePostSalePanelOutreach(active, [base]).allowed, 'atendimento aberto sem pendência não bloqueia');
assert(!evaluatePostSalePanelOutreach({ ...active, commercialOptOut: true }, []).allowed,
  'opt-out bloqueia rascunho comercial');
assert(!evaluatePostSalePanelOutreach({ ...active, isActive: false }, []).allowed,
  'contato inativo bloqueia');
assert(!evaluatePostSalePanelOutreach(null, []).allowed, 'cadastro ausente não autoriza');
assert(!evaluatePostSalePanelOutreach(active, [{ ...base, needsReply: true }]).allowed,
  'resposta pendente tem precedência');
assert(!evaluatePostSalePanelOutreach(active, [{ ...base, attendanceState: 'aguardando_cliente' }]).allowed,
  'aguardando cliente bloqueia nova abordagem');
assert(!evaluatePostSalePanelOutreach(active, [{
  ...base, lastInboundAt: '2026-10-14T12:00:00Z', lastOutboundAt: '2026-10-14T11:00:00Z',
}]).allowed, 'inbound mais recente bloqueia');
assert(evaluatePostSalePanelOutreach(active, [{
  ...base, lastInboundAt: '2026-10-14T11:00:00Z', lastOutboundAt: '2026-10-14T12:00:00Z',
}]).allowed, 'outbound mais recente sem pendência conhecida');
assert(evaluatePostSalePanelOutreach(active, [{
  ...base, status: 'resolved', needsReply: true, attendanceState: 'aguardando_cliente',
}]).allowed, 'conversa resolvida não cria bloqueio vitalício');
assert(!evaluatePostSalePanelOutreach(active, [{
  ...base, lastInboundAt: 'sem data', lastOutboundAt: null,
}]).allowed, 'inbound inválido não pode ser ignorado');
console.log('postSalePanelOutreach.test: OK');
