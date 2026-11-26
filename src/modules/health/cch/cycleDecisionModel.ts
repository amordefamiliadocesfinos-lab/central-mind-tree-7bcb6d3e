export type Goal = "hypertrophy" | "strength" | "maintenance" | "fat_loss" | "muscle_priority";
export type Strategy = "continue_progression" | "consolidate" | "recovery_review";
export type RecoveryReport = "good" | "poor" | "unknown";
export type SymptomReport = "none" | "pain" | "unknown";
export type EvidenceForDecision = {
  data_quality?: { status?: "limited" | "partial" | "reviewable" } | null;
  exercise_assessments?: Array<{ decision?: string }> | null;
  load_trends?: Array<{ signal?: string; exposures?: number }> | null;
  data_gaps?: string[] | null;
  recovery_evidence_state?: string | null;
};
export type Guidance = {
  recommendation: Strategy;
  allowProgression: boolean;
  allowVolumeProposal: boolean;
  reasons: string[];
  evidence: { progressionCandidates: number; negativeSignals: number; repeatedTrends: number };
};
export function buildCycleDecisionBrief(
  evidence: EvidenceForDecision,
  recovery: RecoveryReport,
  symptoms: SymptomReport,
  goal: Goal | "unsure",
  strategy: Strategy,
): Guidance {
  const candidates = (evidence.exercise_assessments ?? []).filter(e => e.decision === "progress_candidate").length;
  const negativeSignals = (evidence.load_trends ?? []).filter(e =>
    e.signal === "review" || e.signal === "load_decreased_observed").length;
  const repeatedTrends = (evidence.load_trends ?? []).filter(e => (e.exposures ?? 0) >= 2).length;
  const reasons: string[] = [];
  const dataStatus = evidence.data_quality?.status ?? "limited";
  if (symptoms === "pain") reasons.push("Dor ou desconforto atual: não gerar progressões automáticas; avaliar a origem antes de intensificar.");
  if (symptoms === "unknown") reasons.push("A condição de dor/desconforto ainda precisa ser informada.");
  if (recovery === "poor") reasons.push("Recuperação relatada como insuficiente: priorizar revisão antes de progressões.");
  if (recovery === "unknown") reasons.push("Recuperação atual não informada; não presumir prontidão.");
  if (dataStatus !== "reviewable") reasons.push("Confiança nos dados " + (dataStatus === "partial" ? "parcial" : "limitada") + "; isso não altera o nível do atleta.");
  if (negativeSignals > 0) reasons.push(negativeSignals + " tendências de desempenho precisam de interpretação antes de progredir.");
  if ((evidence.data_gaps?.length ?? 0) > 0) reasons.push("Há " + evidence.data_gaps!.length + " lacuna(s) documentada(s) na auditoria.");
  if (goal === "fat_loss") reasons.push("Treino não determina necessidade de perder gordura; é necessária meta corporal escolhida.");
  if (goal === "unsure") reasons.push("Escolha o objetivo antes de habilitar propostas de progressão.");
  const guarded = symptoms !== "none" || recovery !== "good";
  const allowProgression = goal !== "unsure" && !guarded && dataStatus === "reviewable" && negativeSignals === 0 &&
    (candidates > 0 || repeatedTrends >= 2);
  const allowVolumeProposal = allowProgression && goal === "muscle_priority" && strategy === "continue_progression" && candidates > 0;
  const recommendation: Strategy = guarded || negativeSignals > 0 ? "recovery_review" :
    dataStatus === "limited" ? "consolidate" :
    allowProgression && (goal === "hypertrophy" || goal === "strength" || goal === "muscle_priority") ? "continue_progression" : "consolidate";
  if (!allowProgression && strategy === "continue_progression") reasons.push("A estratégia pode ser estudada, mas o sistema deve bloquear mudanças automáticas sem confirmação das condições.");
  return { recommendation, allowProgression, allowVolumeProposal, reasons,
    evidence: { progressionCandidates: candidates, negativeSignals, repeatedTrends } };
}

/** Existing M9 aggregate is context, not a current self-report or E5 session review. */
export function describeRecoveryContext(input:{
 sourceAligned:boolean; state?:string;
 context?:{as_of_date?:string;confidence?:string;recovery_observed_days?:number;fatigue_observed_days?:number}|null;
}):{summary:string;detail:string}{
 const fallback={summary:"Cobertura de recuperação não confirmada.",detail:"Não presumir recuperação ou fadiga; a percepção atual é informada separadamente."};
 if(!input.sourceAligned||!input.context||input.state==="unknown")return fallback;
 const c=input.context;
 const date=c.as_of_date;
 if(typeof date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(date))return fallback;
 const ms=Date.parse(date+"T00:00:00Z");
 if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==date)return fallback;
 const validCount=(n:unknown):n is number=>typeof n==="number"&&Number.isSafeInteger(n)&&n>=0;
 if(!validCount(c.recovery_observed_days)||!validCount(c.fatigue_observed_days))return fallback;
 if(c.recovery_observed_days===0&&c.fatigue_observed_days===0)return fallback;
 const state=input.state==="observed_needs_interpretation"?"Observações disponíveis para interpretação":input.state==="limited_coverage"?"Cobertura limitada":"Cobertura não classificada";
 return {summary:state+" · referência "+date.split("-").reverse().join("/"),
 detail:"Recuperação: "+c.recovery_observed_days+" dia(s) observado(s); fadiga: "+c.fatigue_observed_days+" dia(s). Os registros não confirmam prontidão atual nem substituem sua resposta explícita."};
}
