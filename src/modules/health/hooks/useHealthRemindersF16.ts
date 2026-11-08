import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { localDateIso } from "../dashboard/dashboardModel";

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
    Functions: {
      health_f16_save_reminder_rule: {
        Args: {
          p_athlete_id: string;
          p_reminder_type: string;
          p_label: string | null;
          p_enabled: boolean;
          p_schedule_kind: string;
          p_days_of_week: number[];
          p_local_time: string;
          p_interval_days: number | null;
          p_start_on: string;
          p_timezone: string;
          p_rule_id?: string | null;
        };
        Returns: string;
      };
      health_f16_archive_reminder_rule: {
        Args: { p_rule_id: string };
        Returns: string;
      };
      health_f16_record_reminder_event: {
        Args: {
          p_rule_id: string;
          p_event_type: string;
          p_event_date: string;
          p_notes?: string | null;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const db = supabase as unknown as SupabaseClient<LooseDatabase>;

export type ReminderType =
  | "training"
  | "nutrition_log"
  | "body_assessment"
  | "recovery_checkin"
  | "longitudinal_review";

export type ReminderScheduleKind = "daily" | "weekly" | "interval";

export type ReminderRule = {
  id: string;
  reminderType: ReminderType;
  label: string | null;
  enabled: boolean;
  scheduleKind: ReminderScheduleKind;
  daysOfWeek: number[];
  localTime: string;
  intervalDays: number | null;
  startOn: string;
  timezone: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type ReminderEvent = {
  id: string;
  ruleId: string;
  eventType: "completed" | "dismissed";
  eventDate: string;
  notes: string | null;
  occurredAt: string;
};

export type SaveReminderRuleInput = {
  ruleId?: string | null;
  reminderType: ReminderType;
  label?: string | null;
  enabled: boolean;
  scheduleKind: ReminderScheduleKind;
  daysOfWeek: number[];
  localTime: string;
  intervalDays?: number | null;
  startOn: string;
  timezone: string;
};

function isBackendUnavailable(
  error: { message?: string; code?: string } | null | undefined,
) {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    (
      /health_(reminder|f16_)/i.test(message) &&
      /(does not exist|schema cache|could not find)/i.test(message)
    )
  );
}

function dateMinusDaysIso(days: number) {
  const base = new Date();
  const shifted = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() - days,
    12,
    0,
    0,
    0,
  );
  const year = shifted.getFullYear();
  const month = String(shifted.getMonth() + 1).padStart(2, "0");
  const day = String(shifted.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mapRule(value: unknown): ReminderRule {
  const row = value as {
    id: string;
    reminder_type: ReminderType;
    label: string | null;
    enabled: boolean;
    schedule_kind: ReminderScheduleKind;
    days_of_week: number[];
    local_time: string;
    interval_days: number | null;
    start_on: string;
    timezone: string;
    status: "active" | "archived";
    created_at: string;
    updated_at: string;
  };
  return {
    id: row.id,
    reminderType: row.reminder_type,
    label: row.label,
    enabled: row.enabled,
    scheduleKind: row.schedule_kind,
    daysOfWeek: row.days_of_week ?? [],
    localTime: row.local_time,
    intervalDays: row.interval_days,
    startOn: row.start_on,
    timezone: row.timezone,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(value: unknown): ReminderEvent {
  const row = value as {
    id: string;
    reminder_rule_id: string;
    event_type: ReminderEvent["eventType"];
    event_date: string;
    notes: string | null;
    occurred_at: string;
  };
  return {
    id: row.id,
    ruleId: row.reminder_rule_id,
    eventType: row.event_type,
    eventDate: row.event_date,
    notes: row.notes,
    occurredAt: row.occurred_at,
  };
}

export function reminderTypeLabel(value: ReminderType | string) {
  const labels: Record<string, string> = {
    training: "Treino",
    nutrition_log: "Diário alimentar",
    body_assessment: "Avaliação corporal",
    recovery_checkin: "Recuperação",
    longitudinal_review: "Revisão longitudinal",
  };
  return labels[value] ?? value;
}

export function reminderScheduleLabel(rule: ReminderRule) {
  if (rule.scheduleKind === "daily") {
    return `Todos os dias às ${rule.localTime.slice(0, 5)}`;
  }
  if (rule.scheduleKind === "interval") {
    return `A cada ${rule.intervalDays ?? "?"} dias às ${rule.localTime.slice(0, 5)}`;
  }
  const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return `${rule.daysOfWeek.map((day) => dayLabels[day] ?? day).join(", ")} às ${rule.localTime.slice(0, 5)}`;
}

export function useHealthRemindersF16(
  athleteId: string | null | undefined,
) {
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [events, setEvents] = useState<ReminderEvent[]>([]);
  const [loading, setLoading] = useState(Boolean(athleteId));
  const [saving, setSaving] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!athleteId) {
      setRules([]);
      setEvents([]);
      setLoading(false);
      setBackendAvailable(true);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const [rulesResult, eventsResult] = await Promise.all([
      db
        .from("health_reminder_rules")
        .select(
          "id,reminder_type,label,enabled,schedule_kind,days_of_week,local_time,interval_days,start_on,timezone,status,created_at,updated_at",
        )
        .eq("athlete_id", athleteId)
        .eq("status", "active")
        .order("local_time", { ascending: true })
        .order("created_at", { ascending: true }),
      db
        .from("health_reminder_events")
        .select(
          "id,reminder_rule_id,event_type,event_date,notes,occurred_at",
        )
        .eq("athlete_id", athleteId)
        .gte("event_date", dateMinusDaysIso(14))
        .order("event_date", { ascending: false })
        .order("occurred_at", { ascending: false })
        .limit(200),
    ]);

    if (rulesResult.error) {
      setRules([]);
      setEvents([]);
      setBackendAvailable(!isBackendUnavailable(rulesResult.error));
      setError(rulesResult.error.message);
      setLoading(false);
      return;
    }

    setBackendAvailable(true);
    setRules(((rulesResult.data ?? []) as unknown[]).map(mapRule));

    if (eventsResult.error) {
      setEvents([]);
      setBackendAvailable(!isBackendUnavailable(eventsResult.error));
      setError(eventsResult.error.message);
    } else {
      setEvents(((eventsResult.data ?? []) as unknown[]).map(mapEvent));
    }

    setLoading(false);
  }, [athleteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runAction = useCallback(
    async <T,>(operation: () => Promise<T>) => {
      setSaving(true);
      setError(null);
      try {
        const value = await operation();
        await reload();
        return value;
      } finally {
        setSaving(false);
      }
    },
    [reload],
  );

  const saveRule = useCallback(
    async (input: SaveReminderRuleInput) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      return runAction(async () => {
        const result = await db.rpc("health_f16_save_reminder_rule", {
          p_athlete_id: athleteId,
          p_reminder_type: input.reminderType,
          p_label: input.label ?? null,
          p_enabled: input.enabled,
          p_schedule_kind: input.scheduleKind,
          p_days_of_week: input.daysOfWeek,
          p_local_time: input.localTime,
          p_interval_days: input.intervalDays ?? null,
          p_start_on: input.startOn,
          p_timezone: input.timezone,
          p_rule_id: input.ruleId ?? null,
        });
        if (result.error) {
          setBackendAvailable(!isBackendUnavailable(result.error));
          setError(result.error.message);
          throw new Error(result.error.message);
        }
        setBackendAvailable(true);
        return result.data;
      });
    },
    [athleteId, runAction],
  );

  const archiveRule = useCallback(
    async (ruleId: string) =>
      runAction(async () => {
        const result = await db.rpc("health_f16_archive_reminder_rule", {
          p_rule_id: ruleId,
        });
        if (result.error) {
          setBackendAvailable(!isBackendUnavailable(result.error));
          setError(result.error.message);
          throw new Error(result.error.message);
        }
        setBackendAvailable(true);
        return result.data;
      }),
    [runAction],
  );

  const recordEvent = useCallback(
    async (
      ruleId: string,
      eventType: ReminderEvent["eventType"],
      notes?: string | null,
    ) =>
      runAction(async () => {
        const result = await db.rpc("health_f16_record_reminder_event", {
          p_rule_id: ruleId,
          p_event_type: eventType,
          p_event_date: localDateIso(),
          p_notes: notes ?? null,
        });
        if (result.error) {
          setBackendAvailable(!isBackendUnavailable(result.error));
          setError(result.error.message);
          throw new Error(result.error.message);
        }
        setBackendAvailable(true);
        return result.data;
      }),
    [runAction],
  );

  return {
    rules,
    events,
    loading,
    saving,
    backendAvailable,
    error,
    reload,
    saveRule,
    archiveRule,
    recordEvent,
  };
}
