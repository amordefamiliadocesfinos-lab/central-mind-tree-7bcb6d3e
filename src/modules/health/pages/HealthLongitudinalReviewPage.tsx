import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CalendarRange,
  ClipboardCheck,
  Dumbbell,
  History,
  MoonStar,
  RefreshCw,
  Scale,
  Utensils,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealthAthlete } from "../hooks/useHealthAthlete";
import {
  longitudinalDomainLabel,
  longitudinalOutcomeLabel,
  type LongitudinalMetricBlock,
  type LongitudinalReviewOutcome,
  useHealthLongitudinalReviewF13,
} from "../hooks/useHealthLongitudinalReviewF13";

function dateLabel(value: string | null | undefined) {
  if (!value) return "Não informado";
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function numberValue(value: unknown, digits = 1) {
  if (value == null || typeof value !== "number") return "Não observado";
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
  }).format(value);
}

function signedValue(value: unknown, suffix = "", digits = 1) {
  if (value == null || typeof value !== "number") return "Não comparável";
  const formatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
    signDisplay: "always",
  }).format(value);
  return `${formatted}${suffix}`;
}

function textValue(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key];
  return typeof value === "string" ? value : null;
}

function numericValue(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key];
  return typeof value === "number" ? value : null;
}

function ComparisonRow({
  label,
  current,
  prior,
  delta,
}: {
  label: string;
  current: string;
  prior: string;
  delta: string;
}) {
  return (
    <div className="grid gap-2 rounded-lg border p-2.5 sm:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] sm:items-center">
      <p className="text-xs font-medium sm:text-sm">{label}</p>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:hidden">Atual</p>
        <p className="text-sm">{current}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:hidden">Anterior</p>
        <p className="text-sm">{prior}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:hidden">Diferença</p>
        <p className="text-sm">{delta}</p>
      </div>
    </div>
  );
}

function ComparisonHeader() {
  return (
    <div className="hidden grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] gap-2 px-2.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
      <span>Métrica</span>
      <span>Atual</span>
      <span>Anterior</span>
      <span>Diferença</span>
    </div>
  );
}

function DomainCard({
  title,
  icon,
  block,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  block: LongitudinalMetricBlock | undefined;
  children: React.ReactNode;
}) {
  const available = block?.status === "available";
  const currentCoverage = textValue(block?.current, "coverage_status");
  const priorCoverage = textValue(block?.prior, "coverage_status");
  const currentConfidence = textValue(block?.current, "confidence");
  const priorConfidence = textValue(block?.prior, "confidence");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {title}
          </CardTitle>
          <Badge variant="outline">{available ? "Comparável" : "Não comparável"}</Badge>
        </div>
        {available && (currentCoverage || priorCoverage || currentConfidence || priorConfidence) ? (
          <p className="text-xs text-muted-foreground">
            Atual: {currentCoverage ?? "cobertura não informada"}
            {currentConfidence ? ` · confiança ${currentConfidence}` : ""}
            {" · "}
            Anterior: {priorCoverage ?? "cobertura não informada"}
            {priorConfidence ? ` · confiança ${priorConfidence}` : ""}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {available ? (
          <>
            <ComparisonHeader />
            {children}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Não há dois estados comparáveis para este domínio nesta revisão.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-24 w-full" />
      {[1, 2, 3].map((item) => (
        <Skeleton key={item} className="h-44 w-full" />
      ))}
    </div>
  );
}

const outcomeOptions: Array<{
  code: LongitudinalReviewOutcome["outcomeCode"];
  label: string;
}> = [
  { code: "continue_observation", label: "Continuar observando" },
  { code: "review_goal", label: "Revisar objetivo/fase" },
  { code: "review_training", label: "Revisar treino" },
  { code: "review_nutrition", label: "Revisar alimentação" },
  { code: "review_recovery", label: "Revisar recuperação" },
  { code: "review_multiple", label: "Revisar múltiplas áreas" },
  { code: "insufficient_data", label: "Dados insuficientes" },
];

const targetOptions = ["goal", "training", "nutrition", "body", "recovery"] as const;

function automaticTargets(code: LongitudinalReviewOutcome["outcomeCode"]) {
  if (code === "review_goal") return ["goal"];
  if (code === "review_training") return ["training"];
  if (code === "review_nutrition") return ["nutrition"];
  if (code === "review_recovery") return ["recovery"];
  return [];
}

export function HealthLongitudinalReviewPage() {
  const { athlete, loading: athleteLoading } = useHealthAthlete();
  const review = useHealthLongitudinalReviewF13(athlete?.id);
  const [outcomeCode, setOutcomeCode] =
    useState<LongitudinalReviewOutcome["outcomeCode"]>("continue_observation");
  const [targets, setTargets] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const selectableTargets =
    outcomeCode === "review_multiple" || outcomeCode === "insufficient_data";

  const submitTargets = useMemo(
    () => (selectableTargets ? targets : automaticTargets(outcomeCode)),
    [outcomeCode, selectableTargets, targets],
  );

  if (athleteLoading || review.loading) return <PageSkeleton />;

  const evidence = review.run?.evidence;
  const training = evidence?.training;
  const nutrition = evidence?.nutrition;
  const body = evidence?.body;
  const recovery = evidence?.recovery;
  const f11 = evidence?.integrated_decision_context;
  const goal = evidence?.goal_context;
  const phase = evidence?.phase_context;

  const submitOutcome = async () => {
    setLocalError(null);
    if (outcomeCode === "review_multiple" && submitTargets.length < 2) {
      setLocalError("Selecione pelo menos duas áreas para uma revisão múltipla.");
      return;
    }

    try {
      await review.recordOutcome({
        outcomeCode,
        targetDomains: submitTargets,
        notes: notes.trim() || null,
      });
      setNotes("");
    } catch {
      // The hook exposes the backend error in a controlled surface.
    }
  };

  const toggleTarget = (target: string) => {
    setTargets((current) =>
      current.includes(target)
        ? current.filter((item) => item !== target)
        : [...current, target],
    );
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Revisão longitudinal</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Compare períodos reais e registre uma revisão. As diferenças não são uma nota de saúde nem uma recomendação automática.
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-11 shrink-0"
          onClick={() => void review.reload()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {!review.backendAvailable ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Revisão longitudinal ainda não disponível neste ambiente.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  O schema F13 precisa estar operacional antes desta tela funcionar neste ambiente.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {review.error ? (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            Não foi possível concluir uma operação da revisão longitudinal.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarRange className="h-4 w-4 text-primary" />
              Períodos comparados
            </CardTitle>
            {review.run ? (
              <div className="flex gap-1">
                {review.run.historical ? <Badge variant="outline">Histórico</Badge> : null}
                <Badge variant="outline">
                  {review.run.runStatus === "available" ? "Disponível" : "Pausada"}
                </Badge>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {review.run ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Período atual · 28 dias</p>
                  <p className="mt-1 text-sm font-medium">
                    {dateLabel(review.run.currentStartDate)} <ArrowRight className="mx-1 inline h-3 w-3" /> {dateLabel(review.run.currentEndDate)}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Período anterior · 28 dias</p>
                  <p className="mt-1 text-sm font-medium">
                    {dateLabel(review.run.priorStartDate)} <ArrowRight className="mx-1 inline h-3 w-3" /> {dateLabel(review.run.priorEndDate)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {review.run.availableDomains.map((domain) => (
                  <Badge key={domain} variant="outline">
                    {longitudinalDomainLabel(domain)} comparável
                  </Badge>
                ))}
                {review.run.unavailableDomains.map((domain) => (
                  <Badge key={domain} variant="outline">
                    {longitudinalDomainLabel(domain)} indisponível
                  </Badge>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ainda não existe uma revisão longitudinal materializada.
            </p>
          )}

          <Button
            className="min-h-11 w-full sm:w-auto"
            disabled={!review.backendAvailable || review.generating}
            onClick={() => void review.generateReview()}
          >
            {review.generating ? "Gerando revisão..." : "Gerar revisão longitudinal"}
          </Button>
          <p className="text-xs text-muted-foreground">
            A geração compara dados existentes e grava um snapshot auditável. Ela não muda treino, alimentação ou metas.
          </p>
        </CardContent>
      </Card>

      {review.run ? (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contexto do objetivo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">Objetivo principal</p>
                <p className="mt-1 text-sm font-medium">
                  {textValue(goal, "title") ?? "Não registrado"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {textValue(goal, "goal_type") ?? "Sem tipo"} · alvo {dateLabel(textValue(goal, "target_date"))}
                </p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">Fase ativa</p>
                <p className="mt-1 text-sm font-medium">
                  {textValue(phase, "title") ?? "Não registrada"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {textValue(phase, "phase_type") ?? "Sem fase"}
                </p>
              </div>
            </CardContent>
          </Card>

          <DomainCard
            title="Treino"
            icon={<Dumbbell className="h-4 w-4 text-primary" />}
            block={training}
          >
            <ComparisonRow
              label="Sessões concluídas"
              current={numberValue(numericValue(training?.current, "completed_session_count"), 0)}
              prior={numberValue(numericValue(training?.prior, "completed_session_count"), 0)}
              delta={signedValue(numericValue(training?.delta, "completed_session_count"), "", 0)}
            />
            <ComparisonRow
              label="Séries concluídas"
              current={numberValue(numericValue(training?.current, "completed_set_count"), 0)}
              prior={numberValue(numericValue(training?.prior, "completed_set_count"), 0)}
              delta={signedValue(numericValue(training?.delta, "completed_set_count"), "", 0)}
            />
            <ComparisonRow
              label="Exercícios distintos"
              current={numberValue(numericValue(training?.current, "distinct_exercise_count"), 0)}
              prior={numberValue(numericValue(training?.prior, "distinct_exercise_count"), 0)}
              delta={signedValue(numericValue(training?.delta, "distinct_exercise_count"), "", 0)}
            />
          </DomainCard>

          <DomainCard
            title="Alimentação"
            icon={<Utensils className="h-4 w-4 text-primary" />}
            block={nutrition}
          >
            <ComparisonRow
              label="Energia média"
              current={`${numberValue(numericValue(nutrition?.current, "avg_energy_kcal"), 0)} kcal`}
              prior={`${numberValue(numericValue(nutrition?.prior, "avg_energy_kcal"), 0)} kcal`}
              delta={signedValue(numericValue(nutrition?.delta, "avg_energy_kcal"), " kcal", 0)}
            />
            <ComparisonRow
              label="Proteína média"
              current={`${numberValue(numericValue(nutrition?.current, "avg_protein_g"))} g`}
              prior={`${numberValue(numericValue(nutrition?.prior, "avg_protein_g"))} g`}
              delta={signedValue(numericValue(nutrition?.delta, "avg_protein_g"), " g")}
            />
            <ComparisonRow
              label="Dias observados"
              current={numberValue(numericValue(nutrition?.current, "observed_day_count"), 0)}
              prior={numberValue(numericValue(nutrition?.prior, "observed_day_count"), 0)}
              delta={signedValue(numericValue(nutrition?.delta, "observed_day_count"), "", 0)}
            />
          </DomainCard>

          <DomainCard
            title="Evolução corporal"
            icon={<Scale className="h-4 w-4 text-primary" />}
            block={body}
          >
            <ComparisonRow
              label="Peso final do período"
              current={`${numberValue(numericValue(body?.current, "weight_latest_kg"))} kg`}
              prior={`${numberValue(numericValue(body?.prior, "weight_latest_kg"))} kg`}
              delta={signedValue(numericValue(body?.delta, "weight_latest_kg"), " kg")}
            />
            <ComparisonRow
              label="Cintura final"
              current={`${numberValue(numericValue(body?.current, "waist_latest_cm"))} cm`}
              prior={`${numberValue(numericValue(body?.prior, "waist_latest_cm"))} cm`}
              delta={signedValue(numericValue(body?.delta, "waist_latest_cm"), " cm")}
            />
            <ComparisonRow
              label="Gordura corporal final"
              current={`${numberValue(numericValue(body?.current, "body_fat_latest_pct"))} %`}
              prior={`${numberValue(numericValue(body?.prior, "body_fat_latest_pct"))} %`}
              delta={signedValue(numericValue(body?.delta, "body_fat_latest_pct"), " p.p.")}
            />
          </DomainCard>

          <DomainCard
            title="Sono e recuperação"
            icon={<MoonStar className="h-4 w-4 text-primary" />}
            block={recovery}
          >
            <ComparisonRow
              label="Sono médio"
              current={`${numberValue(numericValue(recovery?.current, "average_sleep_minutes"), 0)} min`}
              prior={`${numberValue(numericValue(recovery?.prior, "average_sleep_minutes"), 0)} min`}
              delta={signedValue(numericValue(recovery?.delta, "average_sleep_minutes"), " min", 0)}
            />
            <ComparisonRow
              label="Recuperação média"
              current={numberValue(numericValue(recovery?.current, "average_recovery"))}
              prior={numberValue(numericValue(recovery?.prior, "average_recovery"))}
              delta={signedValue(numericValue(recovery?.delta, "average_recovery"))}
            />
            <ComparisonRow
              label="Fadiga média"
              current={numberValue(numericValue(recovery?.current, "average_fatigue"))}
              prior={numberValue(numericValue(recovery?.prior, "average_fatigue"))}
              delta={signedValue(numericValue(recovery?.delta, "average_fatigue"))}
            />
          </DomainCard>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                Decisão integrada — contexto
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Contexto histórico F11. Não é usado para afirmar causalidade.
              </p>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {(["current_period", "prior_period"] as const).map((key) => {
                const value = f11?.[key];
                return (
                  <div key={key} className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">
                      {key === "current_period" ? "Período atual" : "Período anterior"}
                    </p>
                    {value ? (
                      <>
                        <p className="mt-1 text-sm font-medium">
                          {textValue(value, "run_status") ?? "Estado não informado"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {dateLabel(textValue(value, "as_of_date"))}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">Sem decisão integrada no período.</p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resultado da revisão</CardTitle>
              <p className="text-xs text-muted-foreground">
                Este registro é humano e não aplica mudanças automaticamente.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {review.outcome ? (
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Resultado atual</p>
                  <p className="mt-1 text-sm font-medium">
                    {longitudinalOutcomeLabel(review.outcome.outcomeCode)}
                  </p>
                  {review.outcome.targetDomains.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Áreas: {review.outcome.targetDomains.map(longitudinalDomainLabel).join(", ")}
                    </p>
                  ) : null}
                  {review.outcome.notes ? (
                    <p className="mt-2 text-sm">{review.outcome.notes}</p>
                  ) : null}
                  {review.outcome.outcomeCode !== "continue_observation" ? (
                    <Button asChild variant="outline" className="mt-3 min-h-11">
                      <Link to="/saude/replanejamento">
                        Abrir replanejamento
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2">
                <label htmlFor="f13-outcome" className="text-sm font-medium">
                  Registrar resultado humano
                </label>
                <select
                  id="f13-outcome"
                  value={outcomeCode}
                  onChange={(event) => {
                    setOutcomeCode(event.target.value as LongitudinalReviewOutcome["outcomeCode"]);
                    setTargets([]);
                    setLocalError(null);
                  }}
                  className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {outcomeOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectableTargets ? (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Áreas da revisão</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {targetOptions.map((target) => (
                      <label
                        key={target}
                        className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={targets.includes(target)}
                          onChange={() => toggleTarget(target)}
                        />
                        {longitudinalDomainLabel(target)}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              <div className="space-y-2">
                <label htmlFor="f13-notes" className="text-sm font-medium">
                  Notas opcionais
                </label>
                <textarea
                  id="f13-notes"
                  value={notes}
                  maxLength={4000}
                  onChange={(event) => setNotes(event.target.value)}
                  className="min-h-24 w-full rounded-md border bg-background p-3 text-sm"
                  placeholder="Registre o contexto da revisão sem transformar observações em diagnóstico."
                />
              </div>

              {localError ? (
                <p className="text-sm text-destructive">{localError}</p>
              ) : null}

              <Button
                className="min-h-11 w-full sm:w-auto"
                disabled={review.savingOutcome}
                onClick={() => void submitOutcome()}
              >
                {review.savingOutcome ? "Registrando..." : "Registrar resultado"}
              </Button>
            </CardContent>
          </Card>

          {review.history.length ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4 text-primary" />
                  Histórico de revisões
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {review.history.map((item) => (
                  <div key={item.id} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium">
                        {longitudinalOutcomeLabel(item.outcomeCode)}
                      </p>
                      <Badge variant="outline">
                        {item.recordStatus === "current" ? "Atual" : "Histórico"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dateLabel(item.reviewedAt)}
                      {item.targetDomains.length
                        ? ` · ${item.targetDomains.map(longitudinalDomainLabel).join(", ")}`
                        : ""}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      <p className="text-xs text-muted-foreground">
        A F13 v1 compara períodos e registra revisão humana. Ela não muda automaticamente treino, alimentação, objetivo ou qualquer dado clínico.
      </p>
    </div>
  );
}
