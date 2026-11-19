import { useCallback,useEffect,useState } from "react";

const A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EXA="cccccccc-1000-4000-8000-cccccccccccc";
const EXB="cccccccc-2000-4000-8000-cccccccccccc";
const EXC="cccccccc-4000-4000-8000-cccccccccccc";
const MUSCLE="eeeeeeee-1000-4000-8000-eeeeeeeeeeee";
const athletes=[{id:A,training_level:"advanced"}];
export type GuidedGoal="hypertrophy"|"strength"|"maintenance"|"fat_loss"|"muscle_priority";
export type GuidedStrategy="continue_progression"|"consolidate"|"recovery_review";
export const guidedGoals=[
 {value:"hypertrophy",label:"Hipertrofia e desenvolvimento muscular"},
 {value:"strength",label:"Força e desempenho"},
 {value:"maintenance",label:"Manutenção e recuperação"},
 {value:"fat_loss",label:"Reduzir gordura preservando músculos"},
 {value:"muscle_priority",label:"Priorizar grupos musculares específicos"}
];
export const guidedStrategies=[
 {value:"continue_progression",label:"Continuidade com progressão orientada",detail:"Somente proposta revisável"},
 {value:"consolidate",label:"Consolidar desempenho e técnica",detail:"Sem progressão obrigatória"},
 {value:"recovery_review",label:"Reavaliar recuperação",detail:"Sem ajustes automáticos"}
];

async function api(path:string, method="GET",body?:unknown){
 const result=await fetch("/api/"+path,{method,credentials:"same-origin",
  headers:{"content-type":"application/json"},
  body:body===undefined?undefined:JSON.stringify(body)});
 const response=await result.json();
 if(!result.ok)throw new Error(response.error??"Falha no laboratório isolado");
 return response;
}
type Fixture={program:Record<string,unknown>|null;version:Record<string,unknown>|null;
 templates:Array<Record<string,unknown>>;templateExercises:Array<Record<string,unknown>>;
 queue:Array<Record<string,unknown>>;priorities:Array<Record<string,unknown>>};
const initial:Fixture={program:null,version:null,templates:[],templateExercises:[],queue:[],priorities:[]};
export function useHealthAthlete(){
 const [athlete,setAthlete]=useState<{id:string}|null>(null);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{void api("session").then(data=>{setAthlete(data.athlete);setLoading(false);})
 .catch(()=>setLoading(false));},[]);
 return {athlete,loading};
}
export function useHealthProgramM3(athleteId?:string|null){
 const [state,setState]=useState<Fixture>(initial);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const reload=useCallback(async()=>{
  if(!athleteId){setState(initial);setLoading(false);return;}
  setLoading(true);
  try{setState(await api("state"));setError(null);}
  catch(cause){setError(String(cause));}
  finally{setLoading(false);}
 },[athleteId]);
 useEffect(()=>{void reload();},[reload]);
 const mutate=useCallback(async(path:string,body:unknown)=>{
   setSaving(true);
   try{await api(path,"POST",body);await reload();}
   finally{setSaving(false);}
 },[reload]);
 const updatePrescription=useCallback(async(id:string,patch:Record<string,unknown>,reason:string)=>{
   const current=state.templateExercises.find(x=>x.id===id);
   if(!current||state.version?.status!=="draft")throw new Error("Somente rascunho ativo");
   const keys=["planned_sets_min","planned_sets_max","reps_min","reps_max","rir_target","rest_seconds"];
   const before=Object.fromEntries(keys.map(key=>[key,
     current[key]===undefined||current[key]===null?null:Number(current[key])]));
   await mutate("edit",{id,versionId:state.version.id,before,after:patch,reason});
 },[state,mutate]);
 const editExerciseStructure=useCallback(async(id:string,operation:"replace"|"swap",reason:string,other?:string,replacement?:string)=>{
   await mutate("structure",{id,operation,reason,other,replacement});
 },[mutate]);
 const publish=useCallback(async()=>{if(!state.version)throw Error("Sem versão");await mutate("publish",{versionId:state.version.id});},[mutate,state.version]);
 const queueByTemplate=state.queue.map(entry=>({...entry,template:state.templates.find(t=>t.id===entry.session_template_id)??null}));
 return {...state,isDraft:state.version?.status==="draft",cycleComplete:false,queueByTemplate,loading,saving,error,reload,
  updatePrescription,editExerciseStructure,publish,
  createProgram:async()=>{throw Error("Fora do escopo do laboratório");},
  addTemplate:async()=>{throw Error("Fora do escopo");},
  addExercise:async()=>{throw Error("Fora do escopo");},
  addPriority:async()=>{throw Error("Fora do escopo");},
  prepareNextCycle:async()=>{throw Error("Fora do escopo");}
 };
}
export function useHealthCatalogs(){
 const muscles=[{id:MUSCLE,name:"Peitoral",slug:"chest"}];
 const exercises=[
  {id:EXA,name:"Supino máquina A",is_active:true,muscles:[{muscle_group_id:MUSCLE,role:"primary"}],
    equivalences:[{target_exercise_id:EXB,equivalence_type:"same_primary_muscle",confidence:"provisional"}]},
  {id:EXB,name:"Supino máquina B",is_active:true,muscles:[{muscle_group_id:MUSCLE,role:"primary"}],equivalences:[]},
  {id:EXC,name:"Exercício acessório",is_active:true,muscles:[],equivalences:[]}
 ];
 return {exercises,muscles,loading:false,error:null};
}
export function useHealthTrainingProfileF22(){
 return {profile:{training_level:"advanced",baseline_state:"partial",overall_data_confidence:"low",
   calibration_policy:"non_limiting"},exerciseSummary:{established:2,collecting:0,observedSets:15},
   loading:false,available:true};
}
export function useHealthLongitudinalReviewF13(){return {run:null,error:null,loading:false};}
export function useHealthReplanningF14(){return {currentCase:null,error:null,loading:false};}
export function useCchCycleAdvisor(){
 const assessment={
  engine_version:"synthetic-cch-v10",source_version_id:"aaaaaaaa-2000-4000-8000-aaaaaaaaaaaa",
  completed_sessions:4,completed_sets:12,measured_sets:11,training_profile:{training_level:"advanced"},
  exercise_assessments:[],recovery_context:{recovery_observed_days:4,fatigue_observed_days:4},
  data_quality:{status:"reviewable",completeness_ratio:0.95},
  equipment_provenance:{engine_version:"cch-equipment-v8",historical_unidentified_sessions_are_ineligible:true,
   evidence:[{exercise_id:EXA,equipment_label:"Supino máquina A",load_unit:"kg",exposures:4,
    candidate_load:82.5,reason:"Identificação fictícia confirmada"}]},
  execution_coverage:{engine_version:"cch-execution-v10",exercise_metrics:[
   {exercise_id:EXA,exposures:4,completed_sets:12,sets_with_reps:12,sets_with_rir:12,
   reps_comparable:12,reps_in_range:11,reps_below_range:0,reps_above_range:1,
   rir_comparable:12,rir_below_plan:0,rir_at_or_above_plan:12,interpretation:"reviewable_execution"}]},
  limitations:["Dados 100% sintéticos para verificação visual isolada"],
  periodization_decision:{phase:"selective_progression_review",completed_versions:2,
   recovery_context_sufficient:true,negative_performance_signals:0,review_after_completed_sessions:3},
  muscle_volume_response_review:[],load_trends:[],multi_cycle_versions:[],
  multi_cycle_volume:[],frequency_context:{completed_sessions:4,span_days:30},
  next_review:{after_completed_sessions:3},data_gaps:[],periodization_options:[],
 };
 return {assessment,loading:false,error:null,generating:false,recommendations:[],
   saveIncrement:async()=>{throw Error("Fora do laboratório");},
   generate:async()=>{throw Error("Não gerar treino real em homologação");},
   refresh:async()=>{}};
}

export function useHealthE3ReadOnly(){
 return {observations:[],totalValidSessions:0,uncategorizedSessions:0,missingWorkingSetData:0,
 sourceTruncated:false,loading:false,error:null,reload:async()=>{}};
}
