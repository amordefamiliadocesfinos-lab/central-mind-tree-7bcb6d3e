import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  LockKeyhole,
  PauseCircle,
  Route,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  journeyStateLabel,
  type JourneyNextAction,
  type JourneyStage,
  type JourneyState,
} from "../journey/journeyModel";

function JourneyIcon({ state }: { state: JourneyState }) {
  if (state === "complete") return <CheckCircle2 className="h-4 w-4" />;
  if (state === "evaluated_paused") return <PauseCircle className="h-4 w-4" />;
  if (state === "in_progress") return <Clock3 className="h-4 w-4" />;
  if (state === "blocked") return <LockKeyhole className="h-4 w-4" />;
  if (state === "error") return <AlertCircle className="h-4 w-4" />;
  return <CircleDashed className="h-4 w-4" />;
}

function JourneyAction({
  action,
  evaluating,
  onEvaluate,
}: {
  action: JourneyNextAction;
  evaluating: boolean;
  onEvaluate: () => Promise<unknown>;
}) {
  if (action.code === "evaluate_integration") {
    return (
      <Button
        type="button"
        className="min-h-11 w-full sm:w-auto"
        disabled={evaluating}
        onClick={() => void onEvaluate()}
      >
        {evaluating ? "Avaliando..." : action.label}
      </Button>
    );
  }

  if (!action.href) return null;

  return (
    <Button asChild className="min-h-11 w-full sm:w-auto">
      <Link to={action.href}>{action.label}</Link>
    </Button>
  );
}

export function HealthJourneyF12({
  stages,
  nextAction,
  loading,
  evaluating,
  evaluationError,
  onEvaluate,
}: {
  stages: JourneyStage[];
  nextAction: JourneyNextAction | null;
  loading: boolean;
  evaluating: boolean;
  evaluationError: string | null;
  onEvaluate: () => Promise<unknown>;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-5">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-16 w-full" />
          <div className="grid gap-2 md:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasTechnicalError = stages.some((stage) => stage.journeyState === "error");
  const integratedBlocked = stages.some(
    (stage) =>
      stage.code === "integrated_decision" &&
      stage.journeyState === "blocked",
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Route className="h-4 w-4 text-primary" />
          Sua jornada CCH
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Organiza as etapas do seu acompanhamento. Isso representa processo e dados disponíveis, não uma nota de saúde.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Próximo passo
          </p>
          {nextAction ? (
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{nextAction.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{nextAction.reason}</p>
              </div>
              <JourneyAction
                action={nextAction}
                evaluating={evaluating}
                onEvaluate={onEvaluate}
              />
            </div>
          ) : (
            <div className="mt-2">
              <p className="text-sm font-medium">
                {hasTechnicalError
                  ? "Não foi possível determinar o próximo passo agora."
                  : integratedBlocked
                    ? "A jornada está pronta até o limite disponível neste ambiente."
                    : "A jornada atual já possui uma avaliação integrada."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasTechnicalError
                  ? "Uma etapa apresentou erro técnico; nenhum próximo passo foi inferido."
                  : integratedBlocked
                    ? "O motor integrado ainda não está operacional neste ambiente."
                    : "Revise a decisão integrada e seus motivos abaixo."}
              </p>
            </div>
          )}
          {evaluationError ? (
            <div className="mt-3 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Não foi possível executar a avaliação integrada.</span>
            </div>
          ) : null}
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {stages.map((stage, index) => (
            <div key={stage.code} className="rounded-xl border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-2">
                  <span className="mt-0.5 shrink-0 text-muted-foreground">
                    <JourneyIcon state={stage.journeyState} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {index + 1}. {stage.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{stage.evidence}</p>
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 whitespace-normal text-center">
                  {journeyStateLabel(stage.journeyState)}
                </Badge>
              </div>
              {stage.code !== "integrated_decision" ? (
                <Button asChild variant="ghost" size="sm" className="mt-2 min-h-10 px-2">
                  <Link to={stage.href}>Abrir etapa</Link>
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          A jornada não altera dieta, treino ou dados clínicos automaticamente. Uma avaliação integrada pode resultar em decisão pausada quando faltam dados suficientes.
        </p>
      </CardContent>
    </Card>
  );
}
