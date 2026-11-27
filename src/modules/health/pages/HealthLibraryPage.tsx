import { useMemo, useState } from "react";
import {
  Apple,
  Database,
  Dumbbell,
  Loader2,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { HealthMovementSample } from "../components/HealthMovementSample";
import { ExerciseCatalogItem, useHealthCatalogs } from "../hooks/useHealthCatalogs";

type CatalogMode = "training" | "nutrition";

const patternLabels: Record<string, string> = {
  horizontal_press: "Empurrar horizontal",
  vertical_press: "Empurrar vertical",
  horizontal_pull: "Puxar horizontal",
  vertical_pull: "Puxar vertical",
  squat: "Agachamento",
  hinge: "Dobradiça de quadril",
  lunge: "Afundo",
  knee_extension: "Extensão de joelho",
  knee_flexion: "Flexão de joelho",
  hip_extension: "Extensão de quadril",
  hip_abduction: "Abdução de quadril",
  hip_adduction: "Adução de quadril",
  calf_raise: "Panturrilha",
  elbow_flexion: "Flexão de cotovelo",
  elbow_extension: "Extensão de cotovelo",
  shoulder_abduction: "Abdução de ombro",
  shoulder_extension: "Extensão de ombro",
  core_flexion: "Flexão de core",
  core_anti_extension: "Anti-extensão",
  core_anti_rotation: "Anti-rotação",
  carry: "Carregada",
  other: "Outro",
};

const roleLabels: Record<string, string> = {
  primary: "Primário",
  secondary: "Secundário",
  stabilizer: "Estabilizador",
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ExerciseCard({ item }: { item: ExerciseCatalogItem }) {
  const [showSample,setShowSample]=useState(false);
  const primaryMuscles = item.muscles.filter((entry) => entry.role === "primary");
  const secondaryMuscles = item.muscles.filter((entry) => entry.role === "secondary");

  return (
    <Card>
      <CardHeader className="px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base break-words">{item.name}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {patternLabels[item.movement_pattern] ?? item.movement_pattern}
            </p>
          </div>
          <Badge variant="outline" className="max-w-[45%] break-all text-[10px]">
            {item.code}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3">
        <p className="text-xs text-muted-foreground">{primaryMuscles.map(m=>m.muscle?.name).filter(Boolean).join(", ")||"Músculo principal não confirmado"} · {item.equipment.map(e=>e.equipmentItem?.name).filter(Boolean).join(", ")||"Equipamento não confirmado"}</p>
        <Button className="min-h-11 w-full" variant="outline" aria-expanded={showSample} onClick={()=>setShowSample(v=>!v)}>{showSample?"Recolher referência visual":"Ver movimento"}</Button>
        {showSample?<div className="space-y-2"><HealthMovementSample exerciseId={item.id}/><p className="text-xs text-muted-foreground">Demonstração aprovada não confirmada nesta biblioteca. As amostras existentes são provisórias, vinculadas ao ID exato, não instruções de técnica.</p></div>:null}
        <details className="rounded-md border px-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Músculos, equipamentos e equivalências</summary><div className="space-y-3 pb-2">
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Músculos
          </p>
          <div className="flex flex-wrap gap-1.5">
            {primaryMuscles.map((entry) => (
              <Badge key={entry.muscle_group_id}>
                {entry.muscle?.name ?? "Músculo"} · {roleLabels[entry.role] ?? entry.role}
              </Badge>
            ))}
            {secondaryMuscles.map((entry) => (
              <Badge key={entry.muscle_group_id} variant="secondary">
                {entry.muscle?.name ?? "Músculo"} · {roleLabels[entry.role] ?? entry.role}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Equipamento
          </p>
          <div className="flex flex-wrap gap-1.5">
            {item.equipment.map((entry) => (
              <Badge key={entry.equipment_id} variant="outline">
                {entry.equipmentItem?.name ?? "Equipamento"}
                {entry.requirement_type === "optional" ? " · opcional" : ""}
                {entry.requirement_type === "alternative" ? " · alternativa" : ""}
              </Badge>
            ))}
          </div>
        </div>

        {item.equivalences.length > 0 ? (
          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Equivalências provisórias
            </p>
            <div className="mt-1.5 space-y-1">
              {item.equivalences.map((entry) => (
                <p key={entry.id} className="text-xs">
                  {entry.target?.name ?? "Exercício"} · {entry.equivalence_type.replaceAll("_", " ")}
                </p>
              ))}
            </div>
          </div>
        ) : null}
        </div></details>
      </CardContent>
    </Card>
  );
}

export function HealthLibraryPage() {
  const catalogs = useHealthCatalogs();
  const [mode, setMode] = useState<CatalogMode>("training");
  const [trainingQuery,setTrainingQuery]=useState("");
  const [foodQuery,setFoodQuery]=useState("");
  const [muscle,setMuscle]=useState("");
  const [equipment,setEquipment]=useState("");
  const query=mode==="training"?trainingQuery:foodQuery;
  const setQuery=mode==="training"?setTrainingQuery:setFoodQuery;

  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");

  const filteredExercises = useMemo(() => {
    return catalogs.exercises.filter((exercise) => {
      if(muscle&&!exercise.muscles.some(m=>m.muscle_group_id===muscle&&m.muscle))return false;
      if(equipment&&!exercise.equipment.some(e=>e.equipment_id===equipment&&e.equipmentItem))return false;
      const haystack = [
        exercise.name,
        exercise.code,
        patternLabels[exercise.movement_pattern] ?? exercise.movement_pattern,
        ...exercise.muscles.map((item) => item.muscle?.name ?? ""),
        ...exercise.equipment.map((item) => item.equipmentItem?.name ?? ""),
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return haystack.includes(normalizedQuery);
    });
  }, [catalogs.exercises, normalizedQuery,muscle,equipment]);

  const filteredFoods = useMemo(() => {
    if (!normalizedQuery) return catalogs.foods;
    return catalogs.foods.filter((food) => {
      const haystack = [food.canonical_name, food.brand ?? "", food.source_food_key]
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return haystack.includes(normalizedQuery);
    });
  }, [catalogs.foods, normalizedQuery]);

  if (catalogs.loading) {
    return (
      <div className="flex min-h-56 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Biblioteca</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulte exercícios, equipamentos e alimentos cadastrados. Biblioteca não é prescrição.
        </p>
      </div>

      {catalogs.error ? (
        <Card className="border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">{catalogs.error}</CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button
          className="min-h-11"
          variant={mode === "training" ? "default" : "outline"}
          onClick={() => setMode("training")}
        >
          <Dumbbell className="mr-2 h-4 w-4" />
          Treino
        </Button>
        <Button
          className="min-h-11"
          variant={mode === "nutrition" ? "default" : "outline"}
          onClick={() => setMode("nutrition")}
        >
          <Apple className="mr-2 h-4 w-4" />
          Nutrição
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="min-h-11 pl-9"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={mode === "training" ? "Buscar exercício, músculo ou equipamento" : "Buscar alimento"}
          aria-label={mode === "training" ? "Buscar no catálogo de treino" : "Buscar no catálogo de alimentos"}
        />
      </div>

      <div className="grid grid-cols-2 gap-2"><Button asChild variant="outline" className="min-h-11"><Link to="/saude/treino">Voltar ao treino</Link></Button><Button variant="outline" className="min-h-11" onClick={()=>void catalogs.reload()}>Atualizar catálogo</Button></div>
      {catalogs.error?<p role="alert" className="text-sm">Catálogo não confirmado. Atualize para consultar.</p>:mode === "training" ? (
        <>
          <div className="grid grid-cols-2 gap-2"><div className="min-w-0"><label htmlFor="sx08-muscle" className="text-xs">Músculo</label><select id="sx08-muscle" className="min-h-11 w-full rounded-md border bg-background px-2 text-sm" value={muscle} onChange={e=>setMuscle(e.target.value)}><option value="">Todos</option>{catalogs.muscles.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div><div className="min-w-0"><label htmlFor="sx08-equipment" className="text-xs">Equipamento</label><select id="sx08-equipment" className="min-h-11 w-full rounded-md border bg-background px-2 text-sm" value={equipment} onChange={e=>setEquipment(e.target.value)}><option value="">Todos</option>{catalogs.equipment.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div></div>
          <p role="status" className="text-xs">{filteredExercises.length} exercícios na consulta filtrada.</p>
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Exercícios" value={catalogs.counts.exercises} />
            <StatCard label="Músculos" value={catalogs.counts.muscles} />
            <StatCard label="Equip." value={catalogs.counts.equipment} />
          </div>

          <Card>
            <CardContent className="flex gap-2 py-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                As relações músculo–exercício são categóricas nesta fase. Pesos numéricos de contribuição
                não foram inventados; o Motor CCH fará esse versionamento posteriormente.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {filteredExercises.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum exercício encontrado.
                </CardContent>
              </Card>
            ) : (
              filteredExercises.map((exercise) => <ExerciseCard key={exercise.id} item={exercise} />)
            )}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Fontes" value={catalogs.counts.foodSources} />
            <StatCard label="Alimentos" value={catalogs.counts.foods} />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-primary" />
                Fontes nutricionais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {catalogs.foodSources.map((source) => (
                <div key={source.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{source.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {source.country_code ?? "—"} · {source.release_label ?? "versão não informada"}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {source.source_code}
                    </Badge>
                  </div>
                  {source.license_label ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">{source.license_label}</p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          {catalogs.foods.length === 0 ? (
            <Card>
              <CardContent className="py-5">
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Importação nutricional ainda não executada</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      A estrutura e as fontes estão prontas, mas o sistema não preencheu macros aproximados.
                      Alimentos entrarão somente com chave de origem, versão e qualidade rastreáveis.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredFoods.length===0?<p className="text-sm">Nenhum alimento encontrado na consulta.</p>:null}
              {filteredFoods.map((food) => (
                <Card key={food.id}>
                  <CardContent className="py-3">
                    <p className="text-sm font-medium">{food.canonical_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Base registrada: {food.basis_amount} {food.basis_unit} · {food.energy_kcal ?? "—"} kcal · P {food.protein_g ?? "—"} g · C {food.carbohydrate_g ?? "—"} g · G {food.fat_g ?? "—"} g
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <p className={cn("text-[11px] leading-relaxed text-muted-foreground", mode === "training" && "pt-1")}>
        Contagens e filtros referem-se às linhas consultadas, não garantem catálogo completo. Catálogos globais são somente leitura para o usuário autenticado nesta fase. Alterações técnicas
        entram por migrations/revisão administrativa para preservar versionamento e rastreabilidade.
      </p>
    </div>
  );
}
