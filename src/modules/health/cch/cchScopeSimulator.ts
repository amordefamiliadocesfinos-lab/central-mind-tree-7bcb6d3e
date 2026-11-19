/** CCH E1 — Simulador puro, sem backend, sessão, persistência ou prescrição clínica. */
export type CchLevel="beginner"|"intermediate"|"advanced";
export type CchGoal="hypertrophy"|"strength"|"maintenance"|"fat_loss"|"muscle_priority"|"unsure";
export type CchStrategy="selective_progression_review"|"consolidate_evidence"|"recovery_review";
export type CchScenario={
  trainingLevel:CchLevel;
  goal:CchGoal;
  evidenceQuality:"limited"|"partial"|"reviewable";
  completedSessions:number;
  comparableExercises:number;
  negativePerformanceSignals:number;
  provenMachineMatches:number;
  recovery:"good"|"poor"|"unknown";
  interferingPain:"yes"|"no"|"unknown";
  availableTrainingDays:number|null;
};
export type CchProposal={
  recommendedStrategy:CchStrategy;
  recommendedGoal:CchGoal;
  goalAlternatives:Exclude<CchGoal,"unsure">[];
  reasons:string[];
  blockers:string[];
  trainingLevelPreserved:CchLevel;
  availability:"flexible";
  requiresAthleteGoalSelection:boolean;
  requiresManualReview:true;
  canAutoPublish:false;
  loadChangeKg:null;
  setChange:null;
};
export function simulateCchCycle(input:CchScenario):CchProposal{
  const blockers:string[]=[];
  const reasons:string[]=[];
  const choice=input.goal==="unsure";
  const safeCount=(n:number)=>Number.isFinite(n)&&n>=0;
  if(!safeCount(input.completedSessions)||!safeCount(input.comparableExercises)||
    !safeCount(input.negativePerformanceSignals)||!safeCount(input.provenMachineMatches)||
    (input.availableTrainingDays!==null&&(!Number.isInteger(input.availableTrainingDays)||
      input.availableTrainingDays<1||input.availableTrainingDays>7))) {
    throw new Error("Cenário de simulação contém observações inválidas");
  }
  const recoveryConcern=input.recovery==="poor"||input.interferingPain==="yes";
  if(input.interferingPain!=="no")blockers.push("Sintomas não descartados; revisar antes de intensificar");
  if(input.recovery!=="good")blockers.push("Recuperação atual não confirmada como adequada");
  if(input.evidenceQuality!=="reviewable")blockers.push("Evidência insuficiente para automatizar progressões");
  if(input.negativePerformanceSignals>0)blockers.push("Desempenho com sinais conflitantes");
  if(input.provenMachineMatches===0)reasons.push("Sem histórico de máquina comparável para propor carga em kg");
  if(input.availableTrainingDays===null)reasons.push("Agenda variável ainda sem frequência declarada; não assumir dias fixos");
  if(input.availableTrainingDays!==null)reasons.push("Disponibilidade declarada não impõe dias fixos na sequência");
  reasons.push("Nível declarado do praticante é independente da qualidade das evidências");
  const recommendedStrategy:CchStrategy=recoveryConcern?"recovery_review":
    input.negativePerformanceSignals>0?"recovery_review":
    input.evidenceQuality==="reviewable" && input.completedSessions>=2 &&
    input.comparableExercises>=2 && input.recovery==="good" && input.interferingPain==="no"?
      "selective_progression_review":"consolidate_evidence";
  const recommendedGoal:CchGoal=choice?
    (recoveryConcern?"maintenance":input.goal==="unsure" && recommendedStrategy==="selective_progression_review"?"hypertrophy":"maintenance"):
    input.goal;
  if(choice)reasons.push("Objetivo sugerido não substitui a decisão do atleta");
  if(input.goal==="fat_loss")reasons.push("Objetivo corporal é escolha explícita, nunca inferência do treino");
  const goalAlternatives:Exclude<CchGoal,"unsure">[]=["hypertrophy","strength","maintenance","muscle_priority","fat_loss"];
  return {recommendedStrategy,recommendedGoal,goalAlternatives,reasons,blockers,
    trainingLevelPreserved:input.trainingLevel,availability:"flexible",
    requiresAthleteGoalSelection:choice,requiresManualReview:true,canAutoPublish:false,
    loadChangeKg:null,setChange:null};
}
