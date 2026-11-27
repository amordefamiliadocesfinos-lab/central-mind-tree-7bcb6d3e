import {useRef,useState} from "react";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import type {useHealthNutritionM5,useHealthNutritionM5 as M5Hook} from "../hooks/useHealthNutritionM5";
import type {useHealthNutritionStateM6} from "../hooks/useHealthNutritionStateM6";
import {rangeLabel,strategyLabels,targetFields,targetValues,validateTargets} from "../cch/nutritionReviewSX02";

type Nutrition=ReturnType<typeof M5Hook>;
type NutritionState=ReturnType<typeof useHealthNutritionStateM6>;
export function HealthNutritionPlanSX02({nutrition,nutritionState,athleteId}:{nutrition:ReturnType<typeof useHealthNutritionM5>;nutritionState:NutritionState;athleteId:string}){
 const {plan,version,target}=nutrition;
 const scoped=(!plan||plan.athlete_id===athleteId)&&(!version||version.athlete_id===athleteId&&version.plan_id===plan?.id)&&(!target||target.athlete_id===athleteId&&target.plan_version_id===version?.id);
 if(nutrition.error||!scoped)return <Card><CardContent className="space-y-2 p-3"><p role="alert">Plano indisponível. Atualize antes de editar.</p><Button variant="outline" className="min-h-11 w-full" onClick={()=>void nutrition.reload()}>Atualizar plano</Button></CardContent></Card>;
 // Reset the editor only when its persisted source changes, never from historical consumption.
 const key=JSON.stringify([athleteId,plan?.id,version?.id,version?.status,targetValues(target)]);
 return <PlanReview key={key} nutrition={nutrition} nutritionState={nutritionState}/>;
}
function PlanReview({nutrition,nutritionState}:{nutrition:Nutrition;nutritionState:NutritionState}){
 const {plan,version,target}=nutrition;
 const [name,setName]=useState("Plano nutricional");
 const [strategy,setStrategy]=useState("");
 const [values,setValues]=useState(()=>targetValues(target));
 const [editing,setEditing]=useState(!target);
 const [confirm,setConfirm]=useState(false);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [failed,setFailed]=useState(false);
 const lock=useRef(false);
 const draft=version?.status==="draft";
 const published=version?.status==="published"&&plan?.status==="active"&&plan.current_version_id===version.id;
 const dirty=JSON.stringify(values)!==JSON.stringify(targetValues(target));
 const checked=validateTargets(values);
 const blocked=busy||nutrition.saving||nutrition.loading||nutritionState.refreshing||failed;
 const run=async(action:()=>Promise<void>,message:string)=>{
  if(lock.current||blocked)return;
  lock.current=true;setBusy(true);setNotice("");
  try{await action();setNotice(message);setConfirm(false);}
  catch{setFailed(true);setConfirm(false);setNotice("Resultado não confirmado. Atualize e confira o plano antes de uma nova ação.");}
  finally{lock.current=false;setBusy(false);}
 };
 return <Card data-testid="sx02-plan">
  <CardHeader className="px-3 pb-2 pt-3 sm:px-4"><CardTitle className="text-lg">Meu plano nutricional</CardTitle><p className="text-xs text-muted-foreground">Planejamento não é consumo registrado.</p></CardHeader>
  <CardContent className="space-y-3 px-3 pb-3 sm:px-4">
   {!plan?<div className="space-y-3">
    <p className="text-sm text-muted-foreground">Nenhum plano disponível. Crie um rascunho somente se quiser definir uma estratégia.</p>
    <Label htmlFor="sx02-plan-name">Nome do plano</Label><Input id="sx02-plan-name" className="min-h-11" value={name} onChange={e=>setName(e.target.value)} disabled={blocked}/>
    <Label htmlFor="sx02-strategy">Estratégia escolhida</Label><select id="sx02-strategy" className="min-h-11 w-full rounded-md border bg-background px-2 text-sm" value={strategy} onChange={e=>setStrategy(e.target.value)} disabled={blocked}><option value="">Escolha a estratégia</option>{Object.entries(strategyLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
    <Button className="min-h-11 w-full" disabled={blocked||name.trim().length<2||!strategyLabels[strategy]} onClick={()=>void run(()=>nutrition.createPlan(name,strategy),"Rascunho criado.")}>Criar rascunho</Button>
   </div>:<>
    <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3">
     <div className="min-w-0 flex-1"><p className="break-words text-base font-semibold">{plan.name}</p><p className="text-xs text-muted-foreground">{version?strategyLabels[version.strategy_type]??version.strategy_type:"Estratégia não disponível"} · versão {version?.version_number??"—"}</p>{version?.rationale?<p className="mt-1 text-xs break-words">{version.rationale}</p>:null}</div>
     <Badge variant="outline">{draft?"Rascunho":published?"Publicado e vigente":version?.status==="published"?"Publicado · não vigente":"Versão não disponível"}</Badge>
    </div>
    <p className="text-xs text-muted-foreground">{draft?"As metas abaixo pertencem ao rascunho. Não são metas vigentes.":"Metas da versão apresentada. A comparação diária depende do plano aplicável à data (M6)."}</p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
     {targetFields.map(field=><div key={field.min} className="rounded-lg bg-muted/25 p-2.5 min-w-0"><p className="text-xs text-muted-foreground">{field.label}</p><p className="break-words text-sm font-semibold tabular-nums">{rangeLabel(target?.[field.min],target?.[field.max],field.unit)}</p></div>)}
    </div>
    {draft?<div className="space-y-3">
     <Button variant="outline" className="min-h-11 w-full" disabled={blocked} onClick={()=>{setEditing(!editing);setConfirm(false);}}>{editing?"Recolher editor":"Editar metas do rascunho"}</Button>
     {editing?<div className="space-y-3 rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">Vazio = meta não definida; zero é um valor explícito. Os campos começam com as metas salvas.</p>
      {targetFields.map(field=><fieldset key={field.min} className="space-y-1"><legend className="text-sm font-medium">{field.label} ({field.unit})</legend><div className="grid grid-cols-2 gap-2">
       {([["Mínimo",field.min],["Máximo",field.max]] as const).map(([label,key])=><div key={key}><Label htmlFor={"sx02-"+key} className="text-xs">{field.label} · {label.toLowerCase()}</Label><Input id={"sx02-"+key} className="min-h-11" inputMode="decimal" value={values[key]} disabled={blocked} onChange={e=>{setValues(v=>({...v,[key]:e.target.value}));setConfirm(false);}}/></div>)}
      </div></fieldset>)}
      {checked.error?<p className="text-xs text-muted-foreground">{checked.error}</p>:null}
      <Button variant="secondary" className="min-h-11 w-full" disabled={blocked||!checked.payload||!dirty} onClick={()=>{if(checked.payload)void run(()=>nutrition.saveTargets(checked.payload!),"Metas salvas no rascunho.");}}>Salvar metas</Button>
      {dirty?<Button variant="ghost" className="min-h-11 w-full" disabled={blocked} onClick={()=>{setValues(targetValues(target));setConfirm(false);}}>Descartar alterações locais</Button>:null}
     </div>:null}
     {dirty?<p role="status" className="text-xs text-muted-foreground">Há alterações locais não salvas. Salve ou descarte antes de publicar.</p>:null}
     <Button className="min-h-11 w-full" disabled={blocked||dirty||!target||!checked.payload||confirm} onClick={()=>setConfirm(true)}>Revisar publicação</Button>
     {confirm?<div className="space-y-2 rounded-lg border p-3" data-testid="sx02-plan-confirm"><p className="font-medium text-sm">Publicar versão {version?.version_number}?</p><p className="text-xs">As metas salvas acima passarão pelo escritor de publicação M5. O plano anterior pode ser pausado. Nenhum registro de consumo será modificado.</p><div className="grid grid-cols-2 gap-2"><Button variant="outline" className="min-h-11" disabled={blocked} onClick={()=>setConfirm(false)}>Cancelar</Button><Button className="min-h-11 whitespace-normal" disabled={blocked||dirty||!target||!checked.payload} onClick={()=>void run(async()=>{await nutrition.publishPlan();await nutritionState.refresh();},"Publicação enviada. Confira a versão.")}>Confirmar publicação</Button></div></div>:null}
    </div>:<p className="text-xs text-muted-foreground">Versões não rascunho ficam somente para consulta.</p>}
   </>}
   {notice?<p role={failed?"alert":"status"} className="text-sm">{notice}</p>:null}
   {failed?<Button variant="outline" className="min-h-11 w-full" disabled={busy||nutrition.loading} onClick={()=>void (async()=>{setBusy(true);try{await nutrition.reload(true);setNotice("Confira a versão e os valores salvos antes de liberar nova ação.");}catch{setNotice("Consulta não confirmada.");}finally{setBusy(false);}})()}>Conferir registros</Button>:null}
   {failed&&notice.startsWith("Confira a versão")?<Button variant="outline" className="min-h-11 w-full" onClick={()=>{setFailed(false);setNotice("");setValues(targetValues(target));}}>Conferi; liberar nova ação</Button>:null}
  </CardContent>
 </Card>;
}
