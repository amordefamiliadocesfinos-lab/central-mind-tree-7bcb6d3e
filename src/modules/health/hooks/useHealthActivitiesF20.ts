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

export type HealthActivityModalityF20 = {
  code: string;
  name: string;
  metric_profile:
    | "distance"
    | "machine"
    | "mind_body"
    | "dance"
    | "sport"
    | "mobility"
    | "other";
  sort_order: number;
};

export type HealthActivitySessionF20 = {
  id: string;
  athlete_id: string;
  modality_code: string;
  title: string;
  source: "live" | "manual" | "import";
  status: "active" | "paused" | "completed" | "aborted";
  started_at: string;
  ended_at: string | null;
  paused_at: string | null;
  pause_accumulated_seconds: number;
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

export type HealthActivitySegmentF20 = {
  id: string;
  activity_session_id: string;
  sequence_order: number;
  segment_type:
    | "lap"
    | "warmup"
    | "work"
    | "recovery"
    | "cooldown"
    | "interval"
    | "other";
  label: string | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  pace_seconds_per_km: number | null;
  avg_hr_bpm: number | null;
  cadence_spm: number | null;
  notes: string | null;
};

export type HealthDailyStrengthSessionF20 = {
  id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  source: string;
  session_template_id: string | null;
  template_code: string | null;
  template_name: string | null;
};

type State = {
  modalities: HealthActivityModalityF20[];
  activitiesToday: HealthActivitySessionF20[];
  activeActivity: HealthActivitySessionF20 | null;
  segments: HealthActivitySegmentF20[];
  strengthToday: HealthDailyStrengthSessionF20[];
  openStrengthSessionId: string | null;
};

const emptyState: State = {
  modalities: [],
  activitiesToday: [],
  activeActivity: null,
  segments: [],
  strengthToday: [],
  openStrengthSessionId: null,
};

function eventId() {
  return crypto.randomUUID();
}

function localDayBounds(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function useHealthActivitiesF20(
  athleteId: string | null | undefined,
) {
  const [state, setState] = useState<State>(emptyState);
  const [loading, setLoading] = useState(Boolean(athleteId));
  const [saving, setSaving] = useState(false);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!athleteId) {
      setState(emptyState);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const bounds = localDayBounds();

    const [
      modalitiesResult,
      activitiesResult,
      activeActivityResult,
      strengthResult,
      openStrengthResult,
    ] = await Promise.all([
      db
        .from("health_activity_modalities")
        .select("code,name,metric_profile,sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      db
        .from("health_activity_sessions")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("record_status", "active")
        .gte("started_at", bounds.start)
        .lt("started_at", bounds.end)
        .order("started_at", { ascending: true }),
      db
        .from("health_activity_sessions")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("record_status", "active")
        .in("status", ["active", "paused"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("health_workout_sessions")
        .select("id,status,started_at,ended_at,source,session_template_id")
        .eq("athlete_id", athleteId)
        .eq("record_status", "active")
        .gte("started_at", bounds.start)
        .lt("started_at", bounds.end)
        .order("started_at", { ascending: true }),
      db
        .from("health_workout_sessions")
        .select("id")
        .eq("athlete_id", athleteId)
        .eq("record_status", "active")
        .in("status", ["active", "paused"])
        .limit(1)
        .maybeSingle(),
    ]);

    const firstError =
      modalitiesResult.error ??
      activitiesResult.error ??
      activeActivityResult.error ??
      strengthResult.error ??
      openStrengthResult.error;

    if (firstError) {
      setAvailable(false);
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const activities =
      (activitiesResult.data ?? []) as unknown as HealthActivitySessionF20[];

    const activeActivity =
      (activeActivityResult.data as unknown as HealthActivitySessionF20 | null) ??
      null;

    const activityIds = [
      ...new Set([
        ...activities.map((item) => item.id),
        ...(activeActivity ? [activeActivity.id] : []),
      ]),
    ];
    const segmentsResult = activityIds.length
      ? await db
          .from("health_activity_segments")
          .select("*")
          .in("activity_session_id", activityIds)
          .order("sequence_order", { ascending: true })
      : ({ data: [], error: null } as LooseOperationResult);

    if (segmentsResult.error) {
      setAvailable(false);
      setError(segmentsResult.error.message);
      setLoading(false);
      return;
    }

    const strengthRows = (strengthResult.data ?? []) as Array<
      Record<string, unknown>
    >;
    const templateIds = [
      ...new Set(
        strengthRows
          .map((item) => item.session_template_id)
          .filter((value): value is string => typeof value === "string"),
      ),
    ];

    const templatesResult = templateIds.length
      ? await db
          .from("health_session_templates")
          .select("id,code,name")
          .in("id", templateIds)
      : ({ data: [], error: null } as LooseOperationResult);

    if (templatesResult.error) {
      setAvailable(false);
      setError(templatesResult.error.message);
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

    const strengthToday: HealthDailyStrengthSessionF20[] = strengthRows.map(
      (item) => {
        const templateId =
          typeof item.session_template_id === "string"
            ? item.session_template_id
            : null;
        const template = templateId
          ? templateById.get(templateId)
          : undefined;

        return {
          id: String(item.id),
          status: String(item.status),
          started_at: String(item.started_at),
          ended_at: item.ended_at == null ? null : String(item.ended_at),
          source: String(item.source),
          session_template_id: templateId,
          template_code: template?.code ?? null,
          template_name: template?.name ?? null,
        };
      },
    );

    setAvailable(true);
    setState({
      modalities:
        (modalitiesResult.data ?? []) as unknown as HealthActivityModalityF20[],
      activitiesToday: activities,
      activeActivity,
      segments:
        (segmentsResult.data ?? []) as unknown as HealthActivitySegmentF20[],
      strengthToday,
      openStrengthSessionId:
        openStrengthResult.data &&
        typeof (openStrengthResult.data as Record<string, unknown>).id === "string"
          ? String((openStrengthResult.data as Record<string, unknown>).id)
          : null,
    });
    setLoading(false);
  }, [athleteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!athleteId) return;

    const reconcile = () => {
      if (document.visibilityState === "visible") void reload();
    };

    window.addEventListener("focus", reconcile);
    document.addEventListener("visibilitychange", reconcile);
    return () => {
      window.removeEventListener("focus", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
    };
  }, [athleteId, reload]);

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

  const startActivity = useCallback(
    async (modalityCode: string, title?: string | null) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      await call(() =>
        db.rpc("health_f20_start_activity", {
          p_athlete_id: athleteId,
          p_modality_code: modalityCode,
          p_title: title ?? null,
          p_client_event_id: eventId(),
        }),
      );
    },
    [athleteId, call],
  );

  const pauseActivity = useCallback(
    async (activityId: string) => {
      await call(() =>
        db.rpc("health_f20_pause_activity", {
          p_activity_id: activityId,
          p_client_event_id: eventId(),
        }),
      );
    },
    [call],
  );

  const resumeActivity = useCallback(
    async (activityId: string) => {
      await call(() =>
        db.rpc("health_f20_resume_activity", {
          p_activity_id: activityId,
          p_client_event_id: eventId(),
        }),
      );
    },
    [call],
  );

  const completeActivity = useCallback(
    async (
      activityId: string,
      values: {
        distanceMeters?: number | null;
        caloriesKcal?: number | null;
        avgHrBpm?: number | null;
        maxHrBpm?: number | null;
        rpe?: number | null;
        cadenceSpm?: number | null;
        elevationGainM?: number | null;
        steps?: number | null;
        notes?: string | null;
      },
    ) => {
      await call(() =>
        db.rpc("health_f20_complete_activity", {
          p_activity_id: activityId,
          p_client_event_id: eventId(),
          p_distance_meters: values.distanceMeters ?? null,
          p_calories_kcal: values.caloriesKcal ?? null,
          p_avg_hr_bpm: values.avgHrBpm ?? null,
          p_max_hr_bpm: values.maxHrBpm ?? null,
          p_rpe: values.rpe ?? null,
          p_cadence_spm: values.cadenceSpm ?? null,
          p_elevation_gain_m: values.elevationGainM ?? null,
          p_steps: values.steps ?? null,
          p_notes: values.notes ?? null,
        }),
      );
    },
    [call],
  );

  const createManualActivity = useCallback(
    async (values: {
      modalityCode: string;
      title?: string | null;
      startedAt: string;
      durationSeconds: number;
      distanceMeters?: number | null;
      caloriesKcal?: number | null;
      avgHrBpm?: number | null;
      maxHrBpm?: number | null;
      rpe?: number | null;
      cadenceSpm?: number | null;
      elevationGainM?: number | null;
      steps?: number | null;
      notes?: string | null;
    }) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      await call(() =>
        db.rpc("health_f20_create_manual_activity", {
          p_athlete_id: athleteId,
          p_modality_code: values.modalityCode,
          p_title: values.title ?? null,
          p_started_at: values.startedAt,
          p_duration_seconds: values.durationSeconds,
          p_client_event_id: eventId(),
          p_distance_meters: values.distanceMeters ?? null,
          p_calories_kcal: values.caloriesKcal ?? null,
          p_avg_hr_bpm: values.avgHrBpm ?? null,
          p_max_hr_bpm: values.maxHrBpm ?? null,
          p_rpe: values.rpe ?? null,
          p_cadence_spm: values.cadenceSpm ?? null,
          p_elevation_gain_m: values.elevationGainM ?? null,
          p_steps: values.steps ?? null,
          p_notes: values.notes ?? null,
        }),
      );
    },
    [athleteId, call],
  );

  const addSegment = useCallback(
    async (
      activityId: string,
      values: {
        segmentType?: string;
        label?: string | null;
        durationSeconds?: number | null;
        distanceMeters?: number | null;
        avgHrBpm?: number | null;
        cadenceSpm?: number | null;
        notes?: string | null;
      },
    ) => {
      await call(() =>
        db.rpc("health_f20_add_segment", {
          p_activity_id: activityId,
          p_client_event_id: eventId(),
          p_segment_type: values.segmentType ?? "lap",
          p_label: values.label ?? null,
          p_duration_seconds: values.durationSeconds ?? null,
          p_distance_meters: values.distanceMeters ?? null,
          p_avg_hr_bpm: values.avgHrBpm ?? null,
          p_cadence_spm: values.cadenceSpm ?? null,
          p_notes: values.notes ?? null,
        }),
      );
    },
    [call],
  );

  const segmentsByActivity = useMemo(() => {
    const map = new Map<string, HealthActivitySegmentF20[]>();
    for (const segment of state.segments) {
      const list = map.get(segment.activity_session_id) ?? [];
      list.push(segment);
      map.set(segment.activity_session_id, list);
    }
    return map;
  }, [state.segments]);

  return {
    ...state,
    segmentsByActivity,
    loading,
    saving,
    available,
    error,
    reload,
    startActivity,
    pauseActivity,
    resumeActivity,
    completeActivity,
    createManualActivity,
    addSegment,
  };
}

export type HealthActivitiesF20Controller = ReturnType<
  typeof useHealthActivitiesF20
>;
