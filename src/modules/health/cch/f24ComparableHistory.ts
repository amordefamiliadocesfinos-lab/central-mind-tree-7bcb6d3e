/** F24 G2: conservative reference from actual F21/M4 sessions.
 * Same exercise AND explicitly confirmed identical equipment are required.
 * This is a displayed fact, never an automatic load recommendation.
 */
export type F24HistoryRow = {
  sessionId:string;
  sessionStartedAt:string;
  workoutExerciseId:string;
  exerciseId:string;
  equipmentLabel:string|null;
  loadValue:number|null;
  loadUnit:string|null;
  reps:number|null;
  rir:number|null;
  completedAt:string|null;
};
export type F24HistoryReference = {
  sessionId:string;
  occurredAt:string;
  equipmentLabel:string;
  loadValue:number;
  loadUnit:"kg"|"lb";
  reps:number;
  rir:number|null;
};
const normalized=(value:string|null|undefined)=>(value??"").trim().toLocaleLowerCase("pt-BR");
export function selectF24ComparableHistory(
  exerciseId:string,
  currentConfirmedEquipment:string|null,
  rows:F24HistoryRow[]
):F24HistoryReference|null {
  if(!exerciseId||!normalized(currentConfirmedEquipment))return null;
  const comparable=rows.filter(row=>
    row.exerciseId===exerciseId &&
    normalized(row.equipmentLabel)===normalized(currentConfirmedEquipment) &&
    Number.isFinite(row.loadValue)&&row.loadValue!==null&&row.loadValue>=0 &&
    (row.loadUnit==="kg"||row.loadUnit==="lb") &&
    Number.isInteger(row.reps)&&row.reps!==null&&row.reps>0 &&
    Number.isFinite(Date.parse(row.sessionStartedAt)) &&
    Number.isFinite(Date.parse(row.completedAt??""))
  ).sort((a,b)=>
    Date.parse(b.sessionStartedAt)-Date.parse(a.sessionStartedAt) ||
    Date.parse(b.completedAt!)-Date.parse(a.completedAt!) ||
    a.sessionId.localeCompare(b.sessionId)
  );
  const chosen=comparable[0];
  if(!chosen)return null;
  return {sessionId:chosen.sessionId,occurredAt:chosen.sessionStartedAt,
    equipmentLabel:chosen.equipmentLabel!.trim(),loadValue:chosen.loadValue!,
    loadUnit:chosen.loadUnit as "kg"|"lb",reps:chosen.reps!,rir:chosen.rir};
}
