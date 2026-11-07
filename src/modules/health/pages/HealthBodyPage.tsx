import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Camera,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Ruler,
  Scale,
  Trash2,
  TrendingUp,
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
  type BodyMeasurement,
  type BodyMeasurementInput,
  type BodyMetricCode,
  type BodyPhoto,
  useHealthBodyM8,
} from "../hooks/useHealthBodyM8";
import { useHealthProfileM1 } from "../hooks/useHealthProfileM1";

const photoAngles: Array<{ code: BodyPhoto["angle_code"]; label: string }> = [
  { code: "front_relaxed", label: "Frente relaxado" },
  { code: "left_side_relaxed", label: "Lado esquerdo" },
  { code: "back_relaxed", label: "Costas relaxado" },
  { code: "right_side_relaxed", label: "Lado direito" },
];

function positiveNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function measurementValue(measurements: BodyMeasurement[], code: BodyMetricCode) {
  const item = measurements.find((measurement) => measurement.metric_code === code);
  return item ? Number(item.value) : null;
}

function formatNumber(value: number | string | null | undefined, decimals = 1) {
  if (value == null) return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(decimals).replace(".", ",") : "—";
}

function formatSigned(value: number | string | null | undefined, suffix: string) {
  if (value == null) return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  const sign = parsed > 0 ? "+" : "";
  return sign + parsed.toFixed(2).replace(".", ",") + " " + suffix;
}

function reasonLabel(code: string) {
  const labels: Record<string, string> = {
    NO_BODY_DATA: "Ainda não há dados corporais nesta janela.",
    NO_WEIGHT_OBSERVATIONS: "Não há pesagens suficientes nesta janela.",
    INSUFFICIENT_WEIGHT_OBSERVATIONS: "É necessária mais de uma pesagem para calcular tendência.",
    PARTIAL_WEIGHT_COVERAGE: "A janela tem dados úteis, mas ainda está parcialmente coberta.",
    MIXED_WEIGHT_METHODS: "Foram usados métodos diferentes para o peso.",
    NO_WAIST_OBSERVATIONS: "A cintura ainda não foi registrada nesta janela.",
    NO_PHOTO_SETS_IN_WINDOW: "Ainda não há protocolo fotográfico nesta janela.",
    BMI_NOT_AVAILABLE: "IMC indisponível sem altura e peso comparáveis.",
  };
  return labels[code] ?? code;
}

export function HealthBodyPage() {
  const { toast } = useToast();
  const { athlete, loading: athleteLoading } = useHealthAthlete();
  const body = useHealthBodyM8(athlete?.id);
  const profile = useHealthProfileM1(athlete?.id);

  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [hip, setHip] = useState("");
  const [chest, setChest] = useState("");
  const [neck, setNeck] = useState("");
  const [weightMethod, setWeightMethod] = useState<BodyMeasurementInput["method"]>("scale");
  const [bodyFatMethod, setBodyFatMethod] = useState<BodyMeasurementInput["method"]>("bioimpedance");
  const [weighingContext, setWeighingContext] = useState("morning_fasted");
  const [notes, setNotes] = useState("");
  const [photoFiles, setPhotoFiles] = useState<Partial<Record<BodyPhoto["angle_code"], File>>>({});

  const mediaConsentGranted =
    profile.latestConsents.private_media_storage?.decision === "granted";

  const currentState = useMemo(
    () => body.states.find((state) => state.window_days === 7) ?? null,
    [body.states],
  );

  const saveAssessment = async () => {
    const measurements: BodyMeasurementInput[] = [];

    const add = (
      metric_code: BodyMetricCode,
      raw: string,
      unit_code: BodyMeasurementInput["unit_code"],
      method: BodyMeasurementInput["method"],
      confidence: BodyMeasurementInput["confidence"] = "high",
    ) => {
      const value = positiveNumber(raw);
      if (value == null) return;
      measurements.push({ metric_code, value, unit_code, method, confidence });
    };

    add("weight_kg", weight, "kg", weightMethod);
    add("waist_cm", waist, "cm", "tape");
    add("body_fat_pct", bodyFat, "pct", bodyFatMethod, bodyFatMethod === "estimated" ? "low" : "moderate");
    add("hip_cm", hip, "cm", "tape");
    add("chest_cm", chest, "cm", "tape");
    add("neck_cm", neck, "cm", "tape");

    try {
      await body.recordAssessment({
        measurements,
        conditions: { weighing_context: weighingContext },
        notes: notes.trim() || null,
      });
      toast({ title: "Avaliação registrada", description: "Medidas salvas e tendências atualizadas." });
      setNotes("");
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "Não foi possível registrar",
        description: cause instanceof Error ? cause.message : "Tente novamente.",
      });
    }
  };

  const uploadPhotos = async () => {
    const uploads = photoAngles.flatMap((angle) => {
      const file = photoFiles[angle.code];
      return file ? [{ angle_code: angle.code, file }] : [];
    });

    try {
      await body.uploadPhotoSet(uploads, {
        protocol: "BODY_PHOTO_V1",
        guidance: "same_light_distance_posture",
      });
      setPhotoFiles({});
      toast({ title: "Fotos registradas", description: "Protocolo privado salvo com sucesso." });
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "Não foi possível salvar as fotos",
        description: cause instanceof Error ? cause.message : "Tente novamente.",
      });
    }
  };

  if (athleteLoading || body.loading || profile.loading) {
    return (
      <div className="flex min-h-56 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Evolução corporal</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Medidas, fotos comparáveis e tendências. Estado corporal não é decisão nutricional.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="min-h-10 shrink-0"
          disabled={body.saving}
          onClick={() => void body.refreshStates()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {body.error ? (
        <Card className="border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">{body.error}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4 text-primary" /> Registrar avaliação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="body-weight">Peso (kg)</Label>
              <Input
                id="body-weight"
                inputMode="decimal"
                className="min-h-11"
                placeholder="Ex.: 82,4"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body-waist">Cintura (cm)</Label>
              <Input
                id="body-waist"
                inputMode="decimal"
                className="min-h-11"
                placeholder="Ex.: 88"
                value={waist}
                onChange={(event) => setWaist(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body-fat">Gordura corporal (%)</Label>
              <Input
                id="body-fat"
                inputMode="decimal"
                className="min-h-11"
                placeholder="Opcional"
                value={bodyFat}
                onChange={(event) => setBodyFat(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body-hip">Quadril (cm)</Label>
              <Input id="body-hip" inputMode="decimal" className="min-h-11" value={hip} onChange={(event) => setHip(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body-chest">Peito (cm)</Label>
              <Input id="body-chest" inputMode="decimal" className="min-h-11" value={chest} onChange={(event) => setChest(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body-neck">Pescoço (cm)</Label>
              <Input id="body-neck" inputMode="decimal" className="min-h-11" value={neck} onChange={(event) => setNeck(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Método do peso</Label>
              <Select value={weightMethod} onValueChange={(value) => setWeightMethod(value as BodyMeasurementInput["method"])}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scale">Balança</SelectItem>
                  <SelectItem value="bioimpedance">Bioimpedância</SelectItem>
                  <SelectItem value="professional">Profissional</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Método da gordura</Label>
              <Select value={bodyFatMethod} onValueChange={(value) => setBodyFatMethod(value as BodyMeasurementInput["method"])}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bioimpedance">Bioimpedância</SelectItem>
                  <SelectItem value="caliper">Dobras / adipômetro</SelectItem>
                  <SelectItem value="dexa">DEXA</SelectItem>
                  <SelectItem value="estimated">Estimativa</SelectItem>
                  <SelectItem value="professional">Profissional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Condição da pesagem</Label>
              <Select value={weighingContext} onValueChange={setWeighingContext}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning_fasted">Manhã em jejum</SelectItem>
                  <SelectItem value="morning_unfasted">Manhã sem jejum</SelectItem>
                  <SelectItem value="other">Outra condição</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Observações da avaliação: hidratação, horário diferente, roupa, contexto..."
          />

          <Button
            className="min-h-11 w-full"
            disabled={body.saving || ![weight, waist, bodyFat, hip, chest, neck].some((value) => positiveNumber(value) != null)}
            onClick={() => void saveAssessment()}
          >
            {body.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ruler className="mr-2 h-4 w-4" />}
            Registrar medidas
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" /> Estado corporal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {body.states.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Registre medidas para formar as primeiras janelas de tendência.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              {body.states.map((state) => (
                <div key={state.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{state.window_days} dias</p>
                    <Badge variant="outline">{state.coverage_status} · {state.confidence}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-muted/40 p-2.5">
                      <p className="text-xs text-muted-foreground">Peso atual</p>
                      <p className="font-semibold">{formatNumber(state.weight_latest_kg)} kg</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2.5">
                      <p className="text-xs text-muted-foreground">Variação</p>
                      <p className="font-semibold">{formatSigned(state.weight_change_kg, "kg")}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2.5">
                      <p className="text-xs text-muted-foreground">Tendência</p>
                      <p className="font-semibold">{formatSigned(state.weight_trend_kg_per_week, "kg/sem")}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2.5">
                      <p className="text-xs text-muted-foreground">Cintura</p>
                      <p className="font-semibold">{formatSigned(state.waist_change_cm, "cm")}</p>
                    </div>
                  </div>
                  {state.reason_codes.length ? (
                    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {state.reason_codes.map((code) => <li key={code}>• {reasonLabel(code)}</li>)}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {currentState?.latest_bmi != null ? (
            <p className="text-xs text-muted-foreground">
              IMC derivado da altura do Perfil e do peso mais recente: {formatNumber(currentState.latest_bmi, 2)}. Ele é apenas um indicador descritivo e não substitui composição corporal.
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Tendência corporal descreve o que foi observado. Ela não altera dieta ou treino automaticamente.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4 text-primary" /> Protocolo de fotos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            Para comparar melhor: mantenha iluminação, distância, posição da câmera, roupa e postura semelhantes. As imagens ficam no bucket privado do atleta.
          </div>

          {!mediaConsentGranted ? (
            <div className="rounded-xl border border-dashed p-4 text-sm">
              Ative o consentimento <strong>Mídia privada</strong> no Perfil antes de enviar fotos.{" "}
              <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/saude/perfil">
                Ir para Perfil
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {photoAngles.map((angle) => (
                  <div key={angle.code} className="space-y-2 rounded-xl border p-3">
                    <Label htmlFor={"body-photo-" + angle.code}>{angle.label}</Label>
                    <Input
                      id={"body-photo-" + angle.code}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="min-h-11"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        setPhotoFiles((current) => ({ ...current, [angle.code]: file }));
                      }}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {photoFiles[angle.code]?.name ?? "Nenhuma foto selecionada."}
                    </p>
                  </div>
                ))}
              </div>
              <Button
                variant="secondary"
                className="min-h-11 w-full"
                disabled={body.saving || !Object.values(photoFiles).some(Boolean)}
                onClick={() => void uploadPhotos()}
              >
                {body.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                Salvar protocolo fotográfico
              </Button>
            </>
          )}

          {body.photoSets.length ? (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">Linha do tempo visual</p>
              {body.photoSets.map((set) => (
                <div key={set.id} className="rounded-xl border p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{set.captured_on}</p>
                    <Badge variant="outline">{set.protocol_version}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {set.photos.map((photo) => (
                      <div key={photo.id} className="overflow-hidden rounded-lg border bg-muted/30">
                        {photo.signed_url ? (
                          <img
                            src={photo.signed_url}
                            alt={photoAngles.find((angle) => angle.code === photo.angle_code)?.label ?? "Foto corporal"}
                            className="aspect-[3/4] w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex aspect-[3/4] items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico de avaliações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {body.assessments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma avaliação registrada.</p>
          ) : (
            body.assessments.map((assessment) => {
              const weightValue = measurementValue(assessment.measurements, "weight_kg");
              const waistValue = measurementValue(assessment.measurements, "waist_cm");
              const fatValue = measurementValue(assessment.measurements, "body_fat_pct");
              return (
                <div key={assessment.id} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{assessment.observed_on}</p>
                      <Badge variant="outline">{assessment.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Peso {weightValue == null ? "—" : formatNumber(weightValue) + " kg"} ·
                      Cintura {waistValue == null ? "—" : formatNumber(waistValue) + " cm"} ·
                      Gordura {fatValue == null ? "—" : formatNumber(fatValue) + "%"}
                    </p>
                  </div>
                  {assessment.status === "active" ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="min-h-11 min-w-11 shrink-0"
                      disabled={body.saving}
                      aria-label="Anular avaliação"
                      onClick={() =>
                        void body
                          .voidAssessment(assessment.id)
                          .then(() => toast({ title: "Avaliação anulada", description: "O histórico foi preservado." }))
                          .catch((cause) =>
                            toast({
                              variant: "destructive",
                              title: "Não foi possível anular",
                              description: cause instanceof Error ? cause.message : "Tente novamente.",
                            }),
                          )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
