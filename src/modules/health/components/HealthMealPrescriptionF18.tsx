import { useEffect, useMemo, useState } from "react";
import {
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Utensils,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type {
  Food,
  NutritionPlanVersion,
  RecipeVersion,
} from "../hooks/useHealthNutritionM5";
import {
  type NutritionDayPatternF18,
  type NutritionItemAlternativeF18,
  type NutritionPlannedItemF18,
  type NutritionPlannedMealF18,
  useHealthMealPlanF18,
} from "../hooks/useHealthMealPlanF18";

type SourceKind = "food" | "recipe";
type UnitCode = "g" | "ml" | "unit" | "serving";

function numberOrNull(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
  }).format(Number(value));
}

function mealTypeLabel(value: string) {
  const labels: Record<string, string> = {
    breakfast: "Café da manhã",
    lunch: "Almoço",
    dinner: "Jantar",
    snack: "Lanche",
    pre_workout: "Pré-treino",
    post_workout: "Pós-treino",
    other: "Outra",
  };
  return labels[value] ?? value;
}

function dayTypeLabel(value: string) {
  const labels: Record<string, string> = {
    default: "Padrão",
    training: "Treino",
    rest: "Descanso",
    custom: "Personalizado",
  };
  return labels[value] ?? value;
}

function MacroSummary({
  values,
}: {
  values: {
    kcal: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    fiber: number | null;
  };
}) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
      <div className="rounded-lg bg-muted/40 p-2">
        <p className="text-muted-foreground">Energia</p>
        <p className="font-semibold">{formatNumber(values.kcal, 0)} kcal</p>
      </div>
      <div className="rounded-lg bg-muted/40 p-2">
        <p className="text-muted-foreground">Proteína</p>
        <p className="font-semibold">{formatNumber(values.protein)} g</p>
      </div>
      <div className="rounded-lg bg-muted/40 p-2">
        <p className="text-muted-foreground">Carboidratos</p>
        <p className="font-semibold">{formatNumber(values.carbs)} g</p>
      </div>
      <div className="rounded-lg bg-muted/40 p-2">
        <p className="text-muted-foreground">Gorduras</p>
        <p className="font-semibold">{formatNumber(values.fat)} g</p>
      </div>
      <div className="rounded-lg bg-muted/40 p-2">
        <p className="text-muted-foreground">Fibras</p>
        <p className="font-semibold">{formatNumber(values.fiber)} g</p>
      </div>
    </div>
  );
}

function ItemMacroLine({
  item,
}: {
  item: NutritionPlannedItemF18 | NutritionItemAlternativeF18;
}) {
  return (
    <p className="mt-1 text-[11px] text-muted-foreground">
      {formatNumber(item.energy_kcal_snapshot, 0)} kcal · P{" "}
      {formatNumber(item.protein_g_snapshot)} g · C{" "}
      {formatNumber(item.carbohydrate_g_snapshot)} g · G{" "}
      {formatNumber(item.fat_g_snapshot)} g · Fib{" "}
      {formatNumber(item.fiber_g_snapshot)} g
    </p>
  );
}

function SourceForm({
  foods,
  recipeVersions,
  saving,
  label,
  onSubmit,
}: {
  foods: Food[];
  recipeVersions: RecipeVersion[];
  saving: boolean;
  label: string;
  onSubmit: (values: {
    sourceKind: SourceKind;
    sourceId: string;
    quantity: number;
    unitCode: UnitCode;
  }) => Promise<void>;
}) {
  const [sourceKind, setSourceKind] = useState<SourceKind>("food");
  const [sourceId, setSourceId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCode, setUnitCode] = useState<UnitCode>("g");

  const publishedRecipes = useMemo(
    () =>
      recipeVersions.filter(
        (item) =>
          item.status === "published" &&
          item.yield_amount != null &&
          item.yield_unit != null,
      ),
    [recipeVersions],
  );

  const selectSource = (value: string) => {
    setSourceId(value);
    if (sourceKind === "food") {
      const food = foods.find((item) => item.id === value);
      if (
        food?.basis_unit === "g" ||
        food?.basis_unit === "ml" ||
        food?.basis_unit === "unit"
      ) {
        setUnitCode(food.basis_unit);
      }
    } else {
      const recipe = publishedRecipes.find((item) => item.id === value);
      if (
        recipe?.yield_unit === "g" ||
        recipe?.yield_unit === "ml" ||
        recipe?.yield_unit === "unit" ||
        recipe?.yield_unit === "serving"
      ) {
        setUnitCode(recipe.yield_unit);
      }
    }
  };

  const switchKind = (value: SourceKind) => {
    setSourceKind(value);
    setSourceId("");
    setQuantity("");
    setUnitCode(value === "food" ? "g" : "serving");
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <div className="grid gap-2 sm:grid-cols-[130px_1fr_110px_90px]">
        <Select value={sourceKind} onValueChange={(value) => switchKind(value as SourceKind)}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="food">Alimento</SelectItem>
            <SelectItem value="recipe">Receita</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sourceId} onValueChange={selectSource}>
          <SelectTrigger className="min-h-11">
            <SelectValue placeholder={sourceKind === "food" ? "Escolha o alimento" : "Escolha a receita publicada"} />
          </SelectTrigger>
          <SelectContent>
            {sourceKind === "food"
              ? foods.map((food) => (
                  <SelectItem key={food.id} value={food.id}>
                    {food.canonical_name}
                    {food.brand ? ` · ${food.brand}` : ""}
                  </SelectItem>
                ))
              : publishedRecipes.map((recipe) => (
                  <SelectItem key={recipe.id} value={recipe.id}>
                    {recipe.title}
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>

        <Input
          className="min-h-11"
          inputMode="decimal"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder="Quantidade"
        />

        <Select value={unitCode} onValueChange={(value) => setUnitCode(value as UnitCode)}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="g">g</SelectItem>
            <SelectItem value="ml">ml</SelectItem>
            <SelectItem value="unit">un</SelectItem>
            <SelectItem value="serving">porção</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="secondary"
        className="min-h-11 w-full"
        disabled={saving || !sourceId || !numberOrNull(quantity)}
        onClick={async () => {
          const parsed = numberOrNull(quantity);
          if (!parsed) return;
          await onSubmit({
            sourceKind,
            sourceId,
            quantity: parsed,
            unitCode,
          });
          setSourceId("");
          setQuantity("");
        }}
      >
        <Plus className="mr-2 h-4 w-4" />
        {label}
      </Button>

      <p className="text-[11px] text-muted-foreground">
        A unidade precisa corresponder à base nutricional do alimento ou da
        receita. Os macros são congelados pelo banco ao salvar.
      </p>
    </div>
  );
}

function PlannedItemCard({
  item,
  alternatives,
  editable,
  saving,
  foods,
  recipeVersions,
  onDelete,
  onAddAlternative,
  onDeleteAlternative,
}: {
  item: NutritionPlannedItemF18;
  alternatives: NutritionItemAlternativeF18[];
  editable: boolean;
  saving: boolean;
  foods: Food[];
  recipeVersions: RecipeVersion[];
  onDelete: () => Promise<void>;
  onAddAlternative: (values: {
    sourceKind: SourceKind;
    sourceId: string;
    quantity: number;
    unitCode: UnitCode;
  }) => Promise<void>;
  onDeleteAlternative: (id: string) => Promise<void>;
}) {
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {item.item_name_snapshot}
            {item.is_optional ? " · opcional" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatNumber(item.quantity, 3)} {item.unit_code}
          </p>
          <ItemMacroLine item={item} />
          {item.notes ? (
            <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>
          ) : null}
        </div>
        {editable ? (
          <Button
            size="icon"
            variant="ghost"
            disabled={saving}
            onClick={() => void onDelete()}
            aria-label="Remover item prescrito"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {alternatives.length ? (
        <div className="mt-3 space-y-2 border-l-2 pl-3">
          <p className="flex items-center gap-2 text-xs font-medium">
            <RefreshCw className="h-3.5 w-3.5" />
            Alternativas
          </p>
          {alternatives.map((alternative) => (
            <div
              key={alternative.id}
              className="flex items-start justify-between gap-2 rounded-lg bg-muted/30 p-2"
            >
              <div>
                <p className="text-sm font-medium">
                  {alternative.item_name_snapshot}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(alternative.quantity, 3)} {alternative.unit_code}
                </p>
                <ItemMacroLine item={alternative} />
              </div>
              {editable ? (
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => void onDeleteAlternative(alternative.id)}
                  aria-label="Remover alternativa"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {editable ? (
        <div className="mt-3">
          <SourceForm
            foods={foods}
            recipeVersions={recipeVersions}
            saving={saving}
            label="Adicionar alternativa"
            onSubmit={onAddAlternative}
          />
        </div>
      ) : null}
    </div>
  );
}

function MealCard({
  meal,
  items,
  alternativesByItem,
  editable,
  saving,
  foods,
  recipeVersions,
  onAddItem,
  onDeleteMeal,
  onDeleteItem,
  onAddAlternative,
  onDeleteAlternative,
}: {
  meal: NutritionPlannedMealF18;
  items: NutritionPlannedItemF18[];
  alternativesByItem: Map<string, NutritionItemAlternativeF18[]>;
  editable: boolean;
  saving: boolean;
  foods: Food[];
  recipeVersions: RecipeVersion[];
  onAddItem: (values: {
    sourceKind: SourceKind;
    sourceId: string;
    quantity: number;
    unitCode: UnitCode;
  }) => Promise<void>;
  onDeleteMeal: () => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onAddAlternative: (
    itemId: string,
    values: {
      sourceKind: SourceKind;
      sourceId: string;
      quantity: number;
      unitCode: UnitCode;
    },
  ) => Promise<void>;
  onDeleteAlternative: (id: string) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{meal.name}</CardTitle>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{mealTypeLabel(meal.meal_type)}</span>
              {meal.time_start ? (
                <span className="flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {meal.time_start.slice(0, 5)}
                  {meal.time_end ? `–${meal.time_end.slice(0, 5)}` : ""}
                </span>
              ) : null}
            </p>
          </div>
          {editable ? (
            <Button
              size="icon"
              variant="ghost"
              disabled={saving}
              onClick={() => void onDeleteMeal()}
              aria-label="Remover refeição"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.map((item) => (
            <PlannedItemCard
              key={item.id}
              item={item}
              alternatives={alternativesByItem.get(item.id) ?? []}
              editable={editable}
              saving={saving}
              foods={foods}
              recipeVersions={recipeVersions}
              onDelete={() => onDeleteItem(item.id)}
              onAddAlternative={(values) => onAddAlternative(item.id, values)}
              onDeleteAlternative={onDeleteAlternative}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Esta refeição ainda não tem itens prescritos.
          </div>
        )}

        {editable ? (
          <SourceForm
            foods={foods}
            recipeVersions={recipeVersions}
            saving={saving}
            label="Adicionar item à refeição"
            onSubmit={onAddItem}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

export function HealthMealPrescriptionF18({
  athleteId,
  version,
  foods,
  recipeVersions,
}: {
  athleteId: string | null | undefined;
  version: NutritionPlanVersion | null;
  foods: Food[];
  recipeVersions: RecipeVersion[];
}) {
  const { toast } = useToast();
  const mealPlan = useHealthMealPlanF18(athleteId, version?.id);
  const [selectedPatternId, setSelectedPatternId] = useState("");
  const [patternName, setPatternName] = useState("Dia padrão");
  const [dayType, setDayType] =
    useState<NutritionDayPatternF18["day_type"]>("default");
  const [mealName, setMealName] = useState("");
  const [mealType, setMealType] =
    useState<NutritionPlannedMealF18["meal_type"]>("breakfast");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");

  useEffect(() => {
    if (
      mealPlan.dayPatterns.length &&
      !mealPlan.dayPatterns.some((item) => item.id === selectedPatternId)
    ) {
      setSelectedPatternId(
        mealPlan.dayPatterns.find((item) => item.is_default)?.id ??
          mealPlan.dayPatterns[0].id,
      );
    }
    if (!mealPlan.dayPatterns.length) {
      setSelectedPatternId("");
    }
  }, [mealPlan.dayPatterns, selectedPatternId]);

  const selectedPattern =
    mealPlan.dayPatterns.find((item) => item.id === selectedPatternId) ?? null;
  const selectedMeals = selectedPattern
    ? mealPlan.mealsByPattern.get(selectedPattern.id) ?? []
    : [];
  const patternTotals = selectedPattern
    ? mealPlan.totalsByPattern.get(selectedPattern.id) ?? null
    : null;

  const editable = version?.status === "draft";

  const run = async (message: string, action: () => Promise<void>) => {
    try {
      await action();
      toast({ title: "Plano alimentar atualizado", description: message });
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "Não foi possível concluir",
        description:
          cause instanceof Error ? cause.message : "Tente novamente.",
      });
    }
  };

  if (!version) {
    return (
      <Card>
        <CardContent className="py-5 text-sm text-muted-foreground">
          Crie primeiro um plano nutricional para estruturar as refeições.
        </CardContent>
      </Card>
    );
  }

  if (mealPlan.loading) {
    return (
      <div className="flex min-h-56 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (mealPlan.error) {
    return (
      <Card className="border-amber-500/30">
        <CardContent className="space-y-2 py-5">
          <p className="text-sm font-medium">
            Refeições prescritas ainda não estão disponíveis neste ambiente.
          </p>
          <p className="text-xs text-muted-foreground">
            A interface não cria dados locais falsos. A migration F18 precisa
            estar ativa no banco deste ambiente.
          </p>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => void mealPlan.reload()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Utensils className="h-4 w-4 text-primary" />
            Refeições prescritas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              Versão {version.version_number}
            </Badge>
            <Badge variant="outline">{version.status}</Badge>
            <Badge variant="outline">
              {mealPlan.dayPatterns.length} padrão(ões) de dia
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground">
            Esta área descreve o que foi planejado. O Diário continua sendo a
            fonte do que foi realmente consumido.
          </p>

          {!editable ? (
            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              Esta versão foi publicada e está bloqueada para edição. Alterações
              futuras devem ser feitas em uma nova versão do plano.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {editable ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Estrutura do dia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <div className="space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input
                  className="min-h-11"
                  value={patternName}
                  onChange={(event) => setPatternName(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={dayType}
                  onValueChange={(value) =>
                    setDayType(value as NutritionDayPatternF18["day_type"])
                  }
                >
                  <SelectTrigger className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Padrão</SelectItem>
                    <SelectItem value="training">Treino</SelectItem>
                    <SelectItem value="rest">Descanso</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="min-h-11 w-full"
              disabled={mealPlan.saving || patternName.trim().length < 2}
              onClick={() =>
                void run("Padrão de dia criado.", () =>
                  mealPlan.createDayPattern(
                    patternName,
                    dayType,
                    mealPlan.dayPatterns.length === 0,
                  ),
                )
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar padrão de dia
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {mealPlan.dayPatterns.length ? (
        <>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Padrão visualizado</Label>
                  <Select
                    value={selectedPatternId}
                    onValueChange={setSelectedPatternId}
                  >
                    <SelectTrigger className="min-h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mealPlan.dayPatterns.map((pattern) => (
                        <SelectItem key={pattern.id} value={pattern.id}>
                          {pattern.name} · {dayTypeLabel(pattern.day_type)}
                          {pattern.is_default ? " · padrão principal" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {editable && selectedPattern ? (
                  <Button
                    variant="ghost"
                    className="min-h-11"
                    disabled={mealPlan.saving}
                    onClick={() =>
                      void run("Padrão removido.", () =>
                        mealPlan.deleteDayPattern(selectedPattern.id),
                      )
                    }
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover padrão
                  </Button>
                ) : null}
              </div>

              {patternTotals ? <MacroSummary values={patternTotals} /> : null}
              <p className="text-[11px] text-muted-foreground">
                Totais consideram somente itens principais não opcionais.
                Alternativas não são somadas.
              </p>
            </CardContent>
          </Card>

          {editable && selectedPattern ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Adicionar refeição</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome</Label>
                    <Input
                      className="min-h-11"
                      value={mealName}
                      onChange={(event) => setMealName(event.target.value)}
                      placeholder="Ex.: Café da manhã"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select
                      value={mealType}
                      onValueChange={(value) =>
                        setMealType(
                          value as NutritionPlannedMealF18["meal_type"],
                        )
                      }
                    >
                      <SelectTrigger className="min-h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="breakfast">Café da manhã</SelectItem>
                        <SelectItem value="lunch">Almoço</SelectItem>
                        <SelectItem value="dinner">Jantar</SelectItem>
                        <SelectItem value="snack">Lanche</SelectItem>
                        <SelectItem value="pre_workout">Pré-treino</SelectItem>
                        <SelectItem value="post_workout">Pós-treino</SelectItem>
                        <SelectItem value="other">Outra</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Início opcional</Label>
                    <Input
                      className="min-h-11"
                      type="time"
                      value={timeStart}
                      onChange={(event) => setTimeStart(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fim opcional</Label>
                    <Input
                      className="min-h-11"
                      type="time"
                      value={timeEnd}
                      onChange={(event) => setTimeEnd(event.target.value)}
                    />
                  </div>
                </div>

                <Button
                  className="min-h-11 w-full"
                  disabled={mealPlan.saving || mealName.trim().length < 2}
                  onClick={() =>
                    void run("Refeição adicionada.", async () => {
                      await mealPlan.createMeal(selectedPattern.id, {
                        name: mealName,
                        mealType,
                        timeStart: timeStart || null,
                        timeEnd: timeEnd || null,
                      });
                      setMealName("");
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar refeição
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-4">
            {selectedMeals.length ? (
              selectedMeals.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  items={mealPlan.itemsByMeal.get(meal.id) ?? []}
                  alternativesByItem={mealPlan.alternativesByItem}
                  editable={editable}
                  saving={mealPlan.saving}
                  foods={foods}
                  recipeVersions={recipeVersions}
                  onAddItem={(values) =>
                    mealPlan.addPlannedItem(meal.id, values)
                  }
                  onDeleteMeal={() => mealPlan.deleteMeal(meal.id)}
                  onDeleteItem={mealPlan.deletePlannedItem}
                  onAddAlternative={(itemId, values) =>
                    mealPlan.addAlternative(itemId, values)
                  }
                  onDeleteAlternative={mealPlan.deleteAlternative}
                />
              ))
            ) : (
              <Card>
                <CardContent className="py-5 text-sm text-muted-foreground">
                  Este padrão de dia ainda não tem refeições prescritas.
                </CardContent>
              </Card>
            )}
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-5 text-sm text-muted-foreground">
            Crie a estrutura do dia antes das refeições.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
