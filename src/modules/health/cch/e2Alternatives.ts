export type ExerciseRef={id:string;exercise_id:string;session_template_id:string;sequence_order:number};
export type Equivalence={source_exercise_id:string;target_exercise_id:string;equivalence_type:string;confidence:string};
export type Muscle={exercise_id:string;muscle_group_id:string;role:string};
export type Alternative={targetId:string;equivalenceType:string;confidence:string;isProvisional:boolean;reason:string};
export function alternativesE2(sourceId:string,relations:Equivalence[],muscles:Muscle[],activeIds:string[]):Alternative[]{
 const active=new Set(activeIds);
 const primary=new Set(muscles.filter(x=>x.exercise_id===sourceId&&x.role==="primary").map(x=>x.muscle_group_id));
 if(primary.size===0)return [];
 return relations.filter(x=>x.source_exercise_id===sourceId&&x.target_exercise_id!==sourceId&&active.has(x.target_exercise_id))
 .filter(x=>muscles.some(m=>m.exercise_id===x.target_exercise_id&&m.role==="primary"&&primary.has(m.muscle_group_id)))
 .map(x=>({targetId:x.target_exercise_id,equivalenceType:x.equivalence_type,confidence:x.confidence,
   isProvisional:x.confidence!=="confirmed",reason:"Equivalência de catálogo não comprova mesma execução, equipamento ou tolerância; confirmar antes de substituir."}));
}
export function adjacentSwapE2(items:ExerciseRef[],currentId:string,direction:"up"|"down"){
 const source=items.find(x=>x.id===currentId);if(!source)return null;
 const ordered=[...items].filter(x=>x.session_template_id===source.session_template_id).sort((a,b)=>a.sequence_order-b.sequence_order);
 const index=ordered.findIndex(x=>x.id===currentId);
 const other=ordered[index+(direction==="up"?-1:1)];
 if(!other || Math.abs(other.sequence_order-source.sequence_order)!==1)return null;
 return {currentId:source.id,otherId:other.id,from:source.sequence_order,to:other.sequence_order,
 reason:"A mudança de ordem deve considerar fadiga, prioridade muscular e equipamento; não presume benefício fisiológico."};
}
