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
  const guarded = symptoms !== "none" || recovery !== "good";
  const allowProgression = !guarded && dataStatus === "reviewable" && negativeSignals === 0 &&
    (candidates > 0 || repeatedTrends >= 2);
  const allowVolumeProposal = allowProgression && goal === "muscle_priority" && strategy === "continue_progression" && candidates > 0;
  const recommendation: Strategy = guarded || negativeSignals > 0 ? "recovery_review" :
    dataStatus === "limited" ? "consolidate" :
    goal === "hypertrophy" && candidates > 0 ? "continue_progression" : "consolidate";
  if (!allowProgression && strategy === "continue_progression") reasons.push("A estratégia pode ser estudada, mas o sistema deve bloquear mudanças automáticas sem confirmação das condições.");
  return { recommendation, allowProgression, allowVolumeProposal, reasons,
    evidence: { progressionCandidates: candidates, negativeSignals, repeatedTrends } };
}
