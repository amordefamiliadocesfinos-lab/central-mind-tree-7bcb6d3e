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

function intervalElapsed(
  interval: WorkoutTimerIntervalF19,
  nowMs: number,
) {
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
    oscillator.addEventListener("ended", () => {
      void context.close();
    });
  } catch {
    // Best effort only.
  }
}

function PerformedSetLine({ set }: { set: WorkoutSet }) {
  return (
    <div className="rounded-lg bg-muted/35 px-3 py-2 text-sm">
      <span className="font-semibold">#{set.set_number}</span>
      {" · "}
      {set.load_value ?? "—"} {set.load_unit}
      {" · "}
      {set.reps ?? "—"} reps
      {" · RIR "}
      {set.rir ?? "—"}
      {set.rest_seconds != null ? ` · ${set.rest_seconds}s` : ""}
    </div>
  );
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
  const [resultSaved, setResultSaved] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [viewedExerciseId, setViewedExerciseId] = useState<string | null>(null);
  const alertedRestId = useRef<string | null>(null);
  const previousActiveExerciseId = useRef<string | null>(null);

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

    if (selectedExerciseId) {
      const selected =
        orderedExercises.find(
          (item) =>
            item.id === selectedExerciseId &&
            isExecutable(item) &&
            performedCount(item.id) < plannedMax(item),
        ) ?? null;

      if (selected) return selected;
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
  }, [
    orderedExercises,
    selectedExerciseId,
    setsByExercise,
    timer.activeInterval,
  ]);

  useEffect(() => {
    const activeId = activeExercise?.id ?? null;

    if (timer.activeInterval?.workout_exercise_id) {
      setSelectedExerciseId(timer.activeInterval.workout_exercise_id);
    }

    if (activeId && previousActiveExerciseId.current !== activeId) {
      previousActiveExerciseId.current = activeId;
      setViewedExerciseId(activeId);
      return;
    }

    if (!viewedExerciseId && orderedExercises.length) {
      setViewedExerciseId(activeId ?? orderedExercises[0].id);
      return;
    }

    if (
      viewedExerciseId &&
      !orderedExercises.some((item) => item.id === viewedExerciseId)
    ) {
      setViewedExerciseId(activeId ?? orderedExercises[0]?.id ?? null);
    }
  }, [
    activeExercise?.id,
    orderedExercises,
    timer.activeInterval?.workout_exercise_id,
    viewedExerciseId,
  ]);

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

  const viewingActiveExercise =
    viewedExercise != null &&
    activeExercise != null &&
    viewedExercise.id === activeExercise.id;

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
        Math.floor(
          (nowMs - new Date(fallbackStartedAt).getTime()) / 1000,
        ),
      );

  const activeRest =
    timer.activeInterval?.interval_type === "rest"
      ? timer.activeInterval
      : null;

  const activeWork =
    timer.activeInterval?.interval_type === "work"
      ? timer.activeInterval
      : null;

  const activeSets = activeExercise
    ? setsByExercise.get(activeExercise.id) ?? []
    : [];

  const viewedSets = viewedExercise
    ? setsByExercise.get(viewedExercise.id) ?? []
    : [];

  const restSet =
    activeRest?.workout_set_id != null
      ? activeSets.find((item) => item.id === activeRest.workout_set_id) ?? null
      : null;

  const completedWorkForRest =
    activeRest?.workout_set_id != null
      ? [...timer.intervals]
          .reverse()
          .find(
            (item) =>
              item.interval_type === "work" &&
              item.workout_set_id === activeRest.workout_set_id &&
              item.status === "completed",
          ) ?? null
      : null;


  useEffect(() => {
    if (!activeRest || !restSet) {
      setResultSaved(false);
      return;
    }

    setLoad(restSet.load_value == null ? "" : String(restSet.load_value));
    setLoadUnit(restSet.load_unit || "kg");
    setReps(restSet.reps == null ? "" : String(restSet.reps));
    setRir(restSet.rir == null ? "" : String(restSet.rir));
    setResultSaved(false);
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

  const completedOnActive = activeExercise
    ? performedCount(activeExercise.id)
    : 0;

  const minSets = activeExercise ? plannedMin(activeExercise) : 0;
  const maxSets = activeExercise ? plannedMax(activeExercise) : 0;

  const canDoOptionalExtra =
    activeExercise != null &&
    completedOnActive >= minSets &&
    completedOnActive < maxSets;

  const saveRestResult = async () => {
    if (!activeRest?.workout_set_id) return;

    const parsedLoad = numberOrUndefined(load);

    await timer.updateSetExecution(activeRest.workout_set_id, {
      loadValue: parsedLoad,
      loadUnit: parsedLoad !== undefined ? loadUnit : undefined,
      reps: numberOrUndefined(reps),
      rir: numberOrUndefined(rir),
    });

    setResultSaved(true);
  };

  const finishRestAfterSaved = async (options?: {
    startNextWork?: boolean;
    nextWorkoutExerciseId?: string | null;
  }) => {
    if (!activeRest) return;
    if (!resultSaved) {
      throw new Error("Salve o resultado da série antes de avançar.");
    }

    await timer.finishRest(activeRest.id, options);

    setLoad("");
    setLoadUnit("kg");
    setReps("");
    setRir("");
    setResultSaved(false);
  };

  const viewedExerciseSelectable =
    viewedExercise != null &&
    isExecutable(viewedExercise) &&
    performedCount(viewedExercise.id) < plannedMax(viewedExercise);

  const canChooseViewedExercise =
    viewedExerciseSelectable &&
    (!timer.activeInterval ||
      (timer.activeInterval.interval_type === "rest" && resultSaved));

  const chooseViewedExercise = async () => {
    if (!viewedExercise || !viewedExerciseSelectable) return;

    if (activeRest) {
      await finishRestAfterSaved({
        startNextWork: true,
        nextWorkoutExerciseId: viewedExercise.id,
      });
      setSelectedExerciseId(viewedExercise.id);
      return;
    }

    setSelectedExerciseId(viewedExercise.id);
    setViewedExerciseId(viewedExercise.id);
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
            {sessionPaused ? (
              <Play className="h-5 w-5" />
            ) : (
              <Pause className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

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
                    {timer.activeInterval ? "EM EXECUÇÃO" : "SELECIONADO"}
                  </span>
                </div>
              ) : activeExercise ? (
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => setViewedExerciseId(activeExercise.id)}
                >
                  Em execução:{" "}
                  {exerciseNameById.get(activeExercise.exercise_id) ??
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
              onClick={() =>
                nextExercise && setViewedExerciseId(nextExercise.id)
              }
              aria-label="Próximo exercício"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {sessionPaused ? (
        <Card>
          <CardContent className="space-y-3 py-4">
            <p className="text-center text-sm font-semibold">Treino pausado</p>
            <Button
              className="min-h-12 w-full"
              disabled={timer.saving}
              onClick={() =>
                void run("Treino retomado.", timer.resumeWorkout)
              }
            >
              <Play className="mr-2 h-5 w-5" />
              Retomar treino
            </Button>
          </CardContent>
        </Card>
      ) : viewedExercise ? (
        <Card
          className={
            viewingActiveExercise ? "ring-1 ring-primary/25" : undefined
          }
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  {viewingActiveExercise
                    ? "Exercício atual em execução"
                    : "Visualização do exercício"}
                </p>
                <CardTitle className="mt-1 text-xl">
                  {exerciseNameById.get(viewedExercise.exercise_id) ??
                    "Exercício"}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {viewingActiveExercise
                    ? timer.activeInterval
                      ? `Série ${timer.activeInterval.set_number ?? completedOnActive + 1}`
                      : `Próxima série ${completedOnActive + 1}`
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
              <>
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="text-sm font-semibold">
                    Escolha livre da sequência
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Você pode fazer os exercícios na ordem que estiver disponível
                    na academia. A programação continua a mesma; muda apenas a
                    sequência real de execução.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    RIR alvo {viewedExercise.planned_rir_target ?? "—"} ·
                    descanso{" "}
                    {viewedExercise.planned_rest_seconds != null
                      ? `${viewedExercise.planned_rest_seconds}s`
                      : "—"}
                  </p>
                </div>

                {viewedExerciseSelectable ? (
                  <Button
                    className="min-h-12 w-full"
                    disabled={!canChooseViewedExercise || timer.saving}
                    onClick={() =>
                      void run(
                        activeRest
                          ? "Descanso registrado. Exercício escolhido iniciado."
                          : "Exercício selecionado.",
                        chooseViewedExercise,
                      )
                    }
                  >
                    <Dumbbell className="mr-2 h-5 w-5" />
                    {activeRest
                      ? resultSaved
                        ? "Fazer este exercício agora"
                        : "Salve o resultado antes de trocar"
                      : timer.activeInterval?.interval_type === "work"
                        ? "Conclua a série atual para trocar"
                        : "Fazer este exercício agora"}
                  </Button>
                ) : null}

                {viewedSets.filter((item) => item.status === "completed")
                  .length ? (
                  <div className="space-y-2">
                    {viewedSets
                      .filter((item) => item.status === "completed")
                      .map((set) => (
                        <PerformedSetLine key={set.id} set={set} />
                      ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma série registrada neste exercício ainda.
                  </p>
                )}

                {activeExercise ? (
                  <Button
                    className="min-h-11 w-full"
                    variant="secondary"
                    onClick={() => setViewedExerciseId(activeExercise.id)}
                  >
                    Voltar ao exercício em execução
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                {activeWork ? (
                  <>
                    <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/25 px-4 py-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Execução
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Apenas execute. O resultado será preenchido ao terminar.
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Tempo da série
                        </p>
                        <p className="font-mono text-3xl font-semibold">
                          {formatElapsed(activeElapsed)}
                        </p>
                      </div>
                    </div>

                    <Button
                      className="min-h-12 w-full text-base"
                      disabled={disabled}
                      onClick={() =>
                        void run(
                          "Série concluída. Descanso iniciado.",
                          () =>
                            timer.finishWorkStartRest(activeWork.id),
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

                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Resultado da série
                          </p>
                          <p className="mt-1 text-sm font-semibold">
                            Série {activeRest.set_number ?? completedOnActive} concluída
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-muted-foreground">
                            Tempo de execução
                          </p>
                          <p className="font-mono text-lg font-semibold">
                            {completedWorkForRest?.actual_seconds != null
                              ? formatElapsed(
                                  Number(completedWorkForRest.actual_seconds),
                                )
                              : "—"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="space-y-1">
                          <Label className="text-xs">Carga</Label>
                          <Input
                            className="min-h-11"
                            inputMode="decimal"
                            value={load}
                            onChange={(event) => {
                              setLoad(event.target.value);
                              setResultSaved(false);
                            }}
                            placeholder="kg"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Unid.</Label>
                          <Select
                            value={loadUnit}
                            onValueChange={(value) => {
                              setLoadUnit(value);
                              setResultSaved(false);
                            }}
                          >
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
                          <Label className="text-xs">Reps feitas</Label>
                          <Input
                            className="min-h-11"
                            inputMode="numeric"
                            value={reps}
                            onChange={(event) => {
                              setReps(event.target.value);
                              setResultSaved(false);
                            }}
                            placeholder={
                              viewedExercise.planned_reps_min != null
                                ? `plano ${viewedExercise.planned_reps_min}–${viewedExercise.planned_reps_max ?? viewedExercise.planned_reps_min}`
                                : "—"
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">RIR real</Label>
                          <Input
                            className="min-h-11"
                            inputMode="decimal"
                            value={rir}
                            onChange={(event) => {
                              setRir(event.target.value);
                              setResultSaved(false);
                            }}
                            placeholder={
                              viewedExercise.planned_rir_target != null
                                ? `alvo ${viewedExercise.planned_rir_target}`
                                : "—"
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button
                        className="min-h-12 w-full"
                        variant={resultSaved ? "secondary" : "default"}
                        disabled={
                          timer.saving ||
                          !activeRest.workout_set_id ||
                          resultSaved
                        }
                        onClick={() =>
                          void run(
                            resultSaved
                              ? "Resultado já estava salvo."
                              : "Resultado da série salvo. O descanso continua.",
                            saveRestResult,
                          )
                        }
                      >
                        {resultSaved ? (
                          <CheckCircle2 className="mr-2 h-5 w-5" />
                        ) : (
                          <Save className="mr-2 h-5 w-5" />
                        )}
                        {resultSaved ? "Resultado salvo" : "Salvar resultado"}
                      </Button>

                      <p className="text-xs text-muted-foreground">
                        Salvar não inicia a próxima série e não encerra o descanso.
                        {resultSaved
                          ? " Resultado salvo — escolha abaixo quando deseja avançar."
                          : " Salve o resultado para liberar os botões de avanço."}
                      </p>
                    </div>

                    {completedOnActive < minSets ? (
                      <Button
                        className="min-h-12 w-full text-base"
                        disabled={disabled || !resultSaved}
                        onClick={() =>
                          void run(
                            "Próxima série iniciada.",
                            () =>
                              finishRestAfterSaved({
                                startNextWork: true,
                                nextWorkoutExerciseId: activeExercise.id,
                              }),
                          )
                        }
                      >
                        <Play className="mr-2 h-5 w-5" />
                        Iniciar próxima série
                      </Button>
                    ) : canDoOptionalExtra ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          className="min-h-12"
                          disabled={disabled || !resultSaved}
                          onClick={() =>
                            void run(
                              "Série extra iniciada.",
                              () =>
                                finishRestAfterSaved({
                                  startNextWork: true,
                                  nextWorkoutExerciseId: activeExercise.id,
                                }),
                            )
                          }
                        >
                          <Play className="mr-2 h-5 w-5" />
                          Fazer série extra
                        </Button>

                        {nextDifferentExercise ? (
                          <Button
                            variant="secondary"
                            className="min-h-12"
                            disabled={disabled || !resultSaved}
                            onClick={() =>
                              void run(
                                "Próximo exercício iniciado.",
                                () =>
                                  finishRestAfterSaved({
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
                            disabled={disabled || !resultSaved}
                            onClick={() =>
                              void run(
                                "Descanso encerrado.",
                                () => finishRestAfterSaved(),
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
                        disabled={disabled || !resultSaved}
                        onClick={() =>
                          void run(
                            "Próximo exercício iniciado.",
                            () =>
                              finishRestAfterSaved({
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
                        className="min-h-12 w-full text-base"
                        disabled={disabled || !resultSaved}
                        onClick={() =>
                          void run(
                            "Descanso encerrado.",
                            () => finishRestAfterSaved(),
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
                    <div className="rounded-xl border bg-muted/25 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            Pronto para a série
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Faça a série primeiro. Carga, reps e RIR serão
                            registrados depois que você tocar em concluir.
                          </p>
                        </div>
                        <Clock3 className="h-5 w-5 shrink-0 text-muted-foreground" />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Plano: {activeExercise?.planned_reps_min ?? "—"}–
                        {activeExercise?.planned_reps_max ?? "—"} reps · RIR{" "}
                        {activeExercise?.planned_rir_target ?? "—"} · descanso{" "}
                        {activeExercise?.planned_rest_seconds != null
                          ? `${activeExercise.planned_rest_seconds}s`
                          : "—"}
                      </p>
                    </div>

                    {activeSets.filter((item) => item.status === "completed").length ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Séries anteriores deste exercício
                        </p>
                        {activeSets
                          .filter((item) => item.status === "completed")
                          .slice(-2)
                          .map((set) => (
                            <PerformedSetLine key={set.id} set={set} />
                          ))}
                      </div>
                    ) : null}

                    <Button
                      className="min-h-12 w-full text-base"
                      disabled={disabled || !activeExercise}
                      onClick={() =>
                        activeExercise &&
                        void run(
                          "Cronômetro de execução iniciado.",
                          () =>
                            timer.startWorkInterval(activeExercise.id),
                        )
                      }
                    >
                      <Play className="mr-2 h-5 w-5" />
                      Iniciar série
                    </Button>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-5 text-center">
            <CheckCircle2 className="mx-auto h-7 w-7 text-primary" />
            <p className="mt-2 font-semibold">
              Séries rápidas concluídas
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Revise os detalhes se quiser e finalize o treino.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
