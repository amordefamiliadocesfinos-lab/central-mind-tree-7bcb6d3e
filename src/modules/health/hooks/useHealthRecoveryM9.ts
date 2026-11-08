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
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type LooseOperationResult = {
  data?: unknown;
  error?: { message: string } | null;
};

const db = supabase as unknown as SupabaseClient<LooseDatabase>;

export type SleepPeriod = {
  id: string;
  athlete_id: string;
  sleep_date: string;
  period_type: "nocturnal" | "nap" | "other";
  bed_at: string | null;
  sleep_start_at: string | null;
  final_wake_at: string | null;
  out_of_bed_at: string | null;
  declared_sleep_minutes: number | null;
  calculated_time_in_bed_minutes: number | null;
  calculated_sleep_minutes: number | null;
  awakenings_count: number | null;
  awake_during_period_minutes: number | null;
  timezone: string | null;
  data_source: string;
  confidence: string;
  notes: string | null;
  status: string;
  created_at: string;
};

export type RecoveryMetricCode =
  | "sleep_quality"
  | "sleepiness"
  | "general_fatigue"
  | "muscular_fatigue"
  | "mental_fatigue"
  | "physical_recovery"
  | "training_readiness"
  | "muscle_soreness"
  | "disposition";

export type RecoveryCheckin = {
  id: string;
  athlete_id: string;
  checkin_event_id: string;
  observed_at: string;
  observed_on: string;
  metric_code: RecoveryMetricCode;
  value_ordinal: number | null;
  raw_text: string | null;
  scale_version: string;
  data_source: string;
  confidence: string;
  status: string;
  created_at: string;
};

export type SleepRecoveryState = {
  id: string;
  athlete_id: string;
  as_of_date: string;
  window_days: 7 | 14 | 28;
  window_start_date: string;
  sleep_duration_observed_days: number;
  sleep_timing_observed_days: number;
  sleep_quality_observed_days: number;
  recovery_observed_days: number;
  fatigue_observed_days: number;
  readiness_observed_days: number;
  sleep_duration_coverage: string;
  sleep_timing_coverage: string;
  sleep_quality_coverage: string;
  recovery_coverage: string;
  fatigue_coverage: string;
  readiness_coverage: string;
  average_sleep_minutes: number | null;
  sleep_duration_variability_minutes: number | null;
  average_sleep_quality: number | null;
  average_recovery: number | null;
  average_fatigue: number | null;
  average_readiness: number | null;
  confidence: string;
  reason_codes: string[];
  algorithm_version: string;
  computed_at: string;
};

export type RecoveryMetricInput = {
  metric_code: RecoveryMetricCode;
  value_ordinal?: number | null;
  raw_text?: string | null;
};

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function dateTimeOrNull(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function clientEventId() {
  return crypto.randomUUID();
}

export function useHealthRecoveryM9(athleteId: string | null | undefined) {
  const [sleepPeriods, setSleepPeriods] = useState<SleepPeriod[]>([]);
  const [checkins, setCheckins] = useState<RecoveryCheckin[]>([]);
  const [states, setStates] = useState<SleepRecoveryState[]>([]);
  const [loading, setLoading] = useState(Boolean(athleteId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!athleteId) {
      setSleepPeriods([]);
      setCheckins([]);
      setStates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [sleepResult, checkinResult, stateResult] = await Promise.all([
      db.from("health_sleep_periods")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("sleep_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(90),
      db.from("health_recovery_checkins")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("observed_at", { ascending: false })
        .limit(180),
      db.from("health_sleep_recovery_rolling_states")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("as_of_date", { ascending: false })
        .order("window_days", { ascending: true })
        .limit(24),
    ]);

    const firstError = sleepResult.error ?? checkinResult.error ?? stateResult.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setSleepPeriods((sleepResult.data ?? []) as SleepPeriod[]);
    setCheckins((checkinResult.data ?? []) as RecoveryCheckin[]);

    const latestByWindow = new Map<number, SleepRecoveryState>();
    for (const item of (stateResult.data ?? []) as SleepRecoveryState[]) {
      if (!latestByWindow.has(item.window_days)) latestByWindow.set(item.window_days, item);
    }
    setStates([7, 14, 28].flatMap((windowDays) => {
      const item = latestByWindow.get(windowDays);
      return item ? [item] : [];
    }));

    setLoading(false);
  }, [athleteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(async (operation: () => PromiseLike<LooseOperationResult>) => {
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
  }, [reload]);

  const recordSleepPeriod = useCallback(async (input: {
    sleepDate?: string;
    periodType?: SleepPeriod["period_type"];
    bedAt?: string | null;
    sleepStartAt?: string | null;
    finalWakeAt?: string | null;
    outOfBedAt?: string | null;
    declaredSleepMinutes?: number | null;
    awakeningsCount?: number | null;
    awakeMinutes?: number | null;
    timezone?: string | null;
    notes?: string | null;
  }) => {
    if (!athleteId) throw new Error("Atleta não disponível.");
    return run(() => db.rpc("health_m9_record_sleep_period", {
      p_athlete_id: athleteId,
      p_sleep_date: input.sleepDate ?? todayIso(),
      p_period_type: input.periodType ?? "nocturnal",
      p_bed_at: dateTimeOrNull(input.bedAt),
      p_sleep_start_at: dateTimeOrNull(input.sleepStartAt),
      p_final_wake_at: dateTimeOrNull(input.finalWakeAt),
      p_out_of_bed_at: dateTimeOrNull(input.outOfBedAt),
      p_declared_sleep_minutes: input.declaredSleepMinutes ?? null,
      p_awakenings_count: input.awakeningsCount ?? null,
      p_awake_during_period_minutes: input.awakeMinutes ?? null,
      p_timezone: input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      p_data_source: "USER_REPORTED",
      p_confidence: "moderate",
      p_notes: input.notes?.trim() || null,
      p_client_event_id: clientEventId(),
      p_supersedes_sleep_period_id: null,
    }));
  }, [athleteId, run]);

  const recordRecoveryCheckin = useCallback(async (
    metrics: RecoveryMetricInput[],
    observedAt = new Date(),
    notes?: string | null,
  ) => {
    if (!athleteId) throw new Error("Atleta não disponível.");
    const usable = metrics.filter((metric) =>
      metric.value_ordinal != null || Boolean(metric.raw_text?.trim()),
    );
    if (!usable.length) throw new Error("Informe ao menos uma percepção de recuperação.");

    const checkinEventId = crypto.randomUUID();
    const observedAtIso = observedAt.toISOString();
    const observedOn = todayIso();

    setSaving(true);
    setError(null);
    try {
      const results = await Promise.all(usable.map((metric) =>
        db.rpc("health_m9_record_recovery_checkin", {
          p_athlete_id: athleteId,
          p_checkin_event_id: checkinEventId,
          p_observed_at: observedAtIso,
          p_observed_on: observedOn,
          p_metric_code: metric.metric_code,
          p_value_ordinal: metric.value_ordinal ?? null,
          p_raw_text: metric.raw_text?.trim() || (notes?.trim() || null),
          p_data_source: "USER_REPORTED",
          p_confidence: "moderate",
          p_client_event_id: null,
          p_supersedes_checkin_id: null,
        }),
      ));
      const failed = results.find((result) => result.error);
      if (failed?.error) throw new Error(failed.error.message);
      await reload();
    } finally {
      setSaving(false);
    }
  }, [athleteId, reload]);

  const refreshStates = useCallback(async () => {
    if (!athleteId) throw new Error("Atleta não disponível.");
    setSaving(true);
    setError(null);
    try {
      const date = todayIso();
      for (const windowDays of [7, 14, 28]) {
        const result = await db.rpc("health_m9_refresh_sleep_recovery_state", {
          p_athlete_id: athleteId,
          p_as_of_date: date,
          p_window_days: windowDays,
        });
        if (result.error) throw new Error(result.error.message);
      }
      await reload();
    } finally {
      setSaving(false);
    }
  }, [athleteId, reload]);

  const voidSleepPeriod = useCallback(async (id: string) => {
    await run(() => db.rpc("health_m9_void_sleep_period", {
      p_sleep_period_id: id,
      p_reason: "Anulado pelo usuário",
    }));
  }, [run]);

  const voidRecoveryCheckin = useCallback(async (id: string) => {
    await run(() => db.rpc("health_m9_void_recovery_checkin", {
      p_checkin_id: id,
      p_reason: "Anulado pelo usuário",
    }));
  }, [run]);

  const activeSleepPeriods = useMemo(
    () => sleepPeriods.filter((item) => item.status === "active"),
    [sleepPeriods],
  );

  const activeCheckins = useMemo(
    () => checkins.filter((item) => item.status === "active"),
    [checkins],
  );

  return {
    sleepPeriods,
    checkins,
    activeSleepPeriods,
    activeCheckins,
    states,
    loading,
    saving,
    error,
    reload,
    recordSleepPeriod,
    recordRecoveryCheckin,
    refreshStates,
    voidSleepPeriod,
    voidRecoveryCheckin,
  };
}
