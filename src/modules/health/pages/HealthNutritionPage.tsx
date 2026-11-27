import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHealthAthlete } from "../hooks/useHealthAthlete";
import { useHealthNutritionM5 } from "../hooks/useHealthNutritionM5";
import { useHealthNutritionStateM6 } from "../hooks/useHealthNutritionStateM6";
import { useHealthNutritionDecisionM7 } from "../hooks/useHealthNutritionDecisionM7";
import { HealthMealPrescriptionF18 } from "../components/HealthMealPrescriptionF18";
import { HealthNutritionDiarySX01 } from "../components/HealthNutritionDiarySX01";
import { HealthNutritionPlanSX02 } from "../components/HealthNutritionPlanSX02";
import { HealthNutritionRecipesSX02 } from "../components/HealthNutritionRecipesSX02";
import { HealthNutritionEvolutionSX02 } from "../components/HealthNutritionEvolutionSX02";

export function HealthNutritionPage() {
  const { athlete, loading: athleteLoading } = useHealthAthlete();
  if(athleteLoading)return <div role="status" className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">Carregando perfil…</div>;
  if(!athlete?.id)return <p className="p-3 text-sm text-muted-foreground">Perfil de saúde indisponível.</p>;
  return <HealthNutritionContent key={athlete.id} athleteId={athlete.id}/>;
}
function HealthNutritionContent({athleteId}:{athleteId:string}) {
  const nutrition=useHealthNutritionM5(athleteId);
  const nutritionState=useHealthNutritionStateM6(athleteId);
  const nutritionDecision=useHealthNutritionDecisionM7(athleteId);
  return <div className="space-y-3 pb-4">
    <div><h2 className="text-xl font-semibold tracking-tight">Alimentação</h2><p className="mt-1 text-sm text-muted-foreground">Registre o que consumiu e acompanhe seu plano, sem misturar planejamento e consumo.</p></div>
    {nutrition.error?<Card className="border-destructive/40"><CardContent className="py-3 text-sm text-destructive">{nutrition.error}</CardContent></Card>:null}
    {nutrition.loading?<div role="status" className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true"/>Atualizando alimentação…</div>:null}
    <Tabs defaultValue="diary" className={nutrition.loading?"hidden":"space-y-3"}>
      <TabsList aria-label="Áreas da alimentação" className="grid h-auto w-full grid-cols-3 gap-1 sm:grid-cols-5">
        <TabsTrigger value="diary" className="min-h-11">Diário</TabsTrigger>
        <TabsTrigger value="plan" className="min-h-11">Plano</TabsTrigger>
        <TabsTrigger value="meals" className="min-h-11">Refeições</TabsTrigger>
        <TabsTrigger value="recipes" className="min-h-11">Receitas</TabsTrigger>
        <TabsTrigger value="evolution" className="min-h-11">Evolução</TabsTrigger>
      </TabsList>
      <TabsContent forceMount value="diary" className="space-y-3 data-[state=inactive]:hidden">
        <HealthNutritionDiarySX01 athleteId={athleteId} nutrition={nutrition} nutritionState={nutritionState}/>
      </TabsContent>
      <TabsContent forceMount value="plan" className="space-y-3 data-[state=inactive]:hidden">
        <HealthNutritionPlanSX02 athleteId={athleteId} nutrition={nutrition} nutritionState={nutritionState}/>
      </TabsContent>
      <TabsContent value="meals" className="space-y-3">
        <div className="rounded-lg border p-3 text-xs text-muted-foreground">Refeições planejadas · F18. Não são consumo registrado. A versão do plano determina a edição.</div>
        {!nutrition.error?<HealthMealPrescriptionF18 athleteId={athleteId} version={nutrition.version} foods={nutrition.foods} recipeVersions={nutrition.recipeVersions}/>:null}
      </TabsContent>
      <TabsContent forceMount value="recipes" className="space-y-3 data-[state=inactive]:hidden">
        <HealthNutritionRecipesSX02 nutrition={nutrition} athleteId={athleteId}/>
      </TabsContent>
      <TabsContent forceMount value="evolution" className="space-y-3 data-[state=inactive]:hidden">
        <HealthNutritionEvolutionSX02 nutritionState={nutritionState} nutritionDecision={nutritionDecision} athleteId={athleteId} blocked={nutrition.saving||nutrition.loading||Boolean(nutrition.error)}/>
      </TabsContent>
    </Tabs>
  </div>;
}
