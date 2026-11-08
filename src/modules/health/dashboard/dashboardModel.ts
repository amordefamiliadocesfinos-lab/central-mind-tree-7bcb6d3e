export type DashboardAvailability =
  | "available"
  | "unknown"
  | "error"
  | "not_applicable";

export type DashboardFreshness =
  | "today"
  | "historical"
  | "not_applicable";

export type DashboardIssueDomain =
  | "training"
  | "nutrition"
  | "body"
  | "recovery"
  | "exams";

export type DashboardOperationalIssue = {
  id: string;
  domain: DashboardIssueDomain;
  message: string;
  href: string;
};

export function localDateIso(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function freshnessForDate(
  sourceDate: string | null | undefined,
  today: string,
): DashboardFreshness {
  if (!sourceDate) return "not_applicable";
  return sourceDate === today ? "today" : "historical";
}

export function availabilityFor(options: {
  hasData: boolean;
  error?: string | null;
  notApplicable?: boolean;
  explicitlyUnobserved?: boolean;
}): DashboardAvailability {
  if (options.error) return "error";
  if (options.notApplicable) return "not_applicable";
  if (!options.hasData || options.explicitlyUnobserved) return "unknown";
  return "available";
}

export function isCoverageObserved(value: string | null | undefined) {
  return Boolean(value && value !== "unobserved");
}

export function formatMinutes(value: number | null | undefined) {
  if (value == null) return null;
  const safe = Math.max(0, Math.round(value));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}

export function buildDashboardIssues(input: {
  training: {
    error?: string | null;
    hasActiveSession: boolean;
    hasNextQueue: boolean;
  };
  nutrition: {
    error?: string | null;
    hasDailyState: boolean;
    decisionStatus?: string | null;
  };
  body: {
    error?: string | null;
    hasState: boolean;
    coverageStatus?: string | null;
  };
  recovery: {
    error?: string | null;
    hasState: boolean;
    coverages: Array<string | null | undefined>;
  };
  exams: {
    error?: string | null;
    pendingReviewCount: number;
  };
}): DashboardOperationalIssue[] {
  const issues: DashboardOperationalIssue[] = [];

  if (!input.training.error && !input.training.hasActiveSession && !input.training.hasNextQueue) {
    issues.push({
      id: "training-no-next-session",
      domain: "training",
      message: "Nenhum treino ativo ou programado.",
      href: "/saude/treino",
    });
  }

  if (!input.nutrition.error && !input.nutrition.hasDailyState) {
    issues.push({
      id: "nutrition-no-today-state",
      domain: "nutrition",
      message: "Alimentação de hoje ainda sem estado observado.",
      href: "/saude/alimentacao",
    });
  }

  if (!input.nutrition.error && input.nutrition.decisionStatus === "DECISION_PAUSED") {
    issues.push({
      id: "nutrition-decision-paused",
      domain: "nutrition",
      message: "Decisão nutricional pausada por insuficiência ou qualidade dos dados.",
      href: "/saude/alimentacao",
    });
  }

  if (
    !input.body.error &&
    (!input.body.hasState || input.body.coverageStatus === "unobserved")
  ) {
    issues.push({
      id: "body-unobserved",
      domain: "body",
      message: "Estado corporal ainda não observado.",
      href: "/saude/evolucao",
    });
  }

  if (
    !input.recovery.error &&
    (!input.recovery.hasState ||
      input.recovery.coverages.every((coverage) => !isCoverageObserved(coverage)))
  ) {
    issues.push({
      id: "recovery-unobserved",
      domain: "recovery",
      message: "Sono e recuperação ainda sem cobertura observada.",
      href: "/saude/recuperacao",
    });
  }

  if (!input.exams.error && input.exams.pendingReviewCount > 0) {
    issues.push({
      id: "exams-review-pending",
      domain: "exams",
      message:
        input.exams.pendingReviewCount === 1
          ? "1 documento clínico aguarda revisão."
          : `${input.exams.pendingReviewCount} documentos clínicos aguardam revisão.`,
      href: "/saude/exames",
    });
  }

  return issues;
}
