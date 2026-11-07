import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

export type MuscleGroup = Tables["health_muscle_groups"]["Row"];
export type EquipmentCatalogItem = Tables["health_equipment_catalog"]["Row"];
export type Exercise = Tables["health_exercises"]["Row"];
export type ExerciseMuscle = Tables["health_exercise_muscles"]["Row"];
export type ExerciseEquipment = Tables["health_exercise_equipment"]["Row"];
export type ExerciseEquivalence = Tables["health_exercise_equivalences"]["Row"];
export type FoodSource = Tables["health_food_sources"]["Row"];
export type Food = Tables["health_foods"]["Row"];

export type ExerciseCatalogItem = Exercise & {
  muscles: Array<ExerciseMuscle & { muscle: MuscleGroup | null }>;
  equipment: Array<ExerciseEquipment & { equipmentItem: EquipmentCatalogItem | null }>;
  equivalences: Array<ExerciseEquivalence & { target: Exercise | null }>;
};

type CatalogState = {
  muscles: MuscleGroup[];
  equipment: EquipmentCatalogItem[];
  exercises: ExerciseCatalogItem[];
  foodSources: FoodSource[];
  foods: Food[];
};

const emptyState: CatalogState = {
  muscles: [],
  equipment: [],
  exercises: [],
  foodSources: [],
  foods: [],
};

export function useHealthCatalogs() {
  const [state, setState] = useState<CatalogState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [
      musclesResult,
      equipmentResult,
      exercisesResult,
      exerciseMusclesResult,
      exerciseEquipmentResult,
      equivalencesResult,
      foodSourcesResult,
      foodsResult,
    ] = await Promise.all([
      supabase
        .from("health_muscle_groups")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("health_equipment_catalog")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("health_exercises")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("health_exercise_muscles").select("*"),
      supabase.from("health_exercise_equipment").select("*"),
      supabase.from("health_exercise_equivalences").select("*"),
      supabase
        .from("health_food_sources")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("health_foods")
        .select("*")
        .eq("is_active", true)
        .order("canonical_name", { ascending: true }),
    ]);

    const firstError = [
      musclesResult.error,
      equipmentResult.error,
      exercisesResult.error,
      exerciseMusclesResult.error,
      exerciseEquipmentResult.error,
      equivalencesResult.error,
      foodSourcesResult.error,
      foodsResult.error,
    ].find(Boolean);

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const muscles = musclesResult.data ?? [];
    const equipment = equipmentResult.data ?? [];
    const baseExercises = exercisesResult.data ?? [];
    const exerciseMuscles = exerciseMusclesResult.data ?? [];
    const exerciseEquipment = exerciseEquipmentResult.data ?? [];
    const equivalences = equivalencesResult.data ?? [];

    const muscleById = new Map(muscles.map((item) => [item.id, item]));
    const equipmentById = new Map(equipment.map((item) => [item.id, item]));
    const exerciseById = new Map(baseExercises.map((item) => [item.id, item]));

    const exercises: ExerciseCatalogItem[] = baseExercises.map((exercise) => ({
      ...exercise,
      muscles: exerciseMuscles
        .filter((item) => item.exercise_id === exercise.id)
        .map((item) => ({
          ...item,
          muscle: muscleById.get(item.muscle_group_id) ?? null,
        }))
        .sort((a, b) => {
          const roleRank = { primary: 0, secondary: 1, stabilizer: 2 } as const;
          return (roleRank[a.role as keyof typeof roleRank] ?? 9) -
            (roleRank[b.role as keyof typeof roleRank] ?? 9);
        }),
      equipment: exerciseEquipment
        .filter((item) => item.exercise_id === exercise.id)
        .map((item) => ({
          ...item,
          equipmentItem: equipmentById.get(item.equipment_id) ?? null,
        })),
      equivalences: equivalences
        .filter((item) => item.source_exercise_id === exercise.id)
        .map((item) => ({
          ...item,
          target: exerciseById.get(item.target_exercise_id) ?? null,
        })),
    }));

    setState({
      muscles,
      equipment,
      exercises,
      foodSources: foodSourcesResult.data ?? [],
      foods: foodsResult.data ?? [],
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const counts = useMemo(
    () => ({
      muscles: state.muscles.length,
      equipment: state.equipment.length,
      exercises: state.exercises.length,
      foodSources: state.foodSources.length,
      foods: state.foods.length,
    }),
    [state],
  );

  return {
    ...state,
    counts,
    loading,
    error,
    reload,
  };
}
