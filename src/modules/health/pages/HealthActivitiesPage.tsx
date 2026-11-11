import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Bike,
  CheckCircle2,
  Clock3,
  Dumbbell,
  Footprints,
  ListPlus,
  Loader2,
  Pause,
  Play,
  Plus,
  Timer,
  Waves,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useHealthAthlete } from "../hooks/useHealthAthlete";
import { useHealthActivitiesF20 } from "../hooks/useHealthActivitiesF20";
import type { HealthActivitySessionF20 } from "../hooks/useHealthActivitiesF20";

function num(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return "—";
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return [h, m, s].map((x) => String(x).padStart(2, "0")).join(":");
  }
  return [m, s].map((x) => String(x).padStart(2, "0")).join(":");
}

function formatPace(secondsPerKm: number | null | undefined) {
  if (secondsPerKm == null) return null;
  const total = Math.max(0, Math.round(secondsPerKm));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}/km`;
}

function localDateTimeInput(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function activityElapsed(
  activity: HealthActivitySessionF20,
  nowMs: number,
) {
  if (activity.status === "completed" || activity.status === "aborted") {
    return activity.active_duration_seconds ?? 0;
  }

  const started = new Date(activity.started_at).getTime();
  const currentPause =
    activity.status === "paused" && activity.paused_at
      ? Math.max(0, nowMs - new Date(activity.paused_at).getTime()) / 1000
      : 0;

  return Math.max(
    0,
    Math.floor(
      (nowMs - started) / 1000 -
        Number(activity.pause_accumulated_seconds || 0) -
        currentPause,
    ),
  );
}

function modalityIcon(code: string) {
  if (code === "running" || code === "walking" || code === "hiking") {
    return Footprints;
  }
  if (code === "cycling") return Bike;
  if (code === "swimming") return Waves;
  return Activity;
}

export function HealthActivitiesPage() {
  const { toast } = useToast();
  const { athlete, loading: athleteLoading } = useHealthAthlete();
  const activities = useHealthActivitiesF20(athlete?.id);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [modalityCode, setModalityCode] = useState("running");
  const [title, setTitle] = useState("");

  const [showFinish, setShowFinish] = useState(false);
  const [distanceKm, setDistanceKm] = useState("");
  const [calories, setCalories] = useState("");
  const [avgHr, setAvgHr] = useState("");
  const [maxHr, setMaxHr] = useState("");
  const [rpe, setRpe] = useState("");
  const [cadence, setCadence] = useState("");
  const [elevation, setElevation] = useState("");
  const [steps, setSteps] = useState("");
  const [notes, setNotes] = useState("");

  const [manualOpen, setManualOpen] = useState(false);
  const [manualModality, setManualModality] = useState("running");
  const [manualTitle, setManualTitle] = useState("");
  const [manualStartedAt, setManualStartedAt] = useState(() =>
    localDateTimeInput(),
  );
  const [manualDurationMin, setManualDurationMin] = useState("");
  const [manualDistanceKm, setManualDistanceKm] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [manualAvgHr, setManualAvgHr] = useState("");
  const [manualMaxHr, setManualMaxHr] = useState("");
  const [manualRpe, setManualRpe] = useState("");
  const [manualCadence, setManualCadence] = useState("");
  const [manualElevation, setManualElevation] = useState("");
  const [manualSteps, setManualSteps] = useState("");
  const [manualNotes, setManualNotes] = useState("");

  const [segmentOpen, setSegmentOpen] = useState(false);
  const [segmentType, setSegmentType] = useState("lap");
  const [segmentLabel, setSegmentLabel] = useState("");
  const [segmentDurationSec, setSegmentDurationSec] = useState("");
  const [segmentDistanceM, setSegmentDistanceM] = useState("");
  const [segmentAvgHr, setSegmentAvgHr] = useState("");
  const [segmentCadence, setSegmentCadence] = useState("");

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!activities.activeActivity) {
      setShowFinish(false);
      setDistanceKm("");
      setCalories("");
      setAvgHr("");
      setMaxHr("");
      setRpe("");
      setCadence("");
      setElevation("");
      setSteps("");
      setNotes("");
      setSegmentOpen(false);
    }
  }, [activities.activeActivity?.id]);

  const modalityByCode = useMemo(
    () => new Map(activities.modalities.map((item) => [item.code, item])),
    [activities.modalities],
  );

  const timeline = useMemo(() => {
    const activityItems = activities.activitiesToday.map((item) => ({
      id: `activity-${item.id}`,
      kind: "activity" as const,
      startedAt: item.started_at,
      activity: item,
    }));

    const strengthItems = activities.strengthToday.map((item) => ({
      id: `strength-${item.id}`,
      kind: "strength" as const,
      startedAt: item.started_at,
      strength: item,
    }));

    return [...activityItems, ...strengthItems].sort(
      (a, b) =>
        new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    );
  }, [activities.activitiesToday, activities.strengthToday]);

  const run = async (label: string, action: () => Promise<void>) => {
    try {
      await action();
      toast({ title: "Atividade atualizada", description: label });
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "Não foi possível concluir",
        description:
          cause instanceof Error ? cause.message : "Tente novamente.",
      });
    }
  };

  const completeLive = async () => {
    if (!activities.activeActivity) return;
    await activities.completeActivity(activities.activeActivity.id, {
      distanceMeters:
        num(distanceKm) == null ? null : Number(num(distanceKm)) * 1000,
      caloriesKcal: num(calories),
      avgHrBpm: num(avgHr),
      maxHrBpm: num(maxHr),
      rpe: num(rpe),
      cadenceSpm: num(cadence),
      elevationGainM: num(elevation),
      steps: num(steps),
      notes: notes || null,
    });
  };

  const createManual = async () => {
    const durationMin = num(manualDurationMin);
    if (!durationMin || durationMin <= 0) {
      throw new Error("Informe a duração da atividade.");
    }

    await activities.createManualActivity({
      modalityCode: manualModality,
      title: manualTitle || null,
      startedAt: new Date(manualStartedAt).toISOString(),
      durationSeconds: Math.round(durationMin * 60),
      distanceMeters:
        num(manualDistanceKm) == null
          ? null
          : Number(num(manualDistanceKm)) * 1000,
      caloriesKcal: num(manualCalories),
      avgHrBpm: num(manualAvgHr),
      maxHrBpm: num(manualMaxHr),
      rpe: num(manualRpe),
      cadenceSpm: num(manualCadence),
      elevationGainM: num(manualElevation),
      steps: num(manualSteps),
      notes: manualNotes || null,
    });

    setManualTitle("");
    setManualDurationMin("");
    setManualDistanceKm("");
    setManualCalories("");
    setManualAvgHr("");
    setManualMaxHr("");
    setManualRpe("");
    setManualCadence("");
    setManualElevation("");
    setManualSteps("");
    setManualNotes("");
    setManualStartedAt(localDateTimeInput());
    setManualOpen(false);
  };

  const addSegment = async () => {
    if (!activities.activeActivity) return;

    await activities.addSegment(activities.activeActivity.id, {
      segmentType,
      label: segmentLabel || null,
      durationSeconds: num(segmentDurationSec),
      distanceMeters: num(segmentDistanceM),
      avgHrBpm: num(segmentAvgHr),
      cadenceSpm: num(segmentCadence),
    });

    setSegmentLabel("");
    setSegmentDurationSec("");
    setSegmentDistanceM("");
    setSegmentAvgHr("");
    setSegmentCadence("");
  };

  if (athleteLoading || activities.loading) {
    return (
      <div className="flex min-h-56 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const active = activities.activeActivity;
  const activeModality = active
    ? modalityByCode.get(active.modality_code)
    : null;
  const ActiveIcon = active ? modalityIcon(active.modality_code) : Activity;
  const activeSeconds = active ? activityElapsed(active, nowMs) : 0;
  const activeSegments = active
    ? activities.segmentsByActivity.get(active.id) ?? []
    : [];

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Atividades e sessões
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Corrida, cardio, Pilates, ritmos e outras modalidades. Você pode
            registrar várias sessões no mesmo dia.
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11 shrink-0">
          <Link to="/saude/treino">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Treino
          </Link>
        </Button>
      </div>

      {activities.error ? (
        <Card className="border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">
            {activities.error}
          </CardContent>
        </Card>
      ) : null}

      {!activities.available ? (
        <Card className="border-amber-500/30">
          <CardContent className="py-4 text-sm">
            A camada F20 ainda não está disponível neste ambiente.
          </CardContent>
        </Card>
      ) : active ? (
        <Card className="ring-1 ring-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <ActiveIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Atividade em andamento
                  </p>
                  <CardTitle className="truncate text-xl">
                    {active.title}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activeModality?.name ?? active.modality_code}
                  </p>
                </div>
              </div>
              <Badge variant="outline">
                {active.status === "paused" ? "pausada" : "ativa"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tempo ativo
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pausas não entram na duração.
                </p>
              </div>
              <p className="font-mono text-3xl font-semibold">
                {formatDuration(activeSeconds)}
              </p>
            </div>

            <Button
              variant={active.status === "paused" ? "default" : "outline"}
              className="min-h-11 w-full"
              disabled={activities.saving}
              onClick={() =>
                void run(
                  active.status === "paused"
                    ? "Atividade retomada."
                    : "Atividade pausada.",
                  () =>
                    active.status === "paused"
                      ? activities.resumeActivity(active.id)
                      : activities.pauseActivity(active.id),
                )
              }
            >
              {active.status === "paused" ? (
                <Play className="mr-2 h-4 w-4" />
              ) : (
                <Pause className="mr-2 h-4 w-4" />
              )}
              {active.status === "paused" ? "Retomar" : "Pausar"}
            </Button>

            <details
              className="rounded-xl border p-3"
              open={segmentOpen}
              onToggle={(event) =>
                setSegmentOpen((event.currentTarget as HTMLDetailsElement).open)
              }
            >
              <summary className="cursor-pointer text-sm font-medium">
                Voltas / segmentos
              </summary>

              <div className="mt-3 space-y-3">
                {activeSegments.length ? (
                  <div className="space-y-2">
                    {activeSegments.map((segment) => (
                      <div
                        key={segment.id}
                        className="rounded-lg bg-muted/35 px-3 py-2 text-sm"
                      >
                        <span className="font-semibold">
                          #{segment.sequence_order}
                        </span>
                        {" · "}
                        {segment.label ?? segment.segment_type}
                        {segment.duration_seconds != null
                          ? ` · ${formatDuration(segment.duration_seconds)}`
                          : ""}
                        {segment.distance_meters != null
                          ? ` · ${(segment.distance_meters / 1000).toFixed(2)} km`
                          : ""}
                        {segment.pace_seconds_per_km != null
                          ? ` · ${formatPace(segment.pace_seconds_per_km)}`
                          : ""}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhum segmento registrado.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={segmentType} onValueChange={setSegmentType}>
                      <SelectTrigger className="min-h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lap">Volta</SelectItem>
                        <SelectItem value="interval">Intervalo</SelectItem>
                        <SelectItem value="warmup">Aquecimento</SelectItem>
                        <SelectItem value="work">Trabalho</SelectItem>
                        <SelectItem value="recovery">Recuperação</SelectItem>
                        <SelectItem value="cooldown">Volta à calma</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Rótulo</Label>
                    <Input
                      className="min-h-11"
                      value={segmentLabel}
                      onChange={(e) => setSegmentLabel(e.target.value)}
                      placeholder="ex.: tiro 1"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Duração s</Label>
                    <Input
                      className="min-h-11"
                      inputMode="numeric"
                      value={segmentDurationSec}
                      onChange={(e) => setSegmentDurationSec(e.target.value)}
                      placeholder="opcional"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Distância m</Label>
                    <Input
                      className="min-h-11"
                      inputMode="decimal"
                      value={segmentDistanceM}
                      onChange={(e) => setSegmentDistanceM(e.target.value)}
                      placeholder="opcional"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">FC média</Label>
                    <Input
                      className="min-h-11"
                      inputMode="numeric"
                      value={segmentAvgHr}
                      onChange={(e) => setSegmentAvgHr(e.target.value)}
                      placeholder="opcional"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cadência</Label>
                    <Input
                      className="min-h-11"
                      inputMode="decimal"
                      value={segmentCadence}
                      onChange={(e) => setSegmentCadence(e.target.value)}
                      placeholder="opcional"
                    />
                  </div>
                </div>

                <Button
                  variant="secondary"
                  className="min-h-11 w-full"
                  disabled={activities.saving}
                  onClick={() =>
                    void run("Segmento registrado.", addSegment)
                  }
                >
                  <ListPlus className="mr-2 h-4 w-4" />
                  Adicionar segmento
                </Button>
              </div>
            </details>

            {!showFinish ? (
              <Button
                className="min-h-12 w-full"
                onClick={() => setShowFinish(true)}
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Finalizar atividade
              </Button>
            ) : (
              <div className="space-y-4 rounded-xl border p-3">
                <div>
                  <p className="text-sm font-semibold">
                    Registrar resultado
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Preencha apenas o que você tiver. Distância + tempo calculam
                    pace e velocidade automaticamente.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MetricInput
                    label="Distância km"
                    value={distanceKm}
                    onChange={setDistanceKm}
                    mode="decimal"
                  />
                  <MetricInput
                    label="Calorias"
                    value={calories}
                    onChange={setCalories}
                    mode="decimal"
                  />
                  <MetricInput
                    label="FC média"
                    value={avgHr}
                    onChange={setAvgHr}
                  />
                  <MetricInput
                    label="FC máxima"
                    value={maxHr}
                    onChange={setMaxHr}
                  />
                  <MetricInput
                    label="RPE 0–10"
                    value={rpe}
                    onChange={setRpe}
                    mode="decimal"
                  />
                  <MetricInput
                    label="Cadência"
                    value={cadence}
                    onChange={setCadence}
                    mode="decimal"
                  />
                  <MetricInput
                    label="Elevação m"
                    value={elevation}
                    onChange={setElevation}
                    mode="decimal"
                  />
                  <MetricInput
                    label="Passos"
                    value={steps}
                    onChange={setSteps}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Observações</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Como foi a atividade?"
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    className="min-h-11"
                    disabled={activities.saving}
                    onClick={() =>
                      void run("Atividade concluída.", completeLive)
                    }
                  >
                    Salvar e concluir
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setShowFinish(false)}
                  >
                    Voltar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Play className="h-4 w-4 text-primary" />
                Iniciar atividade agora
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activities.openStrengthSessionId ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                  Há um treino de musculação aberto. Encerre essa sessão antes de
                  iniciar outro cronômetro ao vivo.
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Modalidade</Label>
                  <Select
                    value={modalityCode}
                    onValueChange={setModalityCode}
                  >
                    <SelectTrigger className="min-h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {activities.modalities.map((item) => (
                        <SelectItem key={item.code} value={item.code}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Título opcional</Label>
                  <Input
                    className="min-h-11"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="ex.: corrida leve"
                  />
                </div>
              </div>

              <Button
                className="min-h-12 w-full"
                disabled={
                  activities.saving ||
                  Boolean(activities.openStrengthSessionId) ||
                  !modalityCode
                }
                onClick={() =>
                  void run("Atividade iniciada.", () =>
                    activities.startActivity(modalityCode, title || null),
                  )
                }
              >
                <Timer className="mr-2 h-5 w-5" />
                Iniciar cronômetro
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4 text-primary" />
                Registrar atividade já realizada
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!manualOpen ? (
                <Button
                  variant="outline"
                  className="min-h-11 w-full"
                  onClick={() => setManualOpen(true)}
                >
                  Abrir registro manual
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Modalidade</Label>
                      <Select
                        value={manualModality}
                        onValueChange={setManualModality}
                      >
                        <SelectTrigger className="min-h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {activities.modalities.map((item) => (
                            <SelectItem key={item.code} value={item.code}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Título opcional</Label>
                      <Input
                        className="min-h-11"
                        value={manualTitle}
                        onChange={(e) => setManualTitle(e.target.value)}
                        placeholder="ex.: Pilates"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Início</Label>
                      <Input
                        className="min-h-11"
                        type="datetime-local"
                        value={manualStartedAt}
                        onChange={(e) => setManualStartedAt(e.target.value)}
                      />
                    </div>
                    <MetricInput
                      label="Duração min"
                      value={manualDurationMin}
                      onChange={setManualDurationMin}
                      mode="decimal"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MetricInput
                      label="Distância km"
                      value={manualDistanceKm}
                      onChange={setManualDistanceKm}
                      mode="decimal"
                    />
                    <MetricInput
                      label="Calorias"
                      value={manualCalories}
                      onChange={setManualCalories}
                      mode="decimal"
                    />
                    <MetricInput
                      label="FC média"
                      value={manualAvgHr}
                      onChange={setManualAvgHr}
                    />
                    <MetricInput
                      label="FC máxima"
                      value={manualMaxHr}
                      onChange={setManualMaxHr}
                    />
                    <MetricInput
                      label="RPE 0–10"
                      value={manualRpe}
                      onChange={setManualRpe}
                      mode="decimal"
                    />
                    <MetricInput
                      label="Cadência"
                      value={manualCadence}
                      onChange={setManualCadence}
                      mode="decimal"
                    />
                    <MetricInput
                      label="Elevação m"
                      value={manualElevation}
                      onChange={setManualElevation}
                      mode="decimal"
                    />
                    <MetricInput
                      label="Passos"
                      value={manualSteps}
                      onChange={setManualSteps}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Observações</Label>
                    <Textarea
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      className="min-h-11"
                      disabled={activities.saving}
                      onClick={() =>
                        void run("Atividade registrada.", createManual)
                      }
                    >
                      Salvar atividade
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-11"
                      onClick={() => setManualOpen(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock3 className="h-4 w-4 text-primary" />
            Sessões de hoje
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Musculação e outras modalidades aparecem juntas. Não há limite de
            uma sessão por dia.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {timeline.length ? (
            timeline.map((item) => {
              if (item.kind === "strength") {
                const strength = item.strength;
                const duration =
                  strength.ended_at == null
                    ? null
                    : Math.max(
                        0,
                        Math.floor(
                          (new Date(strength.ended_at).getTime() -
                            new Date(strength.started_at).getTime()) /
                            1000,
                        ),
                      );

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border p-3"
                  >
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Dumbbell className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {strength.template_code
                          ? `${strength.template_code} · `
                          : ""}
                        {strength.template_name ?? "Musculação"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(strength.started_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {duration != null
                          ? ` · ${formatDuration(duration)}`
                          : ""}
                      </p>
                    </div>
                    <Badge variant="outline">{strength.status}</Badge>
                  </div>
                );
              }

              const activity = item.activity;
              const Icon = modalityIcon(activity.modality_code);
              const pace = formatPace(activity.avg_pace_seconds_per_km);

              return (
                <div
                  key={item.id}
                  className="rounded-xl border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {activity.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {modalityByCode.get(activity.modality_code)?.name ??
                          activity.modality_code}
                        {" · "}
                        {new Date(activity.started_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {activity.active_duration_seconds != null
                          ? ` · ${formatDuration(activity.active_duration_seconds)}`
                          : ""}
                      </p>
                    </div>
                    <Badge variant="outline">{activity.status}</Badge>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {activity.distance_meters != null ? (
                      <span>
                        {(activity.distance_meters / 1000).toFixed(2)} km
                      </span>
                    ) : null}
                    {pace ? <span>{pace}</span> : null}
                    {activity.avg_speed_kmh != null ? (
                      <span>{activity.avg_speed_kmh.toFixed(1)} km/h</span>
                    ) : null}
                    {activity.avg_hr_bpm != null ? (
                      <span>FC {activity.avg_hr_bpm}</span>
                    ) : null}
                    {activity.rpe != null ? <span>RPE {activity.rpe}</span> : null}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma sessão registrada hoje.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricInput({
  label,
  value,
  onChange,
  mode = "numeric",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode?: "numeric" | "decimal";
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        className="min-h-11"
        inputMode={mode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="opcional"
      />
    </div>
  );
}
