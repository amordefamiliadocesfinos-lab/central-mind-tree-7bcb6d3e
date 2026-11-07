import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

export type AthleteProfile = Tables["health_athlete_profiles"]["Row"];
export type HealthGoal = Tables["health_goals"]["Row"];
export type HealthGoalPhase = Tables["health_goal_phases"]["Row"];
export type TrainingLocation = Tables["health_training_locations"]["Row"];
export type DeclaredEquipment = Tables["health_declared_equipment"]["Row"];
export type AthletePreferences = Tables["health_athlete_preferences"]["Row"];
export type HealthConsent = Tables["health_consents"]["Row"];

export type ConsentType =
  | "health_data_processing"
  | "private_media_storage"
  | "media_analysis"
  | "coach_sharing"
  | "notifications";

export type ConsentDecision = "granted" | "denied" | "revoked";

type M1Data = {
  profile: AthleteProfile | null;
  activeGoal: HealthGoal | null;
  activePhase: HealthGoalPhase | null;
  locations: TrainingLocation[];
  equipment: DeclaredEquipment[];
  preferences: AthletePreferences | null;
  latestConsents: Partial<Record<ConsentType, HealthConsent>>;
};

const emptyData: M1Data = {
  profile: null,
  activeGoal: null,
  activePhase: null,
  locations: [],
  equipment: [],
  preferences: null,
  latestConsents: {},
};

export function useHealthProfileM1(athleteId: string | null | undefined) {
  const [data, setData] = useState<M1Data>(emptyData);
  const [loading, setLoading] = useState(Boolean(athleteId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primaryLocation = useMemo(
    () => data.locations.find((item) => item.is_primary && item.status === "active") ?? data.locations[0] ?? null,
    [data.locations],
  );

  const reload = useCallback(async () => {
    if (!athleteId) {
      setData(emptyData);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [
      profileResult,
      goalResult,
      phaseResult,
      locationsResult,
      equipmentResult,
      preferencesResult,
      consentsResult,
    ] = await Promise.all([
      supabase.from("health_athlete_profiles").select("*").eq("athlete_id", athleteId).maybeSingle(),
      supabase
        .from("health_goals")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("status", "active")
        .eq("is_primary", true)
        .maybeSingle(),
      supabase
        .from("health_goal_phases")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("health_training_locations")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("status", "active")
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("health_declared_equipment")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("created_at", { ascending: true }),
      supabase.from("health_athlete_preferences").select("*").eq("athlete_id", athleteId).maybeSingle(),
      supabase
        .from("health_consents")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("occurred_at", { ascending: false }),
    ]);

    const firstError = [
      profileResult.error,
      goalResult.error,
      phaseResult.error,
      locationsResult.error,
      equipmentResult.error,
      preferencesResult.error,
      consentsResult.error,
    ].find(Boolean);

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const latestConsents: Partial<Record<ConsentType, HealthConsent>> = {};
    for (const consent of consentsResult.data ?? []) {
      const type = consent.consent_type as ConsentType;
      if (!latestConsents[type]) latestConsents[type] = consent;
    }

    setData({
      profile: profileResult.data,
      activeGoal: goalResult.data,
      activePhase: phaseResult.data,
      locations: locationsResult.data ?? [],
      equipment: equipmentResult.data ?? [],
      preferences: preferencesResult.data,
      latestConsents,
    });
    setLoading(false);
  }, [athleteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runMutation = useCallback(
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

  const saveProfile = useCallback(
    async (values: {
      date_of_birth: string | null;
      height_cm: number | null;
      training_experience_level: string | null;
      dominant_side: string | null;
      profile_notes: string | null;
    }) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      await runMutation(async () =>
        supabase
          .from("health_athlete_profiles")
          .upsert({ athlete_id: athleteId, ...values }, { onConflict: "athlete_id" }),
      );
    },
    [athleteId, runMutation],
  );

  const saveGoal = useCallback(
    async (values: { goal_type: string; title: string; priority: number; notes: string | null }) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      if (data.activeGoal) {
        await runMutation(async () =>
          supabase
            .from("health_goals")
            .update({ ...values, status: "active", is_primary: true })
            .eq("id", data.activeGoal!.id)
            .eq("athlete_id", athleteId),
        );
        return;
      }
      await runMutation(async () =>
        supabase.from("health_goals").insert({
          athlete_id: athleteId,
          ...values,
          status: "active",
          is_primary: true,
          started_on: new Date().toISOString().slice(0, 10),
        }),
      );
    },
    [athleteId, data.activeGoal, runMutation],
  );

  const savePhase = useCallback(
    async (values: { phase_type: string; title: string; objective_notes: string | null }) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      if (!data.activeGoal) throw new Error("Salve um objetivo principal antes da fase.");
      if (data.activePhase) {
        await runMutation(async () =>
          supabase
            .from("health_goal_phases")
            .update({ ...values, status: "active" })
            .eq("id", data.activePhase!.id)
            .eq("athlete_id", athleteId),
        );
        return;
      }
      await runMutation(async () =>
        supabase.from("health_goal_phases").insert({
          athlete_id: athleteId,
          goal_id: data.activeGoal!.id,
          ...values,
          status: "active",
          starts_on: new Date().toISOString().slice(0, 10),
        }),
      );
    },
    [athleteId, data.activeGoal, data.activePhase, runMutation],
  );

  const savePrimaryLocation = useCallback(
    async (values: { name: string; location_type: string; notes: string | null }) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      if (primaryLocation) {
        await runMutation(async () =>
          supabase
            .from("health_training_locations")
            .update({ ...values, is_primary: true, status: "active" })
            .eq("id", primaryLocation.id)
            .eq("athlete_id", athleteId),
        );
        return;
      }
      await runMutation(async () =>
        supabase.from("health_training_locations").insert({
          athlete_id: athleteId,
          ...values,
          is_primary: true,
          status: "active",
        }),
      );
    },
    [athleteId, primaryLocation, runMutation],
  );

  const addEquipment = useCallback(
    async (displayName: string, category: string | null) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      await runMutation(async () =>
        supabase.from("health_declared_equipment").insert({
          athlete_id: athleteId,
          location_id: primaryLocation?.id ?? null,
          display_name: displayName.trim(),
          category,
          availability: "available",
        }),
      );
    },
    [athleteId, primaryLocation?.id, runMutation],
  );

  const setEquipmentAvailability = useCallback(
    async (id: string, availability: "available" | "limited" | "unavailable" | "unknown") => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      await runMutation(async () =>
        supabase
          .from("health_declared_equipment")
          .update({ availability })
          .eq("id", id)
          .eq("athlete_id", athleteId),
      );
    },
    [athleteId, runMutation],
  );

  const savePreferences = useCallback(
    async (values: {
      preferred_session_minutes: number | null;
      preferred_sessions_per_week: number | null;
      training_time_preference: string | null;
      notes: string | null;
    }) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      await runMutation(async () =>
        supabase.from("health_athlete_preferences").upsert(
          {
            athlete_id: athleteId,
            unit_system: "metric",
            default_location_id: primaryLocation?.id ?? null,
            ...values,
          },
          { onConflict: "athlete_id" },
        ),
      );
    },
    [athleteId, primaryLocation?.id, runMutation],
  );

  const recordConsent = useCallback(
    async (consentType: ConsentType, decision: ConsentDecision) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      await runMutation(async () =>
        supabase.from("health_consents").insert({
          athlete_id: athleteId,
          consent_type: consentType,
          decision,
          policy_version: "health-m1-v1",
        }),
      );
    },
    [athleteId, runMutation],
  );

  return {
    ...data,
    primaryLocation,
    loading,
    saving,
    error,
    reload,
    saveProfile,
    saveGoal,
    savePhase,
    savePrimaryLocation,
    addEquipment,
    setEquipmentAvailability,
    savePreferences,
    recordConsent,
  };
}
