import type { CrmOperationalProjection } from './operationalProjection';
import type { CrmPriorityReason } from './priority';

/**
 * F2-A — apresentação determinística, estritamente somente leitura.
 * A classificação P0–P4 e a responsabilidade continuam pertencendo
 * aos motores canônicos. Não decide ações nem cria fatos comerciais.
 */
export type CrmOrientationMode = 'action' | 'verify' | 'waiting';

interface CrmOrientationCopy {
  mode: CrmOrientationMode;
  title: string;
  explanation: string;
}

/** Cobertura exaustiva dos 14 motivos do motor único de prioridade. */
export const CRM_INBOX_ORIENTATION_COPY: Record<CrmPriorityReason, CrmOrientationCopy> = {
  needs_reply: {
    mode: 'action',
    title: 'Responder ao cliente',
    explanation: 'A conversa sinaliza uma resposta pendente. Confira a mensagem antes de responder.',
  },
  pending_result: {
    mode: 'verify',
    title: 'Registrar o desfecho',
    explanation: 'Existe interação ou ação executada ainda sem classificação canônica. Confira o que aconteceu.',
  },
  return_overdue: {
    mode: 'action',
    title: 'Tratar retorno vencido',
    explanation: 'O retorno registrado está atrasado. Confira o histórico e a obrigação antes de agir.',
  },
  next_action_overdue: {
    mode: 'action',
    title: 'Tratar Próxima Ação atrasada',
    explanation: 'Uma obrigação oficial datada está vencida. Confirme seu estado antes de executá-la.',
  },
  return_today: {
    mode: 'action',
    title: 'Realizar retorno de hoje',
    explanation: 'Há retorno programado para hoje. Confira a conversa e o compromisso registrado.',
  },
  next_action_today: {
    mode: 'action',
    title: 'Verificar Próxima Ação de hoje',
    explanation: 'Uma obrigação oficial está programada para hoje. Confira sua execução e seu desfecho.',
  },
  reactivation_overdue: {
    mode: 'action',
    title: 'Revisar reativação vencida',
    explanation: 'Há uma reativação comercial atrasada. Verifique elegibilidade e histórico antes do contato.',
  },
  reactivation_today: {
    mode: 'action',
    title: 'Revisar reativação de hoje',
    explanation: 'Há reativação comercial prevista para hoje. Verifique elegibilidade e contexto.',
  },
  follow_up_urgent: {
    mode: 'action',
    title: 'Conferir follow-up urgente',
    explanation: 'O motor de prioridade sinalizou acompanhamento urgente. Revise o histórico primeiro.',
  },
  cooling: {
    mode: 'verify',
    title: 'Revisar oportunidade',
    explanation: 'Há sinal de esfriamento comercial. Avalie o histórico antes de qualquer abordagem.',
  },
  normal: {
    mode: 'verify',
    title: 'Conferir atendimento',
    explanation: 'Não há motivo de urgência identificado pelo motor. Verifique as obrigações registradas.',
  },
  future: {
    mode: 'waiting',
    title: 'Acompanhar compromisso futuro',
    explanation: 'Há um marco futuro no planejamento. Ele não deve ser antecipado automaticamente.',
  },
  waiting_customer: {
    mode: 'waiting',
    title: 'Aguardando cliente',
    explanation: 'A iniciativa está aguardando resposta, salvo novo fato ou obrigação oficial vencida.',
  },
  resolved: {
    mode: 'waiting',
    title: 'Atendimento concluído',
    explanation: 'A conversa está resolvida. O histórico e eventuais obrigações permanecem preservados.',
  },
};

export interface CrmInboxOrientation {
  contactId: string;
  conversationId: string | null;
  mode: CrmOrientationMode;
  title: string;
  explanation: string;
  priorityLabel: string;
  priorityLevel: string;
  priorityReason: CrmPriorityReason;
  /** Somente dado registrado, nunca um novo agendamento. */
  obligation: CrmOperationalProjection['obligation'];
  /** Não pressupõe comprovação de recebimento por Operações. */
  handoffUnverified: boolean;
  /** Responsabilidade do último Resultado; não afirma responsável da próxima ação. */
  lastResultResponsibility: CrmOperationalProjection['resultResponsibility'];
  undatedObligationNeedsReview: boolean;
}

export function getCrmInboxOrientation(projection: CrmOperationalProjection): CrmInboxOrientation {
  const copy = CRM_INBOX_ORIENTATION_COPY[projection.priority.reason];
  const actionTitle = projection.obligation?.title?.trim() || null;
  const overdueAction = ['next_action_overdue', 'next_action_today', 'return_overdue', 'return_today'].includes(projection.priority.reason);
  // O envio posterior ao prazo é somente evidência de contato; nunca comprova
  // que a tarefa foi executada ou que o Resultado já foi registrado.
  const outboundAt = projection.lastOutboundAt ? Date.parse(projection.lastOutboundAt) : NaN;
  const inboundAt = projection.lastInboundAt ? Date.parse(projection.lastInboundAt) : NaN;
  const resultAt = projection.lastResultAt ? Date.parse(projection.lastResultAt) : NaN;
  const dueAt = projection.obligation?.dueAt ? Date.parse(projection.obligation.dueAt) : NaN;
  const outboundAfterDue = projection.priority.reason === 'pending_result'
    && Number.isFinite(dueAt) && Number.isFinite(outboundAt)
    && outboundAt >= dueAt && (!Number.isFinite(resultAt) || outboundAt > resultAt);
  const inboundAfterResult = projection.priority.reason === 'pending_result'
    && Number.isFinite(inboundAt) && (!Number.isFinite(resultAt) || inboundAt > resultAt);
  // Fatos registrados guiam a execução; não deduzimos que a tarefa foi cumprida.
  const title = projection.priority.reason === 'pending_result' && outboundAfterDue
    ? 'Conferir execução e registrar Resultado'
    : overdueAction && actionTitle ? `Verificar pendência: ${actionTitle}` : copy.title;
  const explanation = projection.priority.reason === 'needs_reply'
    ? 'Leia a última mensagem e prepare a resposta. Depois registre um Resultado apenas se houver um fato comercial.'
    : projection.priority.reason === 'pending_result'
      ? outboundAfterDue
        ? `Há envio registrado depois do prazo de ${actionTitle ? `"${actionTitle}"` : 'uma Próxima Ação'}. Isso não comprova o cumprimento: confira a conversa e registre o Resultado real no formulário. A tarefa continua pendente até o escritor oficial tratá-la.`
        : inboundAfterResult
          ? `Há mensagem do cliente posterior ao último Resultado${actionTitle ? ` e existe a ação "${actionTitle}"` : ''}. Confira o conteúdo e registre somente o desfecho verdadeiro, sem reenviar mensagem apenas para limpar a fila.`
          : `Há pendência de Resultado${actionTitle ? ` vinculada à ação "${actionTitle}"` : ''}. Confira o histórico antes de registrar o fato real; não suponha execução nem conclusão.`
      : overdueAction
        ? `Confira se ${actionTitle ? `a ação "${actionTitle}"` : 'a obrigação registrada'} já foi executada. Se sim, registre o Resultado; se não, execute ou reagende com Adiar. Não conclua sem evidência.`
        : copy.explanation;
  const undatedObligationNeedsReview = Boolean(projection.obligation && !projection.obligation.dueAt);
  // Uma obrigação sem data não reclassifica P0–P4. Mas impede que a orientação
  // de espera seja interpretada como ausência de trabalho já registrado.
  const mode = copy.mode === 'waiting' && undatedObligationNeedsReview ? 'verify' : copy.mode;
  return {
    contactId: projection.contactId,
    conversationId: projection.conversationId,
    mode,
    title,
    explanation,
    priorityLabel: projection.priority.label,
    priorityLevel: projection.priority.level,
    priorityReason: projection.priority.reason,
    obligation: projection.obligation,
    handoffUnverified: projection.handoffRequired === true && !projection.handoffVerified,
    lastResultResponsibility: projection.resultResponsibility,
    undatedObligationNeedsReview,
  };
}


/**
 * F2-B — encaminhamento para um recurso JÁ EXISTENTE.
 * O atalho só troca a aba, foca o campo ou abre o formulário canônico.
 * Nenhuma operação de escrita e nenhum disparo é feito por esta decisão.
 */
export type CrmOrientationTarget = 'reply' | 'result' | 'history' | 'none';
export interface CrmOrientationShortcut {
  target: Exclude<CrmOrientationTarget, 'none'>;
  label: string;
}

const ORIENTATION_TARGETS: Record<CrmPriorityReason, CrmOrientationTarget> = {
  needs_reply: 'reply',
  pending_result: 'result',
  return_overdue: 'history',
  next_action_overdue: 'history',
  return_today: 'history',
  next_action_today: 'history',
  reactivation_overdue: 'history',
  reactivation_today: 'history',
  follow_up_urgent: 'history',
  cooling: 'history',
  normal: 'history',
  future: 'none',
  waiting_customer: 'none',
  resolved: 'none',
};

export function getCrmOrientationShortcut(orientation: CrmInboxOrientation): CrmOrientationShortcut | null {
  // Uma obrigação sem prazo requer leitura humana mesmo quando P4.
  const target = orientation.undatedObligationNeedsReview && ORIENTATION_TARGETS[orientation.priorityReason] === 'none'
    ? 'history'
    : ORIENTATION_TARGETS[orientation.priorityReason];
  if (target === 'none') return null;
  return {
    target,
    label: target === 'reply' ? 'Preparar resposta'
      : target === 'result' ? 'Abrir registro do Resultado'
        : 'Conferir histórico',
  };
}

/**
 * F3-A — pré-checagem somente leitura antes de preparar o recurso existente.
 * Este contrato não escolhe Resultado, não prepara envio e nunca persiste dados.
 */
export interface CrmSupervisedPreparation {
  status: 'ready' | 'blocked';
  target: CrmOrientationTarget;
  contactId: string;
  conversationId: string | null;
  /** A IA é chamada SOMENTE após clique explícito, com conversa já identificada. */
  analyzeReply: boolean;
  taskContextTitle: string | null;
  reason: string;
  requiresHumanConfirmation: true;
}

export function prepareCrmSupervisedAction(
  orientation: CrmInboxOrientation,
  shortcut: CrmOrientationShortcut | null,
  current: { contactId: string; conversationId: string | null; busy: boolean },
): CrmSupervisedPreparation {
  const sameContext = orientation.contactId === current.contactId
    && orientation.conversationId === current.conversationId;
  const allowedShortcut = getCrmOrientationShortcut(orientation);
  const target = shortcut?.target ?? 'none';
  if (!sameContext || current.busy || !allowedShortcut || target !== allowedShortcut.target) {
    return {
      status: 'blocked',
      target: 'none',
      contactId: current.contactId,
      conversationId: current.conversationId,
      analyzeReply: false,
      taskContextTitle: null,
      reason: !sameContext ? 'O contato ou a conversa mudou; confira o contexto atual.'
        : current.busy ? 'Existe uma operação do atendimento em andamento.'
          : 'Nenhuma preparação é indicada para esta situação.',
      requiresHumanConfirmation: true,
    };
  }
  return {
    status: 'ready',
    target,
    contactId: current.contactId,
    conversationId: current.conversationId,
    analyzeReply: target === 'reply' && Boolean(current.conversationId),
    taskContextTitle: orientation.obligation?.title ?? null,
    reason: target === 'reply'
      ? current.conversationId
        ? 'O Assistente prepara sugestões para revisão; usar ou enviar exige ação humana.'
        : 'Sem conversa vinculada: somente o campo de resposta será aberto.'
      : target === 'result'
        ? 'O Resultado continua sujeito à escolha e confirmação humana no formulário canônico.'
        : 'Apenas consulta do histórico existente; nenhuma ação será registrada.',
    requiresHumanConfirmation: true,
  };
}
