/** UI mirror of the F22 structural publication gate; server remains authoritative. */
export type GateTemplate={id:string;status:string};
export type GateExercise={
 session_template_id:string;is_optional:boolean;
 planned_sets_min:number|null;planned_sets_max:number|null;
 reps_min:number|null;reps_max:number|null;
 rir_target:number|null;rest_seconds:number|null;
};
export function assessDraftPublicationStructure(templates:GateTemplate[],exercises:GateExercise[]){
 const active=templates.filter(t=>t.status==="active");
 const activeIds=new Set(active.map(t=>t.id));
 const activeExercises=exercises.filter(e=>activeIds.has(e.session_template_id));
 const incompleteRequiredExercises=activeExercises.filter(e=>!e.is_optional&&(
   e.planned_sets_min===null||e.planned_sets_max===null||
   e.reps_min===null||e.reps_max===null||
   e.rir_target===null||e.rest_seconds===null||
   e.planned_sets_min<1||e.planned_sets_max<e.planned_sets_min||
   e.reps_min<1||e.reps_max<e.reps_min||
   e.rir_target<0||e.rir_target>6||e.rest_seconds<=0
 ));
 const templatesWithoutExercises=active.filter(t=>
   !activeExercises.some(e=>e.session_template_id===t.id));
 return {activeTemplateCount:active.length,incompleteRequiredExercises,
   templatesWithoutExercises,publicationReady:active.length>0&&
   incompleteRequiredExercises.length===0&&templatesWithoutExercises.length===0};
}
