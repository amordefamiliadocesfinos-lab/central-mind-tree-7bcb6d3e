import { useMemo, useState } from "react";
import { Activity, Apple, BookOpen, Loader2, Plus, RefreshCw, Target, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useHealthAthlete } from "../hooks/useHealthAthlete";
import { useHealthNutritionM5 } from "../hooks/useHealthNutritionM5";
import { useHealthNutritionStateM6 } from "../hooks/useHealthNutritionStateM6";

function num(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function HealthNutritionPage() {
  const { toast } = useToast();
  const { athlete, loading: athleteLoading } = useHealthAthlete();
  const nutrition = useHealthNutritionM5(athlete?.id);
  const nutritionState = useHealthNutritionStateM6(athlete?.id);

  const [planName, setPlanName] = useState("Plano nutricional");
  const [strategy, setStrategy] = useState("maintenance");
  const [energyMin, setEnergyMin] = useState("");
  const [energyMax, setEnergyMax] = useState("");
  const [proteinMin, setProteinMin] = useState("");
  const [proteinMax, setProteinMax] = useState("");

  const [recipeName, setRecipeName] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [yieldAmount, setYieldAmount] = useState("");
  const [yieldUnit, setYieldUnit] = useState("g");
  const [foodId, setFoodId] = useState("");
  const [ingredientQty, setIngredientQty] = useState("");

  const [mealType, setMealType] = useState("lunch");
  const [mealId, setMealId] = useState("");
  const [mealFoodId, setMealFoodId] = useState("");
  const [mealQty, setMealQty] = useState("");

  const selectedRecipe = useMemo(
    () => nutrition.recipes.find((item) => item.id === recipeId) ?? nutrition.recipes.find((item) => item.status === "draft") ?? null,
    [nutrition.recipes, recipeId],
  );
  const selectedRecipeVersion = useMemo(
    () => nutrition.recipeVersions.find((item) => item.recipe_id === selectedRecipe?.id && item.status === "draft")
      ?? nutrition.recipeVersions.find((item) => item.id === selectedRecipe?.current_version_id)
      ?? null,
    [nutrition.recipeVersions, selectedRecipe],
  );

  const run = async (message: string, action: () => Promise<void>) => {
    try {
      await action();
      toast({ title: "Alimentação atualizada", description: message });
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "Não foi possível concluir",
        description: cause instanceof Error ? cause.message : "Tente novamente.",
      });
    }
  };

  if (athleteLoading || nutrition.loading) {
    return <div className="flex min-h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const draftPlan = nutrition.version?.status === "draft";

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Alimentação</h2>
        <p className="mt-1 text-sm text-muted-foreground">Plano → consumo → resposta. M5 registra o fato sem sobrescrever o planejamento.</p>
      </div>

      {nutrition.error ? (
        <Card className="border-destructive/40"><CardContent className="py-3 text-sm text-destructive">{nutrition.error}</CardContent></Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" /> Plano nutricional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!nutrition.plan ? (
            <>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input className="min-h-11" value={planName} onChange={(event) => setPlanName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Estratégia</Label>
                <Select value={strategy} onValueChange={setStrategy}>
                  <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maintenance">Manutenção</SelectItem>
                    <SelectItem value="energy_deficit">Déficit energético</SelectItem>
                    <SelectItem value="energy_surplus">Superávit energético</SelectItem>
                    <SelectItem value="recomposition_support">Apoio à recomposição</SelectItem>
                    <SelectItem value="performance_support">Apoio à performance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="min-h-11 w-full" disabled={nutrition.saving || planName.trim().length < 2}
                onClick={() => void run("Plano draft criado.", () => nutrition.createPlan(planName, strategy))}>
                Criar plano
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 rounded-xl border p-3">
                <div>
                  <p className="font-medium">{nutrition.plan.name}</p>
                  <p className="text-xs text-muted-foreground">{nutrition.version?.strategy_type ?? "—"} · versão {nutrition.version?.version_number ?? "—"}</p>
                </div>
                <Badge variant="outline">{nutrition.version?.status ?? nutrition.plan.status}</Badge>
              </div>

              {draftPlan ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Kcal mín.</Label><Input className="min-h-11" inputMode="numeric" value={energyMin} onChange={(e) => setEnergyMin(e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Kcal máx.</Label><Input className="min-h-11" inputMode="numeric" value={energyMax} onChange={(e) => setEnergyMax(e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Proteína mín. g</Label><Input className="min-h-11" inputMode="decimal" value={proteinMin} onChange={(e) => setProteinMin(e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Proteína máx. g</Label><Input className="min-h-11" inputMode="decimal" value={proteinMax} onChange={(e) => setProteinMax(e.target.value)} /></div>
                  </div>
                  <Button variant="secondary" className="min-h-11 w-full" disabled={nutrition.saving || !num(energyMin)}
                    onClick={() => void run("Metas salvas.", () => nutrition.saveTargets({
                      energy_kcal_min: num(energyMin), energy_kcal_max: num(energyMax),
                      protein_g_min: num(proteinMin), protein_g_max: num(proteinMax),
                    }))}>
                    Salvar metas
                  </Button>
                  <Button className="min-h-11 w-full" disabled={nutrition.saving || !nutrition.target}
                    onClick={() => void run("Plano publicado.", nutrition.publishPlan)}>
                    Publicar plano
                  </Button>
                </>
              ) : nutrition.target ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Energia</p><p className="font-semibold">{nutrition.target.energy_kcal_min ?? "—"}–{nutrition.target.energy_kcal_max ?? "—"} kcal</p></div>
                  <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Proteína</p><p className="font-semibold">{nutrition.target.protein_g_min ?? "—"}–{nutrition.target.protein_g_max ?? "—"} g</p></div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" /> Estado nutricional
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="min-h-10"
              disabled={nutritionState.refreshing}
              onClick={() => void nutritionState.refresh()}
            >
              {nutritionState.refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {nutritionState.error ? (
            <p className="text-sm text-destructive">{nutritionState.error}</p>
          ) : null}

          {!nutritionState.daily ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              O estado M6 ainda não foi calculado para hoje. Atualize depois de registrar ou corrigir a alimentação.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Dia: {nutritionState.daily.state_status}</Badge>
                <Badge variant="outline">Confiança: {nutritionState.daily.confidence}</Badge>
                <Badge variant="outline">Registro: {nutritionState.daily.completeness_status}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Energia observada</p>
                  <p className="font-semibold">
                    {nutritionState.daily.energy_kcal_consumed == null ? "Desconhecida" : `${Math.round(Number(nutritionState.daily.energy_kcal_consumed))} kcal`}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Proteína observada</p>
                  <p className="font-semibold">
                    {nutritionState.daily.protein_g_consumed == null ? "Desconhecida" : `${Number(nutritionState.daily.protein_g_consumed).toFixed(1)} g`}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Energia × meta</p>
                  <p className="font-semibold">{nutritionState.daily.energy_target_status}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Proteína × meta</p>
                  <p className="font-semibold">{nutritionState.daily.protein_target_status}</p>
                </div>
              </div>

              {nutritionState.daily.reason_codes.length ? (
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs font-medium">Por que o estado está assim</p>
                  <p className="mt-1 text-xs text-muted-foreground">{nutritionState.daily.reason_codes.join(" · ")}</p>
                </div>
              ) : null}
            </>
          )}

          {nutritionState.rolling7 ? (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Janela de 7 dias</p>
                  <p className="text-xs text-muted-foreground">
                    {nutritionState.rolling7.observed_day_count}/7 dias observados · {nutritionState.rolling7.sufficient_day_count} suficientes
                  </p>
                </div>
                <Badge variant="outline">{nutritionState.rolling7.coverage_status}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Cobertura observada</p>
                  <p className="font-semibold">{Math.round(Number(nutritionState.rolling7.observation_coverage_ratio) * 100)}%</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Cobertura suficiente</p>
                  <p className="font-semibold">{Math.round(Number(nutritionState.rolling7.sufficient_coverage_ratio) * 100)}%</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Energia na meta</p>
                  <p className="font-semibold">
                    {nutritionState.rolling7.energy_target_adherence_ratio == null
                      ? "Sem base comparável"
                      : `${Math.round(Number(nutritionState.rolling7.energy_target_adherence_ratio) * 100)}%`}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Proteína na meta</p>
                  <p className="font-semibold">
                    {nutritionState.rolling7.protein_target_adherence_ratio == null
                      ? "Sem base comparável"
                      : `${Math.round(Number(nutritionState.rolling7.protein_target_adherence_ratio) * 100)}%`}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            M6 descreve o estado dos dados. Ajustes e recomendações pertencem à M7.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4 text-primary" /> Receitas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input className="min-h-11" placeholder="Nova receita" value={recipeName} onChange={(e) => setRecipeName(e.target.value)} />
            <Button className="min-h-11" disabled={nutrition.saving || recipeName.trim().length < 2}
              onClick={() => void run("Receita draft criada.", async () => { await nutrition.createRecipe(recipeName); setRecipeName(""); })}>
              <Plus className="mr-2 h-4 w-4" /> Criar
            </Button>
          </div>

          {nutrition.recipes.length ? (
            <Select value={selectedRecipe?.id ?? ""} onValueChange={setRecipeId}>
              <SelectTrigger className="min-h-11"><SelectValue placeholder="Escolha uma receita" /></SelectTrigger>
              <SelectContent>
                {nutrition.recipes.map((recipe) => <SelectItem key={recipe.id} value={recipe.id}>{recipe.name} · {recipe.status}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}

          {selectedRecipeVersion?.status === "draft" ? (
            <>
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <Input className="min-h-11" inputMode="decimal" placeholder="Rendimento" value={yieldAmount} onChange={(e) => setYieldAmount(e.target.value)} />
                <Select value={yieldUnit} onValueChange={setYieldUnit}>
                  <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="g">g</SelectItem><SelectItem value="ml">ml</SelectItem><SelectItem value="unit">unidade</SelectItem><SelectItem value="serving">porção</SelectItem></SelectContent>
                </Select>
              </div>
              <Button variant="secondary" className="min-h-11 w-full" disabled={!num(yieldAmount) || nutrition.saving}
                onClick={() => void run("Rendimento atualizado.", () => nutrition.updateRecipeVersion(selectedRecipeVersion.id, {
                  yield_amount: num(yieldAmount), yield_unit: yieldUnit,
                }))}>
                Salvar rendimento
              </Button>

              <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
                <Select value={foodId} onValueChange={setFoodId}>
                  <SelectTrigger className="min-h-11"><SelectValue placeholder="Ingrediente" /></SelectTrigger>
                  <SelectContent>{nutrition.foods.map((food) => <SelectItem key={food.id} value={food.id}>{food.canonical_name}</SelectItem>)}</SelectContent>
                </Select>
                <Input
                  className="min-h-11"
                  inputMode="decimal"
                  placeholder={foodId ? `Quantidade ${nutrition.foods.find((item) => item.id === foodId)?.basis_unit ?? ""}` : "Quantidade"}
                  value={ingredientQty}
                  onChange={(e) => setIngredientQty(e.target.value)}
                />
                <Button variant="outline" className="min-h-11" disabled={!foodId || !num(ingredientQty) || nutrition.saving}
                  onClick={() => void run("Ingrediente adicionado.", async () => {
                    const food = nutrition.foods.find((item) => item.id === foodId);
                    if (!food) throw new Error("Selecione um ingrediente válido.");
                    await nutrition.addRecipeIngredient(selectedRecipeVersion.id, foodId, num(ingredientQty)!, food.basis_unit);
                    setFoodId(""); setIngredientQty("");
                  })}>
                  Adicionar
                </Button>
              </div>
              <Button className="min-h-11 w-full" disabled={nutrition.saving || !selectedRecipeVersion.yield_amount}
                onClick={() => void run("Receita publicada com snapshot congelado.", () => nutrition.publishRecipe(selectedRecipeVersion.id))}>
                Publicar receita
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Apple className="h-4 w-4 text-primary" /> Diário de hoje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="rounded-lg bg-muted/40 p-2"><p className="text-muted-foreground">kcal</p><p className="font-semibold">{Math.round(nutrition.totals.kcal)}</p></div>
            <div className="rounded-lg bg-muted/40 p-2"><p className="text-muted-foreground">P</p><p className="font-semibold">{nutrition.totals.protein.toFixed(1)} g</p></div>
            <div className="rounded-lg bg-muted/40 p-2"><p className="text-muted-foreground">C</p><p className="font-semibold">{nutrition.totals.carbs.toFixed(1)} g</p></div>
            <div className="rounded-lg bg-muted/40 p-2"><p className="text-muted-foreground">G</p><p className="font-semibold">{nutrition.totals.fat.toFixed(1)} g</p></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Select value={mealType} onValueChange={setMealType}>
              <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="breakfast">Café da manhã</SelectItem>
                <SelectItem value="lunch">Almoço</SelectItem>
                <SelectItem value="dinner">Jantar</SelectItem>
                <SelectItem value="snack">Lanche</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
            <Button className="min-h-11" disabled={nutrition.saving} onClick={() => void run("Refeição criada.", () => nutrition.createMeal(mealType))}>
              <Plus className="mr-2 h-4 w-4" /> Refeição
            </Button>
          </div>

          {nutrition.meals.length ? (
            <>
              <Select value={mealId || nutrition.meals[0]?.id || ""} onValueChange={setMealId}>
                <SelectTrigger className="min-h-11"><SelectValue placeholder="Escolha a refeição" /></SelectTrigger>
                <SelectContent>{nutrition.meals.map((meal) => <SelectItem key={meal.id} value={meal.id}>{meal.meal_type}</SelectItem>)}</SelectContent>
              </Select>
              <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
                <Select value={mealFoodId} onValueChange={setMealFoodId}>
                  <SelectTrigger className="min-h-11"><SelectValue placeholder="Alimento" /></SelectTrigger>
                  <SelectContent>{nutrition.foods.map((food) => <SelectItem key={food.id} value={food.id}>{food.canonical_name}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="min-h-11" inputMode="decimal" placeholder="g" value={mealQty} onChange={(e) => setMealQty(e.target.value)} />
                <Button className="min-h-11" disabled={!mealFoodId || !num(mealQty) || nutrition.saving}
                  onClick={() => void run("Alimento registrado.", async () => {
                    const food = nutrition.foods.find((item) => item.id === mealFoodId);
                    const targetMeal = mealId || nutrition.meals[0]?.id;
                    if (!food || !targetMeal) throw new Error("Selecione alimento e refeição.");
                    await nutrition.logFoodItem(targetMeal, food, num(mealQty)!, food.basis_unit);
                    setMealFoodId(""); setMealQty("");
                  })}>
                  Registrar
                </Button>
              </div>
            </>
          ) : null}

          <div className="space-y-2">
            {nutrition.activeItems.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum alimento ativo registrado hoje.</p> :
              nutrition.activeItems.map((item) => (
                <div key={item.id} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.item_name_snapshot}</p>
                    <p className="text-xs text-muted-foreground">{item.quantity ?? "—"} {item.unit_code ?? ""} · {Math.round(Number(item.energy_kcal_snapshot) || 0)} kcal · {Number(item.protein_g_snapshot || 0).toFixed(1)} g proteína</p>
                  </div>
                  <Button size="icon" variant="ghost" className="min-h-11 min-w-11 shrink-0" disabled={nutrition.saving}
                    onClick={() => void run("Item anulado sem apagar o histórico.", () => nutrition.voidItem(item.id))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
