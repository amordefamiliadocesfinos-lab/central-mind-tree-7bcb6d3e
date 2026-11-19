/** CCH V1.0 FROZEN — E3 pure, consultative flexible periodization.
 * Does not create programs, queue entries, dates, prescriptions or publication.
 * Checkpoints depend on actual comparable exposure and recovery, never a fixed calendar.
 */
import type {Goal,RecoveryReport,SymptomReport} from "./cycleDecisionModel";

export type SessionObservation={
 id:string;
 occurredAt:string|null; // ISO date/time or YYYY-MM-DD; no fictional dates
 programVersionId:string;
 sessionCode:string;
 status:"completed"|"voided"|"active"|"paused";
 valid:boolean;
 workingSets:number|null;
 exerciseDataComparable:boolean;
 recoveryObserved:boolean;
};
export type FlexibleContext={
 goal:Goal|"unsure";
 trainingLevel:"beginner"|"intermediate"|"advanced"|"unknown";
 dataQuality:"limited"|"partial"|"reviewable";
 recovery:RecoveryReport;
 symptoms:SymptomReport;
 adversePerformanceSignals:number;
 sessions:SessionObservation[];
 sourceVersionId:string|null;
 currentPublishedVersionId:string|null;
 proposedVersionId:string|null;
 plannedStimuli:string[]; // existing session labels only, e.g. A1,B2
 preferredAvailability:number|null; // optional descriptive actual days available
};
export type CycleObservation={
 completedSessions:number;
 comparableSessions:number;
 observedWorkingSets:number|null;
 knownWorkingSetsSessions:number;
 observedSpanDays:number|null;
 actualDaysWithSessions:number|null;
 uniqueStimuli:string[];
};
export type E3Result={
 engineVersion:"cch-e3-flex-v1";
 status:"review_recovery"|"review_evidence"|"eligible_for_manual_review";
 objective:Goal|"unsure";
 levelPreserved:FlexibleContext["trainingLevel"];
 readiness:"insufficient"|"conditional";
 publishedSourceAligned:boolean;
 cycle:CycleObservation;
 coverage:{
  stimulusSequence:{planned:string[];performed:string[];pending:string[];unplanned:string[]};
  plannedCompletedRatio:number|null; // descriptive labels, not target weekly frequency
  comparativeCaveat:string;
 };
 checkpoint:{
  type:"on_next_comparable_session_or_context_change"|"review_now";
  criteria:string[];
  calendarDeadline:null;
  mandatorySessionCount:null;
 };
 alternatives:Array<{strategy:"consolidate"|"recovery_review"|"continue_progression";
  label:string;reason:string;automaticChange:false}>;
 reasons:string[];
 limitations:string[];
 draftOnly:true;
 manualPublicationRequired:true;
 generatesQueue:false;
};

function dateDay(value:string|null):string|null {
 if(!value)return null;
 const date=new Date(value);
 return Number.isNaN(date.getTime())?null:date.toISOString().slice(0,10);
}
function positiveInteger(value:number|null):value is number {
 return typeof value==="number"&&Number.isInteger(value)&&value>=0;
}
export function assessFlexiblePeriodizationE3(input:FlexibleContext):E3Result {
 // Observe only sessions belonging to the version under review. A later or
 // earlier published cycle must never inflate coverage, volume, or readiness.
 const valid=input.sessions.filter(s=>s.valid&&s.status==="completed"&&
   !!input.sourceVersionId&&s.programVersionId===input.sourceVersionId);
 const uniqueIds=new Map<string,SessionObservation>();
 for(const session of valid) if(!uniqueIds.has(session.id))uniqueIds.set(session.id,session);
 const completed=[...uniqueIds.values()];
 const comparable=completed.filter(s=>s.exerciseDataComparable);
 const knownSets=completed.filter(s=>positiveInteger(s.workingSets));
 const observations=completed.map(s=>dateDay(s.occurredAt));
 const dates=observations.filter((s):s is string=>s!==null).sort();
 const first=dates[0],last=dates.at(-1);
 const span=first&&last?
   Math.round((Date.parse(last+"T00:00:00Z")-Date.parse(first+"T00:00:00Z"))/86_400_000)+1:null;
 const performed=[...new Set(completed.map(s=>s.sessionCode).filter(Boolean))];
 const planned=[...new Set(input.plannedStimuli.filter(Boolean))];
 const pending=planned.filter(code=>!performed.includes(code));
 const unplanned=performed.filter(code=>!planned.includes(code));
 const sourceAligned=!!input.sourceVersionId&&!!input.currentPublishedVersionId&&
   input.sourceVersionId===input.currentPublishedVersionId;
 const negatives=Number.isFinite(input.adversePerformanceSignals)&&input.adversePerformanceSignals>0?
   input.adversePerformanceSignals:0;
 const reason:string[]=[];
 const recoveryGuard=input.recovery!=="good"||input.symptoms!=="none";
 if(recoveryGuard)reason.push("Dor ou recuperação sem confirmação adequada: revisar antes de intensificar.");
 if(negatives>0)reason.push("Sinais de desempenho desfavoráveis exigem interpretação individual.");
 if(input.dataQuality!=="reviewable")reason.push("Qualidade de evidência ainda não revisável; não reclassifica experiência.");
 if(!sourceAligned)reason.push("Auditoria e versão publicada de origem não coincidem ou são desconhecidas.");
 if(comparable.length<2)reason.push("Menos de duas sessões com medições comparáveis: observar continuidade sem extrapolar dose.");
 if(input.goal==="unsure")reason.push("Atleta ainda não escolheu um objetivo atual.");
 if(!input.proposedVersionId)reason.push("Sem versão proposta para comparação; nada será criado automaticamente.");
 if(dates.length!==completed.length)reason.push("Datas ausentes ou inválidas: janela de observação não inteiramente verificável.");
 const recoveryReview=recoveryGuard||negatives>0;
 const insufficient=input.dataQuality!=="reviewable"||!sourceAligned||comparable.length<2||
   input.goal==="unsure"||!input.proposedVersionId||recoveryReview;
 const status:E3Result["status"]=recoveryReview?"review_recovery":insufficient?"review_evidence":
   "eligible_for_manual_review";
 const alternatives:E3Result["alternatives"]=[
  {strategy:"consolidate",label:"Manter estímulos e recolher comparações",
   reason:"Respeitar a sequência real, sem calendário fixo nem aumento automático.",automaticChange:false},
  {strategy:"recovery_review",label:"Revisar recuperação e desempenho",
   reason:"Reavaliar sinais atuais e contexto de recuperação antes de intensificar.",automaticChange:false}
 ];
 if(!insufficient)alternatives.push({
  strategy:"continue_progression",label:"Considerar progressão seletiva",
  reason:"Evidências comparáveis permitem revisão humana, não autorizam incremento automático de carga ou volume.",
  automaticChange:false
 });
 return {
  engineVersion:"cch-e3-flex-v1",status,objective:input.goal,levelPreserved:input.trainingLevel,
  readiness:insufficient?"insufficient":"conditional",publishedSourceAligned:sourceAligned,
  cycle:{
   completedSessions:completed.length,comparableSessions:comparable.length,
   observedWorkingSets:knownSets.length===completed.length?
     knownSets.reduce((sum,s)=>sum+s.workingSets!,0):null,
   knownWorkingSetsSessions:knownSets.length,
   observedSpanDays:dates.length===completed.length?span:null,
   actualDaysWithSessions:dates.length===completed.length?new Set(dates).size:null,
   uniqueStimuli:performed
  },
  coverage:{stimulusSequence:{planned,performed,pending,unplanned},
   plannedCompletedRatio:planned.length?planned.filter(code=>performed.includes(code)).length/planned.length:null,
   comparativeCaveat:"Comparação descritiva de códigos; não demonstra dose ideal, hipertrofia ou adesão semanal."},
  checkpoint:{type:recoveryReview?"review_now":"on_next_comparable_session_or_context_change",
   criteria:recoveryReview?["Revisar dor, recuperação e sinais adversos antes da próxima decisão"]:
    ["Próxima sessão efetivamente concluída e comparável","Mudança de objetivo, recuperação ou sintomas",
     "Mudança ou interrupção da disponibilidade real"],
   calendarDeadline:null,mandatorySessionCount:null},
  alternatives,reasons:reason,
  limitations:["Sem modelo semanal fixo: pausas e 3, 4, 5 ou outros dias reais são tratados como observações.",
    "Uma mesma sessão realizada múltiplas vezes não é deduzida da lista de códigos sem dados reais.",
    "Volume observado não demonstra tolerância ou resposta muscular individual.",
    "Mudança de equipamento e unidade exige confirmação por exercício na E2.",
    "Nenhuma proposta modifica M3, M4, F21, F22 ou fila."],
  draftOnly:true,manualPublicationRequired:true,generatesQueue:false
 };
}
