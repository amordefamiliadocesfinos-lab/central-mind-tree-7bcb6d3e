import {useState,useRef} from "react";
import {Button} from "@/components/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Badge} from "@/components/ui/badge";
import {useHealthRecipeReferenceSX02} from "../hooks/useHealthNutritionM5";
import type {useHealthNutritionM5,Recipe,RecipeVersion,RecipeReferenceSX02} from "../hooks/useHealthNutritionM5";
import {formatNumber,validNonnegative,confidenceLabels} from "../cch/nutritionReviewSX02";
type Nutrition=ReturnType<typeof useHealthNutritionM5>;
const selectClass="min-h-11 w-full rounded-md border border-input bg-background px-2 text-sm";
const units:Record<string,string>={g:"g",ml:"ml",unit:"unidade(s)",serving:"porção(ões)"};
const positive=(s:string)=>{const n=validNonnegative(s);return n!==null&&n>0?n:null;};
export function HealthNutritionRecipesSX02({nutrition,athleteId}:{nutrition:Nutrition;athleteId:string}){
 const [recipeId,setRecipeId]=useState("");
 const [name,setName]=useState("");
 const [creating,setCreating]=useState(false);
 const [revision,setRevision]=useState(0);
 const [feedback,setFeedback]=useState("");
 const [busy,setBusy]=useState(false);
 const [failed,setFailed]=useState(false);
 const [reviewed,setReviewed]=useState(false);
 const lock=useRef(false);
 const recipes=nutrition.recipes.filter(r=>r.owner_scope==="global"?r.athlete_id===null:r.owner_scope==="athlete"&&r.athlete_id===athleteId);
 const recipe=recipes.find(r=>r.id===recipeId)??null;
 const version=nutrition.recipeVersions.find(v=>v.recipe_id===recipe?.id&&v.id===recipe?.current_version_id)??nutrition.recipeVersions.find(v=>v.recipe_id===recipe?.id&&v.status==="draft")??null;
 const reference=useHealthRecipeReferenceSX02(version,recipe,athleteId,revision);
 const blocked=busy||nutrition.loading||nutrition.saving||Boolean(nutrition.error)||failed;
 const run=async(action:()=>Promise<void>,message:string)=>{
  if(blocked||lock.current)return;
  lock.current=true;setBusy(true);setFeedback("");
  try{await action();setRevision(v=>v+1);setFeedback(message);}
  catch{setFailed(true);setReviewed(false);setFeedback("Resultado não confirmado. Confira a receita antes de repetir qualquer ação.");}
  finally{lock.current=false;setBusy(false);}
 };
 return <Card data-testid="sx02-recipes"><CardHeader className="px-3 pb-2 pt-3"><CardTitle className="text-lg">Minhas receitas</CardTitle><p className="text-xs text-muted-foreground">Receitas do catálogo e pessoais. Publicar uma receita não registra consumo.</p></CardHeader><CardContent className="space-y-3 px-3 pb-3">
  {nutrition.error?<p role="alert" className="text-sm">Consulta de receitas indisponível. Atualize antes de editar.</p>:<>
   <Label htmlFor="sx02-recipe">Receita</Label><select id="sx02-recipe" className={selectClass} value={recipe?.id??""} disabled={busy||nutrition.saving} onChange={e=>{setRecipeId(e.target.value);setCreating(false);}}><option value="">Escolha uma receita</option>{recipes.map(r=><option key={r.id} value={r.id}>{r.name} · {r.owner_scope==="global"?"Catálogo":r.status==="draft"?"Rascunho":"Pessoal"}</option>)}</select>
   {recipes.length===0?<p className="text-xs text-muted-foreground">Nenhuma receita disponível.</p>:null}
   <Button variant="outline" className="min-h-11 w-full" disabled={blocked} onClick={()=>setCreating(v=>!v)}>{creating?"Recolher criação":"Nova receita"}</Button>
   {creating?<div className="space-y-2 rounded-lg border p-3"><Label htmlFor="sx02-recipe-name">Nome</Label><Input id="sx02-recipe-name" className="min-h-11" value={name} disabled={blocked} onChange={e=>setName(e.target.value)}/><Button className="min-h-11 w-full" disabled={blocked||name.trim().length<2} onClick={()=>void run(async()=>{await nutrition.createRecipe(name);setName("");setCreating(false);},"Rascunho criado. Selecione a receita para continuar.")}>Criar rascunho de receita</Button></div>:null}
   {recipe&&version?<RecipeReview key={version.id+":"+version.status+":"+String(version.yield_amount)+":"+version.yield_unit} nutrition={nutrition} athleteId={athleteId} recipe={recipe} version={version} reference={reference} blocked={blocked} run={run} onReload={()=>setRevision(v=>v+1)}/>:recipe?<p className="text-sm text-muted-foreground">Versão não disponível.</p>:null}
  </>}
  {feedback?<p role={failed?"alert":"status"} className="text-sm">{feedback}</p>:null}
  {failed||nutrition.error?<Button variant="outline" className="min-h-11 w-full" disabled={busy||nutrition.loading} onClick={()=>void(async()=>{setBusy(true);setReviewed(false);try{await nutrition.reload(true);setRevision(v=>v+1);setReviewed(true);setFeedback("Confira os dados atualizados.");}catch{setFeedback("Consulta não confirmada.");}finally{setBusy(false);}})()}>Conferir receitas</Button>:null}
  {failed&&reviewed&&!nutrition.error&&(!version||reference.status==="ready")?<Button variant="outline" className="min-h-11 w-full" onClick={()=>{setFailed(false);setReviewed(false);setFeedback("");setRecipeId("");setName("");}}>Conferi; liberar nova ação</Button>:null}
 </CardContent></Card>;
}
export function RecipeReview({nutrition,athleteId,recipe,version,reference,blocked,run,onReload}:{nutrition:Nutrition;athleteId:string;recipe:Recipe;version:RecipeVersion;reference:RecipeReferenceSX02;blocked:boolean;run:(action:()=>Promise<void>,message:string)=>Promise<void>;onReload:()=>void}){
 const [yieldAmount,setYieldAmount]=useState(version.yield_amount==null?"":String(version.yield_amount));
 const [yieldUnit,setYieldUnit]=useState(version.yield_unit??"g");
 const [foodId,setFoodId]=useState("");
 const [qty,setQty]=useState("");
 const [confirm,setConfirm]=useState(false);
 const draft=version.status==="draft"&&recipe.owner_scope==="athlete"&&recipe.athlete_id===athleteId&&version.athlete_id===athleteId;
 const food=nutrition.foods.find(f=>f.id===foodId);
 const amount=positive(yieldAmount);
 const qtyValue=positive(qty);
 const yieldDirty=amount!==version.yield_amount||yieldUnit!==version.yield_unit;
 const ready=reference.status==="ready";
 const canPublish=draft&&ready&&!blocked&&!yieldDirty&&version.yield_amount!=null&&version.yield_amount>0&&Boolean(version.yield_unit)&&reference.ingredients.length>0;
 const snapshot=reference.snapshot;
 return <section className="space-y-3 rounded-lg border p-3" data-testid="sx02-recipe-review">
  <div className="flex flex-wrap justify-between gap-2"><div className="min-w-0"><p className="font-semibold break-words">{recipe.name}</p><p className="text-xs text-muted-foreground">Versão {version.version_number??"—"} · {recipe.owner_scope==="global"?"Catálogo global":"Receita pessoal"}</p></div><Badge variant="outline">{version.status==="published"?"Publicada":"Rascunho"}</Badge></div>
  <div className="grid grid-cols-2 gap-2"><div className="rounded-md bg-muted/25 p-2"><p className="text-xs text-muted-foreground">Rendimento salvo</p><p className="text-sm font-semibold">{formatNumber(version.yield_amount)} {version.yield_unit?units[version.yield_unit]??version.yield_unit:""}</p></div><div className="rounded-md bg-muted/25 p-2"><p className="text-xs text-muted-foreground">Porções salvas</p><p className="text-sm font-semibold">{formatNumber(version.servings)}</p></div></div>
  {reference.status==="loading"?<p role="status" className="text-xs">Consultando a versão selecionada…</p>:null}
  {reference.status==="unavailable"?<div><p role="alert" className="text-xs">Referência desta versão indisponível; não serão estimados nutrientes.</p><Button variant="outline" className="min-h-11 w-full" onClick={onReload}>Consultar novamente</Button></div>:null}
  {version.status==="published"&&ready&&snapshot?<div className="space-y-2" data-testid="sx02-recipe-snapshot">
   <p className="text-sm font-medium">Composição congelada na publicação</p><p className="text-xs text-muted-foreground">Valores para a base registrada de {formatNumber(snapshot.basis_amount)} {snapshot.basis_unit?units[snapshot.basis_unit]??snapshot.basis_unit:"(unidade não definida)"}. Não são valores por 100 g ou por porção, salvo quando a base assim indicar.</p>
   <div className="grid grid-cols-2 gap-2">{([["Energia",snapshot.energy_kcal,"kcal"],["Proteínas",snapshot.protein_g,"g"],["Carboidratos",snapshot.carbohydrate_g,"g"],["Gorduras",snapshot.fat_g,"g"],["Fibras",snapshot.fiber_g,"g"]] as const).map(([label,value,unit])=><div key={label} className="rounded-md bg-muted/25 p-2"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold text-sm">{formatNumber(value)}{value==null?"":" "+unit}</p></div>)}</div>
   <details className="rounded-md border px-2"><summary className="min-h-11 py-3 cursor-pointer text-sm">Ingredientes e origem</summary><p className="text-xs text-muted-foreground">Método: {snapshot.calculation_method} · confiança {confidenceLabels[snapshot.confidence]??snapshot.confidence} · cálculo {snapshot.calculated_at} · algoritmo {snapshot.algorithm_version??"—"}</p>{reference.frozenIngredients.map(i=><div key={i.id} className="border-t py-2 text-xs"><p className="font-medium">{i.food_name_snapshot} · {formatNumber(i.quantity)} {units[i.unit_code]??i.unit_code}</p><p className="text-muted-foreground">Qualidade: {i.data_quality_snapshot??"não disponível"} · Fonte: {i.source_version_snapshot??"não disponível"}</p></div>)}</details>
  </div>:null}
  {draft?<div className="space-y-3">
   {ready?<div className="space-y-1"><p className="text-sm font-medium">Ingredientes registrados ({reference.ingredients.length})</p>{reference.ingredients.map(i=><p key={i.id} className="text-xs break-words border-b py-1">{nutrition.foods.find(f=>f.id===i.food_id)?.canonical_name??"Alimento fora da lista consultada"} · {formatNumber(i.quantity)} {units[i.unit_code]??i.unit_code}</p>)}</div>:null}
   <details className="rounded-lg border px-2"><summary className="min-h-11 py-3 cursor-pointer text-sm font-medium">Editar rendimento</summary><div className="space-y-2 pb-2"><Label htmlFor="sx02-yield">Quantidade de rendimento</Label><Input id="sx02-yield" className="min-h-11" inputMode="decimal" value={yieldAmount} disabled={blocked} onChange={e=>{setYieldAmount(e.target.value);setConfirm(false);}}/><Label htmlFor="sx02-yield-unit">Unidade</Label><select id="sx02-yield-unit" className={selectClass} value={yieldUnit} disabled={blocked} onChange={e=>{setYieldUnit(e.target.value);setConfirm(false);}}>{Object.entries(units).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><Button variant="secondary" className="min-h-11 w-full" disabled={blocked||!amount||!yieldDirty} onClick={()=>void run(()=>nutrition.updateRecipeVersion(version.id,{yield_amount:amount,yield_unit:yieldUnit}),"Rendimento salvo.")}>Salvar rendimento</Button></div></details>
   <details className="rounded-lg border px-2"><summary className="min-h-11 py-3 cursor-pointer text-sm font-medium">Adicionar ingrediente</summary><div className="space-y-2 pb-2"><Label htmlFor="sx02-ingredient">Alimento do catálogo</Label><select id="sx02-ingredient" className={selectClass} value={foodId} disabled={blocked} onChange={e=>{setFoodId(e.target.value);setQty("");setConfirm(false);}}><option value="">Escolha o ingrediente</option>{nutrition.foods.map(f=><option key={f.id} value={f.id}>{f.canonical_name}{f.brand?" · "+f.brand:""} ({f.basis_unit})</option>)}</select><p className="text-xs text-muted-foreground">Até 200 alimentos consultados.</p><Label htmlFor="sx02-ingredient-qty">Quantidade {food?"("+food.basis_unit+")":""}</Label><Input id="sx02-ingredient-qty" className="min-h-11" inputMode="decimal" value={qty} disabled={blocked||!food} onChange={e=>setQty(e.target.value)}/><Button className="min-h-11 w-full" variant="secondary" disabled={blocked||!ready||!food||!qtyValue||!["g","ml","unit"].includes(food.basis_unit)} onClick={()=>{if(food&&qtyValue)void run(async()=>{await nutrition.addRecipeIngredient(version.id,food.id,qtyValue,food.basis_unit);setFoodId("");setQty("");setConfirm(false);},"Ingrediente adicionado.");}}>Adicionar ingrediente</Button></div></details>
   {yieldDirty?<p className="text-xs text-muted-foreground">Salve o rendimento antes de publicar.</p>:null}
   <p className="text-xs text-muted-foreground">A composição é calculada pelo escritor existente na publicação. Não é estimada nesta tela.</p>
   <Button className="min-h-11 w-full" disabled={!canPublish||confirm} onClick={()=>setConfirm(true)}>Revisar publicação da receita</Button>
   {confirm?<div className="space-y-2 rounded-lg border p-2"><p className="text-sm">Publicar e congelar a composição desta versão? Registros de consumo anteriores não mudam.</p><div className="grid grid-cols-2 gap-2"><Button variant="outline" className="min-h-11" onClick={()=>setConfirm(false)} disabled={blocked}>Cancelar</Button><Button className="min-h-11" disabled={!canPublish} onClick={()=>void run(()=>nutrition.publishRecipe(version.id),"Receita publicada; confira a referência congelada.")}>Confirmar publicação</Button></div></div>:null}
  </div>:<p className="text-xs text-muted-foreground">Versão somente para consulta. Valores ausentes não significam zero.</p>}
 </section>;
}
