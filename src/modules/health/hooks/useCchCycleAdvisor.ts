import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GuidedGoal = "hypertrophy" | "strength" | "maintenance" | "fat_loss" | "muscle_priority";
export type GuidedStrategy = "continue_progression" | "consolidate" | "recovery_review";
export type ExerciseEvidence = {
  template_exercise_id: string; exercise_id: string; session_code: string;
  decision: "progress_candidate" | "maintain" | "review" | "insufficient"; reason: string;
  exposures: number; load_value: number | null; load_unit: string | null;
  previous_best_reps: number | null; latest_best_reps: number | null; latest_min_rir: number | null;
};
export type Assessment = {
  engine_version: string; source_version_id: string; completed_sessions: number;
  completed_sets: number; measured_sets: number;
  exercise_assessments: ExerciseEvidence[];
  training_profile: { training_level?: string; overall_data_confidence?: string } | null;
  recovery_context: { as_of_date?: string; confidence?: string; recovery_observed_days?: number; fatigue_observed_days?: number } | null;
  limitations: string[];
};
const empty: Assessment = {
  engine_version: "cch-guided-v2",source_version_id: "",completed_sessions: 0,completed_sets: 0,
  measured_sets: 0,exercise_assessments: [],training_profile: null,recovery_context: null,limitations: [],
};
export const guidedGoals: Array<{ value: GuidedGoal; label: string }> = [
  {value:"hypertrophy",label:"Hipertrofia e desenvolvimento muscular"},
  {value:"strength",label:"Força e desempenho"},
  {value:"maintenance",label:"Manutenção e recuperação"},
  {value:"fat_loss",label:"Reduzir gordura preservando músculos"},
  {value:"muscle_priority",label:"Priorizar grupos musculares específicos"},
];
export const guidedStrategies: Array<{ value: GuidedStrategy; label: string; detail: string }> = [
  {value:"continue_progression",label:"Continuidade com progressão orientada",
    detail:"Usar evidências comparáveis para sugerir pequenos ajustes. Não presume aumento de cargas."},
  {value:"consolidate",label:"Consolidar desempenho e técnica",
    detail:"Preservar prescrições para revisão sem progressões baseadas em dados insuficientes."},
  {value:"recovery_review",label:"Reavaliar estímulos e recuperação",
    detail:"Apresentar a recuperação como contexto, sem reduzir automaticamente o treino."},
];
export function useCchCycleAdvisor(athleteId: string | null | undefined, versionId: string | null | undefined, programId?: string | null) {
  const [assessment,setAssessment]=useState<Assessment>(empty);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string | null>(null);
  const [generating,setGenerating]=useState(false);

  const refresh=useCallback(async()=>{
    if(!athleteId||!versionId||!programId){setAssessment(empty);setError(null);return;}
    setLoading(true);setError(null);
    try{
      const result=await supabase.rpc("health_cch_assess_cycle" as never, {p_program_id:programId} as never);
      if(result.error)throw new Error(result.error.message);
      const data=result.data as unknown as Assessment;
      if(!data || data.source_version_id!==versionId)throw new Error("Versão da auditoria divergente do programa.");
      setAssessment(data);
    }catch(cause){setError(cause instanceof Error?cause.message:"Auditoria indisponível");setAssessment(empty);}
    finally{setLoading(false);}
  },[athleteId,versionId,programId]);
  useEffect(()=>{void refresh()},[refresh]);

  const recommendations=useMemo(()=>{
    const candidates=assessment.exercise_assessments.filter(e=>e.decision==="progress_candidate").length;
    const reviews=assessment.exercise_assessments.filter(e=>e.decision==="review").length;
    const enough=assessment.completed_sessions>=2 && assessment.completed_sets>=6;
    return [
      {goal:"hypertrophy" as GuidedGoal,strategy:"continue_progression" as GuidedStrategy,
        label:"Continuar hipertrofia com ajustes seletivos",
        reason:enough? `${candidates} prescrições com evidência para possível ajuste de repetições; ${reviews} pedem revisão. A escolha não altera cargas automaticamente.`:
          "Há poucos dados válidos para propor mudanças. A continuidade pode manter o estímulo atual."},
      {goal:"maintenance" as GuidedGoal,strategy:"recovery_review" as GuidedStrategy,
        label:"Consolidar resultados e observar recuperação",
        reason:assessment.recovery_context ?
          "Há contexto recente de recuperação, que precisa ser interpretado junto da sua percepção atual.":
          "Não há contexto recente suficiente de recuperação; o CCH não presumirá fadiga."},
      {goal:"strength" as GuidedGoal,strategy:"consolidate" as GuidedStrategy,
        label:"Considerar um ciclo de força",
        reason:"Opção disponível se for a sua prioridade; nesta versão exige revisão da prescrição, sem converter automaticamente cargas."},
    ];
  },[assessment]);
  const generate=useCallback(async(program:string,goal:GuidedGoal,strategy:GuidedStrategy)=>{
    if(!athleteId||!versionId||assessment.source_version_id!==versionId||error)throw new Error("Auditoria atual válida obrigatória.");
    setGenerating(true);
    try{
      const result=await supabase.rpc("health_cch_generate_guided_cycle" as never,
        {p_program_id:program,p_goal:goal,p_strategy:strategy,p_availability:"flexible"} as never);
      if(result.error)throw new Error(result.error.message);
    }finally{setGenerating(false);}
  },[athleteId,versionId,assessment.source_version_id,error]);
  return {assessment,loading,error,generating,recommendations,refresh,generate};
}
