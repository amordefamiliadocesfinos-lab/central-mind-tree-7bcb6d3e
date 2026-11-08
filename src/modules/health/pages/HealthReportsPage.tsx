import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Download,
  FileText,
  Printer,
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
  useHealthLongitudinalReviewF13,
} from "../hooks/useHealthLongitudinalReviewF13";
import {
  replanningCaseStatusLabel,
  replanningDecisionLabel,
  useHealthReplanningF14,
} from "../hooks/useHealthReplanningF14";

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

function valueLabel(value: unknown, suffix = "", digits = 1) {
  if (value == null) return "Não observado";
  if (typeof value !== "number") return String(value);
  return (
    new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: digits,
    }).format(value) + suffix
  );
}

function signedLabel(value: unknown, suffix = "", digits = 1) {
  if (value == null || typeof value !== "number") return "Não comparável";
  return (
    new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: digits,
      signDisplay: "always",
    }).format(value) + suffix
  );
}

function metric(
  source: Record<string, unknown> | null | undefined,
  key: string,
) {
  return source?.[key];
}

type MetricDefinition = {
  label: string;
  key: string;
  suffix?: string;
  digits?: number;
};

function ReportDomain({
  title,
  block,
  metrics,
}: {
  title: string;
  block: LongitudinalMetricBlock | undefined;
  metrics: MetricDefinition[];
}) {
  const available = block?.status === "available";

  return (
    <Card className="break-inside-avoid">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="outline">
            {available ? "Comparável" : "Não comparável"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!available ? (
          <p className="text-sm text-muted-foreground">
            Não há dois períodos comparáveis para este domínio.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="hidden grid-cols-[1.4fr_repeat(3,1fr)] gap-2 text-xs font-medium text-muted-foreground sm:grid">
              <span>Métrica</span>
              <span>Atual</span>
              <span>Anterior</span>
              <span>Diferença</span>
            </div>
            {metrics.map((item) => (
              <div
                key={item.key}
                className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1.4fr_repeat(3,1fr)]"
              >
                <p className="text-sm font-medium">{item.label}</p>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground sm:hidden">
                    Atual
                  </p>
                  <p className="text-sm">
                    {valueLabel(
                      metric(block.current, item.key),
                      item.suffix,
                      item.digits,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground sm:hidden">
                    Anterior
                  </p>
                  <p className="text-sm">
                    {valueLabel(
                      metric(block.prior, item.key),
                      item.suffix,
                      item.digits,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground sm:hidden">
                    Diferença
                  </p>
                  <p className="text-sm">
                    {signedLabel(
                      metric(block.delta, item.key),
                      item.suffix,
                      item.digits,
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function HealthReportsPage() {
  const { athlete, loading: athleteLoading } = useHealthAthlete();
  const review = useHealthLongitudinalReviewF13(athlete?.id);
  const replanning = useHealthReplanningF14(athlete?.id);

  const caseForReport =
    replanning.currentCase &&
    review.run &&
    replanning.currentCase.sourceReviewRunId === review.run.id
      ? replanning.currentCase
      : null;

  const itemsForReport = caseForReport ? replanning.items : [];

  const snapshot = useMemo(
    () => ({
      schema: "CCH_LONGITUDINAL_REPORT_V1",
      generated_at: new Date().toISOString(),
      athlete: {
        display_name: athlete?.display_name ?? null,
      },
      longitudinal_review: review.run,
      human_review_outcome: review.outcome,
      replanning_case: caseForReport,
      replanning_items: itemsForReport,
      limitations: {
        diagnostic_report: false,
        causal_inference: false,
        automatic_replanning: false,
        specialist_mutation: false,
      },
    }),
    [
      athlete?.display_name,
      caseForReport,
      itemsForReport,
      review.outcome,
      review.run,
    ],
  );

  if (athleteLoading || review.loading || replanning.loading) {
    return <PageSkeleton />;
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cch-relatorio-longitudinal-${
      review.run?.asOfDate ?? "sem-data"
    }.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const evidence = review.run?.evidence;

  return (
    <div className="space-y-4 pb-4 print:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:block">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Relatório longitudinal
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Síntese de acompanhamento com origem, período e limitações
            preservados.
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={!review.run}
            onClick={() => window.print()}
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / PDF
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={!review.run}
            onClick={exportJson}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar JSON
          </Button>
        </div>
      </div>

      {!review.backendAvailable ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">
                  Relatório longitudinal ainda não disponível neste ambiente.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  A F15 depende de uma revisão F13 real. Nenhum relatório vazio
                  será apresentado como completo.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!review.run ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Ainda não existe revisão longitudinal para compor este relatório.
            </p>
            <Button asChild variant="outline" className="mt-3 min-h-11 print:hidden">
              <Link to="/saude/revisao">Abrir revisão longitudinal</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="break-inside-avoid">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Identificação e períodos
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">Atleta</p>
                <p className="mt-1 text-sm font-medium">
                  {athlete?.display_name ?? "Não informado"}
                </p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">Data-base</p>
                <p className="mt-1 text-sm font-medium">
                  {dateLabel(review.run.asOfDate)}
                </p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">
                  Período atual
                </p>
                <p className="mt-1 text-sm font-medium">
                  {dateLabel(review.run.currentStartDate)} —{" "}
                  {dateLabel(review.run.currentEndDate)}
                </p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">
                  Período anterior
                </p>
                <p className="mt-1 text-sm font-medium">
                  {dateLabel(review.run.priorStartDate)} —{" "}
                  {dateLabel(review.run.priorEndDate)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="break-inside-avoid">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cobertura longitudinal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
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
              <p className="text-xs text-muted-foreground">
                Status da revisão:{" "}
                {review.run.runStatus === "available"
                  ? "disponível"
                  : "pausada"}
                .
              </p>
            </CardContent>
          </Card>

          <ReportDomain
            title="Treino"
            block={evidence?.training}
            metrics={[
              {
                label: "Sessões concluídas",
                key: "completed_session_count",
                digits: 0,
              },
              {
                label: "Séries concluídas",
                key: "completed_set_count",
                digits: 0,
              },
              {
                label: "Exercícios distintos",
                key: "distinct_exercise_count",
                digits: 0,
              },
            ]}
          />

          <ReportDomain
            title="Alimentação"
            block={evidence?.nutrition}
            metrics={[
              {
                label: "Energia média",
                key: "avg_energy_kcal",
                suffix: " kcal",
                digits: 0,
              },
              {
                label: "Proteína média",
                key: "avg_protein_g",
                suffix: " g",
                digits: 1,
              },
              {
                label: "Dias observados",
                key: "observed_day_count",
                digits: 0,
              },
            ]}
          />

          <ReportDomain
            title="Evolução corporal"
            block={evidence?.body}
            metrics={[
              {
                label: "Peso final",
                key: "weight_latest_kg",
                suffix: " kg",
                digits: 1,
              },
              {
                label: "Cintura final",
                key: "waist_latest_cm",
                suffix: " cm",
                digits: 1,
              },
              {
                label: "Gordura corporal",
                key: "body_fat_latest_pct",
                suffix: " %",
                digits: 1,
              },
            ]}
          />

          <ReportDomain
            title="Sono e recuperação"
            block={evidence?.recovery}
            metrics={[
              {
                label: "Sono médio",
                key: "average_sleep_minutes",
                suffix: " min",
                digits: 0,
              },
              {
                label: "Recuperação média",
                key: "average_recovery",
                digits: 1,
              },
              {
                label: "Fadiga média",
                key: "average_fatigue",
                digits: 1,
              },
            ]}
          />

          <Card className="break-inside-avoid">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Revisão humana</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {review.outcome ? (
                <>
                  <p className="text-sm font-medium">
                    {longitudinalOutcomeLabel(review.outcome.outcomeCode)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Áreas:{" "}
                    {review.outcome.targetDomains.length
                      ? review.outcome.targetDomains
                          .map(longitudinalDomainLabel)
                          .join(", ")
                      : "sem área específica"}
                  </p>
                  {review.outcome.notes ? (
                    <p className="rounded-lg border p-3 text-sm">
                      {review.outcome.notes}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum outcome humano foi registrado para esta revisão.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="break-inside-avoid">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Replanejamento assistido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!replanning.backendAvailable ? (
                <p className="text-sm text-muted-foreground">
                  F14 ainda não está operacional neste ambiente.
                </p>
              ) : !caseForReport ? (
                <p className="text-sm text-muted-foreground">
                  Não há caso F14 vinculado a esta revisão.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {replanningCaseStatusLabel(caseForReport.caseStatus)}
                    </Badge>
                    <Badge variant="outline">
                      {longitudinalOutcomeLabel(
                        caseForReport.sourceOutcomeCode,
                      )}
                    </Badge>
                  </div>
                  {itemsForReport.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {longitudinalDomainLabel(item.domain)}
                        </p>
                        <Badge variant="outline">
                          {replanningDecisionLabel(item.itemStatus)}
                        </Badge>
                      </div>
                      {item.decisionNotes ? (
                        <p className="mt-2 text-sm">{item.decisionNotes}</p>
                      ) : null}
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="break-inside-avoid">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Limitações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>Este relatório não é diagnóstico.</p>
              <p>Diferença entre períodos não prova causalidade.</p>
              <p>Ausência de dado não é convertida em zero.</p>
              <p>Nenhum ajuste de treino, dieta ou meta é aplicado por este relatório.</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
