/** CCH E5-A — pure longitudinal evidence gate on M3/M4/F13/F14/F21/F22.
 * This is a descriptive safety check, not a second prescription engine.
 * No athlete lookup, database write, dose optimization or publication.
 */
import type {RecoveryReport,SymptomReport} from "./cycleDecisionModel";

export type E5Observation={
 id:string; athleteId:string; programVersionId:string; sessionId:string;
 exerciseId:string; equipmentId:string|null; loadUnit:"kg"|"lb"|null;
 occurredAt:string|null; completed:boolean; voided:boolean;
 workingSets:number|null; reps:number|null; rir:number|null; load:number|null;
 recovery:RecoveryReport; symptoms:SymptomReport;
};
export type E5Context={
 athleteId:string; sourceVersionId:string|null;
 exerciseId:string; equipmentId:string|null; loadUnit:"kg"|"lb"|null;
 trainingLevel:"beginner"|"intermediate"|"advanced"|"unknown";
 goalChosen:boolean; consentToPersonalizedReview:boolean;
 dataQuality:"limited"|"partial"|"reviewable";
 adverseSignals:number; observations:E5Observation[];
};
export type E5Assessment={
 contract:"cch-e5-evidence-gate-v1";
 state:"blocked"|"descriptive_review_only";
 levelPreserved:E5Context["trainingLevel"];
 comparableSessions:number; observationsWithRecovery:number;
 observedLoadRange:{min:number;max:number}|null;
 evidenceIds:string[]; blockers:string[];
 reasons:string[];
 causalClaim:false; autoAdapt:false; autoPublish:false;
 numericIncrement:null; volumeChange:null;
 requiresAthleteApproval:true;
};
const nonNegative=(n:number|null):n is number=>n!==null&&Number.isFinite(n)&&n>=0;
// Date.parse silently repairs impossible calendar dates; reject those first.
export function validE5Date(s:string|null):boolean {
 if(!s)return false;
 const m=/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(s);
 if(!m)return false;
 const y=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
 const date=new Date(Date.UTC(y,month-1,day));
 return date.getUTCFullYear()===y&&date.getUTCMonth()===month-1&&
  date.getUTCDate()===day&&Number.isFinite(Date.parse(s));
}
const dateValid=validE5Date;
export function assessE5Evidence(input:E5Context):E5Assessment{
 const blockers:string[]=[];
 if(!input.consentToPersonalizedReview)blockers.push("Consentimento para revisão personalizada não confirmado.");
 if(!input.goalChosen)blockers.push("Objetivo atual não escolhido pelo atleta.");
 if(input.dataQuality!=="reviewable")blockers.push("Evidência não revisável; nível do atleta preservado.");
 if(!input.sourceVersionId)blockers.push("Versão de origem desconhecida.");
 if(!input.equipmentId||!input.loadUnit)blockers.push("Máquina/unidade de carga não confirmadas.");
 if(!Number.isFinite(input.adverseSignals)||input.adverseSignals<0||input.adverseSignals>0)
  blockers.push("Sinais adversos desconhecidos ou presentes exigem revisão humana.");
 const unique=new Map<string,E5Observation>();
 const conflicted=new Set<string>();
 const fingerprint=(o:E5Observation)=>JSON.stringify([o.occurredAt,o.workingSets,o.reps,o.rir,o.load,o.recovery,o.symptoms,o.completed,o.voided]);
 for(const o of input.observations){
  if(o.athleteId!==input.athleteId||!input.sourceVersionId||
    o.programVersionId!==input.sourceVersionId||o.exerciseId!==input.exerciseId||
    !input.equipmentId||o.equipmentId!==input.equipmentId||
    !input.loadUnit||o.loadUnit!==input.loadUnit||
    !o.completed||o.voided||!dateValid(o.occurredAt)||
    !nonNegative(o.workingSets)||o.workingSets===0||
    !nonNegative(o.reps)||o.reps===0||!nonNegative(o.rir)||
    !nonNegative(o.load)||!o.sessionId||!o.id)continue;
  // A session is one exposure. A duplicate set cannot falsely multiply exposures.
  if(conflicted.has(o.sessionId))continue;
  const previous=unique.get(o.sessionId);
  if(previous&&fingerprint(previous)!==fingerprint(o)){
   unique.delete(o.sessionId);conflicted.add(o.sessionId);
  }else if(!previous||o.id.localeCompare(previous.id)<0)unique.set(o.sessionId,o);
 }
 if(conflicted.size)blockers.push("Observações contraditórias da mesma sessão exigem revisão de origem.");
 const sessions=[...unique.values()].sort((a,b)=>
  (Date.parse(a.occurredAt!)-Date.parse(b.occurredAt!))||a.sessionId.localeCompare(b.sessionId));
 const recoveryObserved=sessions.filter(s=>s.recovery!=="unknown"&&s.symptoms!=="unknown").length;
 if(sessions.length<2)blockers.push("Menos de duas sessões distintas e comparáveis do mesmo exercício, máquina e versão.");
 if(recoveryObserved!==sessions.length)blockers.push("Recuperação/dor não documentadas em todas as sessões comparáveis.");
 if(sessions.some(s=>s.recovery!=="good"||s.symptoms!=="none"))
  blockers.push("Recuperação insuficiente ou dor exige revisão antes de intensificar.");
 const range=sessions.length?{min:Math.min(...sessions.map(s=>s.load!)),
  max:Math.max(...sessions.map(s=>s.load!))}:null;
 return {
  contract:"cch-e5-evidence-gate-v1",
  state:blockers.length?"blocked":"descriptive_review_only",
  levelPreserved:input.trainingLevel,
  comparableSessions:sessions.length,observationsWithRecovery:recoveryObserved,
  observedLoadRange:range,evidenceIds:sessions.map(s=>s.id),blockers,
  reasons:["Comparações descritivas não estabelecem causalidade, hipertrofia, tolerância ou dose ótima.",
   "Duas exposições distintas são verificação estrutural mínima, nunca validação clínica de personalização.",
   "Qualquer decisão futura depende de avaliação longitudinal e revisão explícita do atleta."],
  causalClaim:false,autoAdapt:false,autoPublish:false,numericIncrement:null,
  volumeChange:null,requiresAthleteApproval:true
 };
}
