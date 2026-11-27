import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Dumbbell,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  X,
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useHealthAthlete } from "../hooks/useHealthAthlete";
import {
  type HistoryActivitySessionF21,
  type HistoryWorkoutSessionF21,
  type HistoryWorkoutSetF21,
  useHealthTrainingHistoryF21,
} from "../hooks/useHealthTrainingHistoryF21";

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  if(!/^\d+(?:[.,]\d+)?$/.test(value.trim()))return null;
  const parsed = Number(value.replace(",","."));
  return Number.isFinite(parsed) ? parsed : null;
}

const validNumbers=(values:string[])=>values.every(v=>!v.trim()||numberOrNull(v)!==null);
function localDateTimeInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 19);
}

function durationMinutes(startedAt: string, endedAt: string | null) {
  if (!endedAt) return "";
  return String(
    Math.max(
      0,
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000,
    ),
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return "—";
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

function formatSeriesClock(seconds: number | null | undefined) {
  if (seconds == null) return "—";
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function HistoricalSetEditor({
  set,
  saving,
  onSave,
}: {
  set: HistoryWorkoutSetF21;
  saving: boolean;
  onSave: (values: {
    loadValue: number | null;
    loadUnit: string;
    reps: number | null;
    rir: number | null;
    restSeconds: number | null;
  }) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [load, setLoad] = useState("");
  const [unit, setUnit] = useState("kg");
  const [reps, setReps] = useState("");
  const [rir, setRir] = useState("");
  const [rest, setRest] = useState("");

  const begin = () => {
    setLoad(set.load_value == null ? "" : String(set.load_value));
    setUnit(set.load_unit || "kg");
    setReps(set.reps == null ? "" : String(set.reps));
    setRir(set.rir == null ? "" : String(set.rir));
    setRest(set.rest_seconds == null ? "" : String(set.rest_seconds));
    setEditing(true);
  };

  if (!editing) {
    return (
      <div className="grid grid-cols-[26px_1fr_44px] items-center gap-2 rounded-lg bg-muted/35 px-3 py-2 text-sm">
        <span className="font-semibold">#{set.set_number}</span>
        <div className="min-w-0">
          <p>
            {set.load_value ?? "—"} {set.load_unit} · {set.reps ?? "—"} reps ·
            RIR {set.rir ?? "—"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Execução {formatSeriesClock(set.work_seconds)}
            {" · "}
            Descanso após {formatSeriesClock(set.rest_seconds)}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="min-h-11 min-w-11"
          disabled={saving}
          onClick={begin}
          aria-label={"Editar série " + set.set_number}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Editar série #{set.set_number}</p>
        <Button
          size="icon"
          variant="ghost"
          disabled={saving}
          onClick={() => setEditing(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Field label="Carga">
          <Input
            inputMode="decimal"
            value={load}
            onChange={(e) => setLoad(e.target.value)}
          />
        </Field>
        <Field label="Unid.">
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="kg">kg</SelectItem>
              <SelectItem value="lb">lb</SelectItem>
              <SelectItem value="bodyweight">Corpo</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Reps">
          <Input
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />
        </Field>
        <Field label="RIR">
          <Input
            inputMode="decimal"
            value={rir}
            onChange={(e) => setRir(e.target.value)}
          />
        </Field>
        <Field label="Desc. s">
          <Input
            inputMode="numeric"
            value={rest}
            onChange={(e) => setRest(e.target.value)}
          />
        </Field>
      </div>

      <p className="text-[11px] text-muted-foreground">
        O tempo de execução é medido pelo cronômetro e permanece preservado.
        O campo de descanso acima representa o descanso após esta série.
      </p>

      <Button
        className="min-h-11 w-full"
        disabled={saving||!validNumbers([load,reps,rir,rest])||[reps,rest].some(v=>v.trim()&&!Number.isInteger(numberOrNull(v)))}
        onClick={() =>
          void onSave({
            loadValue: numberOrNull(load),
            loadUnit: unit,
            reps: numberOrNull(reps),
            rir: numberOrNull(rir),
            restSeconds: numberOrNull(rest),
          }).then(ok => {if(ok)setEditing(false);})
        }
      >
        <Save className="mr-2 h-4 w-4" />
        Salvar correção
      </Button>
    </div>
  );
}

function StrengthCard({
  session,
  saving,
  onUpdateSession,
  onUpdateSet,
  onVoid,
}: {
  session: HistoryWorkoutSessionF21;
  saving: boolean;
  onUpdateSession: (values: {
    startedAt: string;
    endedAt: string;
    notes: string | null;
  }) => Promise<boolean>;
  onUpdateSet: (
    setId: string,
    values: {
      loadValue: number | null;
      loadUnit: string;
      reps: number | null;
      rir: number | null;
      restSeconds: number | null;
    },
  ) => Promise<boolean>;
  onVoid: (reason: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"edit" | "void" | null>(null);
  const [start, setStart] = useState(() => localDateTimeInput(session.started_at));
  const [duration, setDuration] = useState(() =>
    durationMinutes(session.started_at, session.ended_at),
  );
  const [notes, setNotes] = useState(session.notes ?? "");
  const [reason, setReason] = useState("");

  const totalSets = session.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.length,
    0,
  );

  const openEdit = () => {
    setStart(localDateTimeInput(session.started_at));
    setDuration(durationMinutes(session.started_at, session.ended_at));
    setNotes(session.notes ?? "");
    setMode("edit");
  };

  const saveSession = async () => {
    const minutes = numberOrNull(duration);
    if (minutes == null || minutes < 0) {
      throw new Error("Informe uma duração válida.");
    }
    const startedAt = start===localDateTimeInput(session.started_at)?session.started_at:new Date(start).toISOString();
    const endedAt = new Date(
      new Date(startedAt).getTime() + Math.round(minutes * 60_000),
    ).toISOString();
    const ok=await onUpdateSession({
      startedAt,
      endedAt,
      notes: notes.trim() || null,
    });
    if(ok)setMode(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Dumbbell className="h-4 w-4 text-primary" />
              {session.template_code ? `${session.template_code} · ` : ""}
              {session.template_name ?? "Musculação"}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTime(session.started_at)}
              {" · "}
              {formatDuration(
                session.ended_at
                  ? Math.max(
                      0,
                      Math.round(
                        (new Date(session.ended_at).getTime() -
                          new Date(session.started_at).getTime()) /
                          1000,
                      ),
                    )
                  : null,
              )}
              {" · "}
              {totalSets} série(s)
            </p>
          </div>
          <Badge variant="outline">Musculação</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="min-h-11 h-auto whitespace-normal"
            disabled={saving}
            onClick={openEdit}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Editar sessão
          </Button>
          <Button
            variant="outline"
            className="min-h-11 h-auto whitespace-normal text-destructive hover:text-destructive"
            disabled={saving}
            onClick={() => setMode("void")}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir do histórico
          </Button>
        </div>

        {mode === "edit" ? (
          <div className="space-y-3 rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Editar treino</p>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setMode(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Início">
                <Input
                  type="datetime-local" step="1"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field label="Duração min">
                <Input
                  inputMode="numeric"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Observações">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>

            <Button
              className="min-h-11 w-full"
              disabled={saving||numberOrNull(duration)===null||!Number.isFinite(Date.parse(start))}
              onClick={() => void saveSession()}
            >
              <Save className="mr-2 h-4 w-4" />
              Salvar sessão
            </Button>
          </div>
        ) : null}

        {mode === "void" ? (
          <VoidPanel
            reason={reason}
            onReasonChange={setReason}
            saving={saving}
            onCancel={() => setMode(null)}
            onConfirm={async () => {
              if (!reason.trim()) {
                throw new Error("Informe o motivo da exclusão.");
              }
              if(await onVoid(reason.trim())){setReason("");setMode(null);}
            }}
          />
        ) : null}

        <details className="rounded-xl border p-3">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
            Exercícios e séries
          </summary>

          <div className="mt-3 space-y-4">
            {session.exercises.length ? (
              session.exercises.map((exercise) => (
                <div key={exercise.id} className="space-y-2">
                  <p className="text-sm font-semibold">
                    {exercise.sequence_order}. {exercise.exercise_name}
                  </p>
                  {exercise.sets.length ? (
                    exercise.sets.map((set) => (
                      <HistoricalSetEditor
                        key={set.id}
                        set={set}
                        saving={saving}
                        onSave={(values) => onUpdateSet(set.id, values)}
                      />
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Sem séries registradas.
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                Sem exercícios registrados nesta sessão.
              </p>
            )}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function ActivityCard({
  session,
  modalities,
  saving,
  onUpdate,
  onVoid,
}: {
  session: HistoryActivitySessionF21;
  modalities: Array<{ code: string; name: string }>;
  saving: boolean;
  onUpdate: (values: {
    modalityCode: string;
    title: string;
    startedAt: string;
    durationSeconds: number;
    distanceMeters: number | null;
    caloriesKcal: number | null;
    avgHrBpm: number | null;
    maxHrBpm: number | null;
    rpe: number | null;
    cadenceSpm: number | null;
    elevationGainM: number | null;
    steps: number | null;
    notes: string | null;
  }) => Promise<boolean>;
  onVoid: (reason: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"edit" | "void" | null>(null);
  const [modality, setModality] = useState(session.modality_code);
  const [title, setTitle] = useState(session.title);
  const [start, setStart] = useState(() => localDateTimeInput(session.started_at));
  const [duration, setDuration] = useState(() =>
    session.active_duration_seconds == null
      ? ""
      : String(session.active_duration_seconds / 60),
  );
  const [distanceKm, setDistanceKm] = useState(() =>
    session.distance_meters == null
      ? ""
      : String(session.distance_meters / 1000),
  );
  const [calories, setCalories] = useState(
    session.calories_kcal == null ? "" : String(session.calories_kcal),
  );
  const [avgHr, setAvgHr] = useState(
    session.avg_hr_bpm == null ? "" : String(session.avg_hr_bpm),
  );
  const [maxHr, setMaxHr] = useState(
    session.max_hr_bpm == null ? "" : String(session.max_hr_bpm),
  );
  const [rpe, setRpe] = useState(
    session.rpe == null ? "" : String(session.rpe),
  );
  const [cadence, setCadence] = useState(
    session.cadence_spm == null ? "" : String(session.cadence_spm),
  );
  const [elevation, setElevation] = useState(
    session.elevation_gain_m == null ? "" : String(session.elevation_gain_m),
  );
  const [steps, setSteps] = useState(
    session.steps == null ? "" : String(session.steps),
  );
  const [notes, setNotes] = useState(session.notes ?? "");
  const [reason, setReason] = useState("");

  const resetEdit = () => {
    setModality(session.modality_code);
    setTitle(session.title);
    setStart(localDateTimeInput(session.started_at));
    setDuration(
      session.active_duration_seconds == null
        ? ""
        : String(session.active_duration_seconds / 60),
    );
    setDistanceKm(
      session.distance_meters == null
        ? ""
        : String(session.distance_meters / 1000),
    );
    setCalories(
      session.calories_kcal == null ? "" : String(session.calories_kcal),
    );
    setAvgHr(session.avg_hr_bpm == null ? "" : String(session.avg_hr_bpm));
    setMaxHr(session.max_hr_bpm == null ? "" : String(session.max_hr_bpm));
    setRpe(session.rpe == null ? "" : String(session.rpe));
    setCadence(
      session.cadence_spm == null ? "" : String(session.cadence_spm),
    );
    setElevation(
      session.elevation_gain_m == null
        ? ""
        : String(session.elevation_gain_m),
    );
    setSteps(session.steps == null ? "" : String(session.steps));
    setNotes(session.notes ?? "");
    setMode("edit");
  };

  const save = async () => {
    const minutes = numberOrNull(duration);
    if (minutes == null || minutes <= 0) {
      throw new Error("Informe uma duração válida.");
    }

    const ok=await onUpdate({
      modalityCode: modality,
      title: title.trim(),
      startedAt: start===localDateTimeInput(session.started_at)?session.started_at:new Date(start).toISOString(),
      durationSeconds: Math.round(minutes * 60),
      distanceMeters:
        numberOrNull(distanceKm) == null
          ? null
          : Number(numberOrNull(distanceKm)) * 1000,
      caloriesKcal: numberOrNull(calories),
      avgHrBpm: numberOrNull(avgHr),
      maxHrBpm: numberOrNull(maxHr),
      rpe: numberOrNull(rpe),
      cadenceSpm: numberOrNull(cadence),
      elevationGainM: numberOrNull(elevation),
      steps: numberOrNull(steps),
      notes: notes.trim() || null,
    });

    if(ok)setMode(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              {session.title}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {session.modality_name} · {formatDateTime(session.started_at)}
              {" · "}
              {formatDuration(session.active_duration_seconds)}
              {session.distance_meters != null
                ? ` · ${(session.distance_meters / 1000).toFixed(2)} km`
                : ""}
            </p>
          </div>
          <Badge variant="outline">Atividade</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="min-h-11 h-auto whitespace-normal"
            disabled={saving}
            onClick={resetEdit}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Editar atividade
          </Button>
          <Button
            variant="outline"
            className="min-h-11 h-auto whitespace-normal text-destructive hover:text-destructive"
            disabled={saving}
            onClick={() => setMode("void")}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir do histórico
          </Button>
        </div>

        {mode === "edit" ? (
          <div className="space-y-3 rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Editar atividade</p>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setMode(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Modalidade">
                <Select value={modality} onValueChange={setModality}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {modalities.map((item) => (
                      <SelectItem key={item.code} value={item.code}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Título">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>
              <Field label="Início">
                <Input
                  type="datetime-local" step="1"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field label="Duração min">
                <Input
                  inputMode="numeric"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Distância km" value={distanceKm} setValue={setDistanceKm} />
              <Metric label="Calorias" value={calories} setValue={setCalories} />
              <Metric label="FC média" value={avgHr} setValue={setAvgHr} />
              <Metric label="FC máxima" value={maxHr} setValue={setMaxHr} />
              <Metric label="RPE" value={rpe} setValue={setRpe} />
              <Metric label="Cadência" value={cadence} setValue={setCadence} />
              <Metric label="Elevação m" value={elevation} setValue={setElevation} />
              <Metric label="Passos" value={steps} setValue={setSteps} />
            </div>

            <Field label="Observações">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>

            <Button
              className="min-h-11 w-full"
              disabled={saving||!validNumbers([duration,distanceKm,calories,avgHr,maxHr,rpe,cadence,elevation,steps])||(numberOrNull(duration)??0)<=0||!Number.isFinite(Date.parse(start))||(numberOrNull(rpe)??0)>10||(numberOrNull(avgHr)!==null&&numberOrNull(maxHr)!==null&&numberOrNull(avgHr)!>numberOrNull(maxHr)!)||(numberOrNull(steps)!==null&&!Number.isInteger(numberOrNull(steps)))||!title.trim()||!modalities.some(m=>m.code===modality)}
              onClick={() => void save()}
            >
              <Save className="mr-2 h-4 w-4" />
              Salvar atividade
            </Button>
          </div>
        ) : null}

        {mode === "void" ? (
          <VoidPanel
            reason={reason}
            onReasonChange={setReason}
            saving={saving}
            onCancel={() => setMode(null)}
            onConfirm={async () => {
              if (!reason.trim()) {
                throw new Error("Informe o motivo da exclusão.");
              }
              if(await onVoid(reason.trim())){setReason("");setMode(null);}
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function VoidPanel({
  reason,
  onReasonChange,
  saving,
  onCancel,
  onConfirm,
}: {
  reason: string;
  onReasonChange: (value: string) => void;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-destructive/30 p-3">
      <div>
        <p className="text-sm font-semibold">Excluir do histórico?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          O registro sairá do histórico ativo e das análises, mas continuará
          preservado tecnicamente para auditoria. Na musculação da fila CCH,
          se não existir treino posterior válido, o treino excluído volta
          automaticamente a ser o próximo da sequência.
        </p>
      </div>

      <Field label="Motivo obrigatório">
        <Textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Ex.: treino de teste, lançamento duplicado..."
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="min-h-11"
          disabled={saving}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          variant="destructive"
          className="min-h-11"
          disabled={saving || !reason.trim()}
          onClick={() => void onConfirm()}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Confirmar exclusão
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Input
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </Field>
  );
}

export function HealthTrainingHistoryPage() {
  const {athlete,loading}=useHealthAthlete();
  if(loading)return <p role="status">Carregando perfil…</p>;
  if(!athlete?.id)return <p>Perfil indisponível.</p>;
  return <HistoryContent key={athlete.id} athleteId={athlete.id}/>;
}
function HistoryContent({athleteId}:{athleteId:string}){
  const {toast}=useToast();
  const history=useHealthTrainingHistoryF21(athleteId);
  const [kind,setKind]=useState("all"),[query,setQuery]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState("");
  const [busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[reviewed,setReviewed]=useState(false);
  const [editorEpoch,setEditorEpoch]=useState(0);
  const lock=useRef(false);
  const usable=history.available&&!history.error&&!history.loading;
  const blocked=!usable||busy||history.saving||failed;
  const matches=(session:typeof history.sessions[number])=>{
    const d=new Date(session.started_at);const day=Number.isFinite(d.getTime())?new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10):"";
    const name=session.kind==="strength"?[session.template_name,session.template_code,...session.exercises.map(e=>e.exercise_name)].join(" "):session.title+" "+session.modality_name;
    return (kind==="all"||kind===session.kind)&&(!from||day>=from)&&(!to||day<=to)&&name.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"));
  };
  const filtered=usable?history.sessions.filter(matches):[];
  const review=async()=>{if(lock.current)return;lock.current=true;setBusy(true);setReviewed(false);try{await history.reload(true);setReviewed(true);}catch{toast({title:"Consulta não confirmada"});}finally{lock.current=false;setBusy(false);}};

  const run = async (label: string, action: () => Promise<void>) => {
    if(blocked||lock.current)return false;
    lock.current=true;setBusy(true);
    try {
      await action();
      toast({ title: "Histórico atualizado", description: label });return true;
    } catch (cause) {
      setFailed(true);setReviewed(false);
      toast({
        variant: "destructive",
        title: "Não foi possível concluir",
        description:
          cause instanceof Error ? cause.message : "Confira antes de repetir.",
      });return false;
    }finally{lock.current=false;setBusy(false);}
  };

  if (history.loading && history.sessions.length===0) {
    return (
      <div className="flex min-h-56 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight">
            Histórico de treinos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Corrija sessões concluídas ou retire registros incorretos do
            histórico ativo sem destruir a auditoria.
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="icon"
            className="min-h-11 min-w-11"
            disabled={history.saving||busy||history.loading}
            onClick={() => void review()}
            aria-label="Atualizar histórico"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/saude/treino">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Treino
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Registros ativos</p>
          <p className="mt-1 text-lg font-semibold">{usable?history.sessions.length:"—"}</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Musculação</p>
          <p className="mt-1 text-lg font-semibold">{usable?history.strengthCount:"—"}</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Atividades</p>
          <p className="mt-1 text-lg font-semibold">{usable?history.activityCount:"—"}</p>
        </div>
      </div>

      {history.error ? (
        <Card className="border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">
            {history.error}
          </CardContent>
        </Card>
      ) : null}

      {failed?<div role="alert" className="space-y-2 rounded-lg border p-3 text-sm"><p>Resultado não confirmado. Atualize e confira antes de repetir a correção.</p><Button variant="outline" className="min-h-11 w-full" disabled={busy||history.loading} onClick={()=>void review()}>Conferir histórico</Button><Button variant="outline" className="min-h-11 w-full" disabled={!reviewed||!usable||busy} onClick={()=>{setFailed(false);setReviewed(false);setEditorEpoch(v=>v+1);}}>Conferi; liberar nova ação</Button></div>:null}
      <section className="space-y-2" aria-label="Filtros do histórico">
        <p className="text-xs text-muted-foreground">Até 300 sessões de cada tipo consultadas; filtros atuam sobre esses registros.</p>
        <div className="grid grid-cols-3 gap-1">{[["all","Todos"],["strength","Musculação"],["activity","Atividades"]].map(([id,label])=><Button key={id} variant={kind===id?"default":"outline"} aria-pressed={kind===id} className="min-h-11 px-1 text-xs" onClick={()=>setKind(id)}>{label}</Button>)}</div>
        <Label htmlFor="sx08-history-search">Buscar sessão ou exercício</Label><Input id="sx08-history-search" className="min-h-11" value={query} onChange={e=>setQuery(e.target.value)}/>
        <div className="grid grid-cols-2 gap-2"><div className="min-w-0"><Label htmlFor="sx08-from">Desde</Label><Input id="sx08-from" type="date" className="min-h-11" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="min-w-0"><Label htmlFor="sx08-to">Até</Label><Input id="sx08-to" type="date" className="min-h-11" value={to} onChange={e=>setTo(e.target.value)}/></div></div>
        {usable?<p role="status" className="text-xs">{filtered.length} registros no filtro</p>:null}
        <Button variant="outline" className="min-h-11 w-full" onClick={()=>{setKind("all");setQuery("");setFrom("");setTo("");}}>Limpar filtros</Button>
      </section>
      {!usable ? (
        <Card>
          <CardContent className="py-4 text-sm">
            Histórico não confirmado. Atualize para consultar.
          </CardContent>
        </Card>
      ) : history.sessions.length ? (
        <div className="space-y-4">
          {filtered.length===0?<p className="text-sm">Nenhum registro corresponde aos filtros.</p>:null}
          {history.sessions.map((session) => <div key={editorEpoch+session.kind+session.id} hidden={!matches(session)}>
            {session.kind === "strength" ? (
              <StrengthCard
                key={"strength-" + session.id}
                session={session}
                saving={blocked}
                onUpdateSession={(values) =>
                  run("Sessão corrigida.", () =>
                    history.updateWorkoutSession(session.id, values),
                  )
                }
                onUpdateSet={(setId, values) =>
                  run("Série corrigida.", () =>
                    history.updateHistoricalSet(setId, values),
                  )
                }
                onVoid={(reason) =>
                  run("Treino removido do histórico ativo.", () =>
                    history.voidWorkoutSession(session.id, reason),
                  )
                }
              />
            ) : (
              <ActivityCard
                key={"activity-" + session.id}
                session={session}
                modalities={history.modalities}
                saving={blocked}
                onUpdate={(values) =>
                  run("Atividade corrigida.", () =>
                    history.updateActivitySession(session.id, values),
                  )
                }
                onVoid={(reason) =>
                  run("Atividade removida do histórico ativo.", () =>
                    history.voidActivitySession(session.id, reason),
                  )
                }
              />
            )}
          </div>)}
        </div>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Nenhum treino concluído no histórico ativo.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
