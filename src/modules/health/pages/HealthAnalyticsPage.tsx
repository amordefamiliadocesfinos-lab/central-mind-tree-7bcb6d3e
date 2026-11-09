import { useState } from "react";
import {
  Activity,
  Apple,
  Dumbbell,
  RefreshCw,
  Scale,
  Sparkles,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealthAthlete } from "../hooks/useHealthAthlete";
import {
  type AnalyticsWindowDays,
  useHealthAnalyticsF17,
} from "../hooks/useHealthAnalyticsF17";

function shortDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(parsed);
}

function numberLabel(value: number | null | undefined, digits = 1) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
  }).format(value);
}

const trainingConfig = {
  sessionCount: {
    label: "Sessões",
    color: "hsl(var(--chart-1))",
  },
  setCount: {
    label: "Séries",
    color: "hsl(var(--chart-2))",
  },
  reps: {
    label: "Repetições",
    color: "hsl(var(--chart-3))",
  },
  kgVolume: {
    label: "Volume kg",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig;

const nutritionConfig = {
  energyKcal: {
    label: "Energia (kcal)",
    color: "hsl(var(--chart-1))",
  },
  proteinG: {
    label: "Proteína (g)",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const bodyConfig = {
  weightKg: {
    label: "Peso (kg)",
    color: "hsl(var(--chart-1))",
  },
  waistCm: {
    label: "Cintura (cm)",
    color: "hsl(var(--chart-2))",
  },
  bodyFatPct: {
    label: "Gordura (%)",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

const recoveryConfig = {
  sleepMinutes: {
    label: "Sono (min)",
    color: "hsl(var(--chart-1))",
  },
  physicalRecovery: {
    label: "Recuperação",
    color: "hsl(var(--chart-2))",
  },
  trainingReadiness: {
    label: "Prontidão",
    color: "hsl(var(--chart-3))",
  },
  generalFatigue: {
    label: "Fadiga",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig;

function DomainEmpty({
  error,
  message,
}: {
  error: string | null;
  message: string;
}) {
  return (
    <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed p-5 text-center">
      <div className="max-w-sm">
        <p className="text-sm font-medium">
          {error ? "Não foi possível carregar este histórico." : message}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {error
            ? "Os outros domínios continuam independentes."
            : "Nenhum ponto fictício em zero será criado."}
        </p>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-96 w-full" />
        ))}
      </div>
    </div>
  );
}

export function HealthAnalyticsPage() {
  const { athlete, loading: athleteLoading } = useHealthAthlete();
  const [windowDays, setWindowDays] = useState<AnalyticsWindowDays>(90);
  const analytics = useHealthAnalyticsF17(athlete?.id, windowDays);

  if (athleteLoading || analytics.loading) return <PageSkeleton />;

  const latestTraining =
    analytics.training.data[analytics.training.data.length - 1] ?? null;
  const latestNutrition =
    analytics.nutrition.data[analytics.nutrition.data.length - 1] ?? null;
  const latestBody =
    analytics.body.data[analytics.body.data.length - 1] ?? null;
  const latestRecovery =
    analytics.recovery.data[analytics.recovery.data.length - 1] ?? null;

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Analytics e histórico
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Gráficos dos dados observados ao longo do tempo. Visualização não é
            diagnóstico, causalidade ou decisão automática.
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-11 shrink-0"
          onClick={() => void analytics.reload()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Janela histórica</p>
            <p className="mt-1 text-xs text-muted-foreground">
              O período altera somente a leitura desta tela.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([30, 90, 180] as const).map((days) => (
              <Button
                key={days}
                variant={windowDays === days ? "default" : "outline"}
                className="min-h-11"
                onClick={() => setWindowDays(days)}
              >
                {days} dias
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Dias com treino</p>
          <p className="mt-1 text-lg font-semibold">
            {analytics.coverage.training}
          </p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Dias alimentares</p>
          <p className="mt-1 text-lg font-semibold">
            {analytics.coverage.nutrition}
          </p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Dias corporais</p>
          <p className="mt-1 text-lg font-semibold">
            {analytics.coverage.body}
          </p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Dias recuperação</p>
          <p className="mt-1 text-lg font-semibold">
            {analytics.coverage.recovery}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Dumbbell className="h-4 w-4 text-primary" />
                Treino
              </CardTitle>
              {latestTraining ? (
                <Badge variant="outline">
                  {latestTraining.sessionCount}{" "}
                  {latestTraining.sessionCount === 1 ? "sessão" : "sessões"} no
                  último dia registrado
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {analytics.training.error || analytics.training.data.length === 0 ? (
              <DomainEmpty
                error={analytics.training.error}
                message="Sem treinos concluídos neste período."
              />
            ) : (
              <div className="space-y-4">
                <ChartContainer
                  config={trainingConfig}
                  className="h-[300px] w-full aspect-auto"
                >
                  <LineChart
                    data={analytics.training.data}
                    margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDate}
                      minTickGap={24}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="counts"
                      width={36}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="volume"
                      orientation="right"
                      width={50}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) =>
                            shortDate(String(value))
                          }
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      yAxisId="counts"
                      type="monotone"
                      dataKey="sessionCount"
                      stroke="var(--color-sessionCount)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                    <Line
                      yAxisId="counts"
                      type="monotone"
                      dataKey="setCount"
                      stroke="var(--color-setCount)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                    <Line
                      yAxisId="counts"
                      type="monotone"
                      dataKey="reps"
                      stroke="var(--color-reps)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                    <Line
                      yAxisId="volume"
                      type="monotone"
                      dataKey="kgVolume"
                      stroke="var(--color-kgVolume)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                  </LineChart>
                </ChartContainer>
                <p className="text-xs text-muted-foreground">
                  Volume kg soma somente séries registradas em kg com carga e
                  repetições conhecidas. lb e bodyweight não são convertidos.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Apple className="h-4 w-4 text-primary" />
                Alimentação
              </CardTitle>
              {latestNutrition ? (
                <Badge variant="outline">
                  Último dia: {latestNutrition.completenessStatus}
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {analytics.nutrition.error ||
            analytics.nutrition.data.length === 0 ? (
              <DomainEmpty
                error={analytics.nutrition.error}
                message="Sem diário alimentar neste período."
              />
            ) : (
              <div className="space-y-4">
                <ChartContainer
                  config={nutritionConfig}
                  className="h-[300px] w-full aspect-auto"
                >
                  <LineChart
                    data={analytics.nutrition.data}
                    margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDate}
                      minTickGap={24}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="energy"
                      width={46}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="protein"
                      orientation="right"
                      width={42}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) =>
                            shortDate(String(value))
                          }
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      yAxisId="energy"
                      type="monotone"
                      dataKey="energyKcal"
                      stroke="var(--color-energyKcal)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                    <Line
                      yAxisId="protein"
                      type="monotone"
                      dataKey="proteinG"
                      stroke="var(--color-proteinG)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                  </LineChart>
                </ChartContainer>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">
                      Energia no último dia
                    </p>
                    <p className="font-medium">
                      {latestNutrition?.energyKcal == null
                        ? "Não comparável"
                        : `${numberLabel(latestNutrition.energyKcal, 0)} kcal`}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">
                      Proteína no último dia
                    </p>
                    <p className="font-medium">
                      {latestNutrition?.proteinG == null
                        ? "Não comparável"
                        : `${numberLabel(latestNutrition.proteinG, 1)} g`}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Se qualquer item ativo do dia não tiver snapshot nutricional,
                  o total correspondente permanece ausente em vez de virar zero.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Scale className="h-4 w-4 text-primary" />
                Evolução corporal
              </CardTitle>
              {latestBody ? (
                <Badge variant="outline">
                  Peso:{" "}
                  {latestBody.weightKg == null
                    ? "—"
                    : `${numberLabel(latestBody.weightKg)} kg`}
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {analytics.body.error || analytics.body.data.length === 0 ? (
              <DomainEmpty
                error={analytics.body.error}
                message="Sem avaliações corporais neste período."
              />
            ) : (
              <div className="space-y-4">
                <ChartContainer
                  config={bodyConfig}
                  className="h-[300px] w-full aspect-auto"
                >
                  <LineChart
                    data={analytics.body.data}
                    margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDate}
                      minTickGap={24}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="measure"
                      width={42}
                      tickLine={false}
                      axisLine={false}
                      domain={["auto", "auto"]}
                    />
                    <YAxis
                      yAxisId="fat"
                      orientation="right"
                      width={38}
                      tickLine={false}
                      axisLine={false}
                      domain={["auto", "auto"]}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) =>
                            shortDate(String(value))
                          }
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      yAxisId="measure"
                      type="monotone"
                      dataKey="weightKg"
                      stroke="var(--color-weightKg)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                    <Line
                      yAxisId="measure"
                      type="monotone"
                      dataKey="waistCm"
                      stroke="var(--color-waistCm)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                    <Line
                      yAxisId="fat"
                      type="monotone"
                      dataKey="bodyFatPct"
                      stroke="var(--color-bodyFatPct)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                  </LineChart>
                </ChartContainer>
                <p className="text-xs text-muted-foreground">
                  Somente avaliações corporais ativas são mostradas. Pontos
                  ausentes não são interpolados.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                Sono e recuperação
              </CardTitle>
              {latestRecovery ? (
                <Badge variant="outline">
                  Sono registrado:{" "}
                  {latestRecovery.sleepMinutes == null
                    ? "—"
                    : `${numberLabel(latestRecovery.sleepMinutes, 0)} min`}
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {analytics.recovery.error ||
            analytics.recovery.data.length === 0 ? (
              <DomainEmpty
                error={analytics.recovery.error}
                message="Sem sono ou check-ins de recuperação neste período."
              />
            ) : (
              <div className="space-y-4">
                <ChartContainer
                  config={recoveryConfig}
                  className="h-[300px] w-full aspect-auto"
                >
                  <LineChart
                    data={analytics.recovery.data}
                    margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDate}
                      minTickGap={24}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="sleep"
                      width={44}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="ordinal"
                      orientation="right"
                      width={28}
                      tickLine={false}
                      axisLine={false}
                      domain={[1, 5]}
                      ticks={[1, 2, 3, 4, 5]}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) =>
                            shortDate(String(value))
                          }
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      yAxisId="sleep"
                      type="monotone"
                      dataKey="sleepMinutes"
                      stroke="var(--color-sleepMinutes)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                    <Line
                      yAxisId="ordinal"
                      type="monotone"
                      dataKey="physicalRecovery"
                      stroke="var(--color-physicalRecovery)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                    <Line
                      yAxisId="ordinal"
                      type="monotone"
                      dataKey="trainingReadiness"
                      stroke="var(--color-trainingReadiness)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                    <Line
                      yAxisId="ordinal"
                      type="monotone"
                      dataKey="generalFatigue"
                      stroke="var(--color-generalFatigue)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                  </LineChart>
                </ChartContainer>
                <p className="text-xs text-muted-foreground">
                  Recuperação, prontidão e fadiga usam escala ordinal 1–5. As
                  linhas descrevem percepção registrada e não são diagnóstico.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">Como interpretar esta tela</p>
              <p className="text-xs text-muted-foreground">
                Observe padrões e continuidade dos registros. Duas linhas que
                mudam juntas não provam que uma causou a outra. Para revisão
                formal entre períodos, use a F13.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
