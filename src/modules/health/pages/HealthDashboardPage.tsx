import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  FlaskConical,
  MoonStar,
  RefreshCw,
  TrendingUp,
  Utensils,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealthAthlete } from "../hooks/useHealthAthlete";
import { useHealthDashboardF10 } from "../hooks/useHealthDashboardF10";
import { formatMinutes, type DashboardFreshness } from "../dashboard/dashboardModel";

function dateLabel(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function dateTimeLabel(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function numberLabel(value: number | null | undefined, digits = 1) {
  if (value == null) return "Não observado";
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
  }).format(value);
}

function confidenceLabel(value: string | null | undefined) {
  if (!value) return null;
  const labels: Record<string, string> = {
    low: "confiança baixa",
    moderate: "confiança moderada",
    high: "confiança alta",
  };
  return labels[value] ?? value;
}

function coverageLabel(value: string | null | undefined) {
  if (!value) return null;
  const labels: Record<string, string> = {
    unobserved: "não observado",
    sparse: "cobertura escassa",
    partial: "cobertura parcial",
    complete: "cobertura completa",
  };
  return labels[value] ?? value;
}

function decisionLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    READY: "Pronta",
    DECISION_PAUSED: "Pausada",
    BLOCKED: "Bloqueada",
    OVERRIDDEN: "Substituída",
  };
  return value ? labels[value] ?? value : "Ainda não avaliada";
}

function vitalLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    blood_pressure: "Pressão arterial",
    resting_heart_rate: "Frequência cardíaca",
    temperature: "Temperatura",
    oxygen_saturation: "Saturação",
    respiratory_rate: "Frequência respiratória",
    blood_glucose: "Glicemia",
  };
  return value ? labels[value] ?? value : null;
}

function historicalNote(freshness: DashboardFreshness, asOf: string | null) {
  if (freshness !== "historical" || !asOf) return null;
  return `Última leitura em ${dateLabel(asOf)}`;
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function DomainCard({
  title,
  icon,
  href,
  cta,
  error,
  freshness,
  asOf,
  confidence,
  coverage,
  children,
}: {
  title: string;
  icon: ReactNode;
  href: string;
  cta: string;
  error?: string | null;
  freshness: DashboardFreshness;
  asOf?: string | null;
  confidence?: string | null;
  coverage?: string | null;
  children: ReactNode;
}) {
  const historical = historicalNote(freshness, asOf ?? null);
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {title}
          </CardTitle>
          <div className="flex flex-wrap justify-end gap-1">
            {historical ? <Badge variant="outline">Histórico</Badge> : null}
            {confidence ? <Badge variant="outline">{confidenceLabel(confidence)}</Badge> : null}
          </div>
        </div>
        {historical ? <p className="text-xs text-muted-foreground">{historical}</p> : null}
        {coverage ? <p className="text-xs text-muted-foreground">{coverageLabel(coverage)}</p> : null}
      </CardHeader>
      <CardContent className="flex h-[calc(100%-4rem)] flex-col gap-3">
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <div className="flex gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Não foi possível carregar este domínio.</span>
            </div>
          </div>
        ) : children}
        <div className="mt-auto pt-1">
          <Button asChild variant="outline" className="min-h-11 w-full justify-between">
            <Link to={href}>
              {cta}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4, 5].map((item) => (
          <Card key={item} className={item === 1 ? "lg:col-span-2" : undefined}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-5 w-36" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
              <Skeleton className="h-11 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function HealthDashboardPage() {
  const { athlete, loading: athleteLoading } = useHealthAthlete();
  const dashboard = useHealthDashboardF10(athlete?.id);
  const today = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  if (athleteLoading || dashboard.loading) return <DashboardSkeleton />;

  const visibleIssues = dashboard.issues.slice(0, 3);
  const extraIssueCount = Math.max(0, dashboard.issues.length - visibleIssues.length);

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Hoje</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão integrada dos seus dados. Cada área mantém sua própria fonte e confiança.
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs capitalize text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {today}
            {athlete?.display_name ? ` · ${athlete.display_name}` : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" className="min-h-10 shrink-0" onClick={() => void dashboard.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {visibleIssues.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pendências operacionais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleIssues.map((issue) => (
              <Link
                key={issue.id}
                to={issue.href}
                className="flex min-h-11 items-center justify-between gap-3 rounded-xl border p-3 text-sm transition-colors hover:bg-muted/40"
              >
                <span>{issue.message}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
            {extraIssueCount > 0 ? (
              <p className="px-1 text-xs text-muted-foreground">
                +{extraIssueCount} pendência{extraIssueCount > 1 ? "s" : ""} disponível{extraIssueCount > 1 ? "eis" : ""} nos módulos especialistas.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <DomainCard
            title="Treino"
            icon={<Dumbbell className="h-4 w-4 text-primary" />}
            href="/saude/treino"
            cta={dashboard.training.activeSession ? "Continuar treino" : "Ver treino"}
            error={dashboard.training.error}
            freshness={dashboard.training.freshness}
            asOf={dashboard.training.asOf}
          >
            {dashboard.training.activeSession ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <Metric label="Estado" value={dashboard.training.activeSession.status === "paused" ? "Pausado" : "Em andamento"} />
                <Metric label="Sessão" value={dashboard.training.activeSession.templateName ?? "Sessão atual"} />
                <Metric label="Início" value={dateTimeLabel(dashboard.training.activeSession.startedAt) ?? "Não informado"} />
              </div>
            ) : dashboard.training.nextQueue ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <Metric label="Próximo treino" value={dashboard.training.nextQueue.templateName ?? "Sessão programada"} />
                <Metric label="Fila" value={`Posição ${dashboard.training.nextQueue.queuePosition}`} />
                <Metric label="Estado" value={dashboard.training.nextQueue.state} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum treino ativo ou programado.</p>
            )}
          </DomainCard>
        </div>

        <DomainCard
          title="Alimentação"
          icon={<Utensils className="h-4 w-4 text-primary" />}
          href="/saude/alimentacao"
          cta="Ver alimentação"
          error={dashboard.nutrition.error}
          freshness={dashboard.nutrition.freshness}
          asOf={dashboard.nutrition.asOf}
          confidence={dashboard.nutrition.confidence}
          coverage={dashboard.nutrition.coverage}
        >
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Refeições hoje" value={dashboard.nutrition.daily ? dashboard.nutrition.daily.observedMealCount : "Não observado"} />
            <Metric label="Itens hoje" value={dashboard.nutrition.daily ? dashboard.nutrition.daily.observedItemCount : "Não observado"} />
            <Metric label="Energia" value={dashboard.nutrition.daily?.energyKcal == null ? "Não observado" : `${numberLabel(dashboard.nutrition.daily.energyKcal, 0)} kcal`} />
            <Metric label="Proteína" value={dashboard.nutrition.daily?.proteinG == null ? "Não observado" : `${numberLabel(dashboard.nutrition.daily.proteinG)} g`} />
          </div>
          <div className="rounded-xl border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Decisão nutricional</span>
              <span className="font-medium">{decisionLabel(dashboard.nutrition.decision?.status)}</span>
            </div>
            {dashboard.nutrition.rolling7 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                7 dias: {dashboard.nutrition.rolling7.observedDayCount} dias observados · {coverageLabel(dashboard.nutrition.rolling7.coverageStatus)}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Sem estado longitudinal de 7 dias.</p>
            )}
          </div>
        </DomainCard>

        <DomainCard
          title="Sono e recuperação"
          icon={<MoonStar className="h-4 w-4 text-primary" />}
          href="/saude/recuperacao"
          cta="Ver recuperação"
          error={dashboard.recovery.error}
          freshness={dashboard.recovery.freshness}
          asOf={dashboard.recovery.asOf}
          confidence={dashboard.recovery.confidence}
          coverage={dashboard.recovery.coverage}
        >
          {dashboard.recovery.state ? (
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Sono médio" value={formatMinutes(dashboard.recovery.state.averageSleepMinutes) ?? "Dados insuficientes"} />
              <Metric label="Sono observado" value={`${dashboard.recovery.state.sleepDurationObservedDays} dias`} />
              <Metric label="Recuperação" value={dashboard.recovery.state.averageRecovery == null ? "Dados insuficientes" : numberLabel(dashboard.recovery.state.averageRecovery, 2)} />
              <Metric label="Fadiga" value={dashboard.recovery.state.averageFatigue == null ? "Dados insuficientes" : numberLabel(dashboard.recovery.state.averageFatigue, 2)} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sono e recuperação ainda sem cobertura observada.</p>
          )}
          <p className="text-xs text-muted-foreground">Este card não autoriza ou altera treino.</p>
        </DomainCard>

        <DomainCard
          title="Evolução corporal"
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
          href="/saude/evolucao"
          cta="Ver evolução"
          error={dashboard.body.error}
          freshness={dashboard.body.freshness}
          asOf={dashboard.body.asOf}
          confidence={dashboard.body.confidence}
          coverage={dashboard.body.coverage}
        >
          {dashboard.body.state ? (
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Peso" value={dashboard.body.state.weightLatestKg == null ? "Não observado" : `${numberLabel(dashboard.body.state.weightLatestKg)} kg`} />
              <Metric label="Tendência" value={dashboard.body.state.weightTrendKgPerWeek == null ? "Não observado" : `${numberLabel(dashboard.body.state.weightTrendKgPerWeek)} kg/sem`} />
              <Metric label="Cintura" value={dashboard.body.state.waistLatestCm == null ? "Não observado" : `${numberLabel(dashboard.body.state.waistLatestCm)} cm`} />
              <Metric label="Gordura corporal" value={dashboard.body.state.bodyFatLatestPct == null ? "Não observado" : `${numberLabel(dashboard.body.state.bodyFatLatestPct)}%`} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Estado corporal ainda não observado.</p>
          )}
          <p className="text-xs text-muted-foreground">Estado corporal não é recomendação nutricional.</p>
        </DomainCard>

        <DomainCard
          title="Exames e biomarcadores"
          icon={<FlaskConical className="h-4 w-4 text-primary" />}
          href="/saude/exames"
          cta="Ver exames"
          error={dashboard.exams.error}
          freshness={dashboard.exams.freshness}
          asOf={dashboard.exams.asOf}
          confidence={dashboard.exams.confidence}
        >
          <div className="grid grid-cols-2 gap-2">
            <Metric
              label="Último exame"
              value={
                dashboard.exams.latestReport
                  ? dateLabel(
                      dashboard.exams.latestReport.collectedAt ??
                      dashboard.exams.latestReport.resultedAt ??
                      dashboard.exams.latestReport.createdAt,
                    )
                  : "Nenhum confirmado"
              }
            />
            <Metric
              label="Marcadores"
              value={dashboard.exams.latestReportMarkerCount == null ? "Não observado" : dashboard.exams.latestReportMarkerCount}
            />
            <Metric
              label="Estados longitudinais"
              value={dashboard.exams.longitudinalStateCount || "Nenhum"}
            />
            <Metric
              label="Último sinal"
              value={
                dashboard.exams.latestVital
                  ? `${vitalLabel(dashboard.exams.latestVital.metricCode)} · ${dateLabel(dashboard.exams.latestVital.observedOn)}`
                  : "Nenhum registro"
              }
            />
          </div>
          {dashboard.exams.pendingReviewCount > 0 ? (
            <div className="rounded-xl border p-3 text-sm">
              {dashboard.exams.pendingReviewCount === 1
                ? "1 documento aguarda revisão."
                : `${dashboard.exams.pendingReviewCount} documentos aguardam revisão.`}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">Resultados estruturados não são diagnóstico.</p>
        </DomainCard>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              Como ler esta tela
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Cada cartão preserva a fonte e a confiança do especialista correspondente.</p>
            <p>Ausência de dado permanece “não observado”; o Dashboard não preenche lacunas nem cria score geral.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
