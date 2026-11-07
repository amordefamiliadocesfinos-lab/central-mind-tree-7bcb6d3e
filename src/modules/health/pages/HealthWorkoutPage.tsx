import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock3, Dumbbell, Loader2, Plus, RefreshCw, SkipForward } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useHealthAthlete } from "../hooks/useHealthAthlete";
import { useHealthCatalogs } from "../hooks/useHealthCatalogs";
import { useHealthWorkoutM4, WorkoutExercise } from "../hooks/useHealthWorkoutM4";

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatElapsed(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((value) => String(value).padStart(2, "0")).join(":");
}

function WorkoutExerciseCard({
  item,
  name,
  performedSets,
  saving,
  exerciseOptions,
  onLogSet,
  onSkip,
  onReplace,
}: {
  item: WorkoutExercise;
  name: string;
  performedSets: Array<{
    id: string;
    set_number: number;
    load_value: number | null;
    load_unit: string;
    reps: number | null;
    rir: number | null;
    rest_seconds: number | null;
  }>;
  saving: boolean;
  exerciseOptions: Array<{ id: string; name: string }>;
  onLogSet: (values: {
    loadValue: number | null;
    loadUnit: string;
    reps: number | null;
    rir: number | null;
    restSeconds: number | null;
  }) => Promise<void>;
  onSkip: () => Promise<void>;
  onReplace: (replacementExerciseId: string) => Promise<void>;
}) {
  const [load, setLoad] = useState("");
  const [loadUnit, setLoadUnit] = useState("kg");
  const [reps, setReps] = useState(item.planned_reps_min?.toString() ?? "");
  const [rir, setRir] = useState(item.planned_rir_target?.toString() ?? "");
  const [rest, setRest] = useState(item.planned_rest_seconds?.toString() ?? "");
  const [replacementId, setReplacementId] = useState("");

  const locked = item.status === "skipped" || item.status === "replaced";

  return (
    <Card className={locked ? "opacity-70" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">{item.sequence_order}. {name}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Plano: {item.planned_sets_min ?? "—"}–{item.planned_sets_max ?? "—"} séries · {item.planned_reps_min ?? "—"}–{item.planned_reps_max ?? "—"} reps · RIR {item.planned_rir_target ?? "—"} · descanso {item.planned_rest_seconds ?? "—"}s
            </p>
          </div>
          <Badge variant="outline">{item.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {performedSets.length > 0 ? (
          <div className="space-y-2">
            {performedSets.map((set) => (
              <div key={set.id} className="grid grid-cols-[34px_1fr] gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <span className="font-semibold">#{set.set_number}</span>
                <span>
                  {set.load_value ?? "—"} {set.load_unit} · {set.reps ?? "—"} reps · RIR {set.rir ?? "—"}
                  {set.rest_seconds != null ? " · " + set.rest_seconds + "s" : ""}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {!locked ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="space-y-1">
                <Label className="text-xs">Carga</Label>
                <Input className="min-h-11" inputMode="decimal" value={load} onChange={(event) => setLoad(event.target.value)} placeholder="kg" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unid.</Label>
                <Select value={loadUnit} onValueChange={setLoadUnit}>
                  <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="lb">lb</SelectItem>
                    <SelectItem value="bodyweight">Corpo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reps</Label>
                <Input className="min-h-11" inputMode="numeric" value={reps} onChange={(event) => setReps(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">RIR</Label>
                <Input className="min-h-11" inputMode="decimal" value={rir} onChange={(event) => setRir(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Desc. s</Label>
                <Input className="min-h-11" inputMode="numeric" value={rest} onChange={(event) => setRest(event.target.value)} />
              </div>
            </div>

            <Button
              className="min-h-11 w-full"
              disabled={saving}
              onClick={() => void onLogSet({
                loadValue: numberOrNull(load),
                loadUnit,
                reps: numberOrNull(reps),
                rir: numberOrNull(rir),
                restSeconds: numberOrNull(rest),
              })}
            >
              Registrar série {performedSets.length + 1}
            </Button>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <Select value={replacementId} onValueChange={setReplacementId}>
                <SelectTrigger className="min-h-11"><SelectValue placeholder="Substituir por..." /></SelectTrigger>
                <SelectContent>
                  {exerciseOptions.filter((option) => option.id !== item.exercise_id).map((option) => (
                    <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={saving || !replacementId}
                onClick={() => void onReplace(replacementId)}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Substituir
              </Button>
              <Button variant="ghost" className="min-h-11" disabled={saving} onClick={() => void onSkip()}>
                <SkipForward className="mr-2 h-4 w-4" /> Pular
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function HealthWorkoutPage() {
  const { toast } = useToast();
  const { athlete, loading: athleteLoading } = useHealthAthlete();
  const catalogs = useHealthCatalogs();
  const workout = useHealthWorkoutM4(athlete?.id);
  const [elapsed, setElapsed] = useState(0);
  const [extraExerciseId, setExtraExerciseId] = useState("");

  const exerciseNameById = useMemo(
    () => new Map(catalogs.exercises.map((item) => [item.id, item.name])),
    [catalogs.exercises],
  );

  useEffect(() => {
    if (!workout.session?.started_at) {
      setElapsed(0);
      return;
    }
    const update = () => {
      const start = new Date(workout.session!.started_at).getTime();
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [workout.session?.started_at]);

  const run = async (label: string, action: () => Promise<void>) => {
    try {
      await action();
      toast({ title: "Treino atualizado", description: label });
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "Não foi possível concluir",
        description: cause instanceof Error ? cause.message : "Tente novamente.",
      });
    }
  };

  if (athleteLoading || catalogs.loading || workout.loading) {
    return <div className="flex min-h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!workout.session) {
    return (
      <div className="space-y-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Treino ao vivo</h2>
            <p className="mt-1 text-sm text-muted-foreground">Execução real do próximo item da fila CCH.</p>
          </div>
          <Button asChild variant="outline" className="min-h-11 shrink-0">
            <Link to="/saude/treino/programa">Programa</Link>
          </Button>
        </div>

        {workout.error ? (
          <Card className="border-destructive/40"><CardContent className="py-3 text-sm text-destructive">{workout.error}</CardContent></Card>
        ) : null}

        {workout.nextQueue ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Dumbbell className="h-4 w-4 text-primary" /> Próximo treino</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="text-lg font-semibold">{workout.nextTemplate?.code ?? "—"} · {workout.nextTemplate?.name ?? "Sessão"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Posição {workout.nextQueue.queue_position} · {workout.nextQueue.state}</p>
              </div>
              <Button
                className="min-h-12 w-full text-base"
                disabled={workout.saving}
                onClick={() => void run("Sessão iniciada.", () => workout.startWorkout(workout.nextQueue!.id))}
              >
                {workout.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Dumbbell className="mr-2 h-5 w-5" />}
                Iniciar treino
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-3 py-5">
              <p className="text-sm font-medium">Nenhum treino disponível na fila.</p>
              <p className="text-xs text-muted-foreground">Crie ou publique um programa para gerar a fila CCH.</p>
              <Button asChild className="min-h-11 w-full"><Link to="/saude/treino/programa">Abrir programa</Link></Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const completedSetCount = workout.sets.filter((item) => item.status === "completed").length;

  return (
    <div className="space-y-4 pb-4">
      <div className="sticky top-[calc(49px+env(safe-area-inset-top))] z-20 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Treino em andamento</p>
            <h2 className="truncate text-lg font-semibold">{workout.nextTemplate?.code ?? "Sessão"} · {workout.nextTemplate?.name ?? "Treino"}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-lg bg-muted px-3 py-2 font-mono text-sm">
            <Clock3 className="h-4 w-4" /> {formatElapsed(elapsed)}
          </div>
        </div>
      </div>

      {workout.exercises.map((item) => (
        <WorkoutExerciseCard
          key={item.id}
          item={item}
          name={exerciseNameById.get(item.exercise_id) ?? "Exercício"}
          performedSets={(workout.setsByExercise.get(item.id) ?? []).map((set) => ({
            id: set.id,
            set_number: set.set_number,
            load_value: set.load_value,
            load_unit: set.load_unit,
            reps: set.reps,
            rir: set.rir,
            rest_seconds: set.rest_seconds,
          }))}
          saving={workout.saving}
          exerciseOptions={catalogs.exercises.map((exercise) => ({ id: exercise.id, name: exercise.name }))}
          onLogSet={(values) => run("Série registrada.", () => workout.logSet(item.id, values))}
          onSkip={() => run("Exercício marcado como pulado.", () => workout.skipExercise(item.id))}
          onReplace={(replacementExerciseId) => run("Exercício substituído.", () => workout.replaceExercise(item.id, replacementExerciseId))}
        />
      ))}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4 text-primary" /> Adicionar exercício</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Select value={extraExerciseId} onValueChange={setExtraExerciseId}>
            <SelectTrigger className="min-h-11"><SelectValue placeholder="Escolha no catálogo" /></SelectTrigger>
            <SelectContent>
              {catalogs.exercises.map((exercise) => <SelectItem key={exercise.id} value={exercise.id}>{exercise.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={workout.saving || !extraExerciseId}
            onClick={() => void run("Exercício adicionado ao treino.", async () => {
              await workout.addExercise(extraExerciseId);
              setExtraExerciseId("");
            })}
          >
            Adicionar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Finalizar treino</p>
              <p className="mt-1 text-xs text-muted-foreground">{completedSetCount} série(s) concluída(s).</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
          <Button
            className="min-h-12 w-full"
            disabled={workout.saving || completedSetCount < 1}
            onClick={() => void run("Treino concluído e fila atualizada.", workout.completeWorkout)}
          >
            Concluir treino
          </Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Ao concluir, a execução fica preservada como fato histórico. O programa publicado da M3 não é alterado.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
