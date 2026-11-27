import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  BrainCircuit,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  FlaskConical,
  History,
  ListChecks,
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
import { useHealthJourneyF12 } from "../hooks/useHealthJourneyF12";
import { HealthJourneyF12 } from "../ui/HealthJourneyF12";
import { HealthIntegratedDomainHandoff } from "../components/HealthIntegratedDomainHandoff";
import {
  integratedDecisionCodeLabel,
  integratedReasonLabel,
  useHealthIntegratedDecisionF11,
} from "../hooks/useHealthIntegratedDecisionF11";
import { formatMinutes, type DashboardFreshness, type DashboardAvailability } from "../dashboard/dashboardModel";

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
  availability,
  freshness,
  asOf,
  confidence,
  coverage,
  primary=false,
  children,
}: {
  title: string;
  icon: ReactNode;
  href: string;
  cta: string;
  error?: string | null;
  availability: DashboardAvailability;
  freshness: DashboardFreshness;
  asOf?: string | null;
  confidence?: string | null;
  coverage?: string | null;
  primary?: boolean;
  children: ReactNode;
}) {
  const historical = historicalNote(freshness, asOf ?? null);
  const unavailable=Boolean(error)||availability==="error";
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="px-3 pt-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {title}
          </CardTitle>
          <div className="flex flex-wrap justify-end gap-1">
            {!unavailable&&historical ? <Badge variant="outline">Histórico</Badge> : null}
            {!unavailable&&confidence ? <Badge variant="outline">{confidenceLabel(confidence)}</Badge> : null}
          </div>
        </div>
        {!unavailable&&historical ? <p className="text-xs text-muted-foreground">{historical}</p> : !unavailable&&asOf?<p className="text-xs text-muted-foreground">Referência: {dateLabel(asOf)}</p>:null}
        {!unavailable&&coverage ? <p className="text-xs text-muted-foreground">{coverageLabel(coverage)}</p> : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2 px-3 pb-3">
        {unavailable ? (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <div className="flex gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Não foi possível carregar este domínio.</span>
            </div>
          </div>
        ) : availability==="unknown" ? <p className="text-sm text-muted-foreground">Sem observação confirmada nesta área.</p> : children}
        <div className="mt-auto pt-1">
          <Button asChild variant={primary?"default":"outline"} className="min-h-11 w-full justify-between whitespace-normal">
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
  if(athleteLoading)return <DashboardSkeleton/>;
  if(!athlete?.id)return <p className="text-sm text-muted-foreground">Selecione um perfil para consultar a saúde.</p>;
  return <HealthDashboardContent key={athlete.id} athlete={athlete}/>;
}
function HealthDashboardContent({athlete}:{athlete:{id:string;display_name?:string|null}}){
  const dashboard = useHealthDashboardF10(athlete.id);
  const integrated = useHealthIntegratedDecisionF11(athlete?.id);
  const journey = useHealthJourneyF12(athlete?.id, {
    backendAvailable: integrated.backendAvailable,
    run: integrated.run,
    error: integrated.error,
  });
  const today = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  if (dashboard.loading) return <DashboardSkeleton />;
  if (dashboard.readFailed) return <Card><CardContent className="space-y-3 p-4" role="alert">
    <p>Não foi possível carregar a visão integrada. Isso não significa ausência de registros.</p>
    <Button onClick={()=>void dashboard.reload()} className="min-h-11">Tentar novamente</Button>
    <div className="grid grid-cols-2 gap-2">{[{to:"/saude/treino",label:"Treino"},{to:"/saude/alimentacao",label:"Alimentação"},{to:"/saude/evolucao",label:"Evolução"},{to:"/saude/recuperacao",label:"Recuperação"},{to:"/saude/exames",label:"Exames"}].map(item=><Button key={item.to} asChild variant="outline" className="min-h-11 whitespace-normal"><Link to={item.to}>{item.label}</Link></Button>)}</div>
  </CardContent></Card>;

  const visibleIssues = dashboard.issues.slice(0, 3);
  const extraIssueCount = Math.max(0, dashboard.issues.length - visibleIssues.length);

  return (
    <div className="space-y-3 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight">Hoje</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Seu acompanhamento diário, com acesso às áreas e às suas informações registradas.
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs capitalize text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {today}
            {athlete?.display_name ? ` · ${athlete.display_name}` : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 shrink-0"
          onClick={() =>
            void Promise.all([dashboard.reload(), integrated.reload(), journey.reload()])
          }
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

        <div data-testid="sau-sx03-training-priority">
          <DomainCard
            title="Treino"
            icon={<Dumbbell className="h-4 w-4 text-primary" />}
            href="/saude/treino"
            cta={dashboard.training.availability==="available"&&!dashboard.training.error&&dashboard.training.activeSession ? "Continuar treino" : dashboard.training.error||dashboard.training.availability==="error" ? "Abrir área de treino" : dashboard.training.nextQueue ? "Acessar próximo treino" : "Ver treino"}
            primary={dashboard.training.availability==="available"&&!dashboard.training.error&&Boolean(dashboard.training.activeSession||dashboard.training.nextQueue)}
            availability={dashboard.training.availability}
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
                <Metric label="Estado da fila" value={dashboard.training.nextQueue.state==="pending"?"Pendente":dashboard.training.nextQueue.state} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum treino ativo ou programado.</p>
            )}
          </DomainCard>
        </div>

      <section aria-label="Áreas de saúde" className="space-y-2">
        <h3 className="text-sm font-semibold">Seu acompanhamento</h3>
        <div className="grid gap-3 sm:grid-cols-2" data-testid="sau-sx03-domains">
        <DomainCard
          title="Alimentação"
          icon={<Utensils className="h-4 w-4 text-primary" />}
          href="/saude/alimentacao"
          cta="Abrir diário alimentar"
          availability={dashboard.nutrition.availability}
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
          cta="Abrir recuperação"
          availability={dashboard.recovery.availability}
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
          cta="Abrir evolução corporal"
          availability={dashboard.body.availability}
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
          cta="Abrir exames"
          availability={dashboard.exams.availability}
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
              value={dashboard.exams.longitudinalStateCount}
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

        </div>
      </section>
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
            {extraIssueCount > 0 ? <details className="rounded-lg border px-2"><summary className="min-h-11 cursor-pointer py-3 text-sm">Ver mais {extraIssueCount} pendências</summary><div className="space-y-2 pb-2">{dashboard.issues.slice(3).map(issue=><Link key={issue.id} to={issue.href} className="flex min-h-11 items-center justify-between gap-2 rounded-lg border p-2 text-sm">{issue.message}<ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true"/></Link>)}</div></details>:null}
          </CardContent>
        </Card>
      ) : null}

      <section aria-label="Planejamento e análise" className="space-y-2">
        <h3 className="text-sm font-semibold">Planejamento e análise</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([{to:"/saude/revisao",label:"Revisão",icon:History},{to:"/saude/replanejamento",label:"Replanejamento",icon:ListChecks},{to:"/saude/rotina",label:"Rotina",icon:CalendarDays},{to:"/saude/analytics",label:"Gráficos",icon:TrendingUp}] as const).map(({to,label,icon:Icon})=><Button key={to} asChild variant="outline" className="min-h-12 h-auto whitespace-normal justify-start px-2 text-left"><Link to={to}><Icon className="mr-2 h-4 w-4 shrink-0" aria-hidden="true"/><span className="min-w-0 break-words">{label}</span></Link></Button>)}
        </div>
        <p className="text-xs text-muted-foreground">Revise períodos e evidências antes de alterar o planejamento. Nenhuma alteração é automática.</p>
      </section>
      <HealthJourneyF12
        stages={journey.stages}
        nextAction={journey.nextAction}
        loading={journey.loading || integrated.loading}
        evaluating={integrated.evaluating}
        evaluationError={integrated.evaluationError}
        onEvaluate={integrated.evaluate}
      />
      <Card id="decisao-integrada">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BrainCircuit className="h-4 w-4 text-primary" />
              Decisão integrada
            </CardTitle>
            <div className="flex flex-wrap justify-end gap-1">
              {integrated.run?.historical ? <Badge variant="outline">Histórico</Badge> : null}
              {integrated.run ? (
                <Badge variant="outline">
                  {integrated.run.runStatus === "complete"
                    ? "Avaliada"
                    : integrated.run.runStatus === "paused"
                      ? "Pausada"
                      : integrated.run.runStatus}
                </Badge>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Motor F11 determinístico. Esta tela lê o ledger e só executa nova avaliação por ação explícita.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {integrated.loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !integrated.backendAvailable ? (
            <div className="rounded-xl border p-3 text-sm">
              <p className="font-medium">Motor integrado ainda não disponível neste ambiente.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Isso é diferente de não haver decisão. A dependência F11 precisa estar operacional no ambiente.
              </p>
            </div>
          ) : integrated.error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <div className="flex gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Não foi possível carregar a decisão integrada.</span>
              </div>
            </div>
          ) : !integrated.run ? (
            <div className="rounded-xl border p-3 text-sm">
              <p className="font-medium">Ainda não há decisão integrada materializada.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Use “Avaliar integração” na jornada quando quiser executar o motor com os dados atuais.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <Metric label="Data da avaliação" value={dateLabel(integrated.run.asOfDate) ?? "Não informado"} />
                <Metric label="Janela" value={`${integrated.run.windowDays} dias`} />
                <Metric label="Algoritmo" value={integrated.run.algorithmVersion} />
              </div>
              <div className="space-y-2">
                {integrated.run.decisions.map((decision) => (
                  <div key={decision.id} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {decision.scope === "nutrition_execution"
                            ? "Execução nutricional"
                            : "Revisão de plano nutricional"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {integratedDecisionCodeLabel(decision.code)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">
                          {decision.status === "ready" ? "Pronta" : "Pausada"}
                        </Badge>
                        <Badge variant="outline">{confidenceLabel(decision.confidence)}</Badge>
                      </div>
                    </div>
                    {decision.reasonCodes.length ? (
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        {decision.reasonCodes.slice(0, 3).map((reason) => (
                          <p key={reason}>• {integratedReasonLabel(reason)}</p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Ação automática: nenhuma. A F11 v1 registra elegibilidade e revisão, não altera dieta ou treino.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <details className="rounded-xl border px-2">
        <summary className="min-h-11 cursor-pointer py-3 px-1 text-sm font-medium">Fontes, cobertura e detalhes técnicos</summary>
        <div className="space-y-3 pb-2">
          <HealthIntegratedDomainHandoff dashboard={dashboard}/>
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
      </details>
    </div>
  );
}
