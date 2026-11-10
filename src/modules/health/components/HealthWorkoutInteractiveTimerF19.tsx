import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Dumbbell,
  Loader2,
  Pause,
  Play,
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

function plannedMin(item: WorkoutExercise) {
  return item.planned_sets_min ?? item.planned_sets_max ?? 1;
}

function plannedMax(item: WorkoutExercise) {
  return item.planned_sets_max ?? item.planned_sets_min ?? 1;
}

function isExecutable(item: WorkoutExercise) {
  return item.status !== "skipped" &&
    item.status !== "replaced" &&
    item.status !== "completed";
}

function playRestReadyAlert() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate([180, 100, 180]);
    } catch {
      // Vibration is best-effort only.
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
    // Audio is best-effort only.
  }
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
  const alertedRestId = useRef<string | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (timer.activeInterval?.interval_type === "work") {
      setLoad("");
      setLoadUnit("kg");
      setReps("");
      setRir("");
    }
  }, [timer.activeInterval?.id, timer.activeInterval?.interval_type]);

  const orderedExercises = useMemo(
    () => [...exercises].sort((a, b) => a.sequence_order - b.sequence_order),
    [exercises],
  );

  const performedCount = (exerciseId: string) =>
    (setsByExercise.get(exerciseId) ?? []).filter(
      (item) => item.status === "completed",
    ).length;

  const currentExercise = useMemo(() => {
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

  const nextDifferentExercise = useMemo(() => {
    if (!currentExercise) return null;

    const candidates = orderedExercises.filter(
      (item) =>
        item.id !== currentExercise.id &&
        isExecutable(item) &&
        performedCount(item.id) < plannedMax(item),
    );

    return (
      candidates.find(
        (item) => item.sequence_order > currentExercise.sequence_order,
      ) ??
      candidates[0] ??
      null
    );
  }, [currentExercise, orderedExercises, setsByExercise]);

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

  const exerciseWorkSeconds = currentExercise
    ? (timer.workIntervalsByExercise.get(currentExercise.id) ?? []).reduce(
        (sum, item) => {
          if (item.id === timer.activeInterval?.id) {
            return sum + activeElapsed;
          }
          return sum + Number(item.actual_seconds ?? 0);
        },
        0,
      )
    : 0;

  const activeRest =
    timer.activeInterval?.interval_type === "rest"
      ? timer.activeInterval
      : null;

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
      toast({ title: "Cronômetro atualizado", description: label });
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

  if (timer.loading && !timer.sessionTiming) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!timer.available) {
    return (
      <div className="space-y-3">
        <div className="sticky top-[calc(49px+env(safe-area-inset-top))] z-20 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                Treino em andamento
              </p>
              <h2 className="truncate text-lg font-semibold">{sessionTitle}</h2>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-lg bg-muted px-3 py-2 font-mono text-sm">
              <Clock3 className="h-4 w-4" />
              {formatElapsed(sessionElapsed)}
            </div>
          </div>
        </div>

        <Card className="border-amber-500/30">
          <CardContent className="py-4">
            <p className="text-sm font-medium">
              Cronômetro interativo ainda não está ativo neste ambiente.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              O treino M4 continua disponível normalmente. A F19 depende da
              migration do ambiente; nenhum timer falso é criado localmente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedOnCurrent = currentExercise
    ? performedCount(currentExercise.id)
    : 0;

  const minSets = currentExercise ? plannedMin(currentExercise) : 0;
  const maxSets = currentExercise ? plannedMax(currentExercise) : 0;
  const canDoOptionalExtra =
    currentExercise != null &&
    completedOnCurrent >= minSets &&
    completedOnCurrent < maxSets;

  return (
    <div className="space-y-4">
      <div className="sticky top-[calc(49px+env(safe-area-inset-top))] z-20 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted-foreground">Tempo ativo</p>
              <Badge variant="outline">
                {sessionPaused ? "pausado" : "ativo"}
              </Badge>
            </div>
            <h2 className="truncate text-lg font-semibold">{sessionTitle}</h2>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="rounded-lg bg-muted px-3 py-2 font-mono text-base font-semibold">
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
                  sessionPaused
                    ? timer.resumeWorkout
                    : timer.pauseWorkout,
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
      </div>

      {sessionPaused ? (
        <Card>
          <CardContent className="py-6 text-center">
            <Pause className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-lg font-semibold">Treino pausado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              O tempo ativo, a execução e o descanso estão congelados.
            </p>
            <Button
              className="mt-4 min-h-12 w-full text-base"
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
      ) : currentExercise ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Agora
                </p>
                <CardTitle className="mt-1 text-xl">
                  {exerciseNameById.get(currentExercise.exercise_id) ??
                    "Exercício"}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Série{" "}
                  {timer.activeInterval?.set_number ??
                    completedOnCurrent + 1}
                  {" · "}
                  plano {minSets}
                  {maxSets !== minSets ? `–${maxSets}` : ""} séries
                </p>
              </div>
              <Badge variant="outline">
                {currentExercise.planned_reps_min ?? "—"}–
                {currentExercise.planned_reps_max ?? "—"} reps
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {timer.activeInterval?.interval_type === "work" ? (
              <>
                <div className="rounded-2xl border p-5 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Execução
                  </p>
                  <p className="mt-2 font-mono text-4xl font-semibold">
                    {formatElapsed(activeElapsed)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Exercício acumulado: {formatElapsed(exerciseWorkSeconds)}
                  </p>
                </div>

                <Button
                  className="min-h-14 w-full text-base"
                  disabled={disabled}
                  onClick={() =>
                    void run("Série concluída. Descanso iniciado.", () =>
                      timer.finishWorkStartRest(timer.activeInterval!.id, {
                        loadValue: numberOrNull(load),
                        loadUnit,
                        reps: numberOrNull(reps),
                        rir: numberOrNull(rir),
                      }),
                    )
                  }
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Concluir série
                </Button>

                <details className="rounded-xl border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Detalhes opcionais da série
                  </summary>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Carga</Label>
                      <Input
                        className="min-h-11"
                        inputMode="decimal"
                        value={load}
                        onChange={(event) => setLoad(event.target.value)}
                        placeholder="opcional"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unidade</Label>
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
                        placeholder="opcional"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">RIR</Label>
                      <Input
                        className="min-h-11"
                        inputMode="decimal"
                        value={rir}
                        onChange={(event) => setRir(event.target.value)}
                        placeholder="opcional"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Se deixar vazio, a série continua válida como fato temporal.
                    O sistema não copia carga, reps ou RIR planejados para a
                    execução real.
                  </p>
                </details>
              </>
            ) : activeRest ? (
              <>
                <div
                  className="rounded-2xl border p-5 text-center"
                  aria-live="polite"
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Descanso
                  </p>
                  <p className="mt-2 font-mono text-4xl font-semibold">
                    {formatElapsed(activeElapsed)}
                  </p>

                  {restTarget == null ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Sem meta de descanso prescrita.
                    </p>
                  ) : restReached ? (
                    <div className="mt-3">
                      <p className="font-semibold">
                        Descanso atingido — pode voltar
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Meta {formatElapsed(restTarget)} · extra +
                        {formatElapsed(activeElapsed - restTarget)}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <p className="text-sm font-medium">
                        Meta {formatElapsed(restTarget)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Faltam {formatElapsed(restTarget - activeElapsed)}
                      </p>
                    </div>
                  )}
                </div>

                {completedOnCurrent < minSets ? (
                  <Button
                    className="min-h-14 w-full text-base"
                    disabled={disabled}
                    onClick={() =>
                      void run("Descanso registrado. Próxima série iniciada.", () =>
                        timer.finishRest(activeRest.id, {
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
                      className="min-h-14 text-base"
                      disabled={disabled}
                      onClick={() =>
                        void run("Descanso registrado. Série extra iniciada.", () =>
                          timer.finishRest(activeRest.id, {
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
                        className="min-h-14 text-base"
                        disabled={disabled}
                        onClick={() =>
                          void run(
                            "Descanso registrado. Próximo exercício iniciado.",
                            () =>
                              timer.finishRest(activeRest.id, {
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
                        className="min-h-14 text-base"
                        disabled={disabled}
                        onClick={() =>
                          void run("Descanso registrado.", () =>
                            timer.finishRest(activeRest.id),
                          )
                        }
                      >
                        Encerrar descanso
                      </Button>
                    )}
                  </div>
                ) : nextDifferentExercise ? (
                  <Button
                    className="min-h-14 w-full text-base"
                    disabled={disabled}
                    onClick={() =>
                      void run(
                        "Descanso registrado. Próximo exercício iniciado.",
                        () =>
                          timer.finishRest(activeRest.id, {
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
                    className="min-h-14 w-full text-base"
                    disabled={disabled}
                    onClick={() =>
                      void run("Descanso final registrado.", () =>
                        timer.finishRest(activeRest.id),
                      )
                    }
                  >
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Encerrar descanso
                  </Button>
                )}

                <p className="text-center text-xs text-muted-foreground">
                  O contador não para ao atingir a meta. O tempo real só fecha
                  quando você toca no botão.
                </p>
              </>
            ) : (
              <>
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="text-sm font-medium">
                    Pronto para a próxima série
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    RIR alvo {currentExercise.planned_rir_target ?? "—"} ·
                    descanso alvo{" "}
                    {currentExercise.planned_rest_seconds != null
                      ? `${currentExercise.planned_rest_seconds}s`
                      : "—"}
                  </p>
                </div>

                <Button
                  className="min-h-14 w-full text-base"
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
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-2 text-lg font-semibold">
              Séries rápidas concluídas
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Não há outra série planejada pendente. Revise os detalhes se
              quiser e finalize o treino.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
