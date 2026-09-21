import { normalizeCrmStage } from './model';
import { getCrmTransition } from './canonical/transitions';
import type { CrmNewFact, CrmResultCode } from './canonical/types';

export interface ExternalFactResolutionContext {
  currentStage?: string | null;
  currentNextActionDate?: string | null;
  currentReturnAt?: string | null;
  conversationStatus?: string | null;
  attendanceState?: string | null;
  needsReply?: boolean;
}

export interface ExternalFactApplicationPlan {
  resultCode: CrmResultCode;
  scheduledFor: null;
}

/**
 * F5-B1b — resolve o fato externo pelo mesmo motor canônico usado pelo CRM.
 *
 * Não duplica o mapa fato → Resultado, não persiste e não inventa agenda.
 */
export function buildExternalFactApplication(
  fact: CrmNewFact,
  context: ExternalFactResolutionContext = {},
): ExternalFactApplicationPlan {
  const decision = getCrmTransition({
    // Placeholder neutro: para os fatos externos aceitos pela F5-B1a,
    // `newFact` é a autoridade que resolve o Resultado efetivo no motor.
    result: 'CRM-RES-001',
    currentStage: normalizeCrmStage(context.currentStage),
    currentNextAction: null,
    currentNextActionDate: context.currentNextActionDate ?? null,
    currentReturnAt: context.currentReturnAt ?? null,
    conversationStatus: context.conversationStatus ?? null,
    attendanceState: context.attendanceState ?? null,
    needsReply: context.needsReply ?? false,
    newFact: fact,
    newFactRelation: 'SUPERSEDES',
  });

  return {
    resultCode: decision.result,
    // Fato externo não pode inventar scheduledFor; qualquer continuidade futura
    // precisa nascer de contexto temporal explícito em outra ação canônica.
    scheduledFor: null,
  };
}
