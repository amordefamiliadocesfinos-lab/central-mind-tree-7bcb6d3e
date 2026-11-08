export type JourneyEvidenceState = "present" | "absent" | "unknown" | "error";

export type JourneyState =
  | "complete"
  | "actionable"
  | "in_progress"
  | "waiting_data"
  | "evaluated_paused"
  | "blocked"
  | "error"
  | "optional";

export type JourneyStageCode =
  | "profile"
  | "program"
  | "execution"
  | "nutrition"
  | "body"
  | "recovery"
  | "integrated_decision";

export type JourneyNextActionCode =
  | "complete_profile"
  | "publish_program"
  | "execute_workout"
  | "record_nutrition"
  | "record_body"
  | "record_recovery"
  | "evaluate_integration"
  | "review_integrated_decision";

export type JourneyStage = {
  code: JourneyStageCode;
  label: string;
  evidenceState: JourneyEvidenceState;
  journeyState: JourneyState;
  evidence: string;
  href: string;
};

export type JourneyNextAction = {
  code: JourneyNextActionCode;
  href?: string;
  label: string;
  reason: string;
};

export type JourneyModelInput = {
  profile: {
    hasProfile: boolean;
    hasActiveGoal: boolean;
    error?: string | null;
  };
  program: {
    hasProgram: boolean;
    programStatus?: string | null;
    hasPublishedCurrentVersion: boolean;
    hasUsableQueue: boolean;
    error?: string | null;
  };
  execution: {
    hasOpenSession: boolean;
    hasCompletedSession: boolean;
    error?: string | null;
  };
  nutrition: {
    hasCurrentRolling: boolean;
    rollingCoverage?: string | null;
    hasCurrentDecision: boolean;
    decisionStatus?: string | null;
    error?: string | null;
  };
  body: {
    hasCurrentState: boolean;
    coverageStatus?: string | null;
    observationCount: number;
    error?: string | null;
  };
  recovery: {
    hasCurrentState: boolean;
    contextObserved: boolean;
    error?: string | null;
  };
  integrated: {
    backendAvailable: boolean;
    hasCurrentRun: boolean;
    runStatus?: string | null;
    hasDecisions: boolean;
    error?: string | null;
  };
};

const labels: Record<JourneyStageCode, string> = {
  profile: "Perfil e objetivo",
  program: "Planejamento de treino",
  execution: "Execução real",
  nutrition: "Alimentação observada",
  body: "Evolução corporal",
  recovery: "Sono e recuperação",
  integrated_decision: "Decisão integrada",
};

const hrefs: Record<JourneyStageCode, string> = {
  profile: "/saude/perfil",
  program: "/saude/treino/programa",
  execution: "/saude/treino",
  nutrition: "/saude/alimentacao",
  body: "/saude/evolucao",
  recovery: "/saude/recuperacao",
  integrated_decision: "/saude/hoje",
};

function stage(
  code: JourneyStageCode,
  evidenceState: JourneyEvidenceState,
  journeyState: JourneyState,
  evidence: string,
): JourneyStage {
  return {
    code,
    label: labels[code],
    evidenceState,
    journeyState,
    evidence,
    href: hrefs[code],
  };
}

function isObservedCoverage(value: string | null | undefined) {
  return value === "partial" || value === "complete";
}

export function buildJourneyStages(input: JourneyModelInput): JourneyStage[] {
  const stages: JourneyStage[] = [];

  if (input.profile.error) {
    stages.push(stage("profile", "error", "error", "Não foi possível verificar perfil e objetivo."));
  } else if (input.profile.hasProfile && input.profile.hasActiveGoal) {
    stages.push(stage("profile", "present", "complete", "Perfil e objetivo principal estão registrados."));
  } else {
    stages.push(
      stage(
        "profile",
        input.profile.hasProfile || input.profile.hasActiveGoal ? "present" : "absent",
        "actionable",
        !input.profile.hasProfile && !input.profile.hasActiveGoal
          ? "Perfil e objetivo principal ainda não estão completos."
          : !input.profile.hasProfile
            ? "O objetivo existe, mas o perfil ainda precisa ser registrado."
            : "O perfil existe, mas falta um objetivo principal ativo.",
      ),
    );
  }

  if (input.program.error) {
    stages.push(stage("program", "error", "error", "Não foi possível verificar o programa de treino."));
  } else if (
    input.program.hasProgram &&
    input.program.programStatus === "active" &&
    input.program.hasPublishedCurrentVersion &&
    input.program.hasUsableQueue
  ) {
    stages.push(stage("program", "present", "complete", "Programa publicado e fila CCH disponíveis."));
  } else if (input.program.hasProgram) {
    stages.push(
      stage(
        "program",
        "present",
        "in_progress",
        "O programa existe, mas ainda não possui versão publicada e fila utilizável completas.",
      ),
    );
  } else {
    stages.push(stage("program", "absent", "actionable", "Ainda não há programa de treino configurado."));
  }

  const programStage = stages.find((item) => item.code === "program")!;
  if (input.execution.error) {
    stages.push(stage("execution", "error", "error", "Não foi possível verificar a execução de treino."));
  } else if (input.execution.hasCompletedSession) {
    stages.push(stage("execution", "present", "complete", "Já existe treino concluído registrado."));
  } else if (input.execution.hasOpenSession) {
    stages.push(stage("execution", "present", "in_progress", "Há um treino em andamento."));
  } else if (programStage.journeyState === "complete") {
    stages.push(stage("execution", "absent", "actionable", "O programa está pronto para uma execução real."));
  } else {
    stages.push(stage("execution", "unknown", "blocked", "A execução depende de um programa utilizável."));
  }

  if (input.nutrition.error) {
    stages.push(stage("nutrition", "error", "error", "Não foi possível verificar o estado nutricional atual."));
  } else if (input.nutrition.hasCurrentRolling && input.nutrition.hasCurrentDecision) {
    stages.push(
      stage(
        "nutrition",
        "present",
        "complete",
        input.nutrition.decisionStatus === "paused"
          ? "O estado atual existe e a decisão nutricional foi avaliada como pausada."
          : "Estado e decisão nutricional atuais estão materializados.",
      ),
    );
  } else if (
    input.nutrition.hasCurrentRolling &&
    !isObservedCoverage(input.nutrition.rollingCoverage)
  ) {
    stages.push(
      stage(
        "nutrition",
        "present",
        "waiting_data",
        "O estado nutricional existe, mas ainda não possui cobertura suficiente.",
      ),
    );
  } else {
    stages.push(
      stage(
        "nutrition",
        input.nutrition.hasCurrentRolling || input.nutrition.hasCurrentDecision ? "present" : "absent",
        "waiting_data",
        "Ainda faltam estado e decisão nutricional atuais para esta etapa.",
      ),
    );
  }

  if (input.body.error) {
    stages.push(stage("body", "error", "error", "Não foi possível verificar a evolução corporal atual."));
  } else if (
    input.body.hasCurrentState &&
    isObservedCoverage(input.body.coverageStatus) &&
    input.body.observationCount > 0
  ) {
    stages.push(stage("body", "present", "complete", "Há observação corporal atual com cobertura utilizável."));
  } else {
    stages.push(
      stage(
        "body",
        input.body.hasCurrentState ? "present" : "absent",
        "waiting_data",
        "Ainda não há observação corporal atual suficiente para a jornada.",
      ),
    );
  }

  if (input.recovery.error) {
    stages.push(stage("recovery", "error", "error", "Não foi possível verificar recuperação atual."));
  } else if (input.recovery.hasCurrentState && input.recovery.contextObserved) {
    stages.push(stage("recovery", "present", "complete", "Há contexto atual de recuperação com cobertura utilizável."));
  } else {
    stages.push(
      stage(
        "recovery",
        input.recovery.hasCurrentState ? "present" : "absent",
        "waiting_data",
        "Ainda não há contexto atual de recuperação suficiente.",
      ),
    );
  }

  if (!input.integrated.backendAvailable) {
    stages.push(
      stage(
        "integrated_decision",
        input.integrated.error ? "error" : "unknown",
        "blocked",
        "O motor integrado ainda não está disponível neste ambiente.",
      ),
    );
  } else if (input.integrated.error) {
    stages.push(
      stage(
        "integrated_decision",
        "error",
        "error",
        "Não foi possível verificar a decisão integrada.",
      ),
    );
  } else if (input.integrated.hasCurrentRun && input.integrated.hasDecisions) {
    stages.push(
      stage(
        "integrated_decision",
        "present",
        input.integrated.runStatus === "paused" ? "evaluated_paused" : "complete",
        input.integrated.runStatus === "paused"
          ? "A avaliação integrada foi executada e ficou pausada com motivos explicáveis."
          : "A avaliação integrada atual está materializada.",
      ),
    );
  } else {
    stages.push(
      stage(
        "integrated_decision",
        "absent",
        "actionable",
        "Ainda não há avaliação integrada atual materializada.",
      ),
    );
  }

  return stages;
}

function actionForStage(stage: JourneyStage): JourneyNextAction | null {
  switch (stage.code) {
    case "profile":
      return {
        code: "complete_profile",
        href: "/saude/perfil",
        label: "Completar perfil e objetivo",
        reason: stage.evidence,
      };
    case "program":
      return {
        code: "publish_program",
        href: "/saude/treino/programa",
        label: "Preparar programa de treino",
        reason: stage.evidence,
      };
    case "execution":
      return {
        code: "execute_workout",
        href: "/saude/treino",
        label: stage.journeyState === "in_progress" ? "Continuar treino" : "Executar treino",
        reason: stage.evidence,
      };
    case "nutrition":
      return {
        code: "record_nutrition",
        href: "/saude/alimentacao",
        label: "Completar alimentação observada",
        reason: stage.evidence,
      };
    case "body":
      return {
        code: "record_body",
        href: "/saude/evolucao",
        label: "Registrar evolução corporal",
        reason: stage.evidence,
      };
    case "recovery":
      return {
        code: "record_recovery",
        href: "/saude/recuperacao",
        label: "Registrar recuperação",
        reason: stage.evidence,
      };
    case "integrated_decision":
      return {
        code:
          stage.journeyState === "complete" || stage.journeyState === "evaluated_paused"
            ? "review_integrated_decision"
            : "evaluate_integration",
        href:
          stage.journeyState === "complete" || stage.journeyState === "evaluated_paused"
            ? "/saude/hoje#decisao-integrada"
            : undefined,
        label:
          stage.journeyState === "complete" || stage.journeyState === "evaluated_paused"
            ? "Revisar decisão integrada"
            : "Avaliar integração",
        reason: stage.evidence,
      };
  }
}

export function buildJourneyNextAction(stages: JourneyStage[]): JourneyNextAction | null {
  for (const current of stages) {
    if (current.journeyState === "error") return null;

    if (
      current.journeyState === "complete" ||
      current.journeyState === "evaluated_paused" ||
      current.journeyState === "optional"
    ) {
      continue;
    }

    if (current.journeyState === "blocked" && current.code === "integrated_decision") {
      return null;
    }

    return actionForStage(current);
  }

  const integrated = stages.find((item) => item.code === "integrated_decision");
  return integrated ? actionForStage(integrated) : null;
}

export function buildJourneyModel(input: JourneyModelInput) {
  const stages = buildJourneyStages(input);
  return {
    stages,
    nextAction: buildJourneyNextAction(stages),
    hasTechnicalError: stages.some((item) => item.journeyState === "error"),
    hasReachedIntegratedEvaluation: stages.some(
      (item) =>
        item.code === "integrated_decision" &&
        (item.journeyState === "complete" || item.journeyState === "evaluated_paused"),
    ),
  };
}

export function journeyStateLabel(value: JourneyState) {
  const labels: Record<JourneyState, string> = {
    complete: "Concluída",
    actionable: "Disponível",
    in_progress: "Em andamento",
    waiting_data: "Aguardando dados",
    evaluated_paused: "Avaliada — pausada",
    blocked: "Bloqueada",
    error: "Erro",
    optional: "Opcional",
  };
  return labels[value];
}
