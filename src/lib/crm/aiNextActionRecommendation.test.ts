import { recommendCrmNextAction } from './aiNextActionRecommendation';
import { CRM_CANONICAL_NEXT_ACTIONS } from './canonical/nextActions';
import type { CrmAiContext } from './aiContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FRENTE 4.3 — Próxima Ação: ${message}`);
}

const CANONICAL_CODES = new Set(CRM_CANONICAL_NEXT_ACTIONS.map(item => item.code));

function context(overrides: Partial<CrmAiContext> = {}): CrmAiContext {
  return {
    generatedAt: new Date().toISOString(),
    contact: { id: 'c1', name: 'Teste', stage: 'negociacao', origin: 'whatsapp', optOut: false, temperature: 'quente' } as any,
    conversation: { id: 'conv1', state: 'em_atendimento', status: 'open', needsReply: true, returnAt: null, lastInboundAt: null, lastOutboundAt: null } as any,
    messages: [], history: [], lastResult: null, lastResultAt: null, nextAction: null, tasks: [],
    purchases: { paidOrdersCount: 0, lifetimeValue: null, lastOrders: [] },
    tags: [], campaign: null,
    catalogs: { results: [], nextActions: [] },
    limits: { messages: 15, historyEvents: 8, tasks: 3, orders: 3 } as any,
    ...overrides,
  } as CrmAiContext;
}

async function run() {
  // A. RES-001 → próxima ação coerente (qualificar contato).
  const a = await recommendCrmNextAction(context(), 'CRM-RES-001');
  assert(a?.nextActionCode === 'CRM-PA-001', 'A: RES-001 deve recomendar CRM-PA-001.');
  assert(a.requiresDate === false, 'A: RES-001 não exige data.');

  // B. RES-008 → conforme motor atual (sem follow-up automático).
  const b = await recommendCrmNextAction(context(), 'CRM-RES-008');
  assert(b?.nextActionCode === null && b.noImmediateAction, 'B: RES-008 não cria próxima ação automática.');

  // C. RES-020 sem pendência comercial → nenhuma ação imediata.
  const c = await recommendCrmNextAction(context(), 'CRM-RES-020');
  assert(c?.noImmediateAction, 'C: RES-020 sem pendência comercial não deve ter ação imediata.');

  // D. RES-022 → exige data.
  const d = await recommendCrmNextAction(context(), 'CRM-RES-022');
  assert(d?.requiresDate === true, 'D: RES-022 deve exigir data.');
  assert(d.temporalPolicy === 'MISSING_REQUIRED_CONTEXT' || d.temporalPolicy === 'REQUIRED_FUTURE', 'D: política temporal deve pedir tempo real.');

  // E. RES-033 → nenhuma ação promocional.
  const e = await recommendCrmNextAction(context(), 'CRM-RES-033');
  assert(e?.nextActionCode === null && e.temporalPolicy === 'PROHIBITED', 'E: RES-033 bloqueia ação e programação.');

  // F. Contexto insuficiente / resultado inválido → não inventa próxima ação.
  const f = await recommendCrmNextAction(context(), 'CRM-RES-999');
  assert(f === null, 'F: resultado fora do catálogo não gera recomendação.');

  // F2. Código inventado pela IA nunca cria Próxima Ação.
  const f2 = await recommendCrmNextAction(context(), 'CRM-RES-013', {
    explain: true,
    invoke: async () => ({ explanation: 'texto', chosen_next_action_code: 'CRM-PA-999' }),
  });
  assert(f2?.nextActionCode === null && !f2.chosenByAi, 'F2: código fora do catálogo não pode virar Próxima Ação.');

  // F3. IA não substitui decisão determinística clara.
  const f3 = await recommendCrmNextAction(context(), 'CRM-RES-001', {
    explain: true,
    invoke: async () => ({ explanation: 'ok', chosen_next_action_code: 'CRM-PA-014' }),
  });
  assert(f3?.nextActionCode === 'CRM-PA-001' && !f3.chosenByAi, 'F3: motor determinístico prevalece sobre a IA.');

  // F4. D3: em ambiguidade legítima, nem candidato canônico devolvido pela IA
  // pode ser promovido a Próxima Ação sem o fato operacional que o motor exige.
  const f4 = await recommendCrmNextAction(context(), 'CRM-RES-027', {
    explain: true,
    invoke: async () => ({ explanation: 'Há caminhos possíveis, mas falta definir o fato operacional.', chosen_next_action_code: 'CRM-PA-006' }),
  });
  assert(f4?.candidates.length > 1, 'F4: cenário deve preservar múltiplos candidatos canônicos.');
  assert(f4?.nextActionCode === null && !f4.chosenByAi, 'F4: IA não pode desempatar candidatos canônicos.');
  assert(f4?.aiExplanation?.includes('falta'), 'F4: IA pode explicar a ambiguidade sem decidir.');

  // G. Toda ação retornada pertence às 19 canônicas.
  for (let index = 1; index <= 33; index += 1) {
    const code = `CRM-RES-${String(index).padStart(3, '0')}`;
    const rec = await recommendCrmNextAction(context(), code);
    assert(rec, `G: ${code} deve produzir recomendação.`);
    assert(rec.nextActionCode === null || CANONICAL_CODES.has(rec.nextActionCode), `G: ${code} retornou ação fora das 19 canônicas.`);
    rec.candidates.forEach(candidate => assert(CANONICAL_CODES.has(candidate.code), `G: candidato inválido em ${code}.`));
  }

  // Datas nunca são inventadas.
  const dates = await recommendCrmNextAction(context(), 'CRM-RES-022');
  assert(!(dates as any).dueAt && !(dates as any).returnAt, 'Nenhuma data pode ser gerada nesta fase.');
}

run().then(() => console.log('aiNextActionRecommendation.test: OK'));
