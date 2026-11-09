import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertTriangle, CheckCircle2, History, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useHealthAthlete } from "../hooks/useHealthAthlete";

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

const db = supabase as unknown as SupabaseClient<LooseDatabase>;

const REPAIR_MARKER = "HISTORICAL_REENTRY_2026_11_09";
const VOID_MARKER = "VOIDED_TEST_EXECUTION_2026_11_09";

type SetPlan = {
  loadValue: number | null;
  reps: number;
  notes?: string;
};

type SessionPlan = {
  code: "A1" | "C1" | "E1";
  date: string;
  exercises: Record<number, SetPlan[]>;
};

const repairPlan: SessionPlan[] = [
  {
    code: "A1",
    date: "2026-11-04",
    exercises: {
      1: [
        { loadValue: 80, reps: 8 },
        { loadValue: 80, reps: 8 },
        { loadValue: 80, reps: 8 },
      ],
      2: [
        { loadValue: 80, reps: 8 },
        { loadValue: 80, reps: 8 },
        { loadValue: 80, reps: 8 },
      ],
      3: [
        { loadValue: 80, reps: 10 },
        { loadValue: 80, reps: 10 },
      ],
      4: [
        { loadValue: 15, reps: 10, notes: "15 kg por halter." },
        { loadValue: 15, reps: 10, notes: "15 kg por halter." },
        { loadValue: 15, reps: 10, notes: "15 kg por halter." },
      ],
      5: [
        { loadValue: 50, reps: 12 },
        { loadValue: 50, reps: 12 },
      ],
    },
  },
  {
    code: "C1",
    date: "2026-11-05",
    exercises: {
      1: [
        { loadValue: 120, reps: 12, notes: "Peso total. Repetições reais acima da faixa prescrita de 6–10." },
        { loadValue: 160, reps: 8, notes: "Peso total." },
        { loadValue: 160, reps: 8, notes: "Peso total." },
      ],
      2: [
        { loadValue: 80, reps: 12, notes: "Peso total." },
        { loadValue: 80, reps: 12, notes: "Peso total." },
        { loadValue: 80, reps: 12, notes: "Peso total." },
      ],
      3: [
        {
          loadValue: null,
          reps: 10,
          notes:
            "Configuração 100 plaquinhas da máquina. Unidade física não confirmada; não converter para kg.",
        },
        {
          loadValue: null,
          reps: 10,
          notes:
            "Configuração 100 plaquinhas da máquina. Unidade física não confirmada; não converter para kg.",
        },
      ],
      4: [
        { loadValue: 40, reps: 12 },
        { loadValue: 40, reps: 12 },
        { loadValue: 40, reps: 12 },
        { loadValue: 40, reps: 12 },
      ],
    },
  },
  {
    code: "E1",
    date: "2026-11-06",
    exercises: {
      1: [
        { loadValue: 15, reps: 12, notes: "15 kg por halter; 12 repetições por lado." },
        { loadValue: 15, reps: 12, notes: "15 kg por halter; 12 repetições por lado." },
        { loadValue: 15, reps: 12, notes: "15 kg por halter; 12 repetições por lado." },
      ],
      2: [
        { loadValue: 15, reps: 10, notes: "15 kg por halter; 10 repetições por lado." },
        { loadValue: 15, reps: 10, notes: "15 kg por halter; 10 repetições por lado." },
        { loadValue: 15, reps: 10, notes: "15 kg por halter; 10 repetições por lado." },
      ],
      3: [{ loadValue: 35, reps: 12 }],
      4: [
        { loadValue: 40, reps: 8 },
        { loadValue: 40, reps: 8 },
        { loadValue: 40, reps: 8 },
      ],
      5: [
        { loadValue: 40, reps: 8, notes: "Repetições reais abaixo da faixa prescrita de 12–20." },
        { loadValue: 40, reps: 8, notes: "Repetições reais abaixo da faixa prescrita de 12–20." },
      ],
    },
  },
];

type ProgramRow = {
  id: string;
  current_version_id: string | null;
  name: string;
  status: string;
};

type VersionRow = {
  id: string;
  title: string;
  status: string;
  published_at: string | null;
};

type TemplateRow = {
  id: string;
  code: string;
  name: string;
  program_version_id: string;
};

type QueueRow = {
  id: string;
  session_template_id: string;
  queue_position: number;
  state: string;
  reason_codes: string[];
};

type TemplateExerciseRow = {
  id: string;
  session_template_id: string;
  exercise_id: string;
  sequence_order: number;
  planned_sets_min: number | null;
  planned_sets_max: number | null;
  reps_min: number | null;
  reps_max: number | null;
  rir_target: number | null;
  rest_seconds: number | null;
};

type SessionRow = {
  id: string;
  queue_entry_id: string | null;
  session_template_id: string | null;
  source: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
};

type PreviewState = {
  program: ProgramRow;
  version: VersionRow;
  templates: TemplateRow[];
  queues: QueueRow[];
  templateExercises: TemplateExerciseRow[];
  sessions: SessionRow[];
};

function isoDay(value: string) {
  return value.slice(0, 10);
}

function technicalTimestamp(date: string) {
  return `${date}T12:00:00-03:00`;
}

function appendUnique(values: string[] | null | undefined, additions: string[]) {
  return Array.from(new Set([...(values ?? []), ...additions]));
}

export function HealthHistoricalWorkoutRepairPage() {
  const { toast } = useToast();
  const { athlete, loading: athleteLoading } = useHealthAthlete();
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    if (!athlete?.id) return;
    setLoading(true);
    setError(null);

    try {
      if (athlete.display_name !== "Deividi Jacobus") {
        throw new Error("Este reparo é restrito ao atleta Deividi Jacobus.");
      }

      const { data: programData, error: programError } = await db
        .from("health_programs")
        .select("id,current_version_id,name,status")
        .eq("athlete_id", athlete.id)
        .eq("status", "active")
        .not("current_version_id", "is", null)
        .maybeSingle();

      if (programError) throw programError;
      const program = programData as unknown as ProgramRow | null;
      if (!program?.current_version_id) {
        throw new Error("Programa ativo publicado não encontrado.");
      }

      const { data: versionData, error: versionError } = await db
        .from("health_program_versions")
        .select("id,title,status,published_at")
        .eq("athlete_id", athlete.id)
        .eq("id", program.current_version_id)
        .single();

      if (versionError) throw versionError;
      const version = versionData as unknown as VersionRow;
      if (version.status !== "published") {
        throw new Error("A versão corrente não está publicada.");
      }

      const { data: templateData, error: templateError } = await db
        .from("health_session_templates")
        .select("id,code,name,program_version_id")
        .eq("athlete_id", athlete.id)
        .eq("program_version_id", version.id)
        .in("code", ["A1", "C1", "E1"])
        .order("sequence_order", { ascending: true });

      if (templateError) throw templateError;
      const templates = (templateData ?? []) as unknown as TemplateRow[];
      if (templates.length !== 3) {
        throw new Error("A1/C1/E1 não foram encontrados integralmente na versão publicada.");
      }

      const templateIds = templates.map((item) => item.id);

      const [{ data: queueData, error: queueError }, { data: exerciseData, error: exerciseError }, { data: sessionData, error: sessionError }] =
        await Promise.all([
          db
            .from("health_cch_queue_entries")
            .select("id,session_template_id,queue_position,state,reason_codes")
            .eq("athlete_id", athlete.id)
            .eq("program_version_id", version.id)
            .in("session_template_id", templateIds)
            .order("queue_position", { ascending: true }),
          db
            .from("health_session_template_exercises")
            .select(
              "id,session_template_id,exercise_id,sequence_order,planned_sets_min,planned_sets_max,reps_min,reps_max,rir_target,rest_seconds",
            )
            .eq("athlete_id", athlete.id)
            .in("session_template_id", templateIds)
            .order("sequence_order", { ascending: true }),
          db
            .from("health_workout_sessions")
            .select(
              "id,queue_entry_id,session_template_id,source,status,started_at,ended_at,notes,created_at",
            )
            .eq("athlete_id", athlete.id)
            .in("session_template_id", templateIds)
            .order("started_at", { ascending: true }),
        ]);

      if (queueError) throw queueError;
      if (exerciseError) throw exerciseError;
      if (sessionError) throw sessionError;

      const queues = (queueData ?? []) as unknown as QueueRow[];
      if (queues.length !== 3) {
        throw new Error("Fila A1/C1/E1 não encontrada integralmente.");
      }

      setPreview({
        program,
        version,
        templates,
        queues,
        templateExercises: (exerciseData ?? []) as unknown as TemplateExerciseRow[],
        sessions: (sessionData ?? []) as unknown as SessionRow[],
      });
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : "Falha ao carregar a prévia.");
    } finally {
      setLoading(false);
    }
  }, [athlete?.display_name, athlete?.id]);

  useEffect(() => {
    if (!athleteLoading) void loadPreview();
  }, [athleteLoading, loadPreview]);

  const testCandidates = useMemo(() => {
    if (!preview) return [];
    const templateCodeById = new Map(preview.templates.map((item) => [item.id, item.code]));
    const expectedDateByCode = new Map(repairPlan.map((item) => [item.code, item.date]));
    const publishedAt = preview.version.published_at ? new Date(preview.version.published_at).getTime() : 0;

    return preview.sessions.filter((session) => {
      if (session.status !== "completed" || session.source !== "queue" || !session.session_template_id) {
        return false;
      }
      const code = templateCodeById.get(session.session_template_id);
      const expectedDate = code ? expectedDateByCode.get(code as SessionPlan["code"]) : null;
      if (!code || !expectedDate) return false;
      const createdAfterPublish = publishedAt ? new Date(session.created_at).getTime() >= publishedAt : true;
      return createdAfterPublish && isoDay(session.started_at) !== expectedDate;
    });
  }, [preview]);

  const existingHistorical = useMemo(() => {
    if (!preview) return [];
    const templateCodeById = new Map(preview.templates.map((item) => [item.id, item.code]));
    const expectedDateByCode = new Map(repairPlan.map((item) => [item.code, item.date]));
    return preview.sessions.filter((session) => {
      if (session.status !== "completed" || !session.session_template_id) return false;
      const code = templateCodeById.get(session.session_template_id);
      const expectedDate = code ? expectedDateByCode.get(code as SessionPlan["code"]) : null;
      return Boolean(expectedDate && isoDay(session.started_at) === expectedDate);
    });
  }, [preview]);

  const applyRepair = async () => {
    if (!athlete?.id || !preview) return;

    const confirmed = window.confirm(
      "Aplicar o reparo histórico de Deividi? Sessões de teste identificadas serão marcadas como aborted (não apagadas), e A1/C1/E1 serão inseridos em 04/11, 05/11 e 06/11/2026.",
    );
    if (!confirmed) return;

    setApplying(true);
    setError(null);

    try {
      const templateByCode = new Map(preview.templates.map((item) => [item.code, item]));
      const queueByTemplate = new Map(preview.queues.map((item) => [item.session_template_id, item]));
      const exercisesByTemplate = new Map<string, TemplateExerciseRow[]>();

      for (const exercise of preview.templateExercises) {
        const list = exercisesByTemplate.get(exercise.session_template_id) ?? [];
        list.push(exercise);
        exercisesByTemplate.set(exercise.session_template_id, list);
      }

      for (const session of testCandidates) {
        const nextNotes = [session.notes, VOID_MARKER, "Sessão criada durante calibração/teste e retirada da história válida a pedido do usuário."]
          .filter(Boolean)
          .join(" | ");

        const { error: abortError } = await db
          .from("health_workout_sessions")
          .update({ status: "aborted", notes: nextNotes })
          .eq("id", session.id)
          .eq("athlete_id", athlete.id)
          .eq("status", "completed");

        if (abortError) throw abortError;

        const { error: noteError } = await db.from("health_workout_events").insert({
          athlete_id: athlete.id,
          session_id: session.id,
          event_type: "note",
          source: "user",
          client_event_id: crypto.randomUUID(),
          occurred_at: new Date().toISOString(),
          payload: {
            marker: VOID_MARKER,
            reason: "test_or_calibration_session_voided_by_user",
          },
        });

        if (noteError) throw noteError;
      }

      for (const plan of repairPlan) {
        const template = templateByCode.get(plan.code);
        if (!template) throw new Error(`Template ${plan.code} não encontrado.`);
        const queue = queueByTemplate.get(template.id);
        if (!queue) throw new Error(`Fila ${plan.code} não encontrada.`);

        const alreadyExists = preview.sessions.some(
          (session) =>
            session.status === "completed" &&
            session.session_template_id === template.id &&
            isoDay(session.started_at) === plan.date,
        );

        if (!alreadyExists) {
          const timestamp = technicalTimestamp(plan.date);
          const startClientEventId = crypto.randomUUID();

          const { error: sessionInsertError } = await db.from("health_workout_sessions").insert({
            athlete_id: athlete.id,
            queue_entry_id: queue.id,
            program_version_id: preview.version.id,
            session_template_id: template.id,
            source: "reentry",
            status: "completed",
            started_at: timestamp,
            ended_at: timestamp,
            start_client_event_id: startClientEventId,
            notes:
              `${REPAIR_MARKER} | Data real informada pelo usuário. Horário e duração não informados; 12:00 America/Sao_Paulo é timestamp técnico de data, não horário declarado. RIR real e descanso não informados.`,
          });

          if (sessionInsertError) throw sessionInsertError;

          const { data: insertedSessionData, error: insertedSessionError } = await db
            .from("health_workout_sessions")
            .select("id")
            .eq("athlete_id", athlete.id)
            .eq("start_client_event_id", startClientEventId)
            .single();

          if (insertedSessionError) throw insertedSessionError;
          const sessionId = String((insertedSessionData as Record<string, unknown>).id);

          const templateExercises = (exercisesByTemplate.get(template.id) ?? []).sort(
            (a, b) => a.sequence_order - b.sequence_order,
          );

          const exerciseRows = templateExercises.map((exercise) => ({
            session_id: sessionId,
            athlete_id: athlete.id,
            exercise_id: exercise.exercise_id,
            template_exercise_id: exercise.id,
            sequence_order: exercise.sequence_order,
            origin: "template",
            status: "completed",
            planned_sets_min: exercise.planned_sets_min,
            planned_sets_max: exercise.planned_sets_max,
            planned_reps_min: exercise.reps_min,
            planned_reps_max: exercise.reps_max,
            planned_rir_target: exercise.rir_target,
            planned_rest_seconds: exercise.rest_seconds,
            notes: `${REPAIR_MARKER} | execução histórica reconstruída a partir do relato do usuário`,
          }));

          const { error: exerciseInsertError } = await db
            .from("health_workout_exercises")
            .insert(exerciseRows);
          if (exerciseInsertError) throw exerciseInsertError;

          const { data: insertedExerciseData, error: insertedExerciseError } = await db
            .from("health_workout_exercises")
            .select("id,sequence_order")
            .eq("athlete_id", athlete.id)
            .eq("session_id", sessionId)
            .order("sequence_order", { ascending: true });

          if (insertedExerciseError) throw insertedExerciseError;
          const insertedExercises = (insertedExerciseData ?? []) as unknown as Array<{
            id: string;
            sequence_order: number;
          }>;

          const workoutExerciseIdBySequence = new Map(
            insertedExercises.map((item) => [item.sequence_order, item.id]),
          );

          const setRows: Array<Record<string, unknown>> = [];
          for (const [sequenceText, setPlans] of Object.entries(plan.exercises)) {
            const sequence = Number(sequenceText);
            const workoutExerciseId = workoutExerciseIdBySequence.get(sequence);
            if (!workoutExerciseId) {
              throw new Error(`Exercício ${sequence} de ${plan.code} não materializado.`);
            }

            setPlans.forEach((setPlan, index) => {
              setRows.push({
                workout_exercise_id: workoutExerciseId,
                session_id: sessionId,
                athlete_id: athlete.id,
                set_number: index + 1,
                set_type: "working",
                status: "completed",
                load_value: setPlan.loadValue,
                load_unit: "kg",
                reps: setPlan.reps,
                rir: null,
                rest_seconds: null,
                client_event_id: crypto.randomUUID(),
                completed_at: timestamp,
                notes: [REPAIR_MARKER, setPlan.notes].filter(Boolean).join(" | "),
              });
            });
          }

          const { error: setInsertError } = await db.from("health_workout_sets").insert(setRows);
          if (setInsertError) throw setInsertError;

          const { error: eventInsertError } = await db.from("health_workout_events").insert([
            {
              athlete_id: athlete.id,
              session_id: sessionId,
              event_type: "session_started",
              source: "user",
              client_event_id: crypto.randomUUID(),
              occurred_at: timestamp,
              payload: {
                marker: REPAIR_MARKER,
                historical_reentry: true,
                date_precision: "day",
                queue_entry_id: queue.id,
                program_version_id: preview.version.id,
                session_template_id: template.id,
              },
            },
            {
              athlete_id: athlete.id,
              session_id: sessionId,
              event_type: "note",
              source: "user",
              client_event_id: crypto.randomUUID(),
              occurred_at: timestamp,
              payload: {
                marker: REPAIR_MARKER,
                historical_reentry: true,
                note: "RIR real, descanso, horário e duração não informados. Prescrição permanece separada da execução.",
              },
            },
            {
              athlete_id: athlete.id,
              session_id: sessionId,
              event_type: "session_completed",
              source: "user",
              client_event_id: crypto.randomUUID(),
              occurred_at: timestamp,
              payload: {
                marker: REPAIR_MARKER,
                historical_reentry: true,
                completed_sets: setRows.length,
                queue_entry_id: queue.id,
              },
            },
          ]);

          if (eventInsertError) throw eventInsertError;
        }

        const nextReasonCodes = appendUnique(queue.reason_codes, [
          "WORKOUT_COMPLETED",
          "HISTORICAL_REENTRY",
          "USER_CONFIRMED_HISTORY",
        ]);

        const { error: queueUpdateError } = await db
          .from("health_cch_queue_entries")
          .update({
            state: "completed",
            reason_codes: nextReasonCodes,
            blocked_reason: null,
          })
          .eq("id", queue.id)
          .eq("athlete_id", athlete.id);

        if (queueUpdateError) throw queueUpdateError;
      }

      setApplied(true);
      toast({
        title: "Histórico reparado",
        description: "A1, C1 e E1 foram reconciliados. A fila deve avançar para D1.",
      });
      await loadPreview();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Falha ao aplicar reparo.";
      setError(message);
      toast({
        variant: "destructive",
        title: "Reparo não concluído",
        description: message,
      });
    } finally {
      setApplying(false);
    }
  };

  if (athleteLoading || loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!athlete || athlete.display_name !== "Deividi Jacobus") {
    return (
      <Card className="border-destructive/40">
        <CardContent className="py-5 text-sm text-destructive">
          Reparo bloqueado: esta rota só pode ser usada pelo atleta Deividi Jacobus.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Reparo histórico de treino</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Operação temporária para reconciliar A1/C1/E1 reais de 04–06/11/2026.
        </p>
      </div>

      {error ? (
        <Card className="border-destructive/40">
          <CardContent className="flex gap-2 py-4 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Salvaguardas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>• Não apaga sessões: testes identificados viram <strong>aborted</strong>.</p>
          <p>• Não altera o programa publicado nem as prescrições.</p>
          <p>• RIR real e descanso permanecem ausentes.</p>
          <p>• “100 plaquinhas” da extensora não é convertido para kg.</p>
          <p>• Horário real não informado: 12:00 é apenas timestamp técnico para preservar a data.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            Prévia atual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {preview ? (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                {repairPlan.map((plan) => {
                  const template = preview.templates.find((item) => item.code === plan.code);
                  const queue = template
                    ? preview.queues.find((item) => item.session_template_id === template.id)
                    : null;
                  const historical = template
                    ? preview.sessions.find(
                        (item) =>
                          item.session_template_id === template.id &&
                          item.status === "completed" &&
                          isoDay(item.started_at) === plan.date,
                      )
                    : null;
                  return (
                    <div key={plan.code} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{plan.code} · {plan.date.split("-").reverse().join("/")}</p>
                        <Badge variant="outline">{queue?.state ?? "sem fila"}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {historical ? "Histórico real já existente." : "Histórico real ainda ausente."}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border p-3">
                <p className="text-sm font-medium">Sessões candidatas a teste</p>
                {testCandidates.length ? (
                  <div className="mt-2 space-y-2">
                    {testCandidates.map((session) => {
                      const template = preview.templates.find(
                        (item) => item.id === session.session_template_id,
                      );
                      return (
                        <div key={session.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span>
                            {template?.code ?? "?"} · {isoDay(session.started_at)} · {session.source}
                          </span>
                          <Badge variant="secondary">será invalidada</Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Nenhuma sessão completed pós-publicação fora das datas reais foi encontrada.
                  </p>
                )}
              </div>

              <div className="rounded-xl border p-3">
                <p className="text-sm font-medium">Históricos reais já presentes</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {existingHistorical.length} de 3 sessões já existem nas datas esperadas.
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Prévia indisponível.</p>
          )}

          <Button variant="outline" className="min-h-11 w-full" onClick={() => void loadPreview()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Recarregar prévia
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Aplicar reconciliação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            A ação é idempotente por data/template: se uma sessão real já existir na data correta, ela não será duplicada.
          </p>
          <Button
            className="min-h-12 w-full"
            disabled={!preview || applying || applied}
            onClick={() => void applyRepair()}
          >
            {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {applied ? "Reparo aplicado" : "Aplicar reparo A1/C1/E1"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
