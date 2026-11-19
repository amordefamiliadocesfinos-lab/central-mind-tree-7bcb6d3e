import test from "node:test";
import assert from "node:assert/strict";
import {simulateCchCycle} from "../.tmp-cch-map-frozen/cchScopeSimulator.js";
const base={trainingLevel:"advanced",goal:"unsure",evidenceQuality:"reviewable",
completedSessions:12,comparableExercises:4,negativePerformanceSignals:0,
provenMachineMatches:3,recovery:"good",interferingPain:"no",availableTrainingDays:null};
test("avançado com registros limitados não vira iniciante",()=>{
const p=simulateCchCycle({...base,evidenceQuality:"limited",completedSessions:1});
assert.equal(p.trainingLevelPreserved,"advanced");assert.equal(p.recommendedStrategy,"consolidate_evidence");
});
test("iniciante com dados completos permanece iniciante",()=>{
assert.equal(simulateCchCycle({...base,trainingLevel:"beginner"}).trainingLevelPreserved,"beginner");
});
test("recuperação ruim prioriza revisão",()=>{
assert.equal(simulateCchCycle({...base,recovery:"poor"}).recommendedStrategy,"recovery_review");
});
test("dor interferente bloqueia hipótese de progressão",()=>{
assert.equal(simulateCchCycle({...base,interferingPain:"yes"}).recommendedStrategy,"recovery_review");
});
test("sinal de desempenho desfavorável exige interpretação",()=>{
assert.equal(simulateCchCycle({...base,negativePerformanceSignals:2}).recommendedStrategy,"recovery_review");
});
test("boa cobertura não permite publicação automática",()=>{
const p=simulateCchCycle(base);assert.equal(p.recommendedStrategy,"selective_progression_review");
assert.equal(p.canAutoPublish,false);assert.equal(p.loadChangeKg,null);assert.equal(p.setChange,null);
});
test("sem máquina não inventa carga",()=>{
const p=simulateCchCycle({...base,provenMachineMatches:0});
assert.equal(p.loadChangeKg,null);assert.ok(p.reasons.some(r=>r.includes("Sem histórico")));
});
test("agenda de 3 ou 5 dias não prende a semana",()=>{
for(const days of [3,5])assert.equal(simulateCchCycle({...base,availableTrainingDays:days}).availability,"flexible");
});
test("objetivo corporal só com escolha do atleta",()=>{
const p=simulateCchCycle({...base,goal:"fat_loss"});
assert.equal(p.recommendedGoal,"fat_loss");assert.ok(p.reasons.some(r=>r.includes("escolha explícita")));
});
test("objetivo ainda indefinido pede decisão do atleta",()=>{
assert.equal(simulateCchCycle(base).requiresAthleteGoalSelection,true);
});
test("contagens inválidas não recebem recomendações",()=>{
assert.throws(()=>simulateCchCycle({...base,comparableExercises:-1}),/inválidas/);
});
