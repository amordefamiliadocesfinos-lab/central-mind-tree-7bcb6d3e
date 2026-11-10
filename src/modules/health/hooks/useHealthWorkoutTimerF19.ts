import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type LooseTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type LooseDatabase = {
  public: {
    Tables: Record<string, LooseTable>;
    Views: Record<string, never>;
    Functions: Record<
      string,
      { Args: Record<string, unknown>; Returns: unknown }
    >;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type LooseOperationResult = {
  data?: unknown;
  error?: { message: string } | null;
};

const db = supabase as unknown as SupabaseClient<LooseDatabase>;

export type WorkoutTimerSessionF19 = {
  id: string;
  athlete_id: string;
  status: "active" | "paused" | "completed" | "aborted";
  started_at: string;
  ended_at: string | null;
  timer_paused_at: string | null;
  pause_accumulated_seconds: number;
};

export type WorkoutTimerIntervalF19 = {
  id: string;
  athlete_id: string;
  session_id: string;
  workout_exercise_id: string;
  workout_set_id: string | null;
  interval_type: "work" | "rest";
  set_number: number | null;
  status: "running" | "paused" | "completed" | "cancelled";
  target_seconds: number | null;
  started_at: string;
  paused_at: string | null;
  pause_accumulated_seconds: number;
  ended_at: string | null;
  actual_seconds: number | null;
  client_event_id: string;
  notes: string | null;
};

type State = {
  sessionTiming: WorkoutTimerSessionF19 | null;
  intervals: WorkoutTimerIntervalF19[];
};

const emptyState: State = {
  sessionTiming: null,
  intervals: [],
};

function eventId() {
  return crypto.randomUUID();
}

export function useHealthWorkoutTimerF19(
  athleteId: string | null | undefined,
  sessionId: string | null | undefined,
  onChanged?: () => Promise<void> | void,
) {
  const [state, setState] = useState<State>(emptyState);
  const [loading, setLoading] = useState(Boolean(athleteId && sessionId));
  const [saving, setSaving] = useState(false);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!athleteId || !sessionId) {
      setState(emptyState);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const [sessionResult, intervalsResult] = await Promise.all([
      db
        .from("health_workout_sessions")
        .select(
          "id,athlete_id,status,started_at,ended_at,timer_paused_at,pause_accumulated_seconds",
        )
        .eq("id", sessionId)
        .eq("athlete_id", athleteId)
        .maybeSingle(),
      db
        .from("health_workout_timer_intervals")
        .select("*")
        .eq("session_id", sessionId)
        .eq("athlete_id", athleteId)
        .order("started_at", { ascending: true }),
    ]);

    const firstError = sessionResult.error ?? intervalsResult.error;
    if (firstError) {
      setState(emptyState);
      setAvailable(false);
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setAvailable(true);
    setState({
      sessionTiming:
        (sessionResult.data as unknown as WorkoutTimerSessionF19 | null) ?? null,
      intervals:
        (intervalsResult.data ?? []) as unknown as WorkoutTimerIntervalF19[],
    });
    setLoading(false);
  }, [athleteId, sessionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!athleteId || !sessionId) return;

    const reconcile = () => {
      if (document.visibilityState === "visible") {
        void reload();
      }
    };

    window.addEventListener("focus", reconcile);
    document.addEventListener("visibilitychange", reconcile);

    return () => {
      window.removeEventListener("focus", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
    };
  }, [athleteId, reload, sessionId]);

  const call = useCallback(
    async (operation: () => PromiseLike<LooseOperationResult>) => {
      setSaving(true);
      setError(null);
      try {
        const result = await operation();
        if (result?.error) throw new Error(result.error.message);
        await reload();
        await onChanged?.();
        return result?.data;
      } finally {
        setSaving(false);
      }
    },
    [onChanged, reload],
  );

  const pauseWorkout = useCallback(async () => {
    if (!sessionId) throw new Error("Sessão não disponível.");
    await call(() =>
      db.rpc("health_f19_pause_workout", {
        p_session_id: sessionId,
        p_client_event_id: eventId(),
      }),
    );
  }, [call, sessionId]);

  const resumeWorkout = useCallback(async () => {
    if (!sessionId) throw new Error("Sessão não disponível.");
    await call(() =>
      db.rpc("health_f19_resume_workout", {
        p_session_id: sessionId,
        p_client_event_id: eventId(),
      }),
    );
  }, [call, sessionId]);

  const startWorkInterval = useCallback(
    async (workoutExerciseId: string) => {
      await call(() =>
        db.rpc("health_f19_start_work_interval", {
          p_workout_exercise_id: workoutExerciseId,
          p_client_event_id: eventId(),
        }),
      );
    },
    [call],
  );

  const finishWorkStartRest = useCallback(
    async (
      workIntervalId: string,
      values?: {
        loadValue?: number | null;
        loadUnit?: string;
        reps?: number | null;
        rir?: number | null;
      },
    ) => {
      await call(() =>
        db.rpc("health_f19_finish_work_start_rest", {
          p_work_interval_id: workIntervalId,
          p_client_event_id: eventId(),
          p_load_value: values?.loadValue ?? null,
          p_load_unit: values?.loadUnit ?? "kg",
          p_reps: values?.reps ?? null,
          p_rir: values?.rir ?? null,
        }),
      );
    },
    [call],
  );

  const finishRest = useCallback(
    async (
      restIntervalId: string,
      options?: {
        startNextWork?: boolean;
        nextWorkoutExerciseId?: string | null;
      },
    ) => {
      await call(() =>
        db.rpc("health_f19_finish_rest", {
          p_rest_interval_id: restIntervalId,
          p_client_event_id: eventId(),
          p_start_next_work: options?.startNextWork ?? false,
          p_next_workout_exercise_id:
            options?.nextWorkoutExerciseId ?? null,
        }),
      );
    },
    [call],
  );

  const updateSetExecution = useCallback(
    async (
      workoutSetId: string,
      values: {
        loadValue?: number;
        loadUnit?: string;
        reps?: number;
        rir?: number;
      },
    ) => {
      if (!athleteId) throw new Error("Atleta não disponível.");

      const patch: Record<string, unknown> = {};
      if (values.loadValue !== undefined) patch.load_value = values.loadValue;
      if (values.loadUnit !== undefined) patch.load_unit = values.loadUnit;
      if (values.reps !== undefined) patch.reps = values.reps;
      if (values.rir !== undefined) patch.rir = values.rir;

      if (!Object.keys(patch).length) return;

      await call(() =>
        db
          .from("health_workout_sets")
          .update(patch)
          .eq("id", workoutSetId)
          .eq("athlete_id", athleteId),
      );
    },
    [athleteId, call],
  );

  const cancelInterval = useCallback(
    async (intervalId: string) => {
      await call(() =>
        db.rpc("health_f19_cancel_interval", {
          p_interval_id: intervalId,
          p_client_event_id: eventId(),
        }),
      );
    },
    [call],
  );

  const activeInterval = useMemo(
    () =>
      [...state.intervals]
        .reverse()
        .find((item) => item.status === "running" || item.status === "paused") ??
      null,
    [state.intervals],
  );

  const workIntervalsByExercise = useMemo(() => {
    const map = new Map<string, WorkoutTimerIntervalF19[]>();
    for (const interval of state.intervals) {
      if (interval.interval_type !== "work") continue;
      const list = map.get(interval.workout_exercise_id) ?? [];
      list.push(interval);
      map.set(interval.workout_exercise_id, list);
    }
    return map;
  }, [state.intervals]);

  return {
    ...state,
    activeInterval,
    workIntervalsByExercise,
    loading,
    saving,
    available,
    error,
    reload,
    pauseWorkout,
    resumeWorkout,
    startWorkInterval,
    finishWorkStartRest,
    finishRest,
    updateSetExecution,
    cancelInterval,
  };
}

export type HealthWorkoutTimerF19Controller = ReturnType<
  typeof useHealthWorkoutTimerF19
>;
