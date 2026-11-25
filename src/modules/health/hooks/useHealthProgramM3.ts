import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const scope = athleteId ?? null;
  const [snapshot, setSnapshot] = useState<{ scope: string | null; state: State; loading: boolean; error: string | null }>({scope: null, state: emptyState, loading: false, error: null});
  const generation = useRef(0);
  const state = snapshot.scope === scope ? snapshot.state : emptyState;
  const loading = Boolean(scope) && (snapshot.scope !== scope || snapshot.loading);
  const error = snapshot.scope === scope ? snapshot.error : null;
  const [saving, setSaving] = useState(false);
  const setError = useCallback((message: string | null) => {
    setSnapshot(previous => previous.scope === scope ? {...previous, error: message} : previous);
  }, [scope]);

  const reload = useCallback(async () => {
    const request = ++generation.current;
    const finish = (state: State, error: string | null = null) => {
      if (request === generation.current) setSnapshot({scope, state, loading: false, error});
    };
    if (!athleteId) {
      finish(emptyState);
      return;
    }

    setSnapshot({scope, state: emptyState, loading: true, error: null});
    try {

    const { data: program, error: programError } = await supabase
      .from("health_programs")
      .select("*")
      .eq("athlete_id", athleteId)
      .in("status", ["active", "draft", "paused"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (programError) {
      finish(emptyState, programError.message);
      return;
    }

    if (!program) {
      finish(emptyState);
      return;
    }

    const { data: versions, error: versionsError } = await supabase
      .from("health_program_versions")
      .select("*")
      .eq("program_id", program.id)
      .eq("athlete_id", athleteId)
      .order("version_number", { ascending: false });

    if (versionsError) {
      finish(emptyState, versionsError.message);
      return;
    }

    const version =
      versions?.find((item) => item.status === "draft") ??
      versions?.find((item) => item.id === program.current_version_id) ??
      versions?.[0] ??
      null;

    if (!version) {
      finish({ ...emptyState, program });
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
      finish(emptyState, firstError.message);
      return;
    }

    const templateIds = new Set((templatesResult.data ?? []).map((item) => item.id));

    finish({
      program,
      version,
      priorities: prioritiesResult.data ?? [],
      templates: templatesResult.data ?? [],
      templateExercises: (exercisesResult.data ?? []).filter((item) =>
        templateIds.has(item.session_template_id),
      ),
      queue: queueResult.data ?? [],
    });
    } catch (cause) {
      finish(emptyState, cause instanceof Error ? cause.message : "Consulta do programa indisponível.");
    }
  }, [athleteId, scope]);

  useEffect(() => {
    void reload();
    return () => { generation.current++; };
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
    [reload, setError],
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
    [athleteId, reload, setError],
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

  const prepareNextCycle = useCallback(async () => {
    if (!state.program) throw new Error("Programa não disponível");
    setSaving(true);
    try {
      const { error: rpcError } = await supabase.rpc("health_cch_prepare_next_cycle" as never,
        { p_program_id: state.program.id } as never);
      if (rpcError) throw new Error(rpcError.message);
      await reload();
    } finally { setSaving(false); }
  }, [reload, state.program]);

  const updatePrescription = useCallback(async (id: string, patch: {
    planned_sets_min: number | null; planned_sets_max: number | null;
    reps_min: number | null; reps_max: number | null;
    rir_target: number | null; rest_seconds: number | null;
  }, rationale?: string) => {
    if (!athleteId || state.version?.status !== "draft") throw new Error("Somente rascunhos podem ser editados");
    const target=state.templateExercises.find(e=>e.id===id &&
      state.templates.some(t=>t.id===e.session_template_id && t.program_version_id===state.version?.id));
    if(!target)throw new Error("Exercício não pertence ao rascunho");
    if(!rationale||rationale.trim().length<10)throw new Error("Informe o motivo da revisão (mínimo 10 caracteres)");
    const expected={
      planned_sets_min:target.planned_sets_min,planned_sets_max:target.planned_sets_max,
      reps_min:target.reps_min,reps_max:target.reps_max,
      rir_target:target.rir_target,rest_seconds:target.rest_seconds,
    };
    await mutate(async()=>supabase.rpc("health_cch_e2_update_draft_prescription" as never,{
      p_template_exercise_id:id,p_expected_version_id:state.version!.id,
      p_expected:expected,p_proposed:patch,p_reason:rationale.trim()
    } as never));
  }, [athleteId, state.version, state.templates, state.templateExercises, mutate]);

  const editExerciseStructure=useCallback(async(
    templateExerciseId:string,operation:"replace"|"swap",reason:string,
    otherId?:string,replacementId?:string
  )=>{
    if(!athleteId||state.version?.status!=="draft")throw new Error("Somente rascunhos podem ser editados");
    const source=state.templateExercises.find(x=>x.id===templateExerciseId &&
      state.templates.some(t=>t.id===x.session_template_id && t.program_version_id===state.version?.id));
    if(!source)throw new Error("Exercício não pertence ao rascunho");
    await mutate(async()=>supabase.rpc("health_cch_e2_edit_draft_exercise" as never,
      {p_template_exercise_id:templateExerciseId,p_operation:operation,p_reason:reason,
      p_other_template_exercise_id:otherId??null,p_replacement_exercise_id:replacementId??null} as never));
  },[athleteId,state.version,state.templateExercises,state.templates,mutate]);
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
  }, [reload, state.version, setError]);

  const isDraft = state.version?.status === "draft";
  const publishedQueue = state.queue.filter(q => q.program_version_id === state.program?.current_version_id);
  const cycleComplete = Boolean(state.program?.current_version_id && publishedQueue.length &&
    publishedQueue.every(q => q.state === "completed") &&
    !state.queue.some(q => ["queued","eligible","prioritized","in_progress","blocked"].includes(q.state)));
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
    cycleComplete,
    prepareNextCycle,
    updatePrescription,
    editExerciseStructure,
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
