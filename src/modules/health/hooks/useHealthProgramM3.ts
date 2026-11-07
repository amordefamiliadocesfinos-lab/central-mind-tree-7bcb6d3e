import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type HealthProgram = Tables["health_programs"]["Row"];
export type HealthProgramVersion = Tables["health_program_versions"]["Row"];
export type MusclePriority = Tables["health_program_muscle_priorities"]["Row"];
export type SessionTemplate = Tables["health_session_templates"]["Row"];
export type TemplateExercise = Tables["health_session_template_exercises"]["Row"];
export type QueueEntry = Tables["health_cch_queue_entries"]["Row"];

type State = {
  program: HealthProgram | null;
  version: HealthProgramVersion | null;
  priorities: MusclePriority[];
  templates: SessionTemplate[];
  templateExercises: TemplateExercise[];
  queue: QueueEntry[];
};

const emptyState: State = {
  program: null,
  version: null,
  priorities: [],
  templates: [],
  templateExercises: [],
  queue: [],
};

export function useHealthProgramM3(athleteId: string | null | undefined) {
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

    const { data: program, error: programError } = await supabase
      .from("health_programs")
      .select("*")
      .eq("athlete_id", athleteId)
      .in("status", ["active", "draft", "paused"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (programError) {
      setError(programError.message);
      setLoading(false);
      return;
    }

    if (!program) {
      setState(emptyState);
      setLoading(false);
      return;
    }

    const { data: versions, error: versionsError } = await supabase
      .from("health_program_versions")
      .select("*")
      .eq("program_id", program.id)
      .eq("athlete_id", athleteId)
      .order("version_number", { ascending: false });

    if (versionsError) {
      setError(versionsError.message);
      setLoading(false);
      return;
    }

    const version =
      versions?.find((item) => item.id === program.current_version_id) ??
      versions?.find((item) => item.status === "draft") ??
      versions?.[0] ??
      null;

    if (!version) {
      setState({ ...emptyState, program });
      setLoading(false);
      return;
    }

    const [prioritiesResult, templatesResult, exercisesResult, queueResult] = await Promise.all([
      supabase
        .from("health_program_muscle_priorities")
        .select("*")
        .eq("program_version_id", version.id)
        .eq("athlete_id", athleteId)
        .order("priority_rank", { ascending: true }),
      supabase
        .from("health_session_templates")
        .select("*")
        .eq("program_version_id", version.id)
        .eq("athlete_id", athleteId)
        .order("sequence_order", { ascending: true }),
      supabase
        .from("health_session_template_exercises")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("sequence_order", { ascending: true }),
      supabase
        .from("health_cch_queue_entries")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("queue_position", { ascending: true }),
    ]);

    const firstError = [
      prioritiesResult.error,
      templatesResult.error,
      exercisesResult.error,
      queueResult.error,
    ].find(Boolean);

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const templateIds = new Set((templatesResult.data ?? []).map((item) => item.id));

    setState({
      program,
      version,
      priorities: prioritiesResult.data ?? [],
      templates: templatesResult.data ?? [],
      templateExercises: (exercisesResult.data ?? []).filter((item) =>
        templateIds.has(item.session_template_id),
      ),
      queue: queueResult.data ?? [],
    });
    setLoading(false);
  }, [athleteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mutate = useCallback(
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

  const createProgram = useCallback(
    async (name: string) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      setSaving(true);
      setError(null);
      try {
        const { error: rpcError } = await supabase.rpc("health_m3_create_program_draft", {
          p_athlete_id: athleteId,
          p_name: name.trim(),
        });
        if (rpcError) throw new Error(rpcError.message);
        await reload();
      } finally {
        setSaving(false);
      }
    },
    [athleteId, reload],
  );

  const addPriority = useCallback(
    async (muscleGroupId: string, priorityRank: number, emphasis: string) => {
      if (!athleteId || !state.version) throw new Error("Versão de programa não disponível.");
      await mutate(async () =>
        supabase.from("health_program_muscle_priorities").upsert(
          {
            athlete_id: athleteId,
            program_version_id: state.version!.id,
            muscle_group_id: muscleGroupId,
            priority_rank: priorityRank,
            emphasis,
          },
          { onConflict: "program_version_id,muscle_group_id" },
        ),
      );
    },
    [athleteId, mutate, state.version],
  );

  const addTemplate = useCallback(
    async (code: string, name: string) => {
      if (!athleteId || !state.version) throw new Error("Versão de programa não disponível.");
      const nextOrder = Math.max(0, ...state.templates.map((item) => item.sequence_order)) + 1;
      await mutate(async () =>
        supabase.from("health_session_templates").insert({
          athlete_id: athleteId,
          program_version_id: state.version!.id,
          code: code.trim().toUpperCase(),
          name: name.trim(),
          sequence_order: nextOrder,
          session_kind: "resistance",
          status: "active",
        }),
      );
    },
    [athleteId, mutate, state.templates, state.version],
  );

  const addExercise = useCallback(
    async (
      sessionTemplateId: string,
      exerciseId: string,
      values: {
        setsMin: number | null;
        setsMax: number | null;
        repsMin: number | null;
        repsMax: number | null;
        rirTarget: number | null;
        restSeconds: number | null;
      },
    ) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      const inTemplate = state.templateExercises.filter(
        (item) => item.session_template_id === sessionTemplateId,
      );
      const nextOrder = Math.max(0, ...inTemplate.map((item) => item.sequence_order)) + 1;

      await mutate(async () =>
        supabase.from("health_session_template_exercises").insert({
          athlete_id: athleteId,
          session_template_id: sessionTemplateId,
          exercise_id: exerciseId,
          sequence_order: nextOrder,
          planned_sets_min: values.setsMin,
          planned_sets_max: values.setsMax,
          reps_min: values.repsMin,
          reps_max: values.repsMax,
          rir_target: values.rirTarget,
          rest_seconds: values.restSeconds,
        }),
      );
    },
    [athleteId, mutate, state.templateExercises],
  );

  const publish = useCallback(async () => {
    if (!state.version) throw new Error("Versão de programa não disponível.");
    setSaving(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc("health_m3_publish_program_version", {
        p_program_version_id: state.version.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      await reload();
    } finally {
      setSaving(false);
    }
  }, [reload, state.version]);

  const isDraft = state.version?.status === "draft";
  const queueByTemplate = useMemo(
    () =>
      state.queue.map((entry) => ({
        ...entry,
        template: state.templates.find((item) => item.id === entry.session_template_id) ?? null,
      })),
    [state.queue, state.templates],
  );

  return {
    ...state,
    queueByTemplate,
    isDraft,
    loading,
    saving,
    error,
    reload,
    createProgram,
    addPriority,
    addTemplate,
    addExercise,
    publish,
  };
}
