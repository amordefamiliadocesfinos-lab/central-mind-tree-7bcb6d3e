import { useEffect, useRef, useState } from "react";
import { Apple, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { useHealthNutritionM5, MealItem, FoodLogOrigin } from "../hooks/useHealthNutritionM5";
import type { useHealthNutritionStateM6 } from "../hooks/useHealthNutritionStateM6";

type Nutrition = ReturnType<typeof useHealthNutritionM5>;
type NutritionState = ReturnType<typeof useHealthNutritionStateM6>;
const mealLabels: Record<string,string> = {breakfast:"Café da manhã",lunch:"Almoço",dinner:"Jantar",snack:"Lanche",other:"Outra refeição"};
const mealLabel = (value:string) => mealLabels[value] ?? value;
const selectClass = "min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const numberFormat = new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1});
const metricKeys = ["energy_kcal_snapshot","protein_g_snapshot","carbohydrate_g_snapshot","fat_g_snapshot","fiber_g_snapshot"] as const;

function known(value:number|null|undefined):number|null {
  return typeof value==="number" && Number.isFinite(value) && value>=0 ? value : null;
}
function sumKnown(items:MealItem[], key:typeof metricKeys[number], complete:boolean):number|null {
  if (!items.length) return complete ? 0 : null;
  let sum=0;
  for (const item of items) {
    const value=known(item[key]);
    if(value===null)return null;
    sum+=value;
  }
  return sum;
}
const fmt=(value:number|null,unit:string)=>value===null?"—":numberFormat.format(value)+" "+unit;
function localDate() {
  const now=new Date();
  return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
}
function range(min:number|null|undefined,max:number|null|undefined,unit:string) {
  const lo=known(min),hi=known(max);
  if(lo===null&&hi===null)return null;
  if(lo!==null&&hi!==null&&lo>hi)return null;
  if(lo!==null&&hi!==null)return lo===hi?fmt(lo,unit):numberFormat.format(lo)+"–"+fmt(hi,unit);
  return lo!==null?"mín. "+fmt(lo,unit):"máx. "+fmt(hi,unit);
}

/** Presentation over existing M5 facts and M6 readback. No calculation writes on mount. */
export function HealthNutritionDiarySX01({nutrition,nutritionState,athleteId}:{nutrition:Nutrition;nutritionState:NutritionState;athleteId:string}) {
  const [mealType,setMealType]=useState("");
  const [mealId,setMealId]=useState("");
  const [foodId,setFoodId]=useState("");
  const [quantity,setQuantity]=useState("");
  const [origin,setOrigin]=useState<FoodLogOrigin>("declared_quantity");
  const [reviewRequired,setReviewRequired]=useState(false);
  const [reviewLoaded,setReviewLoaded]=useState(false);
  const [date,setDate]=useState(localDate);
  const [confirmation,setConfirmation]=useState<string|null>(null);
  const [feedback,setFeedback]=useState("");
  const [actionError,setActionError]=useState("");
  const [busy,setBusy]=useState(false);
  const lock=useRef(false);
  useEffect(()=>{
    const sync=()=>setDate(localDate());
    const handle=window.setInterval(sync,15000);
    window.addEventListener("focus",sync);
    document.addEventListener("visibilitychange",sync);
    return ()=>{window.clearInterval(handle);window.removeEventListener("focus",sync);document.removeEventListener("visibilitychange",sync);};
  },[]);
  useEffect(()=>{setMealId("");setMealType("");setFoodId("");setQuantity("");setConfirmation(null);setFeedback("");},[date]);
  const day=nutrition.day;
  const complete=day?.completeness_status==="complete";
  const currentScope=nutrition.readDate===date&&(!day||(day.athlete_id===athleteId&&day.log_date===date))&&
    nutrition.meals.every(m=>m.athlete_id===athleteId&&m.food_log_day_id===day?.id)&&
    nutrition.activeItems.every(i=>i.athlete_id===athleteId&&nutrition.meals.some(m=>m.id===i.meal_log_id));
  const unavailable=Boolean(nutrition.error||!currentScope);
  const pending=busy||nutrition.saving||nutrition.loading||nutritionState.refreshing;
  const blocked=pending||unavailable||reviewRequired;
  const selectedMeal=nutrition.meals.find(m=>m.id===mealId);
  const selectedFood=nutrition.foods.find(f=>f.id===foodId);
  const amount=Number(quantity.replace(",","."));
  const validAmount=/^\d+(?:[.,]\d+)?$/.test(quantity.trim())&&Number.isFinite(amount)&&amount>0;
  const canRegister=!blocked&&!complete&&Boolean(selectedMeal&&selectedFood&&["g","ml","unit"].includes(selectedFood.basis_unit)&&validAmount&&(origin!=="weighed"||selectedFood.basis_unit==="g"));
  const daily=nutritionState.daily;
  // M6 resolves the applicable published plan by date. Only reuse that reference
  // if its source still matches the M5 published version and the observed diary.
  const aligned=Boolean(!nutritionState.error&&!nutritionState.loading&&!nutritionState.refreshing&&
    daily&&daily.athlete_id===athleteId&&daily.state_date===date&&day&&daily.food_log_day_id===day.id&&
    !unavailable&&!nutrition.loading&&daily.completeness_status===day.completeness_status&&daily.observed_item_count===nutrition.activeItems.length&&
    daily.observed_meal_count===nutrition.meals.length&&nutrition.version?.status==="published"&&
    nutrition.plan?.current_version_id===nutrition.version.id&&daily.plan_version_id===nutrition.version.id&&
    nutrition.target&&nutrition.target.athlete_id===athleteId&&daily.target_id===nutrition.target.id&&nutrition.target.plan_version_id===nutrition.version.id);
  const values=metricKeys.map(key=>unavailable||nutrition.loading?null:sumKnown(nutrition.activeItems,key,complete));
  const metrics=[
    {label:"Energia",unit:"kcal",value:values[0],m6:daily?.energy_kcal_consumed,min:daily?.energy_kcal_min_target,max:daily?.energy_kcal_max_target},
    {label:"Proteínas",unit:"g",value:values[1],m6:daily?.protein_g_consumed,min:daily?.protein_g_min_target,max:daily?.protein_g_max_target},
    {label:"Carboidratos",unit:"g",value:values[2],m6:daily?.carbohydrate_g_consumed,min:daily?.carbohydrate_g_min_target,max:daily?.carbohydrate_g_max_target},
    {label:"Gorduras",unit:"g",value:values[3],m6:daily?.fat_g_consumed,min:daily?.fat_g_min_target,max:daily?.fat_g_max_target},
    {label:"Fibras",unit:"g",value:values[4],m6:daily?.fiber_g_consumed,min:daily?.fiber_g_min_target,max:daily?.fiber_g_max_target},
  ];
  const run=async(message:string,action:()=>Promise<void>)=>{
    if(lock.current||blocked)return;
    if(localDate()!==date){setDate(localDate());setActionError("A data mudou. Atualize o diário antes de continuar.");return;}
    lock.current=true;setBusy(true);setFeedback("");setActionError("");
    try {
      await action();
      setFeedback(message+" Confira os registros atualizados.");
      setConfirmation(null);
      await nutritionState.refresh();
    } catch(cause) {
      setReviewRequired(true);setReviewLoaded(false);setConfirmation(null);
      setActionError((cause instanceof Error?cause.message:"Não foi possível concluir.")+" A gravação pode ter sido recebida. Confira o diário antes de qualquer nova tentativa.");
    } finally {lock.current=false;setBusy(false);}
  };
  const review=async()=>{
    if(lock.current||pending)return;
    lock.current=true;setBusy(true);setReviewLoaded(false);
    try{await nutrition.reload();setReviewLoaded(true);}catch{setActionError("Não foi possível conferir o diário. Tente atualizar novamente.");}
    finally{lock.current=false;setBusy(false);}
  };
  return <div className="space-y-3" data-testid="sau-sx01-diary">
    <Card>
      <CardHeader className="px-3 pb-2 pt-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg"><Apple className="h-5 w-5 text-primary" aria-hidden="true"/>Diário de hoje</CardTitle>
          <Badge variant="outline">{unavailable?"Indisponível":nutrition.loading?"Carregando":complete?"Concluído":day?"Em registro":"Sem diário"}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{date.split("-").reverse().join("/")} · Consumo registrado, não estimativa do dia inteiro.</p>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3 sm:px-4">
        {unavailable?<p role="alert" className="text-sm text-destructive">Diário não confirmado. Atualize antes de registrar ou corrigir.</p>:null}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="sx01-consumption">
          {metrics.map((metric,index)=>{
            const sameValue=metric.value!==null&&known(metric.m6)!==null&&Math.abs(metric.value-metric.m6!)<0.01;
            const target=aligned&&sameValue?range(metric.min,metric.max,metric.unit):null;
            return <div key={metric.label} className={"min-w-0 rounded-lg bg-muted/25 p-2.5 "+(index===0?"col-span-2 sm:col-span-4":"")}>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className={(index===0?"text-2xl":"text-lg")+" break-words font-semibold tabular-nums"}>{fmt(metric.value,metric.unit)}</p>
              {target?<p className="text-xs text-muted-foreground">Meta: {target}</p>:null}
            </div>;
          })}
        </div>
        <p className="text-xs text-muted-foreground">{unavailable?"Dados indisponíveis.":!day?"Nenhum diário observado.":complete&&!nutrition.activeItems.length?"Dia concluído sem itens ativos; zero de registros, não inferência de jejum.":complete?"Dia concluído explicitamente.":"Dia parcial: valores referentes aos itens ativos registrados."} — significa informação não disponível.</p>
        <p className="text-xs text-muted-foreground">{aligned?"Metas de referência: versão publicada v"+nutrition.version?.version_number+", origem M6 da data. Só exibidas para nutrientes com valores alinhados.":"Comparação com metas indisponível: plano aplicável e estado M6 precisam estar alinhados."}</p>
        {nutritionState.error?<p role="status" className="text-xs text-muted-foreground">O estado nutricional M6 não foi atualizado. Consulte Evolução para revisar.</p>:null}
      </CardContent>
    </Card>
    {unavailable||reviewRequired?<Button variant="outline" className="min-h-11 w-full" disabled={pending} onClick={()=>void review()}>Atualizar diário</Button>:null}
    {reviewRequired?<div className="space-y-2 rounded-lg border p-3">
      <p role="alert" className="text-sm">Resultado da última gravação não confirmado. Atualize e confira as refeições abaixo. Não repetiremos a gravação automaticamente.</p>
      <Button variant="outline" className="min-h-11 w-full" disabled={pending||unavailable||!reviewLoaded} onClick={()=>{setReviewRequired(false);setReviewLoaded(false);setActionError("");setFoodId("");setQuantity("");setMealType("");setConfirmation(null);}}>Conferi os registros; liberar nova ação</Button>
    </div>:null}
    {!unavailable&&!complete?<Card>
      <CardHeader className="px-3 pb-2 pt-3"><CardTitle className="text-base">Registrar alimentação</CardTitle></CardHeader>
      <CardContent className="space-y-3 px-3 pb-3">
        {nutrition.meals.length>0?<div className="space-y-2">
          <Label htmlFor="sx01-meal">Refeição</Label>
          <select id="sx01-meal" className={selectClass} value={selectedMeal?.id??""} disabled={blocked} onChange={e=>{setMealId(e.target.value);setFoodId("");setQuantity("");}}>
            <option value="">Escolha a refeição</option>
            {nutrition.meals.map((m,i)=><option key={m.id} value={m.id}>{mealLabel(m.meal_type)} · {m.occurred_at?new Date(m.occurred_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"sem horário"} · {i+1}</option>)}
          </select>
          {selectedMeal?<div className="space-y-2">
            <Label htmlFor="sx01-food">Alimento do catálogo</Label>
            <select id="sx01-food" className={selectClass} value={selectedFood?.id??""} disabled={blocked} onChange={e=>{setFoodId(e.target.value);setQuantity("");setOrigin("declared_quantity");}}>
              <option value="">Escolha o alimento</option>
              {nutrition.foods.map(f=><option key={f.id} value={f.id}>{f.canonical_name}{f.brand?" · "+f.brand:""} ({f.basis_unit})</option>)}
            </select>
            <p className="text-xs text-muted-foreground">Catálogo: até 200 alimentos nesta consulta; a lista pode não ser completa.</p>
            <Label htmlFor="sx01-quantity">Quantidade {selectedFood?"("+selectedFood.basis_unit+")":""}</Label>
            <Input id="sx01-quantity" className="min-h-11" inputMode="decimal" value={quantity} disabled={blocked||!selectedFood} onChange={e=>setQuantity(e.target.value)} placeholder={selectedFood?.basis_unit??"Quantidade"}/>
            <Label htmlFor="sx01-origin">Origem da quantidade</Label>
            <select id="sx01-origin" className={selectClass} value={origin} disabled={blocked||!selectedFood} onChange={e=>setOrigin(e.target.value as FoodLogOrigin)}>
              <option value="declared_quantity">Quantidade informada</option>
              {selectedFood?.basis_unit==="g"?<option value="weighed">Pesada em balança</option>:null}
              <option value="visual_estimate">Estimativa visual</option>
            </select>
            <p className="text-xs text-muted-foreground">Use a unidade e a referência do alimento no catálogo. Quantidade informada ou estimada não é pesagem. Preparo não verificado.</p>
            <Button className="min-h-12 w-full" disabled={!canRegister} onClick={()=>{if(!canRegister||!selectedMeal||!selectedFood)return;void run("Registro enviado.",async()=>{await nutrition.logFoodItem(selectedMeal.id,selectedFood,amount,selectedFood.basis_unit,origin);setFoodId("");setQuantity("");});}}>Registrar alimento</Button>
          </div>:null}
        </div>:null}
        <details open={nutrition.meals.length===0?true:undefined} className="rounded-lg border px-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium"><Plus className="mr-1 h-4 w-4" aria-hidden="true"/>Nova refeição</summary>
          <div className="space-y-2 pb-2">
            <Label htmlFor="sx01-meal-type">Tipo de refeição</Label>
            <select id="sx01-meal-type" className={selectClass} value={mealType} disabled={blocked} onChange={e=>setMealType(e.target.value)}>
              <option value="">Escolha o tipo</option>
              {Object.entries(mealLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
            <Button variant={nutrition.meals.length?"outline":"default"} className="min-h-11 w-full" disabled={blocked||!mealLabels[mealType]} onClick={()=>void run("Refeição enviada.",async()=>{await nutrition.createMeal(mealType);setMealType("");})}>Criar refeição</Button>
          </div>
        </details>
      </CardContent>
    </Card>:null}
    {feedback&&!unavailable?<p role="status" className="text-xs text-muted-foreground">{feedback}</p>:null}
    {actionError?<p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{actionError}</p>:null}
    {!unavailable?<Card>
      <CardHeader className="px-3 pb-2 pt-3"><CardTitle className="text-base">Refeições registradas</CardTitle></CardHeader>
      <CardContent className="space-y-2 px-3 pb-3">
        {nutrition.meals.length===0?<p className="text-sm text-muted-foreground">Nenhuma refeição registrada hoje.</p>:null}
        {nutrition.meals.map((meal,index)=>{
          const items=nutrition.activeItems.filter(i=>i.meal_log_id===meal.id);
          return <details key={meal.id} className="rounded-lg border px-2.5">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">{mealLabel(meal.meal_type)} {index+1} · {items.length} itens · {fmt(sumKnown(items,"energy_kcal_snapshot",false),"kcal")}</summary>
            {items.length===0?<p className="pb-3 text-xs text-muted-foreground">Sem alimentos ativos.</p>:null}
            {items.map(item=><div key={item.id} className="space-y-1 border-t py-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{item.item_name_snapshot}</p>
                  <p className="text-xs text-muted-foreground">{fmt(known(item.quantity),item.unit_code??"")} · {fmt(known(item.energy_kcal_snapshot),"kcal")} · {fmt(known(item.protein_g_snapshot),"g")} proteína</p>
                </div>
                {!complete?<Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" disabled={blocked} aria-label={"Anular "+item.item_name_snapshot} onClick={()=>setConfirmation(item.id)}><Trash2 className="h-4 w-4" aria-hidden="true"/></Button>:null}
              </div>
              {confirmation===item.id&&!complete?<div className="space-y-2"><p className="text-xs">Anular este item preserva o histórico. Confirmar?</p><div className="grid grid-cols-2 gap-2"><Button variant="outline" className="min-h-11" disabled={blocked} onClick={()=>setConfirmation(null)}>Cancelar</Button><Button variant="destructive" className="min-h-11" disabled={blocked} onClick={()=>void run("Anulação enviada.",()=>nutrition.voidItem(item.id))}>Confirmar anulação</Button></div></div>:null}
            </div>)}
          </details>;
        })}
        {complete?<p className="text-xs text-muted-foreground">Reabra o dia antes de alterar refeições ou itens.</p>:null}
        <Button variant="outline" className="min-h-11 w-full" disabled={blocked} onClick={()=>setConfirmation(complete?"reopen":"complete")}>{complete?"Reabrir dia":"Concluir dia"}</Button>
        {confirmation==="complete"||confirmation==="reopen"?<div className="space-y-2 rounded-lg border p-2">
          <p className="text-sm">{complete?"Reabrir para correções?":"Confirmar que terminou o registro de hoje?"+(!nutrition.activeItems.length?" Não há alimentos ativos registrados.":"")}</p>
          <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="min-h-11" disabled={blocked} onClick={()=>setConfirmation(null)}>Cancelar</Button><Button className="min-h-11" disabled={blocked} onClick={()=>void run(complete?"Reabertura enviada.":"Conclusão enviada.",complete?nutrition.reopenToday:nutrition.completeToday)}>{complete?"Confirmar reabertura":"Confirmar conclusão"}</Button></div>
        </div>:null}
      </CardContent>
    </Card>:null}
  </div>;
}
