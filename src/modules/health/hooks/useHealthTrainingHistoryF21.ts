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

export type HistoryWorkoutSetF21 = {
  id: string;
  workout_exercise_id: string;
  session_id: string;
  set_number: number;
  load_value: number | null;
  load_unit: string;
  reps: number | null;
  rir: number | null;
  rest_seconds: number | null;
  completed_at: string | null;
};

export type HistoryWorkoutExerciseF21 = {
  id: string;
  session_id: string;
  exercise_id: string;
  sequence_order: number;
  status: string;
  exercise_name: string;
  sets: HistoryWorkoutSetF21[];
};

export type HistoryWorkoutSessionF21 = {
  id: string;
  kind: "strength";
  status: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  source: string;
  session_template_id: string | null;
  template_code: string | null;
  template_name: string | null;
  exercises: HistoryWorkoutExerciseF21[];
};

export type HistoryActivitySessionF21 = {
  id: string;
  kind: "activity";
  status: string;
  modality_code: string;
  modality_name: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  active_duration_seconds: number | null;
  distance_meters: number | null;
  calories_kcal: number | null;
  avg_hr_bpm: number | null;
  max_hr_bpm: number | null;
  rpe: number | null;
  cadence_spm: number | null;
  elevation_gain_m: number | null;
  steps: number | null;
  avg_pace_seconds_per_km: number | null;
  avg_speed_kmh: number | null;
  notes: string | null;
};

export type HistorySessionF21 =
  | HistoryWorkoutSessionF21
  | HistoryActivitySessionF21;

function eventId() {
  return crypto.randomUUID();
}

export function useHealthTrainingHistoryF21(
  athleteId: string | null | undefined,
) {
  const [sessions, setSessions] = useState<HistorySessionF21[]>([]);
  const [loading, setLoading] = useState(Boolean(athleteId));
  const [saving, setSaving] = useState(false);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!athleteId) {
      setSessions([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const [workoutResult, activityResult, modalitiesResult] = await Promise.all([
      db
        .from("health_workout_sessions")
        .select(
          "id,status,started_at,ended_at,notes,source,session_template_id,record_status",
        )
        .eq("athlete_id", athleteId)
        .eq("record_status", "active")
        .in("status", ["completed", "aborted"])
        .order("started_at", { ascending: false })
        .limit(300),
      db
        .from("health_activity_sessions")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("record_status", "active")
        .in("status", ["completed", "aborted"])
        .order("started_at", { ascending: false })
        .limit(300),
      db
        .from("health_activity_modalities")
        .select("code,name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    const firstError =
      workoutResult.error ?? activityResult.error ?? modalitiesResult.error;

    if (firstError) {
      setAvailable(false);
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const workouts = (workoutResult.data ?? []) as Array<
      Record<string, unknown>
    >;
    const activities = (activityResult.data ?? []) as Array<
      Record<string, unknown>
    >;

    const workoutIds = workouts.map((item) => String(item.id));
    const templateIds = [
      ...new Set(
        workouts
          .map((item) => item.session_template_id)
          .filter((value): value is string => typeof value === "string"),
      ),
    ];

    const [templatesResult, workoutExercisesResult, workoutSetsResult] =
      await Promise.all([
        templateIds.length
          ? db
              .from("health_session_templates")
              .select("id,code,name")
              .in("id", templateIds)
          : Promise.resolve({ data: [], error: null } as LooseOperationResult),
        workoutIds.length
          ? db
              .from("health_workout_exercises")
              .select("id,session_id,exercise_id,sequence_order,status")
              .in("session_id", workoutIds)
              .order("sequence_order", { ascending: true })
          : Promise.resolve({ data: [], error: null } as LooseOperationResult),
        workoutIds.length
          ? db
              .from("health_workout_sets")
              .select(
                "id,workout_exercise_id,session_id,set_number,load_value,load_unit,reps,rir,rest_seconds,completed_at,status",
              )
              .in("session_id", workoutIds)
              .eq("status", "completed")
              .order("set_number", { ascending: true })
          : Promise.resolve({ data: [], error: null } as LooseOperationResult),
      ]);

    const childError =
      templatesResult.error ??
      workoutExercisesResult.error ??
      workoutSetsResult.error;

    if (childError) {
      setAvailable(false);
      setError(childError.message);
      setLoading(false);
      return;
    }

    const rawExercises = (workoutExercisesResult.data ?? []) as Array<
      Record<string, unknown>
    >;
    const exerciseIds = [
      ...new Set(rawExercises.map((item) => String(item.exercise_id))),
    ];

    const exerciseCatalogResult = exerciseIds.length
      ? await db
          .from("health_exercises")
          .select("id,name")
          .in("id", exerciseIds)
      : ({ data: [], error: null } as LooseOperationResult);

    if (exerciseCatalogResult.error) {
      setAvailable(false);
      setError(exerciseCatalogResult.error.message);
      setLoading(false);
      return;
    }

    const templateById = new Map(
      ((templatesResult.data ?? []) as Array<Record<string, unknown>>).map(
        (item) => [
          String(item.id),
          {
            code: item.code == null ? null : String(item.code),
            name: item.name == null ? null : String(item.name),
          },
        ],
      ),
    );

    const exerciseNameById = new Map(
      ((exerciseCatalogResult.data ?? []) as Array<Record<string, unknown>>).map(
        (item) => [String(item.id), String(item.name)],
      ),
    );

    const setsByExercise = new Map<string, HistoryWorkoutSetF21[]>();
    for (const raw of (workoutSetsResult.data ?? []) as Array<
      Record<string, unknown>
    >) {
      const exerciseId = String(raw.workout_exercise_id);
      const list = setsByExercise.get(exerciseId) ?? [];
      list.push({
        id: String(raw.id),
        workout_exercise_id: exerciseId,
        session_id: String(raw.session_id),
        set_number: Number(raw.set_number),
        load_value:
          raw.load_value == null ? null : Number(raw.load_value),
        load_unit: String(raw.load_unit ?? "kg"),
        reps: raw.reps == null ? null : Number(raw.reps),
        rir: raw.rir == null ? null : Number(raw.rir),
        rest_seconds:
          raw.rest_seconds == null ? null : Number(raw.rest_seconds),
        completed_at:
          raw.completed_at == null ? null : String(raw.completed_at),
      });
      setsByExercise.set(exerciseId, list);
    }

    const exercisesBySession = new Map<
      string,
      HistoryWorkoutExerciseF21[]
    >();

    for (const raw of rawExercises) {
      const sessionId = String(raw.session_id);
      const workoutExerciseId = String(raw.id);
      const exerciseId = String(raw.exercise_id);
      const list = exercisesBySession.get(sessionId) ?? [];
      list.push({
        id: workoutExerciseId,
        session_id: sessionId,
        exercise_id: exerciseId,
        sequence_order: Number(raw.sequence_order),
        status: String(raw.status),
        exercise_name:
          exerciseNameById.get(exerciseId) ?? "Exercício",
        sets: setsByExercise.get(workoutExerciseId) ?? [],
      });
      exercisesBySession.set(sessionId, list);
    }

    const strengthSessions: HistoryWorkoutSessionF21[] = workouts.map(
      (raw) => {
        const templateId =
          typeof raw.session_template_id === "string"
            ? raw.session_template_id
            : null;
        const template = templateId
          ? templateById.get(templateId)
          : undefined;

        return {
          id: String(raw.id),
          kind: "strength",
          status: String(raw.status),
          started_at: String(raw.started_at),
          ended_at: raw.ended_at == null ? null : String(raw.ended_at),
          notes: raw.notes == null ? null : String(raw.notes),
          source: String(raw.source),
          session_template_id: templateId,
          template_code: template?.code ?? null,
          template_name: template?.name ?? null,
          exercises: exercisesBySession.get(String(raw.id)) ?? [],
        };
      },
    );

    const modalityByCode = new Map(
      ((modalitiesResult.data ?? []) as Array<Record<string, unknown>>).map(
        (item) => [String(item.code), String(item.name)],
      ),
    );

    const activitySessions: HistoryActivitySessionF21[] = activities.map(
      (raw) => ({
        id: String(raw.id),
        kind: "activity",
        status: String(raw.status),
        modality_code: String(raw.modality_code),
        modality_name:
          modalityByCode.get(String(raw.modality_code)) ??
          String(raw.modality_code),
        title: String(raw.title),
        started_at: String(raw.started_at),
        ended_at: raw.ended_at == null ? null : String(raw.ended_at),
        active_duration_seconds:
          raw.active_duration_seconds == null
            ? null
            : Number(raw.active_duration_seconds),
        distance_meters:
          raw.distance_meters == null ? null : Number(raw.distance_meters),
        calories_kcal:
          raw.calories_kcal == null ? null : Number(raw.calories_kcal),
        avg_hr_bpm:
          raw.avg_hr_bpm == null ? null : Number(raw.avg_hr_bpm),
        max_hr_bpm:
          raw.max_hr_bpm == null ? null : Number(raw.max_hr_bpm),
        rpe: raw.rpe == null ? null : Number(raw.rpe),
        cadence_spm:
          raw.cadence_spm == null ? null : Number(raw.cadence_spm),
        elevation_gain_m:
          raw.elevation_gain_m == null
            ? null
            : Number(raw.elevation_gain_m),
        steps: raw.steps == null ? null : Number(raw.steps),
        avg_pace_seconds_per_km:
          raw.avg_pace_seconds_per_km == null
            ? null
            : Number(raw.avg_pace_seconds_per_km),
        avg_speed_kmh:
          raw.avg_speed_kmh == null ? null : Number(raw.avg_speed_kmh),
        notes: raw.notes == null ? null : String(raw.notes),
      }),
    );

    setSessions(
      [...strengthSessions, ...activitySessions].sort(
        (a, b) =>
          new Date(b.started_at).getTime() -
          new Date(a.started_at).getTime(),
      ),
    );
    setAvailable(true);
    setLoading(false);
  }, [athleteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const call = useCallback(
    async (operation: () => PromiseLike<LooseOperationResult>) => {
      setSaving(true);
      setError(null);
      try {
        const result = await operation();
        if (result?.error) throw new Error(result.error.message);
        await reload();
        return result?.data;
      } finally {
        setSaving(false);
      }
    },
    [reload],
  );

  const updateWorkoutSession = useCallback(
    async (
      sessionId: string,
      values: {
        startedAt: string;
        endedAt: string;
        notes?: string | null;
      },
    ) => {
      await call(() =>
        db.rpc("health_f21_update_workout_session", {
          p_session_id: sessionId,
          p_client_event_id: eventId(),
          p_started_at: values.startedAt,
          p_ended_at: values.endedAt,
          p_notes: values.notes ?? null,
        }),
      );
    },
    [call],
  );

  const updateHistoricalSet = useCallback(
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
      await call(() =>
        db.rpc("health_f21_update_historical_set", {
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

  const voidWorkoutSession = useCallback(
    async (sessionId: string, reason: string) => {
      await call(() =>
        db.rpc("health_f21_void_workout_session", {
          p_session_id: sessionId,
          p_client_event_id: eventId(),
          p_reason: reason,
        }),
      );
    },
    [call],
  );

  const updateActivitySession = useCallback(
    async (
      activityId: string,
      values: {
        modalityCode: string;
        title: string;
        startedAt: string;
        durationSeconds: number;
        distanceMeters: number | null;
        caloriesKcal: number | null;
        avgHrBpm: number | null;
        maxHrBpm: number | null;
        rpe: number | null;
        cadenceSpm: number | null;
        elevationGainM: number | null;
        steps: number | null;
        notes: string | null;
      },
    ) => {
      await call(() =>
        db.rpc("health_f21_update_activity_session", {
          p_activity_id: activityId,
          p_client_event_id: eventId(),
          p_modality_code: values.modalityCode,
          p_title: values.title,
          p_started_at: values.startedAt,
          p_duration_seconds: values.durationSeconds,
          p_distance_meters: values.distanceMeters,
          p_calories_kcal: values.caloriesKcal,
          p_avg_hr_bpm: values.avgHrBpm,
          p_max_hr_bpm: values.maxHrBpm,
          p_rpe: values.rpe,
          p_cadence_spm: values.cadenceSpm,
          p_elevation_gain_m: values.elevationGainM,
          p_steps: values.steps,
          p_notes: values.notes,
        }),
      );
    },
    [call],
  );

  const voidActivitySession = useCallback(
    async (activityId: string, reason: string) => {
      await call(() =>
        db.rpc("health_f21_void_activity_session", {
          p_activity_id: activityId,
          p_client_event_id: eventId(),
          p_reason: reason,
        }),
      );
    },
    [call],
  );

  const modalities =
    (modalitiesResult.data ?? []) as unknown as Array<{
      code: string;
      name: string;
    }>;

  const strengthCount = useMemo(
    () => sessions.filter((item) => item.kind === "strength").length,
    [sessions],
  );
  const activityCount = sessions.length - strengthCount;

  return {
    sessions,
    modalities,
    strengthCount,
    activityCount,
    loading,
    saving,
    available,
    error,
    reload,
    updateWorkoutSession,
    updateHistoricalSet,
    voidWorkoutSession,
    updateActivitySession,
    voidActivitySession,
  };
}
