import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Pencil,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealthAthlete } from "../hooks/useHealthAthlete";
import {
  reminderScheduleLabel,
  reminderTypeLabel,
  type ReminderRule,
  type ReminderScheduleKind,
  type ReminderType,
  useHealthRemindersF16,
} from "../hooks/useHealthRemindersF16";
import { localDateIso } from "../dashboard/dashboardModel";

const dayOptions = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

function destinationForType(type: ReminderType) {
  const routes: Record<ReminderType, string> = {
    training: "/saude/treino",
    nutrition_log: "/saude/alimentacao",
    body_assessment: "/saude/evolucao",
    recovery_checkin: "/saude/recuperacao",
    longitudinal_review: "/saude/revisao",
  };
  return routes[type];
}

function minutesFromTime(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function daysBetween(startIso: string, endIso: string) {
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  return Math.floor((end - start) / 86400000);
}

function clockForTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    dateIso: `${values.year}-${values.month}-${values.day}`,
    weekday: weekdayMap[values.weekday] ?? 0,
    currentMinutes:
      Number(values.hour ?? 0) * 60 + Number(values.minute ?? 0),
  };
}

function isScheduledToday(
  rule: ReminderRule,
  today: string,
  weekday: number,
) {
  if (!rule.enabled || today < rule.startOn) return false;

  if (rule.scheduleKind === "daily") return true;

  if (rule.scheduleKind === "weekly") {
    return rule.daysOfWeek.includes(weekday);
  }

  const difference = daysBetween(rule.startOn, today);
  return (
    difference >= 0 &&
    Boolean(rule.intervalDays) &&
    difference % (rule.intervalDays ?? 1) === 0
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export function HealthRoutinePage() {
  const { athlete, loading: athleteLoading } = useHealthAthlete();
  const reminders = useHealthRemindersF16(athlete?.id);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [reminderType, setReminderType] = useState<ReminderType>("training");
  const [label, setLabel] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [scheduleKind, setScheduleKind] =
    useState<ReminderScheduleKind>("daily");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [localTime, setLocalTime] = useState("09:00");
  const [intervalDays, setIntervalDays] = useState("7");
  const [startOn, setStartOn] = useState(localDateIso());
  const [localError, setLocalError] = useState<string | null>(null);

  const detectedTimezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [timezone, setTimezone] = useState(detectedTimezone);

  const todayRules = reminders.rules.filter((rule) => {
    const clock = clockForTimezone(rule.timezone);
    return isScheduledToday(rule, clock.dateIso, clock.weekday);
  });

  if (athleteLoading || reminders.loading) {
    return <PageSkeleton />;
  }

  const resetForm = () => {
    setEditingId(null);
    setReminderType("training");
    setLabel("");
    setEnabled(true);
    setScheduleKind("daily");
    setDaysOfWeek([]);
    setLocalTime("09:00");
    setIntervalDays("7");
    setStartOn(localDateIso());
    setTimezone(detectedTimezone);
    setLocalError(null);
  };

  const editRule = (rule: ReminderRule) => {
    setEditingId(rule.id);
    setReminderType(rule.reminderType);
    setLabel(rule.label ?? "");
    setEnabled(rule.enabled);
    setScheduleKind(rule.scheduleKind);
    setDaysOfWeek(rule.daysOfWeek);
    setLocalTime(rule.localTime.slice(0, 5));
    setIntervalDays(String(rule.intervalDays ?? 7));
    setStartOn(rule.startOn);
    setTimezone(rule.timezone);
    setLocalError(null);
  };

  const toggleDay = (day: number) => {
    setDaysOfWeek((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  };

  const saveRule = async () => {
    setLocalError(null);

    if (scheduleKind === "weekly" && daysOfWeek.length === 0) {
      setLocalError("Selecione pelo menos um dia da semana.");
      return;
    }

    const parsedInterval = Number(intervalDays);
    if (
      scheduleKind === "interval" &&
      (!Number.isInteger(parsedInterval) ||
        parsedInterval < 1 ||
        parsedInterval > 365)
    ) {
      setLocalError("O intervalo deve ficar entre 1 e 365 dias.");
      return;
    }

    try {
      await reminders.saveRule({
        ruleId: editingId,
        reminderType,
        label: label.trim() || null,
        enabled,
        scheduleKind,
        daysOfWeek: scheduleKind === "weekly" ? daysOfWeek : [],
        localTime,
        intervalDays:
          scheduleKind === "interval" ? parsedInterval : null,
        startOn,
        timezone,
      });
      resetForm();
    } catch {
      setLocalError("Não foi possível salvar o lembrete.");
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Lembretes e rotina
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Organize registros e revisões do CCH. Lembretes são preferências
            operacionais e não prescrições.
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-11 shrink-0"
          onClick={() => void reminders.reload()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {!reminders.backendAvailable ? (
        <Card>
          <CardContent className="p-4 text-sm">
            <p className="font-medium">
              Lembretes ainda não disponíveis neste ambiente.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              O schema F16 precisa estar operacional. A aplicação não usa
              localStorage como substituto silencioso do banco.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {reminders.error ? (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            Não foi possível concluir uma operação da rotina.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-primary" />
            Rotina de hoje
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {todayRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum lembrete ativo está programado para hoje.
            </p>
          ) : (
            todayRules.map((rule) => {
              const clock = clockForTimezone(rule.timezone);
              const latestEvent = reminders.events.find(
                (event) =>
                  event.ruleId === rule.id &&
                  event.eventDate === clock.dateIso,
              );
              const isDue =
                clock.currentMinutes >= minutesFromTime(rule.localTime);
              const status = latestEvent
                ? latestEvent.eventType === "completed"
                  ? "Concluído"
                  : "Dispensado"
                : isDue
                  ? "Pendente agora"
                  : `Hoje às ${rule.localTime.slice(0, 5)}`;

              return (
                <div key={rule.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {rule.label || reminderTypeLabel(rule.reminderType)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {reminderScheduleLabel(rule)}
                      </p>
                    </div>
                    <Badge variant="outline">{status}</Badge>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <Button
                      className="min-h-11"
                      variant={
                        latestEvent?.eventType === "completed"
                          ? "secondary"
                          : "default"
                      }
                      disabled={reminders.saving}
                      onClick={() =>
                        void reminders.recordEvent(
                          rule.id,
                          "completed",
                          clock.dateIso,
                        )
                      }
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Concluir hoje
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-11"
                      disabled={reminders.saving}
                      onClick={() =>
                        void reminders.recordEvent(
                          rule.id,
                          "dismissed",
                          clock.dateIso,
                        )
                      }
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Dispensar hoje
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="min-h-11"
                    >
                      <Link to={destinationForType(rule.reminderType)}>
                        Abrir área
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-primary" />
            {editingId ? "Editar lembrete" : "Novo lembrete"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="f16-type">Tipo</Label>
              <select
                id="f16-type"
                value={reminderType}
                onChange={(event) =>
                  setReminderType(event.target.value as ReminderType)
                }
                className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="training">Treino</option>
                <option value="nutrition_log">Diário alimentar</option>
                <option value="body_assessment">Avaliação corporal</option>
                <option value="recovery_checkin">Recuperação</option>
                <option value="longitudinal_review">
                  Revisão longitudinal
                </option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="f16-label">Nome opcional</Label>
              <Input
                id="f16-label"
                value={label}
                maxLength={160}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Ex.: Registrar alimentação"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="f16-kind">Frequência</Label>
              <select
                id="f16-kind"
                value={scheduleKind}
                onChange={(event) => {
                  const value = event.target.value as ReminderScheduleKind;
                  setScheduleKind(value);
                  if (value !== "weekly") setDaysOfWeek([]);
                }}
                className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="daily">Todos os dias</option>
                <option value="weekly">Dias da semana</option>
                <option value="interval">A cada N dias</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="f16-time">Horário</Label>
              <Input
                id="f16-time"
                type="time"
                value={localTime}
                onChange={(event) => setLocalTime(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="f16-start">Início</Label>
              <Input
                id="f16-start"
                type="date"
                value={startOn}
                onChange={(event) => setStartOn(event.target.value)}
              />
            </div>

            {scheduleKind === "interval" ? (
              <div className="space-y-2">
                <Label htmlFor="f16-interval">Intervalo em dias</Label>
                <Input
                  id="f16-interval"
                  type="number"
                  min={1}
                  max={365}
                  value={intervalDays}
                  onChange={(event) =>
                    setIntervalDays(event.target.value)
                  }
                />
              </div>
            ) : null}
          </div>

          {scheduleKind === "weekly" ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Dias da semana
              </legend>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {dayOptions.map((day) => (
                  <label
                    key={day.value}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg border px-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={daysOfWeek.includes(day.value)}
                      onChange={() => toggleDay(day.value)}
                    />
                    {day.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <label className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Lembrete ativo
          </label>

          <p className="text-xs text-muted-foreground">
            Fuso detectado: {timezone}. A F16 v1 funciona dentro do CCH e não
            envia push, e-mail ou mensagens externas.
          </p>

          {localError ? (
            <p className="text-sm text-destructive">{localError}</p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="min-h-11 flex-1"
              disabled={reminders.saving || !reminders.backendAvailable}
              onClick={() => void saveRule()}
            >
              {editingId ? "Salvar alterações" : "Criar lembrete"}
            </Button>
            {editingId ? (
              <Button
                variant="outline"
                className="min-h-11 flex-1"
                disabled={reminders.saving}
                onClick={resetForm}
              >
                Cancelar edição
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-4 w-4 text-primary" />
            Regras configuradas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {reminders.rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum lembrete configurado.
            </p>
          ) : (
            reminders.rules.map((rule) => (
              <div key={rule.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {rule.label || reminderTypeLabel(rule.reminderType)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {reminderScheduleLabel(rule)}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {rule.enabled ? "Ativo" : "Desativado"}
                  </Badge>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    className="min-h-11 flex-1"
                    disabled={reminders.saving}
                    onClick={() => editRule(rule)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11 flex-1"
                    disabled={reminders.saving}
                    onClick={() =>
                      void reminders.archiveRule(rule.id)
                    }
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Arquivar
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock3 className="h-4 w-4 text-primary" />
            Histórico recente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {reminders.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há eventos de rotina.
            </p>
          ) : (
            reminders.events.slice(0, 12).map((event) => {
              const rule = reminders.rules.find(
                (item) => item.id === event.ruleId,
              );
              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {rule
                        ? rule.label ||
                          reminderTypeLabel(rule.reminderType)
                        : "Lembrete"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.eventDate}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {event.eventType === "completed"
                      ? "Concluído"
                      : "Dispensado"}
                  </Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        F16 ajuda a lembrar registros e revisões. Ela não cria obrigação
        clínica, não bloqueia outros módulos e não altera planejamento.
      </p>
    </div>
  );
}
