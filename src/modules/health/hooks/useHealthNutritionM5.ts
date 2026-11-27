import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type LooseTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type LooseDatabase = {
  public: {
    Tables: Record<string, LooseTable>;
    Views: Record<string, never>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type LooseOperationResult = {
  data?: unknown;
  error?: { message: string } | null;
};

const db = supabase as unknown as SupabaseClient<LooseDatabase>;

export type NutritionPlan = {
  id: string; athlete_id: string; current_version_id: string | null; name: string; status: string;
};
export type NutritionPlanVersion = {
  id: string; plan_id: string; athlete_id: string; version_number: number; status: string;
  strategy_type: string; title: string; rationale: string | null;
};
export type NutritionTarget = {
  id: string; plan_version_id: string; athlete_id: string;
  energy_kcal_min: number | null; energy_kcal_max: number | null;
  protein_g_min: number | null; protein_g_max: number | null;
  carbohydrate_g_min: number | null; carbohydrate_g_max: number | null;
  fat_g_min: number | null; fat_g_max: number | null;
  fiber_g_min: number | null; fiber_g_max: number | null;
};
export type Recipe = { id: string; athlete_id: string | null; name: string; status: string; current_version_id: string | null; owner_scope: string; };
export type RecipeVersion = {
  id: string; recipe_id: string; athlete_id: string | null; status: string; title: string;
  yield_amount: number | null; yield_unit: string | null; servings: number | null;
};
export type Food = { id: string; canonical_name: string; brand: string | null; basis_amount: number; basis_unit: string; energy_kcal: number | null; protein_g: number | null; };
export type FoodLogDay = { id: string; athlete_id: string; log_date: string; completeness_status: string; registration_level: string; confidence: string; };
export type MealLog = { id: string; food_log_day_id: string; athlete_id: string; meal_type: string; occurred_at: string | null; };
export type MealItem = {
  id: string; meal_log_id: string; athlete_id: string; item_name_snapshot: string; quantity: number | null;
  unit_code: string | null; energy_kcal_snapshot: number | null; protein_g_snapshot: number | null;
  carbohydrate_g_snapshot: number | null; fat_g_snapshot: number | null; fiber_g_snapshot?: number | null; status: string;
};

export type FoodLogOrigin = "declared_quantity" | "weighed" | "visual_estimate";

type State = {
  readDate: string | null;
  plan: NutritionPlan | null;
  version: NutritionPlanVersion | null;
  target: NutritionTarget | null;
  recipes: Recipe[];
  recipeVersions: RecipeVersion[];
  foods: Food[];
  day: FoodLogDay | null;
  meals: MealLog[];
  items: MealItem[];
};

const emptyState: State = {
  readDate: null, plan: null, version: null, target: null, recipes: [], recipeVersions: [], foods: [], day: null, meals: [], items: [],
};

function clientEventId() {
  return crypto.randomUUID();
}

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function useHealthNutritionM5(athleteId: string | null | undefined) {
  const [state, setState] = useState<State>(emptyState);
  const [loading, setLoading] = useState(Boolean(athleteId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const reload = useCallback(async (strict=false) => {
    const request=++generation.current;
    if (!athleteId) {
      setState(emptyState);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const today = todayIso();
    const fail=(message:string)=>{
      if(request===generation.current){setError(message);setLoading(false);}
      if(strict)throw new Error(message);
    };
    try {

    const [planResult, recipesResult, foodsResult, dayResult] = await Promise.all([
      db.from("health_nutrition_plans").select("*").eq("athlete_id", athleteId)
        .in("status", ["active", "draft", "paused"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("health_recipes").select("*").or(`athlete_id.eq.${athleteId},owner_scope.eq.global`)
        .in("status", ["active", "draft"]).order("created_at", { ascending: false }),
      db.from("health_foods").select("id,canonical_name,brand,basis_amount,basis_unit,energy_kcal,protein_g")
        .eq("is_active", true).order("canonical_name", { ascending: true }).limit(200),
      db.from("health_food_log_days").select("*").eq("athlete_id", athleteId).eq("log_date", today).maybeSingle(),
    ]);

    const firstError = planResult.error ?? recipesResult.error ?? foodsResult.error ?? dayResult.error;
    if (firstError) {
      fail(firstError.message);
      return;
    }

    const plan = planResult.data as NutritionPlan | null;
    let version: NutritionPlanVersion | null = null;
    let target: NutritionTarget | null = null;

    if (plan) {
      const versionsResult = await db.from("health_nutrition_plan_versions").select("*")
        .eq("plan_id", plan.id).eq("athlete_id", athleteId).order("version_number", { ascending: false });
      if (versionsResult.error) {
        fail(versionsResult.error.message);
      return;
      }
      const versions = (versionsResult.data ?? []) as NutritionPlanVersion[];
      version = versions.find((item) => item.id === plan.current_version_id)
        ?? versions.find((item) => item.status === "draft")
        ?? versions[0]
        ?? null;
      if (version) {
        const targetResult = await db.from("health_nutrition_targets").select("*")
          .eq("plan_version_id", version.id).eq("athlete_id", athleteId).maybeSingle();
        if (targetResult.error) {
          fail(targetResult.error.message);
      return;
        }
        target = targetResult.data as NutritionTarget | null;
      }
    }

    const recipes = (recipesResult.data ?? []) as Recipe[];
    let recipeVersions: RecipeVersion[] = [];
    if (recipes.length) {
      const recipeIds = recipes.map((item) => item.id);
      const rv = await db.from("health_recipe_versions").select("*").in("recipe_id", recipeIds)
        .order("version_number", { ascending: false });
      if (rv.error) {
        fail(rv.error.message);
      return;
      }
      recipeVersions = (rv.data ?? []) as RecipeVersion[];
    }

    const day = dayResult.data as FoodLogDay | null;
    let meals: MealLog[] = [];
    let items: MealItem[] = [];
    if (day) {
      const mealResult = await db.from("health_meal_logs").select("*", { count: "exact" })
        .eq("food_log_day_id", day.id).eq("athlete_id", athleteId).order("occurred_at", { ascending: true });
      if (mealResult.error) {
        fail(mealResult.error.message);
      return;
      }
      meals = (mealResult.data ?? []) as MealLog[];
      if(mealResult.count!==meals.length){fail("Consulta de refeições incompleta. Atualize antes de registrar.");return;}
      if (meals.length) {
        const itemResult = await db.from("health_meal_items").select("*", { count: "exact" }).in("meal_log_id", meals.map((meal) => meal.id))
          .eq("athlete_id", athleteId).order("created_at", { ascending: true });
        if (itemResult.error) {
          fail(itemResult.error.message);
      return;
        }
        items = (itemResult.data ?? []) as MealItem[];
        if(itemResult.count!==items.length){fail("Consulta de itens incompleta. Atualize antes de registrar.");return;}
      }
    }

    if(request!==generation.current){if(strict)throw new Error("Consulta substituída. Confira o diário atualizado.");return;}
    if(today!==todayIso()){fail("A data mudou durante a consulta. Atualize o diário.");return;}
    setState({
      readDate: today,
      plan,
      version,
      target,
      recipes,
      recipeVersions,
      foods: (foodsResult.data ?? []) as Food[],
      day,
      meals,
      items,
    });
    setLoading(false);
    } catch(cause) {
      fail(cause instanceof Error?cause.message:"Falha ao consultar alimentação.");
    }
  }, [athleteId]);

  useEffect(() => { void reload(); return ()=>{generation.current++;}; }, [reload]);

  const run = useCallback(async (operation: () => PromiseLike<LooseOperationResult>) => {
    setSaving(true);
    setError(null);
    try {
      const result = await operation();
      if (result?.error) throw new Error(result.error.message);
      await reload(true);
      return result?.data;
    } finally {
      setSaving(false);
    }
  }, [reload]);

  const createPlan = useCallback(async (name: string, strategyType: string) => {
    if (!athleteId) throw new Error("Atleta não disponível.");
    await run(() => db.rpc("health_m5_create_nutrition_plan_draft", {
      p_athlete_id: athleteId,
      p_name: name.trim(),
      p_goal_id: null,
      p_goal_phase_id: null,
      p_strategy_type: strategyType,
      p_title: "Versão 1",
    }));
  }, [athleteId, run]);

  const saveTargets = useCallback(async (values: Partial<NutritionTarget>) => {
    if (!athleteId || !state.version) throw new Error("Versão nutricional não disponível.");
    await run(() => db.from("health_nutrition_targets").upsert({
      athlete_id: athleteId,
      plan_version_id: state.version!.id,
      ...values,
    }, { onConflict: "plan_version_id,athlete_id" }));
  }, [athleteId, run, state.version]);

  const publishPlan = useCallback(async () => {
    if (!state.version) throw new Error("Versão nutricional não disponível.");
    await run(() => db.rpc("health_m5_publish_nutrition_plan_version", {
      p_plan_version_id: state.version!.id,
    }));
  }, [run, state.version]);

  const createRecipe = useCallback(async (name: string) => {
    if (!athleteId) throw new Error("Atleta não disponível.");
    await run(() => db.rpc("health_m5_create_recipe_draft", {
      p_athlete_id: athleteId,
      p_name: name.trim(),
      p_title: name.trim(),
    }));
  }, [athleteId, run]);

  const updateRecipeVersion = useCallback(async (versionId: string, values: Partial<RecipeVersion>) => {
    await run(() => db.from("health_recipe_versions").update(values).eq("id", versionId));
  }, [run]);

  const addRecipeIngredient = useCallback(async (versionId: string, foodId: string, quantity: number, unitCode: string) => {
    if (!athleteId) throw new Error("Atleta não disponível.");
    const count = await db.from("health_recipe_ingredients").select("id", { count: "exact", head: true })
      .eq("recipe_version_id", versionId);
    if (count.error) throw new Error(count.error.message);
    await run(() => db.from("health_recipe_ingredients").insert({
      recipe_version_id: versionId,
      athlete_id: athleteId,
      food_id: foodId,
      sequence_order: (count.count ?? 0) + 1,
      quantity,
      unit_code: unitCode,
      preparation_state: "prepared",
    }));
  }, [athleteId, run]);

  const publishRecipe = useCallback(async (versionId: string) => {
    await run(() => db.rpc("health_m5_publish_recipe_version", { p_recipe_version_id: versionId }));
  }, [run]);

  const assertDiaryDate = useCallback(() => {
    if(!athleteId || state.readDate!==todayIso() || (state.day && (state.day.athlete_id!==athleteId || state.day.log_date!==state.readDate))) throw new Error("Atualize o diário da data atual antes de continuar.");
    return state.readDate;
  }, [athleteId,state.readDate,state.day]);

  const ensureToday = useCallback(async () => {
    const date=assertDiaryDate();
    if (!athleteId) throw new Error("Atleta não disponível.");
    if (state.day) return state.day.id;
    const result = await db.from("health_food_log_days").insert({
      athlete_id: athleteId,
      log_date: date,
      completeness_status: "partial",
      registration_level: "intermediate",
      confidence: "moderate",
    }).select("id").single();
    if (result.error) throw new Error(result.error.message);
    await reload(true);
    return result.data.id as string;
  }, [athleteId, reload, state.day, assertDiaryDate]);

  const createMeal = useCallback(async (mealType: string) => {
    if (!athleteId) throw new Error("Atleta não disponível.");
    setSaving(true);
    setError(null);
    try {
      const dayId = await ensureToday();
      assertDiaryDate();
      const result = await db.from("health_meal_logs").insert({
        food_log_day_id: dayId,
        athlete_id: athleteId,
        meal_type: mealType,
        occurred_at: new Date().toISOString(),
        data_source: "USER_REPORTED",
      });
      if (result.error) throw new Error(result.error.message);
      await reload(true);
    } finally {
      setSaving(false);
    }
  }, [athleteId, ensureToday, reload, assertDiaryDate]);

  const logFoodItem = useCallback(async (mealId: string, food: Food, quantity: number, unitCode: string, origin: FoodLogOrigin = "declared_quantity") => {
    assertDiaryDate();
    if(!state.meals.some(m=>m.id===mealId&&m.athlete_id===athleteId&&m.food_log_day_id===state.day?.id)||state.day?.completeness_status==="complete")throw new Error("Refeição indisponível para registro.");
    if(!["g","ml","unit"].includes(unitCode)||unitCode!==food.basis_unit||!Number.isFinite(quantity)||quantity<=0||!["declared_quantity","weighed","visual_estimate"].includes(origin)||(origin==="weighed"&&unitCode!=="g"))throw new Error("Confira quantidade, unidade e origem.");
    await run(() => db.rpc("health_m5_log_meal_item", {
      p_meal_log_id: mealId,
      p_client_event_id: clientEventId(),
      p_item_name: food.canonical_name,
      p_quantity: quantity,
      p_unit_code: unitCode,
      p_food_id: food.id,
      p_recipe_version_id: null,
      p_estimation_method: origin,
      p_data_source: origin==="weighed"?"MEASURED":"USER_REPORTED",
      p_confidence: origin==="weighed"?"high":origin==="visual_estimate"?"low":"moderate",
      p_household_measure_text: null,
      p_preparation_state: "unknown",
    }));
  }, [run, assertDiaryDate, state.meals, state.day, athleteId]);

  const voidItem = useCallback(async (itemId: string) => {
    assertDiaryDate();
    if(state.day?.completeness_status==="complete"||!state.items.some(i=>i.id===itemId&&i.athlete_id===athleteId&&i.status==="active"))throw new Error("Item indisponível para correção.");
    await run(() => db.rpc("health_m5_void_meal_item", {
      p_item_id: itemId,
      p_client_event_id: clientEventId(),
      p_reason: "Removido pelo usuário",
    }));
  }, [run, assertDiaryDate, state.day, state.items, athleteId]);

  const completeToday = useCallback(async () => {
    const dayId = await ensureToday();
    assertDiaryDate();
    await run(() => db.rpc("health_m5_complete_food_log_day", {
      p_day_id: dayId,
      p_client_event_id: clientEventId(),
    }));
  }, [ensureToday, run, assertDiaryDate]);

  const reopenToday = useCallback(async () => {
    assertDiaryDate();
    if (!state.day) throw new Error("Diário de hoje não disponível.");
    await run(() => db.rpc("health_m5_reopen_food_log_day", {
      p_day_id: state.day!.id,
      p_client_event_id: clientEventId(),
    }));
  }, [run, state.day, assertDiaryDate]);

  const activeItems = useMemo(() => state.items.filter((item) => item.status === "active"), [state.items]);

  const totals = useMemo(() => activeItems.reduce((acc, item) => ({
    kcal: acc.kcal + (Number(item.energy_kcal_snapshot) || 0),
    protein: acc.protein + (Number(item.protein_g_snapshot) || 0),
    carbs: acc.carbs + (Number(item.carbohydrate_g_snapshot) || 0),
    fat: acc.fat + (Number(item.fat_g_snapshot) || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }), [activeItems]);

  return {
    ...state,
    activeItems,
    totals,
    loading,
    saving,
    error,
    reload,
    createPlan,
    saveTargets,
    publishPlan,
    createRecipe,
    updateRecipeVersion,
    addRecipeIngredient,
    publishRecipe,
    createMeal,
    logFoodItem,
    voidItem,
    completeToday,
    reopenToday,
  };
}
