import type { CrmPriority } from './priority';

/**
 * F4 — orientação pós-Resultado, somente leitura. Recebe o motor de prioridade
 * recalculado APÓS persistência; não inventa fatos nem conclui obrigações.
 */
export type CrmPostResultTarget = 'reply' | 'history' | 'none';
export interface CrmPostResultGuidance {
  title: string;
  explanation: string;
  target: CrmPostResultTarget;
  buttonLabel: string | null;
  /** Obrigações atuais impedem o avanço automático da sessão de fila. */
  keepInFocus: boolean;
}

export function getCrmPostResultGuidance(
  priority: CrmPriority,
  nextActionTitle: string | null,
  handoffPending: boolean,
): CrmPostResultGuidance {
  if (priority.reason === 'needs_reply') {
    return {
      title: 'Resultado registrado · resposta ainda pendente',
      explanation: 'Responda pelo canal oficial. Registrar Resultado não envia mensagem nem retira esta obrigação da fila.',
      target: 'reply', buttonLabel: 'Preparar resposta', keepInFocus: true,
    };
  }
  if (priority.reason === 'pending_result') {
    return {
      title: 'Ainda há uma classificação pendente',
      explanation: 'Confira o histórico atualizado antes de qualquer novo Resultado. Não registre outro desfecho apenas para retirar o contato da fila.',
      target: 'history', buttonLabel: 'Conferir histórico', keepInFocus: true,
    };
  }
  // P3 é fila normal, não comprova uma obrigação devida. Não impedir
  // avanço somente por esse rótulo genérico.
  if (priority.operational && priority.reason !== 'normal') {
    const title = nextActionTitle?.trim();
    return {
      title: 'Resultado registrado · existe outra obrigação atual',
      explanation: title
        ? `A Próxima Ação "${title}" continua exigindo atenção segundo a fila recalculada. Confira a execução e, se necessário, reagende pelo fluxo existente.`
        : 'Há obrigação ativa na fila recalculada. Confira o histórico antes de executar ou reagendar.',
      target: 'history', buttonLabel: 'Conferir histórico', keepInFocus: true,
    };
  }
  if (handoffPending) {
    return {
      title: 'Resultado registrado · continuidade operacional',
      explanation: 'A próxima etapa depende do módulo responsável. Consulte o encaminhamento operacional exibido neste atendimento; não presuma aceite ou execução.',
      target: 'none', buttonLabel: null, keepInFocus: true,
    };
  }
  if (priority.reason === 'waiting_customer' || priority.reason === 'future') {
    return {
      title: 'Resultado registrado · aguardar compromisso',
      explanation: 'Não há resposta imediata pendente. O retorno ou a Próxima Ação futura seguirá a programação oficial; não é necessário reenviar mensagem.',
      target: 'none', buttonLabel: null, keepInFocus: false,
    };
  }
  return {
    title: 'Resultado registrado · sem pendência imediata',
    explanation: 'O atendimento foi atualizado. Você pode seguir pela fila, sem criar uma nova Próxima Ação artificial.',
    target: 'none', buttonLabel: null, keepInFocus: false,
  };
}
