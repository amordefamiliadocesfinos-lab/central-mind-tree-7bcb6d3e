export type GoalV9="hypertrophy"|"strength"|"maintenance"|"fat_loss"|"muscle_priority";
export type StrategyV9="continue_progression"|"consolidate"|"recovery_review";
export type AssessmentV9={
  data_quality?:{status?:"limited"|"partial"|"reviewable"}|null;
  periodization_decision?:{phase?:string;completed_versions?:number;recovery_context_sufficient?:boolean;negative_performance_signals?:number}|null;
  equipment_provenance?:{evidence?:Array<{candidate_load?:number|null;exposures?:number}>}|null;
  exercise_assessments?:Array<{decision?:string}>|null;
  muscle_volume_response_review?:Array<{comparable_versions?:number;observation?:string}>|null;
  data_gaps?:string[]|null;
};
export type StrategyOptionV9={goal:GoalV9;strategy:StrategyV9;label:string;reason:string;level:"supported"|"conditional"|"preference";automaticChange:boolean};
export type DecisionProfileV9={
  phase:"review_recovery"|"review_performance"|"selective_review"|"consolidate_evidence";
  confidence:"limited"|"partial"|"reviewable";
  blockers:string[];
  equipmentCandidates:number;
  volumeComparableGroups:number;
  options:StrategyOptionV9[];
  reviewAfterCompletedSessions:number;
};
export function evaluateV9(a:AssessmentV9, recovery:"good"|"poor"|"unknown",symptoms:"none"|"pain"|"unknown"):DecisionProfileV9{
 const confidence=a.data_quality?.status??"limited";
 const negative=a.periodization_decision?.negative_performance_signals??0;
 const verified=(a.equipment_provenance?.evidence??[]).filter(e=>typeof e.candidate_load==="number" && Number.isFinite(e.candidate_load) && (e.exposures??0)>=3).length;
 const volume=(a.muscle_volume_response_review??[]).filter(e=>(e.comparable_versions??0)>=2).length;
 const recoveryCovered=a.periodization_decision?.recovery_context_sufficient===true;
 const blockers:string[]=[];
 if(symptoms==="pain")blockers.push("Dor que interfere no treino: revisar antes de intensificar");
 if(symptoms==="unknown")blockers.push("Desconforto não avaliado");
 if(recovery==="poor")blockers.push("Recuperação atual insuficiente");
 if(recovery==="unknown")blockers.push("Recuperação atual não informada");
 if(negative>0)blockers.push(`${negative} tendência(s) desfavoráveis exigem interpretação`);
 if(confidence!=="reviewable")blockers.push("Histórico com confiança "+confidence+"; não altera nível do praticante");
 if(!recoveryCovered)blockers.push("Cobertura longitudinal de recuperação limitada");
 const phase:DecisionProfileV9["phase"]=symptoms==="pain"||recovery==="poor"?"review_recovery":
 negative>0?"review_performance":
 confidence==="reviewable"&&recovery==="good"&&symptoms==="none"&&recoveryCovered?"selective_review":"consolidate_evidence";
 const options:StrategyOptionV9[]=[
 {goal:"hypertrophy",strategy:phase==="selective_review"?"continue_progression":"consolidate",
 label:"Hipertrofia com continuidade ajustável",
 reason:phase==="selective_review"?"Há evidência para revisar progressões seletivas; não equivale a autorizar carga ou volume automáticos.":"Manter a base e coletar comparações confiáveis antes de alterar dose.",
 level:phase==="selective_review"?"supported":"conditional",automaticChange:false},
 {goal:"strength",strategy:"consolidate",label:"Foco de força",
 reason:verified?`${verified} carga(s) candidatas em equipamentos identificados; confirmar técnica e revisão antes de alterar.`:
 "Ainda não há cargas candidatas comprovadas por máquina e unidade.",level:verified?"conditional":"preference",automaticChange:false},
 {goal:"muscle_priority",strategy:"consolidate",label:"Priorizar um músculo",
 reason:volume?`${volume} grupo(s) com volumes comparáveis entre versões; comparar também recuperação e desempenho antes de redistribuir.`:
 "Prioridade escolhida pelo atleta; o histórico não demonstra dose ótima por músculo.",level:"preference",automaticChange:false},
 {goal:"maintenance",strategy:phase==="review_recovery"?"recovery_review":"consolidate",label:"Consolidar e acompanhar recuperação",
 reason:phase==="review_recovery"?"Rever sintomas e recuperação antes de aumentar a demanda.":"Preservar estímulos úteis, monitorando resposta individual.",level:"supported",automaticChange:false},
 {goal:"fat_loss",strategy:"consolidate",label:"Manter musculação durante objetivo de composição corporal",
 reason:"A necessidade de perder gordura não é inferida do treino; requer objetivo corporal e contexto nutricional.",level:"preference",automaticChange:false}
 ];
 return {phase,confidence,blockers,equipmentCandidates:verified,volumeComparableGroups:volume,options,reviewAfterCompletedSessions:3};
}
