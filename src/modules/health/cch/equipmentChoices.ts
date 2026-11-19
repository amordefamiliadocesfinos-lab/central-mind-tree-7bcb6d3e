/** CCH frozen E2: derive selectable equipment from explicit V8 confirmations only. */
export type ConfirmedEquipmentEvidence = {
 exercise_id:string;equipment_label:string;load_unit:string;
 exposures:number;candidate_load:number|null;
};
export type EquipmentChoice={
 key:string;exerciseId:string;label:string;unit:"kg"|"lb";exposures:number;
};
export function confirmedEquipmentChoices(evidence:ConfirmedEquipmentEvidence[] | null | undefined):EquipmentChoice[]{
 const unique=new Map<string,EquipmentChoice>();
 for(const row of evidence??[]){
  const label=typeof row.equipment_label==="string"?row.equipment_label.trim():"";
  if(!row.exercise_id||label.length<2||label.length>100||
   !["kg","lb"].includes(row.load_unit)||!Number.isFinite(row.exposures)||row.exposures<1)continue;
  const key=JSON.stringify([row.exercise_id,label,row.load_unit]);
  const previous=unique.get(key);
  if(!previous||previous.exposures<row.exposures){
    unique.set(key,{key,exerciseId:row.exercise_id,label,unit:row.load_unit as "kg"|"lb",
      exposures:row.exposures});
  }
 }
 return [...unique.values()].sort((a,b)=>
   a.exerciseId.localeCompare(b.exerciseId)||a.label.localeCompare(b.label)||a.unit.localeCompare(b.unit));
}
