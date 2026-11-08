import { useMemo, useState } from "react";
import { BatteryCharging, Clock3, Loader2, Moon, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useHealthAthlete } from "../hooks/useHealthAthlete";
import {
  type RecoveryMetricCode,
  type RecoveryMetricInput,
  useHealthRecoveryM9,
} from "../hooks/useHealthRecoveryM9";

const metrics: Array<{
  code: RecoveryMetricCode;
  label: string;
  low: string;
  high: string;
}> = [
  { code: "sleep_quality", label: "Qualidade do sono", low: "Muito ruim", high: "Muito boa" },
  { code: "sleepiness", label: "Sonolência", low: "Ausente", high: "Muito alta" },
  { code: "general_fatigue", label: "Fadiga geral", low: "Muito baixa", high: "Muito alta" },
  { code: "muscular_fatigue", label: "Fadiga muscular", low: "Muito baixa", high: "Muito alta" },
  { code: "mental_fatigue", label: "Fadiga mental", low: "Muito baixa", high: "Muito alta" },
  { code: "physical_recovery", label: "Recuperação física", low: "Muito baixa", high: "Muito boa" },
  { code: "training_readiness", label: "Prontidão percebida", low: "Muito baixa", high: "Muito boa" },
  { code: "muscle_soreness", label: "Dor muscular", low: "Ausente", high: "Muito alta" },
  { code: "disposition", label: "Disposição", low: "Muito ruim", high: "Muito boa" },
];

function minutesFromHours(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 60) : null;
}

function localDateTime(date: string, time: string) {
  if (!date || !time) return null;
  return `${date}T${time}`;
}

function formatMinutes(value: number | null | undefined) {
  if (value == null) return "Desconhecido";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours ? `${hours}h${String(minutes).padStart(2, "0")}` : `${minutes} min`;
}

function coverageLabel(value: string) {
  const labels: Record<string, string> = {
    unobserved: "Não observado",
    sparse: "Escasso",
    partial: "Parcial",
    complete: "Completo",
  };
  return labels[value] ?? value;
}

export function HealthRecoveryPage() {
  const { toast } = useToast();
  const { athlete, loading: athleteLoading } = useHealthAthlete();
  const recovery = useHealthRecoveryM9(athlete?.id);

  const today = new Date().toISOString().slice(0, 10);
  const [sleepDate, setSleepDate] = useState(today);
  const [periodType, setPeriodType] = useState<"nocturnal" | "nap" | "other">("nocturnal");
  const [bedTime, setBedTime] = useState("");
  const [sleepTime, setSleepTime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [outOfBedTime, setOutOfBedTime] = useState("");
  const [declaredHours, setDeclaredHours] = useState("");
  const [awakenings, setAwakenings] = useState("");
  const [awakeMinutes, setAwakeMinutes] = useState("");
  const [sleepNotes, setSleepNotes] = useState("");

  const [metricValues, setMetricValues] = useState<Partial<Record<RecoveryMetricCode, number>>>({});
  const [checkinNotes, setCheckinNotes] = useState("");

  const activeHistory = useMemo(() => {
    const sleep = recovery.activeSleepPeriods.map((item) => ({
      id: `sleep-${item.id}`,
      date: item.sleep_date,
      title: item.period_type === "nap" ? "Cochilo" : "Sono",
      detail: item.declared_sleep_minutes != null
        ? formatMinutes(item.declared_sleep_minutes)
        : item.calculated_sleep_minutes != null
          ? formatMinutes(item.calculated_sleep_minutes)
          : item.calculated_time_in_bed_minutes != null
            ? `Tempo na cama: ${formatMinutes(item.calculated_time_in_bed_minutes)}`
            : "Duração desconhecida",
      kind: "sleep" as const,
      sourceId: item.id,
    }));
    const grouped = new Map<string, { id: string; date: string; title: string; detail: string; kind: "checkin"; sourceId: string }>();
    for (const item of recovery.activeCheckins) {
      const key = item.checkin_event_id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: `checkin-${key}`,
          date: item.observed_on,
          title: "Check-in de recuperação",
          detail: "",
          kind: "checkin",
          sourceId: item.id,
        });
      }
      const current = grouped.get(key)!;
      const label = metrics.find((metric) => metric.code === item.metric_code)?.label ?? item.metric_code;
      current.detail += current.detail ? ` · ${label}: ${item.value_ordinal ?? "texto"}` : `${label}: ${item.value_ordinal ?? "texto"}`;
    }
    return [...sleep, ...grouped.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  }, [recovery.activeCheckins, recovery.activeSleepPeriods]);

  const saveSleep = async () => {
    try {
      await recovery.recordSleepPeriod({
        sleepDate,
        periodType,
        bedAt: localDateTime(sleepDate, bedTime),
        sleepStartAt: localDateTime(sleepDate, sleepTime),
        finalWakeAt: wakeTime ? localDateTime(
          periodType === "nocturnal" && bedTime && wakeTime < bedTime
            ? new Date(new Date(sleepDate).getTime() + 86_400_000).toISOString().slice(0, 10)
            : sleepDate,
          wakeTime,
        ) : null,
        outOfBedAt: outOfBedTime ? localDateTime(
          periodType === "nocturnal" && bedTime && outOfBedTime < bedTime
            ? new Date(new Date(sleepDate).getTime() + 86_400_000).toISOString().slice(0, 10)
            : sleepDate,
          outOfBedTime,
        ) : null,
        declaredSleepMinutes: minutesFromHours(declaredHours),
        awakeningsCount: awakenings ? Number(awakenings) : null,
        awakeMinutes: awakeMinutes ? Number(awakeMinutes) : null,
        notes: sleepNotes,
      });
      toast({ title: "Sono registrado", description: "O que foi informado foi preservado sem preencher dados ausentes." });
      setSleepNotes("");
    } catch (cause) {
      toast({ variant: "destructive", title: "Não foi possível registrar", description: cause instanceof Error ? cause.message : "Tente novamente." });
    }
  };

  const saveCheckin = async () => {
    const payload: RecoveryMetricInput[] = Object.entries(metricValues).map(([metric_code, value_ordinal]) => ({
      metric_code: metric_code as RecoveryMetricCode,
      value_ordinal,
    }));
    try {
      await recovery.recordRecoveryCheckin(payload, new Date(), checkinNotes);
      toast({ title: "Check-in registrado", description: "Percepções registradas sem criar score composto." });
      setMetricValues({});
      setCheckinNotes("");
    } catch (cause) {
      toast({ variant: "destructive", title: "Não foi possível registrar", description: cause instanceof Error ? cause.message : "Tente novamente." });
    }
  };

  if (athleteLoading || recovery.loading) {
    return <div className="flex min-h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Sono e recuperação</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sono, fadiga e recuperação observados. Estado não é decisão de treino.</p>
        </div>
        <Button size="sm" variant="outline" className="min-h-10 shrink-0" disabled={recovery.saving} onClick={() => void recovery.refreshStates()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>

      {recovery.error ? <Card className="border-destructive/40"><CardContent className="py-3 text-sm text-destructive">{recovery.error}</CardContent></Card> : null}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Moon className="h-4 w-4 text-primary" /> Registrar sono</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2"><Label>Data</Label><Input type="date" className="min-h-11" value={sleepDate} onChange={(e) => setSleepDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Tipo</Label><Select value={periodType} onValueChange={(value) => setPeriodType(value as typeof periodType)}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nocturnal">Noite</SelectItem><SelectItem value="nap">Cochilo</SelectItem><SelectItem value="other">Outro</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Duração declarada (horas)</Label><Input inputMode="decimal" className="min-h-11" placeholder="Ex.: 7,5" value={declaredHours} onChange={(e) => setDeclaredHours(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-2"><Label>Deitei</Label><Input type="time" className="min-h-11" value={bedTime} onChange={(e) => setBedTime(e.target.value)} /></div>
            <div className="space-y-2"><Label>Dormi aprox.</Label><Input type="time" className="min-h-11" value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} /></div>
            <div className="space-y-2"><Label>Acordei</Label><Input type="time" className="min-h-11" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} /></div>
            <div className="space-y-2"><Label>Levantei</Label><Input type="time" className="min-h-11" value={outOfBedTime} onChange={(e) => setOutOfBedTime(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Despertares</Label><Input inputMode="numeric" className="min-h-11" value={awakenings} onChange={(e) => setAwakenings(e.target.value)} /></div>
            <div className="space-y-2"><Label>Minutos acordado</Label><Input inputMode="numeric" className="min-h-11" value={awakeMinutes} onChange={(e) => setAwakeMinutes(e.target.value)} /></div>
          </div>
          <Textarea placeholder="Observações opcionais" value={sleepNotes} onChange={(e) => setSleepNotes(e.target.value)} />
          <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">Se você informar apenas deitar e acordar, o sistema pode calcular <strong>tempo na cama</strong>, mas não inventará duração efetiva de sono.</div>
          <Button className="min-h-11 w-full" disabled={recovery.saving} onClick={() => void saveSleep()}>{recovery.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock3 className="mr-2 h-4 w-4" />}Registrar sono</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><BatteryCharging className="h-4 w-4 text-primary" /> Check-in de recuperação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {metrics.map((metric) => (
              <div key={metric.code} className="rounded-xl border p-3">
                <div className="mb-2 flex items-center justify-between gap-2"><Label>{metric.label}</Label><span className="text-xs text-muted-foreground">{metricValues[metric.code] ?? "Não informado"}</span></div>
                <div className="grid grid-cols-5 gap-2">
                  {[1,2,3,4,5].map((value) => (
                    <Button key={value} type="button" variant={metricValues[metric.code] === value ? "default" : "outline"} className="min-h-11 px-0" onClick={() => setMetricValues((current) => ({ ...current, [metric.code]: value }))}>{value}</Button>
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>{metric.low}</span><span>{metric.high}</span></div>
              </div>
            ))}
          </div>
          <Textarea placeholder="Observação geral opcional. Texto não é convertido automaticamente em nota." value={checkinNotes} onChange={(e) => setCheckinNotes(e.target.value)} />
          <Button className="min-h-11 w-full" disabled={recovery.saving || Object.keys(metricValues).length === 0} onClick={() => void saveCheckin()}>Salvar check-in</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Estado 7 / 14 / 28 dias</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {recovery.states.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não há estado calculado.</p> : (
            <div className="grid gap-3 lg:grid-cols-3">
              {recovery.states.map((state) => (
                <div key={state.id} className="rounded-xl border p-4">
                  <div className="mb-3 flex items-center justify-between"><strong>{state.window_days} dias</strong><Badge variant="outline">{state.confidence}</Badge></div>
                  <div className="space-y-2 text-sm">
                    {[
                      ["Sono", state.sleep_duration_coverage, state.sleep_duration_observed_days],
                      ["Horários", state.sleep_timing_coverage, state.sleep_timing_observed_days],
                      ["Qualidade", state.sleep_quality_coverage, state.sleep_quality_observed_days],
                      ["Recuperação", state.recovery_coverage, state.recovery_observed_days],
                      ["Fadiga", state.fatigue_coverage, state.fatigue_observed_days],
                      ["Prontidão", state.readiness_coverage, state.readiness_observed_days],
                    ].map(([label, coverage, days]) => (
                      <div key={String(label)} className="flex items-center justify-between gap-2"><span>{label}</span><span className="text-xs text-muted-foreground">{coverageLabel(String(coverage))} · {String(days)} dias</span></div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-lg bg-muted/40 p-2.5 text-xs">
                    Sono médio: <strong>{formatMinutes(state.average_sleep_minutes)}</strong>
                  </div>
                  {state.reason_codes.length ? <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">{state.reason_codes.map((code) => <li key={code}>• {code}</li>)}</ul> : null}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Não existe score composto de prontidão na M9 v1. Cada dimensão mantém sua própria cobertura.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Histórico recente</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {activeHistory.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p> : activeHistory.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border p-3">
              <div className="min-w-0"><p className="text-sm font-medium">{item.title} · {item.date}</p><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p></div>
              <Button size="icon" variant="ghost" className="min-h-11 min-w-11 shrink-0" disabled={recovery.saving} onClick={() => void (item.kind === "sleep" ? recovery.voidSleepPeriod(item.sourceId) : recovery.voidRecoveryCheckin(item.sourceId))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
