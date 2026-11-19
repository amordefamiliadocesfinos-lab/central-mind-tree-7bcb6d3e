/** CCH FROZEN E2: pure, review-only per-exercise proposal. */
export type Prescription={id:string;exercise_id:string;session_template_id:string;planned_sets_min:number|null;planned_sets_max:number|null;reps_min:number|null;reps_max:number|null;rir_target:number|null;rest_seconds:number|null};
export type Execution={exercise_id:string;exposures:number;completed_sets:number;sets_with_rir:number;reps_comparable:number;reps_in_range:number;reps_below_range:number};
export type Machine={exercise_id:string;equipment_label:string;load_unit:string;exposures:number;candidate_load:number|null};
export type Context={sourceMatches:boolean;quality:"limited"|"partial"|"reviewable";recovery:"good"|"poor"|"unknown";pain:"none"|"pain"|"unknown";negativeSignals:number;goal:string;strategy:string};
export type Proposal={id:string;before:Prescription;after:Prescription;decision:"maintain"|"review"|"candidate";reason:string;confidence:"insufficient"|"conditional";machine:string|null;requiresReview:true;canPublish:false};
export function proposePrescriptionE2(items:Prescription[],executions:Execution[],machines:Machine[],context:Context):Proposal[]{
 const metrics=new Map(executions.map(x=>[x.exercise_id,x]));
 return items.map(item=>{
  const m=metrics.get(item.exercise_id);
  const matches=machines.filter(x=>x.exercise_id===item.exercise_id);
  const verified=matches.length===1&&matches[0].exposures>=3&&matches[0].candidate_load!==null?matches[0]:null;
  const complete=[item.planned_sets_min,item.planned_sets_max,item.reps_min,item.reps_max,item.rest_seconds]
    .every(x=>x!==null&&Number.isInteger(x)&&x>0)&&item.rir_target!==null&&
    item.rir_target>=0&&item.rir_target<=6&&item.planned_sets_max!>=item.planned_sets_min!&&
    item.reps_max!>=item.reps_min!;
  const adequate=!!m&&m.exposures>=3&&m.completed_sets>=6&&m.reps_comparable>=6&&
    m.sets_with_rir/m.completed_sets>=0.75&&m.reps_in_range/m.reps_comparable>=0.8&&m.reps_below_range===0;
  const safe=context.sourceMatches&&context.quality==="reviewable"&&context.recovery==="good"&&
    context.pain==="none"&&context.negativeSignals===0;
  const eligible=complete&&safe&&adequate&&!!verified&&context.goal==="hypertrophy"&&
    context.strategy==="continue_progression"&&item.reps_max!<100;
  let decision:Proposal["decision"]="maintain";
  let reason="Prescrição conservada; histórico não sustenta mudança numérica individualizada.";
  if(!complete){decision="review";reason="Prescrição incompleta ou inconsistente: corrigir manualmente.";}
  else if(m&&m.reps_comparable>=4&&m.reps_below_range>m.reps_in_range){
    decision="review";reason="Séries abaixo da faixa predominam: revisar contexto e técnica antes de intensificar.";
  }else if(!context.sourceMatches){decision="review";reason="Auditoria não corresponde à versão publicada de origem.";}
  else if(context.pain!=="none"||context.recovery!=="good"||context.negativeSignals>0){
    decision="review";reason="Recuperação, sintomas ou sinais de desempenho pedem revisão.";
  }else if(eligible){decision="candidate";reason="Mesma máquina confirmada, desempenho e RIR comparáveis e recuperação favorável: considerar +1 repetição no teto, após revisão.";}
  else if(!verified){reason="Máquina e incremento não comprovados na execução; não inferir progressão.";}
  else if(!adequate){reason="Exposições, repetições ou RIR insuficientes para recomendar progressão.";}
  return {id:item.id,before:{...item},after:eligible?{...item,reps_max:item.reps_max!+1}:{...item},
    decision,reason,confidence:eligible?"conditional":"insufficient",machine:verified?`${verified.equipment_label} (${verified.load_unit})`:null,
    requiresReview:true,canPublish:false};
 });
}
