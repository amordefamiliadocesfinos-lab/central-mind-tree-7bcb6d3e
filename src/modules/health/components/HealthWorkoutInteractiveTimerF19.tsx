import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Save,
  Square,
  X,
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
import { HealthExerciseMovementPreview } from "./HealthExerciseMovementPreview";
import { assessF24ExecutionSignal } from "../cch/executionEvidence";
import { HealthWorkoutContextualGuidance } from "./HealthWorkoutContextualGuidance";
import type { ExerciseCatalogItem } from "../hooks/useHealthCatalogs";
import { canOfferExtraSeries, preserveF24ExtraChoice } from "../cch/f24ExtraSeriesChoice";
import type {F24ExerciseHistoryStatus} from "../hooks/useF24WorkoutHistory";
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
  focusMode=false,
  onToggleFocus,
  guidanceScope,
  guidanceReadReady,
  fallbackStartedAt,
  exercises,
  setsByExercise,
  exerciseNameById,
  exerciseCatalogById,
  historicalReferences,
  historyLoading,
  timer,
  onCompleteWorkout,
  onConfirmEquipment,
}: {
  sessionTitle: string;
  focusMode?: boolean;
  onToggleFocus?: () => void;
  guidanceScope?: string;
  guidanceReadReady?: boolean;
  fallbackStartedAt: string;
  exercises: WorkoutExercise[];
  setsByExercise: Map<string, WorkoutSet[]>;
  exerciseNameById: Map<string, string>;
  exerciseCatalogById?: Map<string, ExerciseCatalogItem>;
  historicalReferences: Map<string,F24ExerciseHistoryStatus>;
  historyLoading: boolean;
  timer: HealthWorkoutTimerF19Controller;
  onCompleteWorkout: () => Promise<void>;
  onConfirmEquipment: (workoutExerciseId:string,equipmentLabel:string)=>Promise<void>;
}) {
  const { toast } = useToast();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [equipmentLabels,setEquipmentLabels] = useState<Record<string,string>>({});
  const [equipmentConfirmed,setEquipmentConfirmed] = useState<string[]>([]);
  const [load, setLoad] = useState("");
  const [loadUnit, setLoadUnit] = useState("kg");
  const [reps, setReps] = useState("");
  const [rir, setRir] = useState("");
  const [resultDirty, setResultDirty] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [feedback,setFeedback]=useState("");
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [viewedExerciseId, setViewedExerciseId] = useState<string | null>(null);
  const [plannedNextExerciseId, setPlannedNextExerciseId] = useState<string | null>(null);
  const [extraExerciseId, setExtraExerciseId] = useState<string | null>(null);
  const actionPending = useRef(false);
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
            (performedCount(item.id) < plannedMax(item) ||
              (extraExerciseId === item.id &&
                canOfferExtraSeries(performedCount(item.id), plannedMax(item), item.status))),
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
    extraExerciseId,
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

  const historyStatus = viewedExercise ? historicalReferences.get(viewedExercise.id) : undefined;
  // Only a verified label match from the existing scoped read may expose values.
  // A matching label does not certify the same physical machine.
  const previousReference = !historyLoading && historyStatus?.reason === "comparable"
    ? historyStatus.reference : null;

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

  // Consumes the permission to run a single extra series. Never auto-repeat.
  useEffect(() => {
    if (activeWork) setExtraExerciseId(null);
  }, [activeWork?.id]);

  const plannedNextExercise =
    orderedExercises.find(
      (item) =>
        item.id === plannedNextExerciseId &&
        isExecutable(item) &&
        (performedCount(item.id) < plannedMax(item) ||
         (extraExerciseId === item.id &&
          canOfferExtraSeries(performedCount(item.id), plannedMax(item), item.status))),
    ) ?? null;

  const recommendedNextExercise =
    activeExercise &&
    performedCount(activeExercise.id) < plannedMax(activeExercise)
      ? activeExercise
      : nextDifferentExercise;

  useEffect(() => {
    setPlannedNextExerciseId(null);
  }, [activeRest?.id]);

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
      setResultDirty(false);
      return;
    }

    setLoad(restSet.load_value == null ? "" : String(restSet.load_value));
    setLoadUnit(restSet.load_unit || "kg");
    setReps(restSet.reps == null ? "" : String(restSet.reps));
    setRir(restSet.rir == null ? "" : String(restSet.rir));
    setResultDirty(false);
  }, [
    activeRest?.id,
    restSet?.id,
    restSet?.updated_at,
  ]);

  const resultPersisted =
    activeRest != null &&
    restSet != null &&
    new Date(restSet.updated_at).getTime() >
      new Date(activeRest.started_at).getTime();

  const resultSaved = resultPersisted && !resultDirty;

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
    // Block synchronous duplicate taps before React reflects saving=true.
    if (actionPending.current) return;
    actionPending.current = true;
    try {
      await action();
      setFeedback(label);
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "Não foi possível concluir",
        description:
          cause instanceof Error ? cause.message : "Tente novamente.",
      });
    } finally {
      actionPending.current = false;
    }
  };

  const chooseNextExercise = (exercise: WorkoutExercise) => {
    setExtraExerciseId(null);
    setPlannedNextExerciseId(exercise.id);
    setFeedback("Próxima ação escolhida.");
  };

  const chooseExtraSeries = (exercise: WorkoutExercise) => {
    if (!canOfferExtraSeries(performedCount(exercise.id), plannedMax(exercise), exercise.status)) return;
    setExtraExerciseId(exercise.id);
    setSelectedExerciseId(exercise.id);
    setViewedExerciseId(exercise.id);
    if (activeRest) setPlannedNextExerciseId(exercise.id);
    setFeedback("Série extra escolhida. Plano preservado.");
  };

  const sessionPaused = timer.sessionTiming?.status === "paused";
  const disabled = timer.saving || sessionPaused;
  const exerciseStateLabel = sessionPaused ? "PAUSADO" : activeWork ? "EM EXECUÇÃO" : activeRest ? "EM DESCANSO" : "PRONTO";

  const completedOnActive = activeExercise
    ? performedCount(activeExercise.id)
    : 0;

  const minSets = activeExercise ? plannedMin(activeExercise) : 0;
  const maxSets = activeExercise ? plannedMax(activeExercise) : 0;

  // Only an in-plan continuation is a default destination for an explicit
  // Start tap. At the target, every extra or exercise change still requires
  // a fresh athlete choice; browsing with arrows never starts a series.
  const canContinuePlanned = Boolean(activeExercise && isExecutable(activeExercise) &&
    completedOnActive < maxSets);
  const nextWorkDestination = plannedNextExercise ??
    (!plannedNextExerciseId && canContinuePlanned ? activeExercise : null);
  const canAdvanceRest = Boolean(activeRest?.workout_set_id && resultSaved &&
    !timer.loading && !timer.error && !disabled);


  const saveRestResult = async () => {
    if (!activeRest?.workout_set_id) return;

    const parsedLoad = numberOrUndefined(load);

    await timer.updateSetExecution(activeRest.workout_set_id, {
      loadValue: parsedLoad,
      loadUnit: parsedLoad !== undefined ? loadUnit : undefined,
      reps: numberOrUndefined(reps),
      rir: numberOrUndefined(rir),
    });

    setResultDirty(false);
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
    setResultDirty(false);
  };

  const completeWorkoutNow = async (saveCurrentResult: boolean) => {
    if (activeRest) {
      let shouldCloseRest = resultSaved;

      if (saveCurrentResult && !resultSaved) {
        await saveRestResult();
        shouldCloseRest = true;
      }

      if (shouldCloseRest && timer.sessionTiming?.status === "active") {
        await timer.finishRest(activeRest.id);
      }
    }

    await onCompleteWorkout();
    setShowEndConfirm(false);
  };

  const viewedExerciseSelectable =
    viewedExercise != null &&
    isExecutable(viewedExercise) &&
    (performedCount(viewedExercise.id) < plannedMax(viewedExercise) ||
      (extraExerciseId === viewedExercise.id &&
       canOfferExtraSeries(performedCount(viewedExercise.id), plannedMax(viewedExercise), viewedExercise.status)));

  const canChooseViewedExercise =
    viewedExerciseSelectable &&
    (!timer.activeInterval ||
      timer.activeInterval.interval_type === "rest");

  const chooseViewedExercise = async () => {
    if (!viewedExercise || !viewedExerciseSelectable) return;

    if (activeRest) {
      // An explicitly chosen extra series must not turn into "next exercise".
      if (preserveF24ExtraChoice(viewedExercise.id, extraExerciseId,
          performedCount(viewedExercise.id), plannedMax(viewedExercise), viewedExercise.status)) {
        chooseExtraSeries(viewedExercise);
      } else {
        chooseNextExercise(viewedExercise);
      }
      return;
    }

    setSelectedExerciseId(viewedExercise.id);
    setViewedExerciseId(viewedExercise.id);
    setLoad("");
    setLoadUnit("kg");
    setReps("");
    setRir("");
  };

  const startPlannedExercise = async () => {
    const destination = nextWorkDestination;
    if (!destination || !canAdvanceRest) return;

    await finishRestAfterSaved({
      startNextWork: true,
      nextWorkoutExerciseId: destination.id,
    });
    setSelectedExerciseId(destination.id);
    setViewedExerciseId(destination.id);
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
    <div className="sau-execution-stack space-y-3" data-sau-phase={sessionPaused?"paused":activeRest?"rest":activeWork?"work":"ready"}>
      <div data-cch-session-bar data-sau-paused={sessionPaused} className="sau-session-bar sticky top-[calc(49px+env(safe-area-inset-top))] z-20 rounded-xl border bg-background/95 px-2 py-2 shadow-sm backdrop-blur">
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Tempo ativo</span>
              <Badge variant="outline">
                {sessionPaused ? "pausado" : "ativo"}
              </Badge>
            </div>
            <p className="break-words text-sm font-semibold sm:text-base">{sessionTitle}</p>
          </div>

          <div className="sau-session-clock shrink-0 rounded-lg bg-muted px-2 py-2 font-mono text-base font-semibold tabular-nums sm:text-lg">
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

        <div className="flex items-center justify-between gap-1">
          {onToggleFocus?<Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={focusMode?"Sair do modo focado":"Ativar modo focado"} onClick={onToggleFocus}>{focusMode?<Minimize2 className="h-4 w-4"/>:<Maximize2 className="h-4 w-4"/>}</Button>:null}
          <p role="status" className="sau-session-feedback min-w-0 flex-1 text-xs text-muted-foreground">{feedback}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 shrink-0 px-2 text-xs text-destructive hover:text-destructive"
            disabled={timer.saving}
            onClick={() => setShowEndConfirm(true)}
          >
            <Square className="mr-1.5 h-3.5 w-3.5" />
            Encerrar treino
          </Button>
        </div>
      </div>

      {showEndConfirm ? (
        <Card className="border-destructive/30">
          <CardContent className="space-y-3 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Encerrar treino agora?</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tudo que já foi registrado será preservado. Exercícios não
                  realizados permanecerão como não executados nesta sessão.
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="min-h-11 min-w-11"
                disabled={timer.saving}
                onClick={() => setShowEndConfirm(false)}
                aria-label="Cancelar encerramento"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {activeWork ? (
              <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                Há uma série em execução. Se encerrar agora, esse cronômetro será
                fechado e essa série incompleta não será registrada como concluída.
              </p>
            ) : null}

            {activeRest && !resultSaved ? (
              <div className="space-y-2">
                <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  O resultado da última série ainda não foi salvo. Você pode salvar
                  carga/reps/RIR antes de encerrar ou finalizar sem essas alterações.
                </p>
                <Button
                  className="min-h-11 w-full"
                  disabled={timer.saving}
                  onClick={() =>
                    void run(
                      "Resultado salvo e treino encerrado.",
                      () => completeWorkoutNow(true),
                    )
                  }
                >
                  <Save className="mr-2 h-4 w-4" />
                  Salvar resultado e encerrar
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11 w-full"
                  disabled={timer.saving}
                  onClick={() =>
                    void run(
                      "Treino encerrado sem salvar o resultado pendente.",
                      () => completeWorkoutNow(false),
                    )
                  }
                >
                  Encerrar sem salvar resultado
                </Button>
              </div>
            ) : (
              <Button
                className="min-h-11 w-full"
                variant="destructive"
                disabled={timer.saving}
                onClick={() =>
                  void run(
                    "Treino encerrado. Histórico preservado.",
                    () => completeWorkoutNow(false),
                  )
                }
              >
                <Square className="mr-2 h-4 w-4" />
                Confirmar encerramento
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="sau-exercise-nav border-primary/15">
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
              <p className="text-xs font-medium text-muted-foreground">{viewingActiveExercise?"Exercício atual":"Visualizando outro exercício"}</p>

              {viewingActiveExercise ? (
                <div className="mt-1 flex items-center justify-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                  <span data-testid="cch-r07-exercise-state" className="text-xs font-semibold text-primary">
                    {exerciseStateLabel}
                  </span>
                </div>
              ) : activeExercise ? (
                <button
                  type="button"
                  className="mt-1 min-h-11 text-xs font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => setViewedExerciseId(activeExercise.id)}
                >
                  Exercício atual:{" "}
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
          {orderedExercises.length > 0 && <div className="mt-3 flex gap-1.5" aria-label={`Posição ${viewedIndex + 1} de ${orderedExercises.length}`}>
            {orderedExercises.map((exercise,index)=><span key={exercise.id} aria-hidden="true" data-position={index===viewedIndex?"current":"other"} className="sau-exercise-position h-1.5 min-w-0 flex-1 rounded-full"/>) }
          </div>}
        </CardContent>
      </Card>

      {sessionPaused ? (
        <Card className="sau-paused-panel">
          <CardContent className="space-y-3 py-5 text-center">
            <span className="sau-pause-symbol mx-auto flex h-14 w-14 items-center justify-center rounded-full" aria-hidden="true"><Pause className="h-7 w-7"/></span>
            <p className="text-center text-xl font-semibold">Treino pausado</p>
            <p className="text-sm text-muted-foreground">Seu treino está em pausa. Retome para continuar.</p>
            <Button
              className="sau-resume-button min-h-14 w-full text-base font-bold"
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
          className={`sau-current-exercise ${viewingActiveExercise ? "ring-1 ring-primary/25" : ""}`}
          data-sau-active-work={Boolean(viewingActiveExercise && activeWork)}
        >
          <CardHeader className="sau-exercise-heading px-3 pt-3 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  {viewingActiveExercise
                    ? "Exercício atual"
                    : "Visualização do exercício"}
                </p>
                <div className="flex items-center gap-1">
                  <CardTitle className="mt-1 min-w-0 text-xl">
                    {exerciseNameById.get(viewedExercise.exercise_id) ?? "Exercício"}
                  </CardTitle>
                  <HealthExerciseMovementPreview key={viewedExercise.id}
                    exercise={exerciseCatalogById?.get(viewedExercise.exercise_id)}
                    name={exerciseNameById.get(viewedExercise.exercise_id) ?? "Exercício"}/>
                </div>
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

          <CardContent className="sau-exercise-content space-y-3 px-3 pb-3">
            <aside data-testid="cch-history-reference" aria-label="Referência histórica, não é o resultado atual"
              className="rounded-lg bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <p className="font-medium">Última execução comparável</p>
                {previousReference ? (
                  <time dateTime={previousReference.occurredAt}>{new Date(previousReference.occurredAt).toLocaleDateString("pt-BR")}</time>
                ) : null}
              </div>
              {historyLoading ? (
                <p className="mt-1">Consultando histórico…</p>
              ) : previousReference ? (
                <>
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-medium text-foreground tabular-nums">
                    <span>{previousReference.loadValue} {previousReference.loadUnit}</span>
                    <span aria-hidden="true">·</span>
                    <span>{previousReference.reps} reps</span>
                    <span aria-hidden="true">·</span>
                    <span>RIR {previousReference.rir ?? "—"}</span>
                  </p>
                  <p className="mt-1 break-words">Mesmo rótulo: {previousReference.equipmentLabel}. Identidade física não confirmada.</p>
                </>
              ) : (
                <p className="mt-1">{
                  historyStatus?.reason === "equipment_unconfirmed"
                    ? "Confirme o rótulo do aparelho para comparar."
                    : historyStatus?.reason === "unavailable" || !historyStatus
                      ? "Histórico indisponível no momento."
                      : "Sem registro anterior com o mesmo rótulo. Não compare cargas de aparelhos distintos."
                }</p>
              )}
            </aside>
            {!timer.activeInterval && viewedSets.length===0 && !equipmentConfirmed.includes(viewedExercise.id) ? (
              <details className="space-y-2 rounded-lg border px-3 py-1">
                <summary className="flex min-h-11 cursor-pointer items-center text-xs font-medium">Máquina usada (opcional)</summary>
                <Label>Identificação do aparelho</Label>
                <Input placeholder="Ex.: Supino máquina A" value={equipmentLabels[viewedExercise.id]??""}
                  onChange={event=>setEquipmentLabels(prev=>({...prev,[viewedExercise.id]:event.target.value}))}/>
                <Button className="min-h-11" variant="outline"
                  disabled={timer.saving||(equipmentLabels[viewedExercise.id]??"").trim().length<2}
                  onClick={()=>void run("Máquina registrada para este exercício.",async()=>{
                    await onConfirmEquipment(viewedExercise.id,equipmentLabels[viewedExercise.id]);
                    setEquipmentConfirmed(prev=>[...prev,viewedExercise.id]);
                  })}>Confirmar máquina antes da primeira série</Button>
                <p className="text-xs text-muted-foreground">O CCH só compara cargas entre execuções que tenham identificação de máquina compatível. Você pode continuar sem informar.</p>
              </details>
            ) : null}
            {!viewingActiveExercise ? (
              <>
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="text-sm font-semibold">
                    Ordem flexível
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Escolha outro exercício sem modificar o programa publicado.
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
                          ? "Exercício preparado para depois deste descanso."
                          : "Exercício selecionado.",
                        chooseViewedExercise,
                      )
                    }
                  >
                    <Dumbbell className="mr-2 h-5 w-5" />
                    {activeRest
                      ? plannedNextExerciseId === viewedExercise.id
                        ? "Escolhido para depois"
                        : "Escolher para depois"
                      : timer.activeInterval?.interval_type === "work"
                        ? "Conclua a série atual para trocar"
                        : "Fazer este exercício agora"}
                  </Button>
                ) : null}

                {!timer.activeInterval &&
                 canOfferExtraSeries(performedCount(viewedExercise.id), plannedMax(viewedExercise), viewedExercise.status) &&
                 extraExerciseId !== viewedExercise.id ? (
                  <Button className="min-h-12 w-full" variant="outline"
                    disabled={timer.saving}
                    onClick={() => chooseExtraSeries(viewedExercise)}>
                    + Série extra neste exercício
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
                    <div className="flex flex-col items-center gap-1 rounded-xl border bg-muted/25 px-3 py-3 text-center" data-testid="cch-work-clock">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Execução
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Apenas execute. O resultado será preenchido ao terminar.
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="sr-only">
                          Tempo da série
                        </p>
                        <p className="font-mono text-5xl font-semibold tabular-nums">
                          {formatElapsed(activeElapsed)}
                        </p>
                      </div>
                    </div>

                    <Button
                      className="sau-primary-work-action min-h-12 w-full text-base"
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
                      className="flex flex-col items-center gap-1 rounded-xl border bg-muted/15 px-3 py-3 text-center"
                      data-testid="cch-rest-clock"
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

                      <p role="status" className="sr-only">{restReached?"Meta de descanso atingida.":""}</p>
                      <p className="font-mono text-5xl font-semibold tabular-nums">
                        {formatElapsed(activeElapsed)}
                      </p>
                    </div>

                    <div className="sau-set-result rounded-xl border bg-muted/20 p-3">
                      <div className="sau-result-heading flex items-start justify-between gap-3">
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

                      <div className="sau-result-fields mt-2 grid grid-cols-2 gap-1.5 min-[400px]:grid-cols-4 sm:gap-3">
                        <div className="min-w-0 space-y-1">
                          <Label className="text-xs">Carga</Label>
                          <Input
                            className="min-h-11 px-2 text-sm"
                            inputMode="decimal"
                            value={load}
                            onChange={(event) => {
                              setLoad(event.target.value);
                              setResultDirty(true);
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
                              setResultDirty(true);
                            }}
                          >
                            <SelectTrigger className="min-h-11 px-2 text-sm">
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
                              setResultDirty(true);
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
                              setResultDirty(true);
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

                    <div className="sau-save-result space-y-2">
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

                      <p className="sau-result-explanation text-xs text-muted-foreground">
                        {resultSaved
                          ? "Resultado salvo. Continue quando estiver pronto."
                          : "Salve para liberar o próximo passo."}
                      </p>
                    </div>

                    <div className="space-y-2" data-testid="cch-rest-next-action">
                      {!canContinuePlanned && (nextDifferentExercise || (activeExercise && canOfferExtraSeries(completedOnActive,maxSets,activeExercise.status))) ? (
                        <>
                          <p className="text-xs font-medium text-muted-foreground">
                            {plannedNextExercise ? "Escolha confirmada. Inicie quando estiver pronto." : "Escolha como deseja continuar"}
                          </p>
                          <div className="grid auto-rows-fr grid-cols-2 gap-2">
                            {activeExercise && canOfferExtraSeries(completedOnActive,maxSets,activeExercise.status) ? (
                              <Button type="button" variant={plannedNextExerciseId===activeExercise.id?"default":"outline"}
                                className="min-h-12 w-full whitespace-normal px-2 text-sm"
                                disabled={disabled||timer.loading}
                                aria-pressed={plannedNextExerciseId===activeExercise.id}
                                onClick={()=>chooseExtraSeries(activeExercise)}>+ Série extra</Button>
                            ):null}
                            {nextDifferentExercise ? (
                              <Button type="button" variant={plannedNextExerciseId===nextDifferentExercise.id?"default":"outline"}
                                className="min-h-12 w-full whitespace-normal px-2 text-sm"
                                disabled={disabled||timer.loading}
                                aria-pressed={plannedNextExerciseId===nextDifferentExercise.id}
                                onClick={()=>chooseNextExercise(nextDifferentExercise)}>Próximo exercício</Button>
                            ):null}
                          </div>
                        </>
                      ):null}

                      {nextWorkDestination ? (
                        <Button className="min-h-12 w-full whitespace-normal text-base"
                          disabled={!canAdvanceRest}
                          onClick={()=>void run("Série iniciada.",startPlannedExercise)}>
                          <Play className="mr-2 h-5 w-5 shrink-0"/>
                          {plannedNextExercise ? `Iniciar ${exerciseNameById.get(nextWorkDestination.exercise_id)??"exercício escolhido"}` : "Iniciar próxima série"}
                        </Button>
                      ):recommendedNextExercise ? (
                        <p className="text-xs text-muted-foreground">Escolha como deseja continuar. Nenhuma série será iniciada automaticamente.</p>
                      ):(
                        <Button className="min-h-12 w-full"
                          disabled={!canAdvanceRest}
                          onClick={()=>void run("Descanso encerrado.",()=>finishRestAfterSaved())}>
                          <CheckCircle2 className="mr-2 h-5 w-5"/>Encerrar descanso
                        </Button>
                      )}
                      {canContinuePlanned && (nextDifferentExercise || plannedNextExerciseId) ? (
                        <details className="rounded-lg border px-2">
                          <summary className="flex min-h-11 cursor-pointer items-center text-xs font-medium">Trocar exercício</summary>
                          <div className="space-y-2 pb-2">
                            {nextDifferentExercise?<Button type="button" variant="outline" className="min-h-11 w-full whitespace-normal"
                              disabled={disabled||timer.loading} onClick={()=>chooseNextExercise(nextDifferentExercise)}>
                              Escolher próximo da grade
                            </Button>:null}
                            {plannedNextExerciseId && plannedNextExerciseId!==activeExercise?.id ? (
                              <Button type="button" variant="ghost" className="min-h-11 w-full"
                                disabled={disabled||timer.loading} onClick={()=>{setPlannedNextExerciseId(null);setExtraExerciseId(null);}}>
                                Continuar neste exercício
                              </Button>
                            ):null}
                          </div>
                        </details>
                      ):null}
                    </div>
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
      {/* Keep optional decisions mounted across pause, work and navigation.
          Put guidance after the execution controls, never ahead of the clock. */}
      <HealthWorkoutContextualGuidance key={guidanceScope??"disabled"}
        sessionContext={guidanceScope??""}
        context={viewedExercise?JSON.stringify([guidanceScope,viewedExercise.id]):""}
        eligible={Boolean(guidanceScope && guidanceReadReady && viewedExercise && viewingActiveExercise &&
          timer.sessionTiming?.status==="active" && !timer.loading && !timer.saving && !timer.error &&
          !historyLoading && !showEndConfirm && !activeWork &&
          (!timer.activeInterval || (activeRest?.status==="running" && resultSaved)) &&
          completedOnActive < maxSets)}
        executionSignal={viewedExercise?assessF24ExecutionSignal(viewedSets,viewedExercise.planned_reps_min,viewedExercise.planned_rir_target):null}
        unconfirmed={Boolean(viewedExercise && historicalReferences.get(viewedExercise.id)?.reason==="equipment_unconfirmed" &&
          !equipmentConfirmed.includes(viewedExercise.id))}/>
    </div>
  );
}
