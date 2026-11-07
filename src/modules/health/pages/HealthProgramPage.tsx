import { useMemo, useState } from "react";
import { Dumbbell, Layers3, ListOrdered, Loader2, Plus, Target } from "lucide-react";
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
import { useHealthAthlete } from "../hooks/useHealthAthlete";
import { useHealthCatalogs } from "../hooks/useHealthCatalogs";
import { useHealthProgramM3 } from "../hooks/useHealthProgramM3";

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function HealthProgramPage() {
  const { toast } = useToast();
  const { athlete, loading: athleteLoading } = useHealthAthlete();
  const catalogs = useHealthCatalogs();
  const program = useHealthProgramM3(athlete?.id);

  const [programName, setProgramName] = useState("");
  const [muscleId, setMuscleId] = useState("");
  const [priorityRank, setPriorityRank] = useState("1");
  const [emphasis, setEmphasis] = useState("priority");
  const [sessionCode, setSessionCode] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [exerciseId, setExerciseId] = useState("");
  const [setsMin, setSetsMin] = useState("3");
  const [setsMax, setSetsMax] = useState("4");
  const [repsMin, setRepsMin] = useState("6");
  const [repsMax, setRepsMax] = useState("10");
  const [rirTarget, setRirTarget] = useState("2");
  const [restSeconds, setRestSeconds] = useState("120");

  const exerciseNameById = useMemo(
    () => new Map(catalogs.exercises.map((item) => [item.id, item.name])),
    [catalogs.exercises],
  );
  const muscleNameById = useMemo(
    () => new Map(catalogs.muscles.map((item) => [item.id, item.name])),
    [catalogs.muscles],
  );

  const save = async (label: string, action: () => Promise<void>) => {
    try {
      await action();
      toast({ title: "Salvo", description: label });
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "Não foi possível concluir",
        description: cause instanceof Error ? cause.message : "Tente novamente.",
      });
    }
  };

  if (athleteLoading || catalogs.loading || program.loading) {
    return (
      <div className="flex min-h-56 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!program.program) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Treino</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie o primeiro programa CCH. A execução ao vivo entra na M4.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Novo programa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="m3-program-name">Nome</Label>
              <Input
                id="m3-program-name"
                className="min-h-11"
                placeholder="Ex.: CCH — Hipertrofia"
                value={programName}
                onChange={(event) => setProgramName(event.target.value)}
              />
            </div>
            <Button
              className="min-h-11 w-full"
              disabled={program.saving || programName.trim().length < 2}
              onClick={() => void save("Programa e versão rascunho criados.", () => program.createProgram(programName))}
            >
              {program.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Criar programa
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const draft = program.isDraft;

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{program.program.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {draft ? "Versão rascunho editável" : "Versão publicada e bloqueada para edição"}
          </p>
        </div>
        <Badge variant={draft ? "secondary" : "default"}>
          v{program.version?.version_number ?? "—"} · {program.version?.status ?? "—"}
        </Badge>
      </div>

      {program.error ? (
        <Card className="border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">{program.error}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Prioridades musculares
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {program.priorities.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {program.priorities.map((item) => (
                <Badge key={item.muscle_group_id} variant="outline">
                  {item.priority_rank}. {muscleNameById.get(item.muscle_group_id) ?? "Músculo"} · {item.emphasis}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhuma prioridade definida.</p>
          )}

          {draft ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_120px_150px_auto]">
              <Select value={muscleId} onValueChange={setMuscleId}>
                <SelectTrigger className="min-h-11"><SelectValue placeholder="Músculo" /></SelectTrigger>
                <SelectContent>
                  {catalogs.muscles.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityRank} onValueChange={setPriorityRank}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>Prioridade {n}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={emphasis} onValueChange={setEmphasis}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Prioridade</SelectItem>
                  <SelectItem value="standard">Padrão</SelectItem>
                  <SelectItem value="maintenance">Manutenção</SelectItem>
                  <SelectItem value="deprioritized">Reduzida</SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="min-h-11"
                disabled={!muscleId || program.saving}
                onClick={() => void save("Prioridade muscular atualizada.", () =>
                  program.addPriority(muscleId, Number(priorityRank), emphasis)
                )}
              >
                Adicionar
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers3 className="h-4 w-4 text-primary" />
            Sessões do programa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {draft ? (
            <div className="grid gap-3 sm:grid-cols-[110px_1fr_auto]">
              <Input
                className="min-h-11"
                placeholder="A1"
                value={sessionCode}
                onChange={(event) => setSessionCode(event.target.value)}
              />
              <Input
                className="min-h-11"
                placeholder="Ex.: Peito + Ombro"
                value={sessionName}
                onChange={(event) => setSessionName(event.target.value)}
              />
              <Button
                className="min-h-11"
                disabled={program.saving || sessionCode.trim().length < 1 || sessionName.trim().length < 2}
                onClick={() => void save("Sessão adicionada.", async () => {
                  await program.addTemplate(sessionCode, sessionName);
                  setSessionCode("");
                  setSessionName("");
                })}
              >
                <Plus className="mr-2 h-4 w-4" /> Sessão
              </Button>
            </div>
          ) : null}

          {program.templates.length === 0 ? (
            <p className="text-xs text-muted-foreground">Crie pelo menos uma sessão para publicar.</p>
          ) : (
            <div className="space-y-3">
              {program.templates.map((template) => {
                const items = program.templateExercises.filter((item) => item.session_template_id === template.id);
                return (
                  <div key={template.id} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{template.code} · {template.name}</p>
                        <p className="text-xs text-muted-foreground">{items.length} exercício(s)</p>
                      </div>
                      <Badge variant="secondary">#{template.sequence_order}</Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {items.map((item) => (
                        <div key={item.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                          {item.sequence_order}. {exerciseNameById.get(item.exercise_id) ?? "Exercício"}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {item.planned_sets_min ?? "—"}–{item.planned_sets_max ?? "—"} séries · {item.reps_min ?? "—"}–{item.reps_max ?? "—"} reps · RIR {item.rir_target ?? "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {draft && program.templates.length > 0 ? (
            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-medium">Adicionar exercício</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger className="min-h-11"><SelectValue placeholder="Sessão" /></SelectTrigger>
                  <SelectContent>
                    {program.templates.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.code} · {item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={exerciseId} onValueChange={setExerciseId}>
                  <SelectTrigger className="min-h-11"><SelectValue placeholder="Exercício" /></SelectTrigger>
                  <SelectContent>
                    {catalogs.exercises.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-6">
                {[
                  ["Séries min", setsMin, setSetsMin],
                  ["Séries max", setsMax, setSetsMax],
                  ["Reps min", repsMin, setRepsMin],
                  ["Reps max", repsMax, setRepsMax],
                  ["RIR", rirTarget, setRirTarget],
                  ["Desc. s", restSeconds, setRestSeconds],
                ].map(([label, value, setter]) => (
                  <div key={label as string} className="space-y-1">
                    <Label className="text-xs">{label as string}</Label>
                    <Input
                      className="min-h-11"
                      inputMode="decimal"
                      value={value as string}
                      onChange={(event) => (setter as (v: string) => void)(event.target.value)}
                    />
                  </div>
                ))}
              </div>
              <Button
                variant="secondary"
                className="mt-3 min-h-11 w-full"
                disabled={!templateId || !exerciseId || program.saving}
                onClick={() => void save("Exercício adicionado à sessão.", () =>
                  program.addExercise(templateId, exerciseId, {
                    setsMin: numberOrNull(setsMin),
                    setsMax: numberOrNull(setsMax),
                    repsMin: numberOrNull(repsMin),
                    repsMax: numberOrNull(repsMax),
                    rirTarget: numberOrNull(rirTarget),
                    restSeconds: numberOrNull(restSeconds),
                  })
                )}
              >
                <Dumbbell className="mr-2 h-4 w-4" />
                Adicionar exercício
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {draft ? (
        <Card>
          <CardContent className="space-y-3 py-4">
            <p className="text-sm font-medium">Publicar versão</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              A publicação é atômica: bloqueia a versão para edição, ativa o programa e cria a fila CCH na ordem das sessões.
            </p>
            <Button
              className="min-h-11 w-full"
              disabled={program.saving || program.templates.length === 0}
              onClick={() => void save("Versão publicada e fila CCH criada.", program.publish)}
            >
              {program.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Publicar e gerar fila
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListOrdered className="h-4 w-4 text-primary" />
              Fila CCH contínua
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {program.queueByTemplate.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma entrada na fila.</p>
            ) : (
              program.queueByTemplate.map((entry) => (
                <div key={entry.id} className="flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {entry.queue_position}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {entry.template?.code ?? "—"} · {entry.template?.name ?? "Sessão"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.state} · {entry.reason_codes.join(", ") || "sem reason code"}
                    </p>
                  </div>
                </div>
              ))
            )}
            <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground">
              Nesta fase a fila é estrutural. Recovery, prioridade dinâmica, interferência e recomendação “qual treino agora?” entram no Motor CCH posterior.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
