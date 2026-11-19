import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RecoveryReport, SymptomReport } from "../cch/cycleDecisionModel";

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
  muscle_distribution?: Array<{muscle_group_id:string;muscle_name:string;planned_min_sets_per_sequence:number;recorded_work_sets:number;planned_exercises:number;note:string;observed_sets_per_7_days?:number|null;normalization_available?:boolean}>;
  frequency_context?: {completed_sessions:number;span_days:number|null;first_completed_at:string|null;last_completed_at:string|null};
  recovery_evidence_state?: "unknown" | "limited_coverage" | "observed_needs_interpretation";
  goal_specific_guidance?: Record<GuidedGoal,string>;
  load_trends?: Array<{exercise_id:string;load_unit:string;exposures:number;recent_peak_load:number|null;prior_peak_load:number|null;recent_best_reps:number|null;prior_best_reps:number|null;recent_rir:number|null;signal:string;reason:string}>;
  periodization_options?: Array<{stage:string;description:string}>;
  data_quality?: {status:"limited"|"partial"|"reviewable";observed_sessions:number;completed_work_sets:number;
    fully_measured_sets:number;completeness_ratio:number;comparable_exercise_units:number;
    training_level_is_independent_of_quality:boolean};
  data_gaps?: string[];
  strategy_options?: Array<{goal:GuidedGoal;strategy:GuidedStrategy;reason:string}>;
  next_review?: {after_completed_sessions:number;also_on:string;schedule_mode:string};
  equipment_load_candidates?: Array<{exercise_id:string;equipment_label:string|null;unit:string;increment:number|null;observed_load:number|null;candidate_load:number|null;reason:string}>;
  multi_cycle_versions?: Array<{version_id:string;version_number:number;sessions:number}>;
  multi_cycle_volume?: Array<{version_number:number;muscle_id:string;muscle_name:string;work_sets:number;sessions:number;observed_per_7_days:number|null;note:string}>;
  periodization_mode?: string;
  execution_coverage?: {engine_version:string;exercise_metrics:Array<{exercise_id:string;exposures:number;completed_sets:number;sets_with_reps:number;sets_with_rir:number;reps_comparable:number;reps_in_range:number;reps_below_range:number;reps_above_range:number;rir_comparable:number;rir_below_plan:number;rir_at_or_above_plan:number;interpretation:string}>};
  muscle_volume_response_review?: Array<{muscle_id:string;muscle_name:string;comparable_versions:number;recent_observed_sets_per_7_days:number|null;previous_observed_sets_per_7_days:number|null;observation:string;inference:string}>;
  periodization_decision?: {phase:string;completed_versions:number;recovery_context_sufficient:boolean;negative_performance_signals:number;review_after_completed_sessions:number};
  equipment_provenance?: {engine_version:string;historical_unidentified_sessions_are_ineligible:boolean;
    evidence:Array<{exercise_id:string;equipment_label:string;load_unit:string;exposures:number;
      recent_load:number;recent_reps:number;candidate_load:number|null;reason:string}>};
};
const empty: Assessment = {
  engine_version: "cch-guided-v5",source_version_id: "",completed_sessions: 0,completed_sets: 0,
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
      const result=await supabase.rpc("health_cch_assess_cycle_v10" as never, {p_program_id:programId} as never);
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
    const trainedGroups=assessment.muscle_distribution?.length ?? 0;
    const recovery=assessment.recovery_evidence_state ?? "unknown";
    const confidence=assessment.data_quality?.status ?? "limited";
    const gaps=assessment.data_gaps?.length ?? 0;
    const suggestions = [
      {goal:"hypertrophy" as GuidedGoal,strategy:"continue_progression" as GuidedStrategy,
        label:"Continuar hipertrofia com ajustes seletivos",
        reason:enough? `${candidates} propostas de repetição, ${reviews} exercícios para revisão; confiança de dados ${confidence}. Existem ${gaps} lacunas identificadas, sem alterar seu nível de experiência.`:
          "Dados ainda limitados para progressões; o CCH preserva a prescrição como base para revisão."},
      {goal:"maintenance" as GuidedGoal,strategy:"recovery_review" as GuidedStrategy,
        label:"Consolidar resultados e observar recuperação",
        reason:recovery==="observed_needs_interpretation" ?
          "Existem observações recentes de recuperação e fadiga; confirme como está se sentindo antes de rever estímulos." :
          "A cobertura de recuperação está ausente ou limitada; o CCH não presumirá fadiga nem reduzirá seu treino."},
      {goal:"strength" as GuidedGoal,strategy:"consolidate" as GuidedStrategy,
        label:"Considerar foco de força",
        reason:`Foram avaliadas ${assessment.load_trends?.length ?? 0} tendências por exercício/unidade. Aumento de carga exige conferir equipamento, técnica e recuperação; a proposta não inventa kg.`},
      {goal:"muscle_priority" as GuidedGoal,strategy:"consolidate" as GuidedStrategy,
        label:"Reorganizar prioridades musculares",
        reason:`${trainedGroups} grupos musculares possuem distribuição observada. Escolha qual deseja priorizar antes de gerar a proposta.`},
      {goal:"fat_loss" as GuidedGoal,strategy:"consolidate" as GuidedStrategy,
        label:"Manter musculação enquanto define objetivo corporal",
        reason:"A execução do treino não demonstra, sozinha, necessidade de perder gordura; exige escolha consciente e contexto nutricional/corporal."},
    ];
    // An athlete with sparse records is not a beginner; recommend consolidation
    // first only because prescription evidence is limited, never because of athlete level.
    return confidence==="limited" ?
      [...suggestions].sort((left,right) => Number(right.goal==="maintenance")-Number(left.goal==="maintenance")) :
      suggestions;
  },[assessment]);
  const generate=useCallback(async(program:string,goal:GuidedGoal,strategy:GuidedStrategy,priorityMuscleId?:string,allowTargetedSets=false,recovery:RecoveryReport="unknown",symptoms:SymptomReport="unknown")=>{
    if(!athleteId||!versionId||assessment.source_version_id!==versionId||error)throw new Error("Auditoria atual válida obrigatória.");
    setGenerating(true);
    try{
      const result=await supabase.rpc("health_cch_generate_guided_cycle_v10" as never,
        {p_program_id:program,p_goal:goal,p_strategy:strategy,p_availability:"flexible",
          p_priority_muscle_id:priorityMuscleId || null,p_allow_targeted_set_proposal:allowTargetedSets,
          p_recovery_report:recovery,p_symptom_report:symptoms} as never);
      if(result.error)throw new Error(result.error.message);
    }finally{setGenerating(false);}
  },[athleteId,versionId,assessment.source_version_id,error]);
  const saveIncrement=useCallback(async(exerciseId:string,label:string,unit:string,increment:number)=>{
    if(!athleteId)throw new Error("Atleta indisponível");
    const result=await supabase.rpc("health_cch_save_load_increment" as never,
      {p_athlete_id:athleteId,p_exercise_id:exerciseId,p_equipment_label:label,
        p_load_unit:unit,p_increment:increment} as never);
    if(result.error)throw new Error(result.error.message);
    await refresh();
  },[athleteId,refresh]);
  return {assessment,loading,error,generating,recommendations,refresh,generate,saveIncrement};
}
