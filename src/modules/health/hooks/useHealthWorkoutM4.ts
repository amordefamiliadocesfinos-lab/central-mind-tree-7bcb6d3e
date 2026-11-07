import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type WorkoutSession = Tables["health_workout_sessions"]["Row"];
export type WorkoutExercise = Tables["health_workout_exercises"]["Row"];
export type WorkoutSet = Tables["health_workout_sets"]["Row"];
export type QueueEntry = Tables["health_cch_queue_entries"]["Row"];
export type SessionTemplate = Tables["health_session_templates"]["Row"];

type State = {
  session: WorkoutSession | null;
  exercises: WorkoutExercise[];
  sets: WorkoutSet[];
  nextQueue: QueueEntry | null;
  nextTemplate: SessionTemplate | null;
};

const emptyState: State = {
  session: null,
  exercises: [],
  sets: [],
  nextQueue: null,
  nextTemplate: null,
};

function eventId() {
  return crypto.randomUUID();
}

export function useHealthWorkoutM4(athleteId: string | null | undefined) {
  const [state, setState] = useState<State>(emptyState);
  const [loading, setLoading] = useState(Boolean(athleteId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!athleteId) {
      setState(emptyState);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [sessionResult, queueResult] = await Promise.all([
      supabase
        .from("health_workout_sessions")
        .select("*")
        .eq("athlete_id", athleteId)
        .in("status", ["active", "paused"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("health_cch_queue_entries")
        .select("*")
        .eq("athlete_id", athleteId)
        .in("state", ["queued", "eligible", "prioritized"])
        .order("queue_position", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const firstError = sessionResult.error ?? queueResult.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const session = sessionResult.data ?? null;
    const nextQueue = queueResult.data ?? null;

    if (session) {
      const [exercisesResult, setsResult, templateResult] = await Promise.all([
        supabase
          .from("health_workout_exercises")
          .select("*")
          .eq("session_id", session.id)
          .eq("athlete_id", athleteId)
          .order("sequence_order", { ascending: true }),
        supabase
          .from("health_workout_sets")
          .select("*")
          .eq("session_id", session.id)
          .eq("athlete_id", athleteId)
          .order("completed_at", { ascending: true }),
        session.session_template_id
          ? supabase
              .from("health_session_templates")
              .select("*")
              .eq("id", session.session_template_id)
              .eq("athlete_id", athleteId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      const childError = exercisesResult.error ?? setsResult.error ?? templateResult.error;
      if (childError) {
        setError(childError.message);
        setLoading(false);
        return;
      }

      setState({
        session,
        exercises: exercisesResult.data ?? [],
        sets: setsResult.data ?? [],
        nextQueue,
        nextTemplate: templateResult.data ?? null,
      });
      setLoading(false);
      return;
    }

    let nextTemplate: SessionTemplate | null = null;
    if (nextQueue?.session_template_id) {
      const templateResult = await supabase
        .from("health_session_templates")
        .select("*")
        .eq("id", nextQueue.session_template_id)
        .eq("athlete_id", athleteId)
        .maybeSingle();
      if (templateResult.error) {
        setError(templateResult.error.message);
        setLoading(false);
        return;
      }
      nextTemplate = templateResult.data;
    }

    setState({ ...emptyState, nextQueue, nextTemplate });
    setLoading(false);
  }, [athleteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const call = useCallback(
    async (operation: () => Promise<{ error: { message: string } | null }>) => {
      setSaving(true);
      setError(null);
      try {
        const result = await operation();
        if (result.error) throw new Error(result.error.message);
        await reload();
      } finally {
        setSaving(false);
      }
    },
    [reload],
  );

  const startWorkout = useCallback(
    async (queueEntryId: string) => {
      await call(async () =>
        supabase.rpc("health_m4_start_workout", {
          p_queue_entry_id: queueEntryId,
          p_client_event_id: eventId(),
        }),
      );
    },
    [call],
  );

  const logSet = useCallback(
    async (
      workoutExerciseId: string,
      values: {
        loadValue: number | null;
        loadUnit: string;
        reps: number | null;
        rir: number | null;
        restSeconds: number | null;
      },
    ) => {
      if (!state.session) throw new Error("Sessão não disponível.");
      const setNumber =
        Math.max(
          0,
          ...state.sets
            .filter((item) => item.workout_exercise_id === workoutExerciseId)
            .map((item) => item.set_number),
        ) + 1;

      await call(async () =>
        supabase.rpc("health_m4_log_set", {
          p_session_id: state.session!.id,
          p_workout_exercise_id: workoutExerciseId,
          p_client_event_id: eventId(),
          p_set_number: setNumber,
          p_set_type: "working",
          p_load_value: values.loadValue,
          p_load_unit: values.loadUnit,
          p_reps: values.reps,
          p_rir: values.rir,
          p_rest_seconds: values.restSeconds,
        }),
      );
    },
    [call, state.session, state.sets],
  );

  const updateSet = useCallback(
    async (
      setId: string,
      values: {
        loadValue: number | null;
        loadUnit: string;
        reps: number | null;
        rir: number | null;
        restSeconds: number | null;
      },
    ) => {
      await call(async () =>
        supabase.rpc("health_m4_update_set", {
          p_set_id: setId,
          p_client_event_id: eventId(),
          p_load_value: values.loadValue,
          p_load_unit: values.loadUnit,
          p_reps: values.reps,
          p_rir: values.rir,
          p_rest_seconds: values.restSeconds,
        }),
      );
    },
    [call],
  );

  const addExercise = useCallback(
    async (exerciseId: string) => {
      if (!state.session) throw new Error("Sessão não disponível.");
      await call(async () =>
        supabase.rpc("health_m4_add_exercise", {
          p_session_id: state.session!.id,
          p_exercise_id: exerciseId,
          p_client_event_id: eventId(),
        }),
      );
    },
    [call, state.session],
  );

  const skipExercise = useCallback(
    async (workoutExerciseId: string) => {
      await call(async () =>
        supabase.rpc("health_m4_skip_exercise", {
          p_workout_exercise_id: workoutExerciseId,
          p_client_event_id: eventId(),
        }),
      );
    },
    [call],
  );

  const replaceExercise = useCallback(
    async (workoutExerciseId: string, replacementExerciseId: string) => {
      await call(async () =>
        supabase.rpc("health_m4_replace_exercise", {
          p_workout_exercise_id: workoutExerciseId,
          p_replacement_exercise_id: replacementExerciseId,
          p_client_event_id: eventId(),
        }),
      );
    },
    [call],
  );

  const completeWorkout = useCallback(async () => {
    if (!state.session) throw new Error("Sessão não disponível.");
    await call(async () =>
      supabase.rpc("health_m4_complete_workout", {
        p_session_id: state.session!.id,
        p_client_event_id: eventId(),
      }),
    );
  }, [call, state.session]);

  const setsByExercise = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>();
    for (const set of state.sets) {
      const current = map.get(set.workout_exercise_id) ?? [];
      current.push(set);
      map.set(set.workout_exercise_id, current);
    }
    return map;
  }, [state.sets]);

  return {
    ...state,
    setsByExercise,
    loading,
    saving,
    error,
    reload,
    startWorkout,
    logSet,
    updateSet,
    addExercise,
    skipExercise,
    replaceExercise,
    completeWorkout,
  };
}
