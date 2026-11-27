import {useRef,useState} from "react";
import {Button} from "@/components/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import type {useHealthNutritionStateM6} from "../hooks/useHealthNutritionStateM6";
import type {useHealthNutritionDecisionM7} from "../hooks/useHealthNutritionDecisionM7";
import {formatNumber,ratioLabel,coverageLabels,confidenceLabels,statusLabels} from "../cch/nutritionReviewSX02";
type State=ReturnType<typeof useHealthNutritionStateM6>;
type Decision=ReturnType<typeof useHealthNutritionDecisionM7>;
const decisions:Record<string,string>={
 review_data_quality:"Dados insuficientes para uma decisão confiável",
 review_energy_execution:"Revisar a execução da meta de energia",
 review_protein_execution:"Revisar a execução da meta de proteína",
 review_energy_and_protein_execution:"Revisar a execução de energia e proteína",
 maintain_plan:"Manter o plano nutricional atual",
 decision_paused:"Avaliação pausada",
};
const reasons:Record<string,string>={
 NO_NUTRITION_PLAN_FOR_DATE:"Sem plano aplicável à data.",
 NO_NUTRITION_TARGET:"Sem metas cadastradas.",
 NO_FOOD_LOG_DAY:"Nenhum diário observado.",
 NO_ACTIVE_MEAL_ITEMS:"Sem itens ativos no diário.",
 COMPLETE_DAY_WITH_NO_ACTIVE_ITEMS:"Dia concluído sem itens ativos.",
 DAY_NOT_COMPLETE:"Dia ainda não concluído.",
 ENERGY_COVERAGE_INCOMPLETE:"Cobertura de energia incompleta.",
 PROTEIN_COVERAGE_INCOMPLETE:"Cobertura de proteínas incompleta.",
 CARBOHYDRATE_COVERAGE_INCOMPLETE:"Cobertura de carboidratos incompleta.",
 FAT_COVERAGE_INCOMPLETE:"Cobertura de gorduras incompleta.",
 FIBER_COVERAGE_INCOMPLETE:"Cobertura de fibras incompleta.",
 INSUFFICIENT_SUFFICIENT_DAYS:"Ainda faltam dias suficientes.",
 INSUFFICIENT_ENERGY_COMPARABLE_DAYS:"Ainda faltam dias comparáveis de energia.",
 INSUFFICIENT_PROTEIN_COMPARABLE_DAYS:"Ainda faltam dias comparáveis de proteína.",
 ROLLING_COVERAGE_TOO_LOW:"Cobertura da janela ainda baixa.",
 ENERGY_ADHERENCE_BELOW_THRESHOLD:"Execução da meta de energia abaixo do limiar.",
 PROTEIN_ADHERENCE_BELOW_THRESHOLD:"Execução da meta de proteína abaixo do limiar.",
 ENERGY_AND_PROTEIN_ADHERENCE_ACCEPTABLE:"Aderência de energia e proteína suficiente.",
 BODY_RESPONSE_REQUIRED_FOR_PLAN_ADJUSTMENT:"Ajuste do plano exige evidência de resposta corporal.",
};
function ReasonDetails({codes,title}:{codes:string[];title:string}){
 return codes.length?<details className="rounded-lg border px-3"><summary className="min-h-11 py-3 cursor-pointer text-sm font-medium">{title}</summary><ul className="space-y-1 pb-3 text-xs text-muted-foreground">{codes.map((code,index)=><li key={code+index}>{reasons[code]??code}</li>)}</ul></details>:null;
}
function Metric({label,value}:{label:string;value:string}){return <div className="min-w-0 rounded-lg bg-muted/25 p-2.5"><p className="text-xs text-muted-foreground">{label}</p><p className="break-words text-sm font-semibold tabular-nums">{value}</p></div>;}
const fmt=(v:number|null|undefined,unit:string)=>formatNumber(v)==="—"?"Não disponível":formatNumber(v)+" "+unit;
const today=()=>{const now=new Date();return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);};
export function HealthNutritionEvolutionSX02({nutritionState:s,nutritionDecision:d,athleteId,blocked=false}:{nutritionState:State;nutritionDecision:Decision;athleteId:string;blocked?:boolean}){
 const [busy,setBusy]=useState(false);
 const [actionError,setActionError]=useState("");
 const lock=useRef(false);
 const date=today();
 const daily=!s.error&&!s.loading&&!s.refreshing&&s.daily?.athlete_id===athleteId&&s.daily.state_date===date?s.daily:null;
 const rolling=!s.error&&!s.loading&&!s.refreshing&&s.rolling7?.athlete_id===athleteId&&s.rolling7.window_end_date===date&&s.rolling7.window_days===7?s.rolling7:null;
 const decision=!d.error&&!d.loading&&!d.evaluating&&d.decision?.athlete_id===athleteId&&d.decision.as_of_date===date&&d.decision.record_status==="current"?d.decision:null;
 const pending=blocked||busy||s.loading||s.refreshing||d.loading||d.evaluating;
 const act=async(action:()=>Promise<void>)=>{
  if(lock.current||pending)return;
  lock.current=true;setBusy(true);setActionError("");
  try{await action();}catch{setActionError("Resultado não confirmado. Confira os registros antes de repetir.");}
  finally{lock.current=false;setBusy(false);}
 };
 return <div className="space-y-3" data-testid="sx02-evolution">
  <Card><CardHeader className="px-3 pt-3 pb-2"><CardTitle className="text-lg">Evolução alimentar</CardTitle><p className="text-xs text-muted-foreground">Registros calculados pelo M6. Não representam resposta corporal ou diagnóstico.</p></CardHeader><CardContent className="space-y-3 px-3 pb-3">
   {s.error?<p role="alert" className="text-sm text-destructive">Estado nutricional indisponível. Atualize para consultar.</p>:null}
   {s.loading||s.refreshing?<p role="status" className="text-sm">Consultando estado…</p>:null}
   {daily?<section className="space-y-2">
    <p className="text-sm font-semibold">Hoje · {coverageLabels[daily.state_status]??daily.state_status}</p><p className="text-xs text-muted-foreground">Estado calculado em {daily.calculated_at} · confiança {confidenceLabels[daily.confidence]??daily.confidence} · {daily.observed_item_count} itens observados. Pode exigir atualização após correções.</p>
    <div className="grid grid-cols-2 gap-2"><Metric label="Energia observada" value={fmt(daily.energy_kcal_consumed,"kcal")}/><Metric label="Proteína observada" value={fmt(daily.protein_g_consumed,"g")}/><Metric label="Energia × meta" value={statusLabels[daily.energy_target_status]??daily.energy_target_status}/><Metric label="Proteína × meta" value={statusLabels[daily.protein_target_status]??daily.protein_target_status}/></div>
    <ReasonDetails title="Como este estado foi calculado" codes={daily.reason_codes}/>
   </section>:!s.error&&!s.loading&&!s.refreshing?<p className="text-sm text-muted-foreground">Nenhum estado de hoje confirmado.</p>:null}
   {rolling?<section className="space-y-2 border-t pt-3">
    <p className="text-sm font-semibold">Últimos 7 dias · {coverageLabels[rolling.coverage_status]??rolling.coverage_status}</p><p className="text-xs text-muted-foreground">Janela até {rolling.window_end_date} · cálculo {rolling.calculated_at}</p>
    <div className="grid grid-cols-2 gap-2"><Metric label="Dias observados" value={formatNumber(rolling.observed_day_count)+"/7"}/><Metric label="Dias suficientes" value={formatNumber(rolling.sufficient_day_count)+"/7"}/><Metric label="Cobertura observada" value={ratioLabel(rolling.observation_coverage_ratio)}/><Metric label="Cobertura suficiente" value={ratioLabel(rolling.sufficient_coverage_ratio)}/><Metric label="Energia média · dias suficientes" value={fmt(rolling.avg_energy_kcal,"kcal")}/><Metric label="Proteína média · dias suficientes" value={fmt(rolling.avg_protein_g,"g")}/><Metric label={"Energia na meta · "+formatNumber(rolling.energy_comparable_day_count)+" dias comparáveis"} value={ratioLabel(rolling.energy_target_adherence_ratio)}/><Metric label={"Proteína na meta · "+formatNumber(rolling.protein_comparable_day_count)+" dias comparáveis"} value={ratioLabel(rolling.protein_target_adherence_ratio)}/></div>
    <p className="text-xs text-muted-foreground">Aderência descreve execução observada, não eficácia do plano. Ausência de dados não significa baixa ingestão.</p><ReasonDetails title="Detalhes da cobertura" codes={rolling.reason_codes}/>
   </section>:null}
   <Button variant="outline" className="min-h-11 w-full" disabled={pending} onClick={()=>void act(s.refresh)}>Atualizar estado nutricional</Button>
  </CardContent></Card>
  <Card><CardHeader className="px-3 pt-3 pb-2"><CardTitle className="text-base">Orientação para revisão</CardTitle><p className="text-xs text-muted-foreground">Avaliação consultiva registrada pelo M7. Não publica nem altera metas.</p></CardHeader><CardContent className="space-y-3 px-3 pb-3">
   {d.error?<p role="alert" className="text-sm text-destructive">Não foi possível confirmar a avaliação.</p>:null}
   {decision?<><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{decision.decision_status==="paused"?"Avaliação pausada":"Avaliação disponível"} · confiança {confidenceLabels[decision.confidence]??decision.confidence}</p><p className="mt-1 font-semibold text-sm">{decisions[decision.decision_code]??"Consultar avaliação registrada"}</p><p className="mt-1 text-xs text-muted-foreground">Avaliada em {decision.created_at} · janela {decision.window_days} dias. Registro histórico da avaliação, não atualização automática.</p></div>
   <div className="grid grid-cols-2 gap-2"><Metric label="Dias suficientes" value={formatNumber(decision.sufficient_day_count)+"/"+decision.window_days}/><Metric label="Cobertura" value={coverageLabels[decision.rolling_coverage_status]??decision.rolling_coverage_status}/><Metric label="Aderência energia" value={ratioLabel(decision.energy_target_adherence_ratio)}/><Metric label="Aderência proteína" value={ratioLabel(decision.protein_target_adherence_ratio)}/></div>
   <ReasonDetails title="Por que esta orientação?" codes={decision.reason_codes}/>
   <p className="text-sm font-medium">Ajuste do plano: {decision.plan_adjustment_status==="paused"?"pausado":"elegibilidade registrada, sem alteração automática"}</p><ReasonDetails title="Limites para ajustar o plano" codes={decision.plan_adjustment_reason_codes}/>
   </>:!d.error&&!d.loading&&!d.evaluating?<p className="text-sm text-muted-foreground">Nenhuma avaliação de hoje confirmada.</p>:null}
   <Button className="min-h-11 w-full" disabled={pending} onClick={()=>void act(d.evaluate)}>Avaliar execução nutricional</Button>
   {actionError?<p role="alert" className="text-sm text-destructive">{actionError}</p>:null}
  </CardContent></Card>
 </div>;
}
