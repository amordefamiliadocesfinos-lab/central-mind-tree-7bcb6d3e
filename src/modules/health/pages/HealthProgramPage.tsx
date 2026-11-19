import { useMemo, useState } from "react";
import { BrainCircuit, Dumbbell, Layers3, ListOrdered, Loader2, Plus, ShieldCheck, Target } from "lucide-react";
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
import { useHealthTrainingProfileF22 } from "../hooks/useHealthTrainingProfileF22";
import { useHealthLongitudinalReviewF13 } from "../hooks/useHealthLongitudinalReviewF13";
import { useHealthReplanningF14 } from "../hooks/useHealthReplanningF14";
import { guidedGoals, guidedStrategies, useCchCycleAdvisor } from "../hooks/useCchCycleAdvisor";
import type { GuidedGoal, GuidedStrategy } from "../hooks/useCchCycleAdvisor";

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
  const trainingProfile = useHealthTrainingProfileF22(athlete?.id);
  const longitudinal = useHealthLongitudinalReviewF13(athlete?.id);
  const replanning = useHealthReplanningF14(athlete?.id);
  const cycleAdvisor = useCchCycleAdvisor(athlete?.id, program.program?.current_version_id, program.program?.id);
  const [goalChoice, setGoalChoice] = useState<GuidedGoal | "unsure">("unsure");
  const [strategyChoice, setStrategyChoice] = useState<GuidedStrategy>("continue_progression");
  const [priorityMuscleId, setPriorityMuscleId] = useState("");
  const [allowTargetedSets, setAllowTargetedSets] = useState(false);

  const [programName, setProgramName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({setsMin:"",setsMax:"",repsMin:"",repsMax:"",rir:"",rest:""});
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

  if (
    athleteLoading ||
    catalogs.loading ||
    program.loading ||
    trainingProfile.loading
  ) {
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

  const incompleteRequiredExercises = program.templateExercises.filter(
    (item) =>
      !item.is_optional &&
      (
        item.planned_sets_min == null ||
        item.planned_sets_max == null ||
        item.reps_min == null ||
        item.reps_max == null ||
        item.rir_target == null ||
        item.rest_seconds == null ||
        item.planned_sets_min < 1 ||
        item.planned_sets_max < item.planned_sets_min ||
        item.reps_min < 1 ||
        item.reps_max < item.reps_min ||
        item.rir_target < 0 ||
        item.rir_target > 6 ||
        item.rest_seconds <= 0
      ),
  );

  const templatesWithoutExercises = program.templates.filter(
    (template) =>
      !program.templateExercises.some(
        (item) => item.session_template_id === template.id,
      ),
  );

  const publicationReady =
    program.templates.length > 0 &&
    incompleteRequiredExercises.length === 0 &&
    templatesWithoutExercises.length === 0;

  const versionParameters =
    program.version?.parameter_set &&
    typeof program.version.parameter_set === "object" &&
    !Array.isArray(program.version.parameter_set)
      ? (program.version.parameter_set as Record<string, unknown>)
      : {};

  const phaseLabel =
    typeof versionParameters.phase === "string"
      ? versionParameters.phase
      : "—";

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

      {program.cycleComplete && !draft ? (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-base">Ciclo concluído — planejar próxima etapa</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">O CCH utiliza os registros válidos do seu último ciclo para orientar a estratégia seguinte. Nenhuma sessão será criada antes de você escolher o objetivo.</p>
            {cycleAdvisor.loading ? <p className="text-xs text-muted-foreground">Auditando histórico...</p> : null}
            {cycleAdvisor.error ? <p className="text-xs text-destructive">Auditoria indisponível: {cycleAdvisor.error}</p> : (
              <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1">
                <p className="font-medium">Evidências da auditoria</p>
                <p>{cycleAdvisor.assessment.completed_sessions} sessões · {cycleAdvisor.assessment.completed_sets} séries · {cycleAdvisor.assessment.measured_sets} séries com carga, reps e RIR</p>
                <p>{cycleAdvisor.assessment.exercise_assessments.filter(item => item.decision === "progress_candidate").length} proposta(s) de progressão e {cycleAdvisor.assessment.exercise_assessments.filter(item => item.decision === "review").length} exercício(s) a revisar.</p>
                <div className="mt-2 space-y-2">
                  {cycleAdvisor.assessment.exercise_assessments.slice(0, 12).map((item) => (
                    <div key={item.template_exercise_id} className="rounded border p-2">
                      <p className="font-medium">{item.session_code}: {exerciseNameById.get(item.exercise_id) ?? "Exercício"} · {item.decision === "progress_candidate" ? "Proposta" : item.decision === "review" ? "Revisar" : item.decision === "maintain" ? "Manter" : "Dados insuficientes"}</p>
                      <p className="text-muted-foreground">{item.exposures} exposição(ões) comparáveis; {item.load_value == null ? "sem carga comparable" : `${item.load_value} ${item.load_unit ?? ""}`}; reps anterior/recente: {item.previous_best_reps ?? "—"}/{item.latest_best_reps ?? "—"}</p>
                      <p className="text-muted-foreground">{item.reason}</p>
                    </div>
                  ))}
                </div>
                {cycleAdvisor.assessment.load_trends?.length ? (
                  <div className="space-y-1">
                    <p className="font-medium">Tendência de força por exercício (observacional)</p>
                    {cycleAdvisor.assessment.load_trends.slice(0,8).map(item => (
                      <p key={item.exercise_id + item.load_unit} className="text-muted-foreground">
                        {exerciseNameById.get(item.exercise_id) ?? "Exercício"} · {item.signal.replaceAll("_"," ")}
                        · carga anterior/recente: {item.prior_peak_load ?? "—"}/{item.recent_peak_load ?? "—"} {item.load_unit}.
                      </p>
                    ))}
                  </div>
                ) : null}
                {cycleAdvisor.assessment.frequency_context ? (
                  <p className="text-muted-foreground">Regularidade: {cycleAdvisor.assessment.frequency_context.completed_sessions} sessões registradas no período observado de {cycleAdvisor.assessment.frequency_context.span_days ?? "—"} dia(s); não representa meta semanal.</p>
                ) : null}
                {cycleAdvisor.assessment.muscle_distribution?.length ? (
                  <div className="space-y-1">
                    <p className="font-medium">Distribuição observada de séries por grupo muscular principal</p>
                    {cycleAdvisor.assessment.muscle_distribution.map(item => (
                      <p key={item.muscle_group_id} className="text-muted-foreground">
                        {item.muscle_name}: {item.recorded_work_sets} séries realizadas; mínimo planejado na sequência: {item.planned_min_sets_per_sequence}; observadas por 7 dias: {item.normalization_available ? item.observed_sets_per_7_days : "não comparável"}.
                      </p>
                    ))}
                    <p className="text-muted-foreground">Totais da sequência, não volume semanal recomendado. Grupos secundários não são somados.</p>
                  </div>
                ) : null}
                {cycleAdvisor.assessment.periodization_options?.length ? (
                  <div className="space-y-1">
                    <p className="font-medium">Roteiro de periodização flexível</p>
                    {cycleAdvisor.assessment.periodization_options.map(item => (
                      <p key={item.stage} className="text-muted-foreground">{item.description}</p>
                    ))}
                  </div>
                ) : null}
                {cycleAdvisor.assessment.goal_specific_guidance?.[goalChoice === "unsure" ? "hypertrophy" : goalChoice] ? (
                  <p className="text-muted-foreground">{cycleAdvisor.assessment.goal_specific_guidance[goalChoice === "unsure" ? "hypertrophy" : goalChoice]}</p>
                ) : null}
                {cycleAdvisor.assessment.recovery_context ? <p className="text-muted-foreground">Recuperação: existe registro recente de {cycleAdvisor.assessment.recovery_context.as_of_date}; interpretar cobertura e percepção antes de alterar estímulos.</p> : <p className="text-muted-foreground">Recuperação: sem informação recente suficiente para justificar mudanças.</p>}
                {cycleAdvisor.assessment.limitations.map((text, index) => <p key={index} className="text-muted-foreground">{text}</p>)}
                <p className="text-muted-foreground">Fase registrada: {phaseLabel}. Nível: {trainingProfile.profile?.training_level ?? "não informado"}.</p>
                <p className="text-muted-foreground">
                  F13 — Revisão longitudinal: {longitudinal.run ?
                    `${longitudinal.run.runStatus}, ${longitudinal.run.availableDomains.length} domínio(s) comparáveis` :
                    "sem revisão disponível para esta decisão"}.
                </p>
                {replanning.currentCase ? <p className="text-muted-foreground">
                  F14 — Caso de replanejamento: {replanning.currentCase.caseStatus}. A decisão humana continua independente da geração.
                </p> : null}
              </div>
            )}
            <div className="space-y-2">
              <Label>Qual é seu objetivo agora?</Label>
              <Select value={goalChoice} onValueChange={(value) => setGoalChoice(value as GuidedGoal | "unsure")}>
                <SelectTrigger className="min-h-11"><SelectValue placeholder="Escolha um objetivo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unsure">Não sei — quero recomendações</SelectItem>
                  {guidedGoals.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {goalChoice === "unsure" ? (
              <div className="space-y-2">
                <p className="text-xs font-medium">Estratégias para você avaliar</p>
                {cycleAdvisor.recommendations.map((item) => (
                  <button key={item.goal + item.strategy} type="button"
                    className="w-full rounded-lg border p-3 text-left hover:border-primary/50"
                    onClick={() => { setGoalChoice(item.goal); setStrategyChoice(item.strategy); }}>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Estratégia para o próximo ciclo</Label>
                <Select value={strategyChoice} onValueChange={(value) => setStrategyChoice(value as GuidedStrategy)}>
                  <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{guidedStrategies.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{guidedStrategies.find(s => s.value === strategyChoice)?.detail}</p>
              </div>
            )}
            {goalChoice === "muscle_priority" ? (
              <div className="space-y-2">
                <Label>Qual grupo muscular deseja priorizar?</Label>
                <Select value={priorityMuscleId} onValueChange={setPriorityMuscleId}>
                  <SelectTrigger className="min-h-11"><SelectValue placeholder="Selecione um grupo do programa"/></SelectTrigger>
                  <SelectContent>
                    {cycleAdvisor.assessment.muscle_distribution?.map(item => (
                      <SelectItem key={item.muscle_group_id} value={item.muscle_group_id}>{item.muscle_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">A escolha altera a prioridade do rascunho; a distribuição de volume precisará ser revisada antes da publicação.</p>
                {strategyChoice === "continue_progression" ? (
                  <label className="flex gap-2 items-start text-xs">
                    <input type="checkbox" className="mt-1" checked={allowTargetedSets}
                      onChange={event => setAllowTargetedSets(event.target.checked)} />
                    Propor, se houver evidências compatíveis, aumento de 1 no máximo de séries de um único exercício prioritário. Revisarei o rascunho antes de publicar.
                  </label>
                ) : null}
              </div>
            ) : null}
            <p className="text-xs">Disponibilidade: <strong>flexível</strong> — o programa preserva a sequência de estímulos sem fixar dias da semana.</p>
            <Button className="w-full min-h-11" disabled={goalChoice === "unsure" || (goalChoice === "muscle_priority" && !priorityMuscleId) || cycleAdvisor.loading ||
              !!cycleAdvisor.error || cycleAdvisor.generating || program.saving}
              onClick={() => void save("Nova versão proposta para revisão; nenhuma sessão foi publicada.", async () => {
                await cycleAdvisor.generate(program.program!.id, goalChoice as GuidedGoal, strategyChoice, priorityMuscleId,goalChoice === "muscle_priority" && strategyChoice === "continue_progression" && allowTargetedSets);
                await program.reload();
              })}>
              {cycleAdvisor.generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              Gerar proposta de novo ciclo
            </Button>
            <p className="text-[11px] text-muted-foreground">Prescrições sem evidência suficiente serão mantidas para revisão. A publicação da nova versão é separada e não ocorre automaticamente.</p>
          </CardContent>
        </Card>
      ) : null}
      {draft && program.program.current_version_id ? (
        <Card><CardContent className="space-y-2 py-4">
          <p className="text-sm font-medium">Próximo ciclo em revisão</p>
          <p className="text-xs text-muted-foreground">A versão anterior foi copiada para revisão, não é progressão automática. Confira cargas no Histórico e revise prescrições antes de publicar.</p>
        </CardContent></Card>
      ) : null}
      <Card className="border-primary/15">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BrainCircuit className="h-4 w-4 text-primary" />
            Perfil do praticante e confiança CCH
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trainingProfile.profile ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border p-3">
                  <p className="text-[11px] text-muted-foreground">Nível real</p>
                  <p className="mt-1 text-sm font-semibold capitalize">
                    {trainingProfile.profile.training_level === "advanced"
                      ? "Avançado"
                      : trainingProfile.profile.training_level === "intermediate"
                        ? "Intermediário"
                        : "Iniciante"}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-[11px] text-muted-foreground">Fase de treino</p>
                  <p className="mt-1 text-sm font-semibold capitalize">{phaseLabel}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-[11px] text-muted-foreground">Baseline CCH</p>
                  <p className="mt-1 text-sm font-semibold">
                    {trainingProfile.profile.baseline_state}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-[11px] text-muted-foreground">Confiança dos dados</p>
                  <p className="mt-1 text-sm font-semibold">
                    {trainingProfile.profile.overall_data_confidence}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-muted/35 p-3">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Calibração não limitante</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      O CCH aprende carga, resposta, RIR e recuperação durante treinos
                      produtivos. Baixa confiança em um dado não transforma um atleta
                      avançado em iniciante e não reduz automaticamente o estímulo.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Evidência interna por exercício:{" "}
                {trainingProfile.exerciseSummary.established} estabelecido(s),{" "}
                {trainingProfile.exerciseSummary.collecting} em coleta ·{" "}
                {trainingProfile.exerciseSummary.observedSets} séries observadas.
              </p>
            </>
          ) : trainingProfile.available ? (
            <p className="text-xs text-muted-foreground">
              Perfil de maturidade ainda não cadastrado.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              A camada F22 ainda não está disponível neste ambiente.
            </p>
          )}
        </CardContent>
      </Card>

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
                      {items.map((item) => {
                        const incomplete =
                          !item.is_optional &&
                          (
                            item.planned_sets_min == null ||
                            item.planned_sets_max == null ||
                            item.reps_min == null ||
                            item.reps_max == null ||
                            item.rir_target == null ||
                            item.rest_seconds == null
                          );

                        return (
                          <div
                            key={item.id}
                            className="rounded-lg bg-muted/40 px-3 py-2 text-sm"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span>
                                {item.sequence_order}.{" "}
                                {exerciseNameById.get(item.exercise_id) ?? "Exercício"}
                              </span>
                              {incomplete ? (
                                <Badge variant="destructive">Incompleto</Badge>
                              ) : null}
                            </div>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {item.planned_sets_min ?? "—"}–{item.planned_sets_max ?? "—"} séries ·{" "}
                              {item.reps_min ?? "—"}–{item.reps_max ?? "—"} reps · RIR{" "}
                              {item.rir_target ?? "—"} · descanso{" "}
                              {item.rest_seconds ?? "—"}s
                            </span>
                            {draft ? <div className="mt-2 space-y-2">
                              <Button variant="outline" size="sm" onClick={() => {
                                setEditId(item.id);
                                setEdit({setsMin:String(item.planned_sets_min??""),setsMax:String(item.planned_sets_max??""),
                                  repsMin:String(item.reps_min??""),repsMax:String(item.reps_max??""),
                                  rir:String(item.rir_target??""),rest:String(item.rest_seconds??"")});
                              }}>Revisar prescrição</Button>
                              {editId===item.id ? <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                  {([["Séries mín.","setsMin"],["Séries máx.","setsMax"],["Reps mín.","repsMin"],["Reps máx.","repsMax"],["RIR","rir"],["Descanso (s)","rest"]] as const).map(([label,key]) =>
                                    <label key={key} className="text-xs">{label}<Input type="number" step={key==="rir"?"0.5":"1"} value={edit[key]}
                                      onChange={e=>setEdit(prev=>({...prev,[key]:e.target.value}))}/></label>)}
                                </div>
                                <Button disabled={program.saving} onClick={() => void save("Prescrição atualizada.",async () => {
                                  await program.updatePrescription(item.id,{
                                    planned_sets_min:numberOrNull(edit.setsMin),planned_sets_max:numberOrNull(edit.setsMax),
                                    reps_min:numberOrNull(edit.repsMin),reps_max:numberOrNull(edit.repsMax),
                                    rir_target:numberOrNull(edit.rir),rest_seconds:numberOrNull(edit.rest)});
                                  setEditId(null);
                                })}>Salvar ajustes</Button>
                              </div> : null}
                            </div> : null}

                          </div>
                        );
                      })}
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
              O Publication Gate só libera a versão quando cada exercício obrigatório
              possui séries, reps, RIR e descanso válidos.
            </p>

            {!publicationReady ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs">
                Publicação bloqueada: {incompleteRequiredExercises.length} exercício(s)
                obrigatório(s) incompleto(s) e {templatesWithoutExercises.length} sessão(ões)
                sem exercícios.
              </div>
            ) : (
              <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-3 text-xs">
                Estrutura pronta para publicação.
              </div>
            )}

            <Button
              className="min-h-11 w-full"
              disabled={program.saving || !publicationReady}
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
