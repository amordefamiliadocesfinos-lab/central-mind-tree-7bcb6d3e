import { useCallback, useEffect, useMemo, useState } from "react";
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
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type LooseOperationResult = {
  data?: unknown;
  error?: { message: string } | null;
};

const db = supabase as unknown as SupabaseClient<LooseDatabase>;

export type NutritionDayPatternF18 = {
  id: string;
  plan_version_id: string;
  athlete_id: string;
  code: string;
  name: string;
  day_type: "default" | "training" | "rest" | "custom";
  sequence_order: number;
  is_default: boolean;
  notes: string | null;
};

export type NutritionPlannedMealF18 = {
  id: string;
  day_pattern_id: string;
  plan_version_id: string;
  athlete_id: string;
  meal_type:
    | "breakfast"
    | "lunch"
    | "dinner"
    | "snack"
    | "pre_workout"
    | "post_workout"
    | "other";
  name: string;
  sequence_order: number;
  time_start: string | null;
  time_end: string | null;
  notes: string | null;
};

export type NutritionPlannedItemF18 = {
  id: string;
  planned_meal_id: string;
  plan_version_id: string;
  athlete_id: string;
  sequence_order: number;
  source_kind: "food" | "recipe";
  food_id: string | null;
  recipe_version_id: string | null;
  item_name_snapshot: string;
  quantity: number;
  unit_code: "g" | "ml" | "unit" | "serving";
  energy_kcal_snapshot: number | null;
  protein_g_snapshot: number | null;
  carbohydrate_g_snapshot: number | null;
  fat_g_snapshot: number | null;
  fiber_g_snapshot: number | null;
  is_optional: boolean;
  notes: string | null;
};

export type NutritionItemAlternativeF18 = {
  id: string;
  planned_item_id: string;
  plan_version_id: string;
  athlete_id: string;
  sequence_order: number;
  source_kind: "food" | "recipe";
  food_id: string | null;
  recipe_version_id: string | null;
  item_name_snapshot: string;
  quantity: number;
  unit_code: "g" | "ml" | "unit" | "serving";
  energy_kcal_snapshot: number | null;
  protein_g_snapshot: number | null;
  carbohydrate_g_snapshot: number | null;
  fat_g_snapshot: number | null;
  fiber_g_snapshot: number | null;
  notes: string | null;
};

type State = {
  dayPatterns: NutritionDayPatternF18[];
  meals: NutritionPlannedMealF18[];
  items: NutritionPlannedItemF18[];
  alternatives: NutritionItemAlternativeF18[];
};

const emptyState: State = {
  dayPatterns: [],
  meals: [],
  items: [],
  alternatives: [],
};

function nextSequence(values: number[]) {
  return values.length ? Math.max(...values) + 1 : 1;
}

function nextPatternCode(
  patterns: NutritionDayPatternF18[],
  dayType: NutritionDayPatternF18["day_type"],
  sequence: number,
) {
  const base =
    dayType === "default"
      ? "DEFAULT"
      : dayType === "training"
        ? "TRAINING"
        : dayType === "rest"
          ? "REST"
          : `DAY_${sequence}`;

  const existing = new Set(patterns.map((item) => item.code));
  if (!existing.has(base)) return base;

  let suffix = 2;
  while (existing.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

export function useHealthMealPlanF18(
  athleteId: string | null | undefined,
  planVersionId: string | null | undefined,
) {
  const [state, setState] = useState<State>(emptyState);
  const [loading, setLoading] = useState(Boolean(athleteId && planVersionId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!athleteId || !planVersionId) {
      setState(emptyState);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const [patternsResult, mealsResult, itemsResult, alternativesResult] =
      await Promise.all([
        db
          .from("health_nutrition_day_patterns")
          .select("*")
          .eq("athlete_id", athleteId)
          .eq("plan_version_id", planVersionId)
          .order("sequence_order", { ascending: true }),
        db
          .from("health_nutrition_planned_meals")
          .select("*")
          .eq("athlete_id", athleteId)
          .eq("plan_version_id", planVersionId)
          .order("sequence_order", { ascending: true }),
        db
          .from("health_nutrition_planned_items")
          .select("*")
          .eq("athlete_id", athleteId)
          .eq("plan_version_id", planVersionId)
          .order("sequence_order", { ascending: true }),
        db
          .from("health_nutrition_item_alternatives")
          .select("*")
          .eq("athlete_id", athleteId)
          .eq("plan_version_id", planVersionId)
          .order("sequence_order", { ascending: true }),
      ]);

    const firstError =
      patternsResult.error ??
      mealsResult.error ??
      itemsResult.error ??
      alternativesResult.error;

    if (firstError) {
      setState(emptyState);
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setState({
      dayPatterns:
        (patternsResult.data ?? []) as unknown as NutritionDayPatternF18[],
      meals: (mealsResult.data ?? []) as unknown as NutritionPlannedMealF18[],
      items: (itemsResult.data ?? []) as unknown as NutritionPlannedItemF18[],
      alternatives:
        (alternativesResult.data ??
          []) as unknown as NutritionItemAlternativeF18[],
    });
    setLoading(false);
  }, [athleteId, planVersionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(
    async (operation: () => PromiseLike<LooseOperationResult>) => {
      setSaving(true);
      setError(null);
      try {
        const result = await operation();
        if (result?.error) throw new Error(result.error.message);
        await reload();
        return result?.data;
      } finally {
        setSaving(false);
      }
    },
    [reload],
  );

  const createDayPattern = useCallback(
    async (
      name: string,
      dayType: NutritionDayPatternF18["day_type"],
      isDefault: boolean,
    ) => {
      if (!athleteId || !planVersionId) {
        throw new Error("Versão nutricional não disponível.");
      }

      const normalizedName = name.trim();
      if (normalizedName.length < 2) {
        throw new Error("Informe um nome para o padrão de dia.");
      }

      const sequence = nextSequence(
        state.dayPatterns.map((item) => item.sequence_order),
      );
      const code = nextPatternCode(state.dayPatterns, dayType, sequence);

      if (isDefault) {
        const currentDefault = state.dayPatterns.find((item) => item.is_default);
        if (currentDefault) {
          const clearResult = await db
            .from("health_nutrition_day_patterns")
            .update({ is_default: false })
            .eq("id", currentDefault.id)
            .eq("athlete_id", athleteId);
          if (clearResult.error) throw new Error(clearResult.error.message);
        }
      }

      await run(() =>
        db.from("health_nutrition_day_patterns").insert({
          plan_version_id: planVersionId,
          athlete_id: athleteId,
          code,
          name: normalizedName,
          day_type: dayType,
          sequence_order: sequence,
          is_default: isDefault,
        }),
      );
    },
    [athleteId, planVersionId, run, state.dayPatterns],
  );

  const updateDayPattern = useCallback(
    async (
      patternId: string,
      values: Partial<
        Pick<NutritionDayPatternF18, "name" | "day_type" | "notes">
      >,
    ) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      await run(() =>
        db
          .from("health_nutrition_day_patterns")
          .update(values)
          .eq("id", patternId)
          .eq("athlete_id", athleteId),
      );
    },
    [athleteId, run],
  );

  const deleteDayPattern = useCallback(
    async (patternId: string) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      await run(() =>
        db
          .from("health_nutrition_day_patterns")
          .delete()
          .eq("id", patternId)
          .eq("athlete_id", athleteId),
      );
    },
    [athleteId, run],
  );

  const createMeal = useCallback(
    async (
      dayPatternId: string,
      values: {
        name: string;
        mealType: NutritionPlannedMealF18["meal_type"];
        timeStart?: string | null;
        timeEnd?: string | null;
      },
    ) => {
      if (!athleteId || !planVersionId) {
        throw new Error("Versão nutricional não disponível.");
      }

      const normalizedName = values.name.trim();
      if (normalizedName.length < 2) {
        throw new Error("Informe o nome da refeição.");
      }

      const patternExists = state.dayPatterns.some(
        (item) => item.id === dayPatternId,
      );
      if (!patternExists) throw new Error("Padrão de dia inválido.");

      const sequence = nextSequence(
        state.meals
          .filter((item) => item.day_pattern_id === dayPatternId)
          .map((item) => item.sequence_order),
      );

      await run(() =>
        db.from("health_nutrition_planned_meals").insert({
          day_pattern_id: dayPatternId,
          plan_version_id: planVersionId,
          athlete_id: athleteId,
          meal_type: values.mealType,
          name: normalizedName,
          sequence_order: sequence,
          time_start: values.timeStart || null,
          time_end: values.timeEnd || null,
        }),
      );
    },
    [athleteId, planVersionId, run, state.dayPatterns, state.meals],
  );

  const updateMeal = useCallback(
    async (
      mealId: string,
      values: Partial<
        Pick<
          NutritionPlannedMealF18,
          "name" | "meal_type" | "time_start" | "time_end" | "notes"
        >
      >,
    ) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      await run(() =>
        db
          .from("health_nutrition_planned_meals")
          .update(values)
          .eq("id", mealId)
          .eq("athlete_id", athleteId),
      );
    },
    [athleteId, run],
  );

  const deleteMeal = useCallback(
    async (mealId: string) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      await run(() =>
        db
          .from("health_nutrition_planned_meals")
          .delete()
          .eq("id", mealId)
          .eq("athlete_id", athleteId),
      );
    },
    [athleteId, run],
  );

  const addPlannedItem = useCallback(
    async (
      mealId: string,
      values: {
        sourceKind: "food" | "recipe";
        sourceId: string;
        quantity: number;
        unitCode: "g" | "ml" | "unit" | "serving";
        isOptional?: boolean;
        notes?: string | null;
      },
    ) => {
      if (!athleteId || !planVersionId) {
        throw new Error("Versão nutricional não disponível.");
      }
      if (!Number.isFinite(values.quantity) || values.quantity <= 0) {
        throw new Error("Quantidade inválida.");
      }

      const sequence = nextSequence(
        state.items
          .filter((item) => item.planned_meal_id === mealId)
          .map((item) => item.sequence_order),
      );

      await run(() =>
        db.from("health_nutrition_planned_items").insert({
          planned_meal_id: mealId,
          plan_version_id: planVersionId,
          athlete_id: athleteId,
          sequence_order: sequence,
          source_kind: values.sourceKind,
          food_id: values.sourceKind === "food" ? values.sourceId : null,
          recipe_version_id:
            values.sourceKind === "recipe" ? values.sourceId : null,
          quantity: values.quantity,
          unit_code: values.unitCode,
          is_optional: values.isOptional ?? false,
          notes: values.notes ?? null,
        }),
      );
    },
    [athleteId, planVersionId, run, state.items],
  );

  const updatePlannedItem = useCallback(
    async (
      itemId: string,
      values: {
        quantity?: number;
        unit_code?: "g" | "ml" | "unit" | "serving";
        is_optional?: boolean;
        notes?: string | null;
      },
    ) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      await run(() =>
        db
          .from("health_nutrition_planned_items")
          .update(values)
          .eq("id", itemId)
          .eq("athlete_id", athleteId),
      );
    },
    [athleteId, run],
  );

  const deletePlannedItem = useCallback(
    async (itemId: string) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      await run(() =>
        db
          .from("health_nutrition_planned_items")
          .delete()
          .eq("id", itemId)
          .eq("athlete_id", athleteId),
      );
    },
    [athleteId, run],
  );

  const addAlternative = useCallback(
    async (
      plannedItemId: string,
      values: {
        sourceKind: "food" | "recipe";
        sourceId: string;
        quantity: number;
        unitCode: "g" | "ml" | "unit" | "serving";
        notes?: string | null;
      },
    ) => {
      if (!athleteId || !planVersionId) {
        throw new Error("Versão nutricional não disponível.");
      }
      if (!Number.isFinite(values.quantity) || values.quantity <= 0) {
        throw new Error("Quantidade inválida.");
      }

      const sequence = nextSequence(
        state.alternatives
          .filter((item) => item.planned_item_id === plannedItemId)
          .map((item) => item.sequence_order),
      );

      await run(() =>
        db.from("health_nutrition_item_alternatives").insert({
          planned_item_id: plannedItemId,
          plan_version_id: planVersionId,
          athlete_id: athleteId,
          sequence_order: sequence,
          source_kind: values.sourceKind,
          food_id: values.sourceKind === "food" ? values.sourceId : null,
          recipe_version_id:
            values.sourceKind === "recipe" ? values.sourceId : null,
          quantity: values.quantity,
          unit_code: values.unitCode,
          notes: values.notes ?? null,
        }),
      );
    },
    [athleteId, planVersionId, run, state.alternatives],
  );

  const deleteAlternative = useCallback(
    async (alternativeId: string) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      await run(() =>
        db
          .from("health_nutrition_item_alternatives")
          .delete()
          .eq("id", alternativeId)
          .eq("athlete_id", athleteId),
      );
    },
    [athleteId, run],
  );

  const mealsByPattern = useMemo(() => {
    const map = new Map<string, NutritionPlannedMealF18[]>();
    for (const meal of state.meals) {
      const list = map.get(meal.day_pattern_id) ?? [];
      list.push(meal);
      map.set(meal.day_pattern_id, list);
    }
    return map;
  }, [state.meals]);

  const itemsByMeal = useMemo(() => {
    const map = new Map<string, NutritionPlannedItemF18[]>();
    for (const item of state.items) {
      const list = map.get(item.planned_meal_id) ?? [];
      list.push(item);
      map.set(item.planned_meal_id, list);
    }
    return map;
  }, [state.items]);

  const alternativesByItem = useMemo(() => {
    const map = new Map<string, NutritionItemAlternativeF18[]>();
    for (const alternative of state.alternatives) {
      const list = map.get(alternative.planned_item_id) ?? [];
      list.push(alternative);
      map.set(alternative.planned_item_id, list);
    }
    return map;
  }, [state.alternatives]);

  const totalsByPattern = useMemo(() => {
    const map = new Map<
      string,
      {
        kcal: number | null;
        protein: number | null;
        carbs: number | null;
        fat: number | null;
        fiber: number | null;
      }
    >();

    for (const pattern of state.dayPatterns) {
      const mealIds = new Set(
        state.meals
          .filter((meal) => meal.day_pattern_id === pattern.id)
          .map((meal) => meal.id),
      );
      const requiredItems = state.items.filter(
        (item) => mealIds.has(item.planned_meal_id) && !item.is_optional,
      );

      const sum = (key: keyof NutritionPlannedItemF18) => {
        if (!requiredItems.length) return null;
        const values = requiredItems.map((item) => item[key]);
        if (values.some((value) => value == null)) return null;
        return values.reduce<number>((acc, value) => acc + Number(value), 0);
      };

      map.set(pattern.id, {
        kcal: sum("energy_kcal_snapshot"),
        protein: sum("protein_g_snapshot"),
        carbs: sum("carbohydrate_g_snapshot"),
        fat: sum("fat_g_snapshot"),
        fiber: sum("fiber_g_snapshot"),
      });
    }

    return map;
  }, [state.dayPatterns, state.items, state.meals]);

  return {
    ...state,
    mealsByPattern,
    itemsByMeal,
    alternativesByItem,
    totalsByPattern,
    loading,
    saving,
    error,
    reload,
    createDayPattern,
    updateDayPattern,
    deleteDayPattern,
    createMeal,
    updateMeal,
    deleteMeal,
    addPlannedItem,
    updatePlannedItem,
    deletePlannedItem,
    addAlternative,
    deleteAlternative,
  };
}
