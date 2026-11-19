export function validIncrement(value:number,label:string,unit:string) {
 return Number.isFinite(value)&&value>0&&value<=100&&label.trim().length>=2&&label.trim().length<=100&&["kg","lb"].includes(unit);
}
export type Volume={version_number:number;muscle_id:string;observed_per_7_days:number|null};
export function compareVolume(rows:Volume[]) {
 const by=new Map<string,Volume[]>();
 for(const row of rows){if(row.observed_per_7_days===null)continue;by.set(row.muscle_id,[...(by.get(row.muscle_id)||[]),row]);}
 return [...by].map(([muscleId,list])=>{
 const ordered=list.sort((a,b)=>a.version_number-b.version_number);
 const a=ordered.at(-2),b=ordered.at(-1)!;
 return {muscleId,versions:ordered.length,trend:!a?"insufficient":b.observed_per_7_days!>a.observed_per_7_days!?"more_observed":b.observed_per_7_days!<a.observed_per_7_days!?"less_observed":"stable_observed",
 note:"A contagem observada nao demonstra tolerancia ou resposta hipertrofica."};
 });
}
export function reviewPhase(versions:{sessions:number}[],dataQuality:string) {
 return {phase:versions.filter(v=>v.sessions>0).length>=2&&dataQuality==="reviewable"?"multi_cycle_review":"consolidate_and_collect",reviewAfterSessions:3,autoPublish:false};
}