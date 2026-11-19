import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GuidedGoal = "hypertrophy" | "strength" | "maintenance" | "fat_loss" | "muscle_priority";
export type GuidedStrategy = "continue_progression" | "consolidate" | "recovery_review";
type Workout = { id: string; started_at: string; program_version_id: string; status: string };
type Exercise = { id: string; session_id: string; exercise_id: string };
type SetRow = { session_id: string; workout_exercise_id: string; load_value: number | null; load_unit: string | null; reps: number | null; rir: number | null; status: string };
type Assessment = { sessions: number; completedSets: number; measuredSets: number; exerciseCount: number;
  comparableExercises: number; note: string; lastSessionAt: string | null; sourceVersionId: string | null };
const empty: Assessment = { sessions: 0, completedSets: 0, measuredSets: 0, exerciseCount: 0,
  comparableExercises: 0, note: "Sem histórico suficiente para recomendações individualizadas.", lastSessionAt: null, sourceVersionId: null };

export const guidedGoals: Array<{ value: GuidedGoal; label: string }> = [
  { value: "hypertrophy", label: "Hipertrofia e desenvolvimento muscular" },
  { value: "strength", label: "Força e desempenho" },
  { value: "maintenance", label: "Manutenção e recuperação" },
  { value: "fat_loss", label: "Reduzir gordura preservando massa muscular" },
  { value: "muscle_priority", label: "Priorizar grupos musculares específicos" },
];
export const guidedStrategies: Array<{ value: GuidedStrategy; label: string; detail: string }> = [
  { value: "continue_progression", label: "Continuidade com progressão orientada", detail: "Manter a estrutura útil e ajustar somente quando houver evidência comparável." },
  { value: "consolidate", label: "Consolidar a técnica e a regularidade", detail: "Priorizar execução consistente e monitorar resultados antes de aumentar a demanda." },
  { value: "recovery_review", label: "Reavaliar distribuição e recuperação", detail: "Manter decisões conservadoras até analisar fadiga, sono e recuperação." },
];

export function useCchCycleAdvisor(athleteId: string | null | undefined, versionId: string | null | undefined) {
  const [assessment, setAssessment] = useState<Assessment>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const refresh = useCallback(async () => {
    if (!athleteId || !versionId) { setAssessment(empty); setError(null); return; }
    setLoading(true);
    setError(null);
    try {
      const sessionsResult = await supabase.from("health_workout_sessions")
        .select("id,started_at,program_version_id,status")
        .eq("athlete_id", athleteId).eq("program_version_id", versionId)
        .eq("record_status", "active").eq("status", "completed")
        .order("started_at", { ascending: false }).limit(100);
      if (sessionsResult.error) throw new Error(sessionsResult.error.message);
      const sessions = (sessionsResult.data ?? []) as Workout[];
      if (!sessions.length) {
        setAssessment({ ...empty, sourceVersionId: versionId });
        return;
      }
      const ids = sessions.map(s => s.id);
      const [exerciseResult, setResult] = await Promise.all([
        supabase.from("health_workout_exercises").select("id,session_id,exercise_id")
          .eq("athlete_id", athleteId).in("session_id", ids),
        supabase.from("health_workout_sets").select("session_id,workout_exercise_id,load_value,load_unit,reps,rir,status")
          .eq("athlete_id", athleteId).in("session_id", ids).eq("status", "completed"),
      ]);
      if (exerciseResult.error || setResult.error) throw new Error(exerciseResult.error?.message ?? setResult.error!.message);
      const exercises = (exerciseResult.data ?? []) as Exercise[];
      const sets = (setResult.data ?? []) as SetRow[];
      const exerciseById = new Map(exercises.map(e => [e.id, e]));
      const observed = new Map<string, Set<string>>();
      for (const set of sets) {
        const exercise = exerciseById.get(set.workout_exercise_id);
        if (!exercise || set.reps == null || set.load_value == null) continue;
        const key = exercise.exercise_id + ":" + set.load_unit;
        const sessionsForExercise = observed.get(key) ?? new Set<string>();
        sessionsForExercise.add(set.session_id);
        observed.set(key, sessionsForExercise);
      }
      const comparable = [...observed.values()].filter(s => s.size >= 2).length;
      setAssessment({
        sessions: sessions.length,
        completedSets: sets.length,
        measuredSets: sets.filter(s => s.reps != null && s.load_value != null).length,
        exerciseCount: new Set(exercises.map(e => e.exercise_id)).size,
        comparableExercises: comparable,
        lastSessionAt: sessions[0].started_at,
        sourceVersionId: versionId,
        note: comparable > 0
          ? "Há exercícios observados em mais de uma sessão, mas a recomendação só pode comparar cargas na mesma unidade e exercício."
          : "Há histórico de execução, porém poucas exposições comparáveis para inferir progressão por exercício.",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha na auditoria do histórico");
      setAssessment(empty);
    } finally { setLoading(false); }
  }, [athleteId, versionId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const recommendations = useMemo(() => {
    const sufficient = assessment.sessions >= 2 && assessment.completedSets >= 6;
    return [
      { goal: "hypertrophy" as GuidedGoal, strategy: "continue_progression" as GuidedStrategy,
        label: "Continuar hipertrofia com progressão seletiva",
        reason: sufficient ? "A rotina apresenta execuções válidas. O CCH mantém o que funcionou e usa evidências comparáveis para ajustes conservadores." :
          "É uma opção de continuidade, mas ainda faltam informações para inferir progressões." },
      { goal: "maintenance" as GuidedGoal, strategy: "recovery_review" as GuidedStrategy,
        label: "Consolidar resultados e revisar recuperação",
        reason: "Estratégia alternativa quando o objetivo não está claro. Não assume fadiga nem reduz a prescrição automaticamente." },
      { goal: "strength" as GuidedGoal, strategy: "consolidate" as GuidedStrategy,
        label: "Priorizar força com revisão técnica",
        reason: "Pode ser selecionada se este for seu interesse; a auditoria não presume essa meta a partir das cargas." },
    ];
  }, [assessment]);

  const generate = useCallback(async (programId: string, goal: GuidedGoal, strategy: GuidedStrategy) => {
    if (!athleteId || !versionId || assessment.sourceVersionId !== versionId || error)
      throw new Error("A auditoria precisa estar disponível antes da geração.");
    setGenerating(true);
    try {
      const { error: rpcError } = await supabase.rpc("health_cch_generate_guided_cycle" as never, {
        p_program_id: programId, p_goal: goal, p_strategy: strategy, p_availability: "flexible",
      } as never);
      if (rpcError) throw new Error(rpcError.message);
    } finally { setGenerating(false); }
  }, [athleteId, versionId, assessment.sourceVersionId, error]);

  return { assessment, loading, error, generating, recommendations, refresh, generate };
}
