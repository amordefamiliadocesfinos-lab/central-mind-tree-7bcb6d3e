import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Loader2,
  Pause,
  Play,
  Save,
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
import { useToast } from "@/hooks/use-toast";
import type {
  WorkoutExercise,
  WorkoutSet,
} from "../hooks/useHealthWorkoutM4";
import type {
  HealthWorkoutTimerF19Controller,
  WorkoutTimerIntervalF19,
} from "../hooks/useHealthWorkoutTimerF19";

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrUndefined(value: string) {
  const parsed = numberOrNull(value);
  return parsed == null ? undefined : parsed;
}

function formatElapsed(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return [hours, minutes, secs]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  }

  return [minutes, secs]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function elapsedSeconds(
  startedAt: string,
  pauseAccumulatedSeconds: number,
  status: "running" | "paused" | "completed" | "cancelled",
  pausedAt: string | null,
  endedAt: string | null,
  nowMs: number,
) {
  const start = new Date(startedAt).getTime();
  const end =
    status === "completed" || status === "cancelled"
      ? new Date(endedAt ?? startedAt).getTime()
      : nowMs;
  const currentPause =
    status === "paused" && pausedAt
      ? Math.max(0, end - new Date(pausedAt).getTime()) / 1000
      : 0;

  return Math.max(
    0,
    Math.floor(
      (end - start) / 1000 -
        Number(pauseAccumulatedSeconds || 0) -
        currentPause,
    ),
  );
}

function sessionElapsedSeconds(
  startedAt: string,
  pauseAccumulatedSeconds: number,
  status: "active" | "paused" | "completed" | "aborted",
  pausedAt: string | null,
  endedAt: string | null,
  nowMs: number,
) {
  const start = new Date(startedAt).getTime();
  const end =
    status === "completed" || status === "aborted"
      ? new Date(endedAt ?? startedAt).getTime()
      : nowMs;
  const currentPause =
    status === "paused" && pausedAt
      ? Math.max(0, end - new Date(pausedAt).getTime()) / 1000
      : 0;

  return Math.max(
    0,
    Math.floor(
      (end - start) / 1000 -
        Number(pauseAccumulatedSeconds || 0) -
        currentPause,
    ),
  );
}

function intervalElapsed(interval: WorkoutTimerIntervalF19, nowMs: number) {
  if (
    (interval.status === "completed" || interval.status === "cancelled") &&
    interval.actual_seconds != null
  ) {
    return Number(interval.actual_seconds);
  }

  return elapsedSeconds(
    interval.started_at,
    interval.pause_accumulated_seconds,
    interval.status,
    interval.paused_at,
    interval.ended_at,
    nowMs,
  );
}

function plannedMin(item: WorkoutExercise) {
  return item.planned_sets_min ?? item.planned_sets_max ?? 1;
}

function plannedMax(item: WorkoutExercise) {
  return item.planned_sets_max ?? item.planned_sets_min ?? 1;
}

function isExecutable(item: WorkoutExercise) {
  return (
    item.status !== "skipped" &&
    item.status !== "replaced" &&
    item.status !== "completed"
  );
}

function playRestReadyAlert() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate([180, 100, 180]);
    } catch {
      // Best effort only.
    }
  }

  if (typeof window === "undefined" || !window.AudioContext) return;

  try {
    const context = new window.AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.16);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {
    // Best effort only.
  }
}

export function HealthWorkoutInteractiveTimerF19({
  sessionTitle,
  fallbackStartedAt,
  exercises,
  setsByExercise,
  exerciseNameById,
  timer,
}: {
  sessionTitle: string;
  fallbackStartedAt: string;
  exercises: WorkoutExercise[];
  setsByExercise: Map<string, WorkoutSet[]>;
  exerciseNameById: Map<string, string>;
  timer: HealthWorkoutTimerF19Controller;
}) {
  const { toast } = useToast();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [load, setLoad] = useState("");
  const [loadUnit, setLoadUnit] = useState("kg");
  const [reps, setReps] = useState("");
  const [rir, setRir] = useState("");
  const [viewedExerciseId, setViewedExerciseId] = useState<string | null>(null);
  const alertedRestId = useRef<string | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const orderedExercises = useMemo(
    () => [...exercises].sort((a, b) => a.sequence_order - b.sequence_order),
    [exercises],
  );

  const performedCount = (exerciseId: string) =>
    (setsByExercise.get(exerciseId) ?? []).filter(
      (item) => item.status === "completed",
    ).length;

  const activeExercise = useMemo(() => {
    if (timer.activeInterval) {
      return (
        orderedExercises.find(
          (item) => item.id === timer.activeInterval?.workout_exercise_id,
        ) ?? null
      );
    }

    const unfinishedActive =
      orderedExercises.find(
        (item) =>
          item.status === "active" &&
          performedCount(item.id) < plannedMax(item),
      ) ?? null;

    if (unfinishedActive) return unfinishedActive;

    return (
      orderedExercises.find(
        (item) =>
          isExecutable(item) &&
          performedCount(item.id) < plannedMax(item),
      ) ?? null
    );
  }, [orderedExercises, setsByExercise, timer.activeInterval]);

  useEffect(() => {
    if (!orderedExercises.length) {
      setViewedExerciseId(null);
      return;
    }

    if (!viewedExerciseId) {
      setViewedExerciseId(activeExercise?.id ?? orderedExercises[0].id);
      return;
    }

    if (!orderedExercises.some((item) => item.id === viewedExerciseId)) {
      setViewedExerciseId(activeExercise?.id ?? orderedExercises[0].id);
    }
  }, [activeExercise?.id, orderedExercises, viewedExerciseId]);

  const viewedExercise =
    orderedExercises.find((item) => item.id === viewedExerciseId) ??
    activeExercise ??
    orderedExercises[0] ??
    null;

  const viewedIndex = viewedExercise
    ? orderedExercises.findIndex((item) => item.id === viewedExercise.id)
    : -1;

  const previousExercise =
    viewedIndex > 0 ? orderedExercises[viewedIndex - 1] : null;
  const nextExercise =
    viewedIndex >= 0 && viewedIndex < orderedExercises.length - 1
      ? orderedExercises[viewedIndex + 1]
      : null;

  const currentExercise = activeExercise;

  const nextDifferentExercise = useMemo(() => {
    if (!activeExercise) return null;

    const candidates = orderedExercises.filter(
      (item) =>
        item.id !== activeExercise.id &&
        isExecutable(item) &&
        performedCount(item.id) < plannedMax(item),
    );

    return (
      candidates.find(
        (item) => item.sequence_order > activeExercise.sequence_order,
      ) ??
      candidates[0] ??
      null
    );
  }, [activeExercise, orderedExercises, setsByExercise]);

  const activeElapsed = timer.activeInterval
    ? intervalElapsed(timer.activeInterval, nowMs)
    : 0;

  const sessionElapsed = timer.sessionTiming
    ? sessionElapsedSeconds(
        timer.sessionTiming.started_at,
        timer.sessionTiming.pause_accumulated_seconds,
        timer.sessionTiming.status,
        timer.sessionTiming.timer_paused_at,
        timer.sessionTiming.ended_at,
        nowMs,
      )
    : Math.max(
        0,
        Math.floor((nowMs - new Date(fallbackStartedAt).getTime()) / 1000),
      );

  const activeRest =
    timer.activeInterval?.interval_type === "rest"
      ? timer.activeInterval
      : null;

  const activeWork =
    timer.activeInterval?.interval_type === "work"
      ? timer.activeInterval
      : null;

  const currentSets = currentExercise
    ? setsByExercise.get(currentExercise.id) ?? []
    : [];

  const viewedSets = viewedExercise
    ? setsByExercise.get(viewedExercise.id) ?? []
    : [];

  const viewingActiveExercise =
    viewedExercise != null &&
    currentExercise != null &&
    viewedExercise.id === currentExercise.id;

  const restSet =
    activeRest?.workout_set_id != null
      ? currentSets.find((item) => item.id === activeRest.workout_set_id) ?? null
      : null;

  useEffect(() => {
    if (!activeRest || !restSet) return;

    setLoad(restSet.load_value == null ? "" : String(restSet.load_value));
    setLoadUnit(restSet.load_unit || "kg");
    setReps(restSet.reps == null ? "" : String(restSet.reps));
    setRir(restSet.rir == null ? "" : String(restSet.rir));
  }, [activeRest?.id, restSet?.id]);

  const restTarget = activeRest?.target_seconds ?? null;
  const restReached =
    activeRest != null &&
    restTarget != null &&
    activeElapsed >= restTarget;

  useEffect(() => {
    if (!activeRest) {
      alertedRestId.current = null;
      return;
    }

    if (
      restReached &&
      activeRest.status === "running" &&
      alertedRestId.current !== activeRest.id
    ) {
      alertedRestId.current = activeRest.id;
      playRestReadyAlert();
    }
  }, [activeRest, restReached]);

  const run = async (label: string, action: () => Promise<void>) => {
    try {
      await action();
      toast({ title: "Treino atualizado", description: label });
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "Não foi possível concluir",
        description:
          cause instanceof Error ? cause.message : "Tente novamente.",
      });
    }
  };

  const sessionPaused = timer.sessionTiming?.status === "paused";
  const disabled = timer.saving || sessionPaused;

  const completedOnCurrent = currentExercise
    ? performedCount(currentExercise.id)
    : 0;
  const minSets = currentExercise ? plannedMin(currentExercise) : 0;
  const maxSets = currentExercise ? plannedMax(currentExercise) : 0;
  const canDoOptionalExtra =
    currentExercise != null &&
    completedOnCurrent >= minSets &&
    completedOnCurrent < maxSets;

  const executionValues = () => ({
    loadValue: numberOrNull(load),
    loadUnit,
    reps: numberOrNull(reps),
    rir: numberOrNull(rir),
  });

  const saveRestSetIfNeeded = async () => {
    if (!activeRest?.workout_set_id) return;

    await timer.updateSetExecution(activeRest.workout_set_id, {
      loadValue: numberOrUndefined(load),
      loadUnit:
        numberOrUndefined(load) !== undefined ? loadUnit : undefined,
      reps: numberOrUndefined(reps),
      rir: numberOrUndefined(rir),
    });
  };

  const finishRestWithData = async (options?: {
    startNextWork?: boolean;
    nextWorkoutExerciseId?: string | null;
  }) => {
    if (!activeRest) return;
    await saveRestSetIfNeeded();
    await timer.finishRest(activeRest.id, options);
    setLoad("");
    setLoadUnit("kg");
    setReps("");
    setRir("");
  };

  if (timer.loading && !timer.sessionTiming) {
    return (
      <Card>
        <CardContent className="flex min-h-28 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!timer.available) {
    return (
      <Card className="border-amber-500/30">
        <CardContent className="py-4">
          <p className="text-sm font-medium">
            Cronômetro interativo indisponível neste ambiente.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="sticky top-[calc(49px+env(safe-area-inset-top))] z-20 rounded-xl border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Tempo ativo</span>
              <Badge variant="outline">
                {sessionPaused ? "pausado" : "ativo"}
              </Badge>
            </div>
            <p className="truncate text-sm font-semibold">{sessionTitle}</p>
          </div>

          <div className="rounded-lg bg-muted px-3 py-2 font-mono text-lg font-semibold">
            {formatElapsed(sessionElapsed)}
          </div>

          <Button
            size="icon"
            variant={sessionPaused ? "default" : "outline"}
            className="min-h-11 min-w-11"
            disabled={timer.saving}
            onClick={() =>
              void run(
                sessionPaused ? "Treino retomado." : "Treino pausado.",
                sessionPaused ? timer.resumeWorkout : timer.pauseWorkout,
              )
            }
            aria-label={sessionPaused ? "Retomar treino" : "Pausar treino"}
          >
            <Card className="border-primary/15">
        <CardContent className="px-3 py-3">
          <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              className="min-h-11 min-w-11"
              disabled={!previousExercise}
              onClick={() =>
                previousExercise && setViewedExerciseId(previousExercise.id)
              }
              aria-label="Exercício anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <div className="min-w-0 text-center">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Exercício {viewedIndex + 1} de {orderedExercises.length}
              </p>
              <p className="truncate text-base font-semibold">
                {viewedExercise
                  ? exerciseNameById.get(viewedExercise.exercise_id) ??
                    "Exercício"
                  : "—"}
              </p>
              {viewingActiveExercise ? (
                <div className="mt-1 flex items-center justify-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                  <span className="text-xs font-semibold text-primary">
                    EM EXECUÇÃO
                  </span>
                </div>
              ) : currentExercise ? (
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => setViewedExerciseId(currentExercise.id)}
                >
                  Em execução:{" "}
                  {exerciseNameById.get(viewedExercise.exercise_id) ??
                    "Exercício"}{" "}
                  · voltar
                </button>
              ) : null}
            </div>

            <Button
              size="icon"
              variant="outline"
              className="min-h-11 min-w-11"
              disabled={!nextExercise}
              onClick={() => nextExercise && setViewedExerciseId(nextExercise.id)}
              aria-label="Próximo exercício"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {sessionPaused ? (
              <Play className="h-5 w-5" />
            ) : (
              <Pause className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {sessionPaused ? (
        <Card>
          <CardContent className="space-y-3 py-4">
            <p className="text-center text-sm font-semibold">Treino pausado</p>
            <Button
              className="min-h-12 w-full"
              disabled={timer.saving}
              onClick={() => void run("Treino retomado.", timer.resumeWorkout)}
            >
              <Play className="mr-2 h-5 w-5" />
              Retomar treino
            </Button>
          </CardContent>
        </Card>
      ) : viewedExercise ? (
        <Card className={viewingActiveExercise ? "ring-1 ring-primary/25" : undefined}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  Exercício atual
                </p>
                <CardTitle className="mt-1 text-xl">
                  {exerciseNameById.get(currentExercise.exercise_id) ??
                    "Exercício"}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Série{" "}
                  {viewingActiveExercise
                    ? `Série ${timer.activeInterval?.set_number ?? completedOnCurrent + 1}`
                    : `${viewedSets.filter((item) => item.status === "completed").length} série(s) concluída(s)`}
                  {" · "}
                  plano {plannedMin(viewedExercise)}
                  {plannedMax(viewedExercise) !== plannedMin(viewedExercise)
                    ? `–${plannedMax(viewedExercise)}`
                    : ""} séries
                </p>
              </div>
              <Badge variant="outline">
                {viewedExercise.planned_reps_min ?? "—"}–
                {viewedExercise.planned_reps_max ?? "—"} reps
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {!viewingActiveExercise ? (
              <div className="space-y-3">
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="text-sm font-semibold">Visualização do exercício</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Este exercício não está em execução agora. Você pode consultar
                    a prescrição e o histórico, mas os controles ficam bloqueados
                    até ele se tornar o exercício ativo.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    RIR alvo {viewedExercise.planned_rir_target ?? "—"} · descanso{" "}
                    {viewedExercise.planned_rest_seconds != null
                      ? `${viewedExercise.planned_rest_seconds}s`
                      : "—"}
                  </p>
                </div>

                {viewedSets.length ? (
                  <div className="space-y-2">
                    {viewedSets
                      .filter((item) => item.status === "completed")
                      .map((set) => (
                        <div
                          key={set.id}
                          className="rounded-lg bg-muted/35 px-3 py-2 text-sm"
                        >
                          <span className="font-semibold">#{set.set_number}</span>
                          {" · "}
                          {set.load_value ?? "—"} {set.load_unit}
                          {" · "}
                          {set.reps ?? "—"} reps
                          {" · RIR "}
                          {set.rir ?? "—"}
                          {set.rest_seconds != null
                            ? ` · ${set.rest_seconds}s`
                            : ""}
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma série registrada neste exercício ainda.
                  </p>
                )}
              </div>
            ) : null}

            {viewingActiveExercise ? (
              <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Carga</Label>
                <Input
                  className="min-h-11"
                  inputMode="decimal"
                  value={load}
                  onChange={(event) => setLoad(event.target.value)}
                  placeholder="kg"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unid.</Label>
                <Select value={loadUnit} onValueChange={setLoadUnit}>
                  <SelectTrigger className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="lb">lb</SelectItem>
                    <SelectItem value="bodyweight">Corpo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reps</Label>
                <Input
                  className="min-h-11"
                  inputMode="numeric"
                  value={reps}
                  onChange={(event) => setReps(event.target.value)}
                  placeholder={
                    currentExercise.planned_reps_min != null
                      ? `${currentExercise.planned_reps_min}–${currentExercise.planned_reps_max ?? currentExercise.planned_reps_min}`
                      : "—"
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">RIR</Label>
                <Input
                  className="min-h-11"
                  inputMode="decimal"
                  value={rir}
                  onChange={(event) => setRir(event.target.value)}
                  placeholder={
                    currentExercise.planned_rir_target != null
                      ? `alvo ${currentExercise.planned_rir_target}`
                      : "—"
                  }
                />
              </div>
            </div>

            {activeWork ? (
              <>
                <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/25 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Execução
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Preencha a série enquanto executa.
                    </p>
                  </div>
                  <p className="font-mono text-2xl font-semibold">
                    {formatElapsed(activeElapsed)}
                  </p>
                </div>

                <Button
                  className="min-h-12 w-full text-base"
                  disabled={disabled}
                  onClick={() =>
                    void run("Série concluída. Descanso iniciado.", () =>
                      timer.finishWorkStartRest(
                        activeWork.id,
                        executionValues(),
                      ),
                    )
                  }
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Concluir série
                </Button>
              </>
            ) : activeRest ? (
              <>
                <div
                  className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
                  aria-live="polite"
                >
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Descanso
                    </p>
                    {restTarget == null ? (
                      <p className="text-sm font-medium">
                        Sem meta prescrita
                      </p>
                    ) : restReached ? (
                      <>
                        <p className="text-sm font-semibold">
                          Pode voltar
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Meta {formatElapsed(restTarget)} · extra +
                          {formatElapsed(activeElapsed - restTarget)}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Meta {formatElapsed(restTarget)} · faltam{" "}
                        {formatElapsed(restTarget - activeElapsed)}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 font-mono text-2xl font-semibold">
                    {formatElapsed(activeElapsed)}
                  </p>
                </div>

                <p className="text-xs text-muted-foreground">
                  Os campos acima são da série que acabou. Se algo ficou vazio,
                  preencha agora; o sistema salva antes de avançar.
                </p>

                <Button
                  variant="outline"
                  className="min-h-11 w-full"
                  disabled={timer.saving || !activeRest.workout_set_id}
                  onClick={() =>
                    void run("Dados da série salvos.", saveRestSetIfNeeded)
                  }
                >
                  <Save className="mr-2 h-4 w-4" />
                  Salvar dados da série
                </Button>

                {completedOnCurrent < minSets ? (
                  <Button
                    className="min-h-12 w-full text-base"
                    disabled={disabled}
                    onClick={() =>
                      void run(
                        "Dados salvos. Próxima série iniciada.",
                        () =>
                          finishRestWithData({
                            startNextWork: true,
                            nextWorkoutExerciseId: currentExercise.id,
                          }),
                      )
                    }
                  >
                    <Play className="mr-2 h-5 w-5" />
                    Voltar ao exercício
                  </Button>
                ) : canDoOptionalExtra ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      className="min-h-12"
                      disabled={disabled}
                      onClick={() =>
                        void run(
                          "Dados salvos. Série extra iniciada.",
                          () =>
                            finishRestWithData({
                              startNextWork: true,
                              nextWorkoutExerciseId: currentExercise.id,
                            }),
                        )
                      }
                    >
                      <Play className="mr-2 h-5 w-5" />
                      Mais uma série
                    </Button>
                    {nextDifferentExercise ? (
                      <Button
                        variant="secondary"
                        className="min-h-12"
                        disabled={disabled}
                        onClick={() =>
                          void run(
                            "Dados salvos. Próximo exercício iniciado.",
                            () =>
                              finishRestWithData({
                                startNextWork: true,
                                nextWorkoutExerciseId:
                                  nextDifferentExercise.id,
                              }),
                          )
                        }
                      >
                        <Dumbbell className="mr-2 h-5 w-5" />
                        Próximo exercício
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        className="min-h-12"
                        disabled={disabled}
                        onClick={() =>
                          void run(
                            "Dados e descanso registrados.",
                            () => finishRestWithData(),
                          )
                        }
                      >
                        Encerrar descanso
                      </Button>
                    )}
                  </div>
                ) : nextDifferentExercise ? (
                  <Button
                    className="min-h-12 w-full text-base"
                    disabled={disabled}
                    onClick={() =>
                      void run(
                        "Dados salvos. Próximo exercício iniciado.",
                        () =>
                          finishRestWithData({
                            startNextWork: true,
                            nextWorkoutExerciseId: nextDifferentExercise.id,
                          }),
                      )
                    }
                  >
                    <Dumbbell className="mr-2 h-5 w-5" />
                    Próximo exercício
                  </Button>
                ) : (
                  <Button
                    className="min-h-12 w-full text-base"
                    disabled={disabled}
                    onClick={() =>
                      void run(
                        "Dados e descanso registrados.",
                        () => finishRestWithData(),
                      )
                    }
                  >
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Encerrar descanso
                  </Button>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/25 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      Pronto para a série
                    </p>
                    <p className="text-xs text-muted-foreground">
                      RIR alvo {currentExercise.planned_rir_target ?? "—"} ·
                      descanso{" "}
                      {currentExercise.planned_rest_seconds != null
                        ? `${currentExercise.planned_rest_seconds}s`
                        : "—"}
                    </p>
                  </div>
                  <Clock3 className="h-5 w-5 text-muted-foreground" />
                </div>

                <Button
                  className="min-h-12 w-full text-base"
                  disabled={disabled}
                  onClick={() =>
                    void run("Cronômetro de execução iniciado.", () =>
                      timer.startWorkInterval(currentExercise.id),
                    )
                  }
                >
                  <Play className="mr-2 h-5 w-5" />
                  Iniciar série
                </Button>
              </>
            )}
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-5 text-center">
            <CheckCircle2 className="mx-auto h-7 w-7 text-primary" />
            <p className="mt-2 font-semibold">Séries rápidas concluídas</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Revise os detalhes se quiser e finalize o treino.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
