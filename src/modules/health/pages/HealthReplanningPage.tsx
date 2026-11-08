import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useHealthAthlete } from "../hooks/useHealthAthlete";
import {
  longitudinalDomainLabel,
  longitudinalOutcomeLabel,
  useHealthLongitudinalReviewF13,
} from "../hooks/useHealthLongitudinalReviewF13";
import {
  replanningCaseStatusLabel,
  replanningDecisionLabel,
  type ReplanningDecision,
  type ReplanningItem,
  useHealthReplanningF14,
} from "../hooks/useHealthReplanningF14";

function dateLabel(value: string | null | undefined) {
  if (!value) return "Não informado";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function specialistHref(domain: ReplanningItem["domain"]) {
  const routes: Record<ReplanningItem["domain"], string> = {
    goal: "/saude/perfil",
    training: "/saude/treino/programa",
    nutrition: "/saude/alimentacao",
    body: "/saude/evolucao",
    recovery: "/saude/recuperacao",
  };
  return routes[domain];
}

function ReplanningItemCard({
  item,
  saving,
  onSave,
}: {
  item: ReplanningItem;
  saving: boolean;
  onSave: (
    decision: Exclude<ReplanningDecision, "pending">,
    notes: string | null,
  ) => Promise<unknown>;
}) {
  const [decision, setDecision] = useState<
    "" | Exclude<ReplanningDecision, "pending">
  >(item.itemStatus === "pending" ? "" : item.itemStatus);
  const [notes, setNotes] = useState(item.decisionNotes ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  const save = async () => {
    if (!decision) return;
    setLocalError(null);
    try {
      await onSave(decision, notes.trim() || null);
    } catch {
      setLocalError("Não foi possível registrar esta decisão.");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base">
            {longitudinalDomainLabel(item.domain)}
          </CardTitle>
          <Badge variant="outline">
            {replanningDecisionLabel(item.itemStatus)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <label
            htmlFor={"f14-decision-" + item.id}
            className="text-sm font-medium"
          >
            Decisão humana
          </label>
          <select
            id={"f14-decision-" + item.id}
            value={decision}
            onChange={(event) =>
              setDecision(
                event.target.value as
                  | ""
                  | Exclude<ReplanningDecision, "pending">,
              )
            }
            className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Selecione</option>
            <option value="keep_current">Manter atual</option>
            <option value="revise">Revisar</option>
            <option value="defer">Adiar</option>
            <option value="not_applicable">Não se aplica</option>
          </select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor={"f14-notes-" + item.id}
            className="text-sm font-medium"
          >
            Notas opcionais
          </label>
          <Textarea
            id={"f14-notes-" + item.id}
            value={notes}
            maxLength={4000}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Registre o contexto da decisão. A mudança real continua no especialista."
          />
        </div>

        {localError ? (
          <p className="text-sm text-destructive">{localError}</p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="min-h-11 flex-1"
            disabled={!decision || saving}
            onClick={() => void save()}
          >
            Registrar decisão
          </Button>
          <Button asChild variant="outline" className="min-h-11 flex-1">
            <Link to={specialistHref(item.domain)}>
              Abrir especialista
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Este registro documenta a revisão. Ele não altera automaticamente o
          módulo especialista.
        </p>
      </CardContent>
    </Card>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

export function HealthReplanningPage() {
  const { athlete, loading: athleteLoading } = useHealthAthlete();
  const review = useHealthLongitudinalReviewF13(athlete?.id);
  const replanning = useHealthReplanningF14(athlete?.id);
  const [voidReason, setVoidReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  if (athleteLoading || review.loading || replanning.loading) {
    return <PageSkeleton />;
  }

  const sourceOutcome = review.outcome;
  const sourceRun = review.run;
  const sourceRequiresReplanning =
    Boolean(sourceOutcome) &&
    sourceOutcome?.outcomeCode !== "continue_observation";
  const caseMatchesCurrentOutcome =
    Boolean(replanning.currentCase && sourceOutcome) &&
    replanning.currentCase?.sourceReviewOutcomeId === sourceOutcome?.id;
  const pendingItems = replanning.items.filter(
    (item) => item.itemStatus === "pending",
  ).length;

  const openCase = async () => {
    if (!sourceRun) return;
    setLocalError(null);
    try {
      await replanning.openCase(sourceRun.id);
    } catch {
      setLocalError("Não foi possível abrir o caso de replanejamento.");
    }
  };

  const completeCase = async () => {
    if (!replanning.currentCase) return;
    setLocalError(null);
    try {
      await replanning.completeCase(replanning.currentCase.id);
    } catch {
      setLocalError("Não foi possível concluir o caso.");
    }
  };

  const voidCase = async () => {
    if (!replanning.currentCase || !voidReason.trim()) return;
    setLocalError(null);
    try {
      await replanning.voidCase(
        replanning.currentCase.id,
        voidReason.trim(),
      );
      setVoidReason("");
    } catch {
      setLocalError("Não foi possível anular o caso.");
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Replanejamento assistido
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Transforme uma revisão longitudinal em decisões humanas de
            acompanhamento. Nenhuma mudança é aplicada automaticamente.
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-11 shrink-0"
          onClick={() =>
            void Promise.all([review.reload(), replanning.reload()])
          }
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {!replanning.backendAvailable ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">
                  Replanejamento ainda não disponível neste ambiente.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  O schema F14 precisa estar operacional antes de registrar
                  casos. A tela não simula persistência local.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {replanning.error ? (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            Não foi possível concluir uma operação do replanejamento.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" />
            Revisão de origem
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!sourceRun ? (
            <div>
              <p className="text-sm text-muted-foreground">
                Ainda não existe revisão longitudinal para iniciar um
                replanejamento.
              </p>
              <Button asChild variant="outline" className="mt-3 min-h-11">
                <Link to="/saude/revisao">Abrir revisão longitudinal</Link>
              </Button>
            </div>
          ) : !sourceOutcome ? (
            <div>
              <p className="text-sm text-muted-foreground">
                A revisão existe, mas ainda não possui resultado humano.
              </p>
              <Button asChild variant="outline" className="mt-3 min-h-11">
                <Link to="/saude/revisao">Registrar resultado da revisão</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Data-base</p>
                  <p className="mt-1 text-sm font-medium">
                    {sourceRun.asOfDate}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">
                    Resultado humano
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {longitudinalOutcomeLabel(sourceOutcome.outcomeCode)}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Áreas</p>
                  <p className="mt-1 text-sm font-medium">
                    {sourceOutcome.targetDomains.length
                      ? sourceOutcome.targetDomains
                          .map(longitudinalDomainLabel)
                          .join(", ")
                      : "Sem área específica"}
                  </p>
                </div>
              </div>

              {sourceOutcome.outcomeCode === "continue_observation" ? (
                <p className="rounded-xl border p-3 text-sm text-muted-foreground">
                  O resultado atual é continuar observando. Não há caso de
                  replanejamento a abrir para este outcome.
                </p>
              ) : caseMatchesCurrentOutcome ? (
                <p className="text-xs text-muted-foreground">
                  O caso atual já está vinculado a este resultado da F13.
                </p>
              ) : (
                <Button
                  className="min-h-11 w-full sm:w-auto"
                  disabled={
                    !review.backendAvailable ||
                    !replanning.backendAvailable ||
                    replanning.saving
                  }
                  onClick={() => void openCase()}
                >
                  Abrir caso de replanejamento
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {localError ? (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            {localError}
          </CardContent>
        </Card>
      ) : null}

      {replanning.currentCase ? (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CardTitle className="text-base">Caso atual</CardTitle>
                <Badge variant="outline">
                  {replanningCaseStatusLabel(
                    replanning.currentCase.caseStatus,
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                Origem:{" "}
                {longitudinalOutcomeLabel(
                  replanning.currentCase.sourceOutcomeCode,
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Aberto em {dateLabel(replanning.currentCase.openedAt)}
              </p>
              <p className="text-xs text-muted-foreground">
                Este caso registra decisões humanas. Alterações reais devem ser
                feitas no módulo especialista.
              </p>
            </CardContent>
          </Card>

          {replanning.items.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {replanning.items.map((item) => (
                <ReplanningItemCard
                  key={item.id}
                  item={item}
                  saving={replanning.saving}
                  onSave={(decision, notes) =>
                    replanning.recordDecision({
                      caseId: replanning.currentCase!.id,
                      domain: item.domain,
                      decision,
                      notes,
                    })
                  }
                />
              ))}
            </div>
          ) : replanning.currentCase.sourceOutcomeCode ===
            "insufficient_data" ? (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                A revisão de origem registrou dados insuficientes e não definiu
                um domínio específico de replanejamento. O caso pode ser
                encerrado como registro humano sem aplicar mudanças.
              </CardContent>
            </Card>
          ) : null}

          {replanning.currentCase.caseStatus !== "completed" &&
          replanning.currentCase.caseStatus !== "voided" ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Fechamento do caso</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  className="min-h-11 w-full"
                  disabled={pendingItems > 0 || replanning.saving}
                  onClick={() => void completeCase()}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Concluir revisão do caso
                </Button>
                {pendingItems > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Ainda há {pendingItems}{" "}
                    {pendingItems === 1 ? "item pendente" : "itens pendentes"}.
                  </p>
                ) : null}

                <div className="border-t pt-4">
                  <label
                    htmlFor="f14-void-reason"
                    className="text-sm font-medium"
                  >
                    Anular caso
                  </label>
                  <Textarea
                    id="f14-void-reason"
                    value={voidReason}
                    maxLength={4000}
                    onChange={(event) => setVoidReason(event.target.value)}
                    placeholder="Informe o motivo da anulação."
                    className="mt-2"
                  />
                  <Button
                    variant="outline"
                    className="mt-2 min-h-11 w-full"
                    disabled={!voidReason.trim() || replanning.saving}
                    onClick={() => void voidCase()}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Anular caso
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      {replanning.history.length ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <RotateCcw className="h-4 w-4 text-primary" />
              Histórico de casos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {replanning.history.map((item) => (
              <div key={item.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium">
                    {longitudinalOutcomeLabel(item.sourceOutcomeCode)}
                  </p>
                  <Badge variant="outline">
                    {replanningCaseStatusLabel(item.caseStatus)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dateLabel(item.openedAt)}
                  {item.recordStatus === "superseded"
                    ? " · histórico supersedido"
                    : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        F14 organiza replanejamento humano. Ela não publica programa, altera
        dieta, muda objetivo ou executa decisão automaticamente.
      </p>
    </div>
  );
}
