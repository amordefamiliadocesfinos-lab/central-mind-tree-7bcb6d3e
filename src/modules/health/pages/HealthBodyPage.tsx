import { useMemo, useRef, useState } from "react";
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
  if(!/^\d+(?:[.,]\d+)?$/.test(value.trim()))return null;
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
  const {athlete,loading}=useHealthAthlete();
  if(loading)return <p role="status" className="p-3 text-sm">Carregando perfil…</p>;
  if(!athlete?.id)return <p className="p-3 text-sm">Perfil indisponível.</p>;
  return <HealthBodyContent key={athlete.id} athleteId={athlete.id}/>;
}
function HealthBodyContent({athleteId}:{athleteId:string}){
  const profile=useHealthProfileM1(athleteId);
  const [showPhotos,setShowPhotos]=useState(false);
  const mediaConsentGranted=!profile.loading&&!profile.error&&profile.latestConsents.private_media_storage?.athlete_id===athleteId&&profile.latestConsents.private_media_storage?.decision==="granted";
  const body=useHealthBodyM8(athleteId,Boolean(mediaConsentGranted&&showPhotos));
  const [windowDays,setWindowDays]=useState<7|14|28>(7);
  const [comparisonAngle,setComparisonAngle]=useState<BodyPhoto["angle_code"]>("front_relaxed");
  const [firstSet,setFirstSet]=useState("");
  const [secondSet,setSecondSet]=useState("");
  const [showRegistration,setShowRegistration]=useState(false);
  const [showUpload,setShowUpload]=useState(false);
  const [confirmVoid,setConfirmVoid]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [reviewRequired,setReviewRequired]=useState(false);
  const [reviewed,setReviewed]=useState(false);
  const [notice,setNotice]=useState("");
  const lock=useRef(false);
  const blocked=body.loading||body.saving||busy||Boolean(body.error)||reviewRequired;
  const run=async(action:()=>Promise<void>,message:string)=>{
    if(lock.current||blocked)return;
    lock.current=true;setBusy(true);setNotice("");
    try{await action();setNotice(message);setConfirmVoid(null);}
    catch(cause){setReviewRequired(true);setReviewed(false);setNotice((cause instanceof Error?cause.message:"Resultado não confirmado.")+" Confira o histórico antes de repetir.");}
    finally{lock.current=false;setBusy(false);}
  };

  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [hip, setHip] = useState("");
  const [chest, setChest] = useState("");
  const [neck, setNeck] = useState("");
  const [weightMethod, setWeightMethod] = useState<BodyMeasurementInput["method"]>("scale");
  const [bodyFatMethod, setBodyFatMethod] = useState<BodyMeasurementInput["method"]|"">("");
  const [weighingContext, setWeighingContext] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFiles, setPhotoFiles] = useState<Partial<Record<BodyPhoto["angle_code"], File>>>({});

  const currentState = useMemo(
    () => !body.error&&!body.loading ? body.states.find((state) => state.window_days === windowDays && state.athlete_id===athleteId) ?? null : null,
    [body.states,windowDays,athleteId,body.error,body.loading],
  );

  const fields=[{raw:weight,min:5,max:400},{raw:waist,min:10,max:300},{raw:bodyFat,min:1,max:75},{raw:hip,min:10,max:300},{raw:chest,min:10,max:300},{raw:neck,min:10,max:300}];
  const valid=fields.some(f=>f.raw.trim()!=="")&&fields.every(f=>!f.raw.trim()||(positiveNumber(f.raw)!==null&&positiveNumber(f.raw)!>=f.min&&positiveNumber(f.raw)!<=f.max))&&(!weight.trim()||Boolean(weighingContext))&&(!bodyFat.trim()||Boolean(bodyFatMethod));
  const saveAssessment = async () => {
    if(!valid||blocked)return;
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

    add("weight_kg", weight, "kg", weightMethod,weightMethod==="other"?"moderate":"high");
    add("waist_cm", waist, "cm", "tape");
    if(bodyFatMethod)add("body_fat_pct", bodyFat, "pct", bodyFatMethod, bodyFatMethod === "estimated" ? "low" : "moderate");
    add("hip_cm", hip, "cm", "tape");
    add("chest_cm", chest, "cm", "tape");
    add("neck_cm", neck, "cm", "tape");

    await run(async()=>{
      await body.recordAssessment({measurements,conditions:weight.trim()?{weighing_context:weighingContext}:null,notes:notes.trim()||null});
      setWeight("");setWaist("");setBodyFat("");setHip("");setChest("");setNeck("");setNotes("");setWeighingContext("");setBodyFatMethod("");setShowRegistration(false);
    },"Avaliação registrada. Confira o histórico.");
  };
  const uploadPhotos=async()=>{
    if(!mediaConsentGranted||blocked)return;
    const uploads=photoAngles.flatMap(angle=>photoFiles[angle.code]?[{angle_code:angle.code,file:photoFiles[angle.code]!}]:[]);
    await run(async()=>{await body.uploadPhotoSet(uploads,{protocol:"BODY_PHOTO_V1",guidance:"same_light_distance_posture"});setPhotoFiles({});setShowUpload(false);},"Protocolo enviado. Confira a linha do tempo.");
  };
  const reload=async()=>{
    if(lock.current||busy)return;
    lock.current=true;setBusy(true);setReviewed(false);
    try{await body.reload(true);await profile.reload();setReviewed(true);setNotice("Confira o histórico atualizado.");}
    catch{setNotice("Consulta não confirmada.");}
    finally{lock.current=false;setBusy(false);}
  };

  if (body.loading && !body.assessments.length && !body.states.length && !body.photoSets.length) {
    return (
      <div className="flex min-h-56 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
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
          className="min-h-11 shrink-0"
          disabled={blocked}
          onClick={() => void run(body.refreshStates,"Indicadores atualizados.")}
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

      {notice?<p role={reviewRequired?"alert":"status"} className="text-sm">{notice}</p>:null}
      {body.error||reviewRequired?<Button variant="outline" className="min-h-11 w-full" disabled={busy||body.loading} onClick={()=>void reload()}>Conferir registros</Button>:null}
      {reviewRequired&&reviewed&&!body.error?<Button className="min-h-11 w-full" variant="outline" onClick={()=>{setReviewRequired(false);setReviewed(false);setWeight("");setWaist("");setBodyFat("");setHip("");setChest("");setNeck("");setPhotoFiles({});setConfirmVoid(null);setNotice("");}}>Conferi; liberar nova ação</Button>:null}
      <Card data-testid="sx04-overview">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" /> Minha evolução
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-3 pb-3">
          <div className="grid grid-cols-3 gap-2" aria-label="Janela de evolução">{([7,14,28] as const).map(days=><Button key={days} variant={days===windowDays?"default":"outline"} aria-pressed={days===windowDays} className="min-h-11" onClick={()=>setWindowDays(days)}>{days} dias</Button>)}</div>
          {body.error?<p role="alert" className="text-sm text-destructive">Estado corporal indisponível.</p>:null}
          {!currentState ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Nenhum estado confirmado nesta janela.
            </div>
          ) : (
            <div className="grid gap-2">
              {[currentState].map((state) => (
                <div key={state.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{state.window_days} dias · {state.as_of_date}</p>
                    <Badge variant="outline">{({unobserved:"Sem observações",sparse:"Escassa",partial:"Parcial",complete:"Completa"})[state.coverage_status]} · confiança {({low:"baixa",moderate:"moderada",high:"alta"})[state.confidence]}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-muted/40 p-2.5">
                      <p className="text-xs text-muted-foreground">Último peso na janela</p>
                      <p className="font-semibold">{state.weight_latest_kg==null?"—":formatNumber(state.weight_latest_kg)+" kg"}</p>
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
                      <p className="text-xs text-muted-foreground">Última cintura</p>
                      <p className="font-semibold">{state.waist_latest_cm==null?"—":formatNumber(state.waist_latest_cm)+" cm"}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{state.weight_observation_count} pesagens · {state.waist_observation_count} observações de cintura · cálculo {state.computed_at}</p>
                  {state.reason_codes.length ? (
                    <details className="mt-2"><summary className="min-h-11 py-3 cursor-pointer text-sm">Cobertura e limites</summary><ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {state.reason_codes.map((code) => <li key={code}>• {reasonLabel(code)}</li>)}
                    </ul></details>
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
            Ausência de informação (—) não significa zero. Tendência corporal descreve o que foi observado. Ela não altera dieta ou treino automaticamente.
          </p>
        </CardContent>
      </Card>

      <Card data-testid="sx04-registration">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4 text-primary" /> Registrar avaliação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-3 pb-3">
          <Button className="min-h-11 w-full" variant={showRegistration?"outline":"default"} onClick={()=>setShowRegistration(v=>!v)} disabled={blocked}>{showRegistration?"Recolher registro":"Registrar peso e medidas"}</Button>
          {showRegistration?<div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
              <Label htmlFor="body-weight-method">Método do peso</Label>
              <Select value={weightMethod} onValueChange={(value) => setWeightMethod(value as BodyMeasurementInput["method"])}>
                <SelectTrigger id="body-weight-method" className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scale">Balança</SelectItem>
                  <SelectItem value="bioimpedance">Bioimpedância</SelectItem>
                  <SelectItem value="professional">Profissional</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="body-fat-method">Método da gordura</Label>
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
              <Label htmlFor="body-context">Condição da pesagem</Label>
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

          <Label htmlFor="body-notes">Observações (opcional)</Label><Textarea id="body-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Observações da avaliação: hidratação, horário diferente, roupa, contexto..."
          />

          {!valid?<p className="text-xs text-muted-foreground">Preencha ao menos uma medida válida. Peso: 5–400 kg; cintura e circunferências: 10–300 cm; gordura: 1–75%. Escolha condição do peso e método da gordura quando aplicáveis. Campos vazios não são registrados.</p>:null}
          <Button
            className="min-h-11 w-full"
            disabled={blocked || !valid}
            onClick={() => void saveAssessment()}
          >
            {body.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ruler className="mr-2 h-4 w-4" />}
            Registrar medidas
          </Button>
          </div>:null}
        </CardContent>
      </Card>

      <Card data-testid="sx04-photos">
        <CardHeader className="px-3 pt-3 pb-2"><CardTitle className="flex items-center gap-2 text-base"><Camera className="h-4 w-4 text-primary"/>Fotos de evolução</CardTitle><p className="text-xs text-muted-foreground">Protocolo privado BODY_PHOTO_V1. Fotos não medem gordura nem massa muscular.</p></CardHeader>
        <CardContent className="space-y-3 px-3 pb-3">
          {!mediaConsentGranted?<div className="rounded-lg border p-3 text-sm">{profile.loading||profile.error?"Consentimento não confirmado. Fotos indisponíveis.":"Ative o consentimento Mídia privada no Perfil para acessar ou enviar fotos."} <Link to="/saude/perfil" className="inline-flex min-h-11 items-center font-medium text-primary underline">Ir para Perfil</Link></div>:<>
            <p className="text-xs text-muted-foreground">Mantenha iluminação, distância, posição da câmera, roupa e postura semelhantes. Selecione somente os ângulos disponíveis; quatro ângulos são recomendados, não obrigatórios.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button className="min-h-11 h-auto whitespace-normal" variant="outline" disabled={blocked} onClick={()=>setShowUpload(v=>!v)}>{showUpload?"Recolher envio":"Novo protocolo"}</Button>
              <Button className="min-h-11 h-auto whitespace-normal" variant="outline" disabled={body.loading||busy||Boolean(body.error)} onClick={()=>{setShowPhotos(v=>!v);setFirstSet("");setSecondSet("");}}>{showPhotos?"Ocultar fotos":"Ver fotos privadas"}</Button>
            </div>
            {showUpload?<div className="space-y-3 rounded-lg border p-2">
              <div className="grid gap-2 sm:grid-cols-2">{photoAngles.map(angle=><div key={angle.code} className="min-w-0 space-y-1"><Label htmlFor={"body-photo-"+angle.code}>{angle.label}</Label><Input id={"body-photo-"+angle.code} type="file" accept="image/jpeg,image/png,image/webp" className="min-h-11" disabled={blocked} onChange={e=>{const file=e.target.files?.[0];setPhotoFiles(current=>({...current,[angle.code]:file}));}}/><p className="text-xs break-words text-muted-foreground">{photoFiles[angle.code]?.name??"Não selecionada"}</p></div>)}</div>
              <Button className="min-h-11 w-full whitespace-normal" disabled={blocked||!Object.values(photoFiles).some(Boolean)} onClick={()=>void uploadPhotos()}>Salvar protocolo fotográfico</Button>
            </div>:null}
            {showPhotos&&!body.error&&!body.loading?<div data-testid="sx04-photo-timeline" className="space-y-3">
              <p className="text-sm font-medium">Linha do tempo · até 6 protocolos recentes</p>
              {body.photoSets.length===0?<p className="text-sm text-muted-foreground">Nenhum protocolo ativo confirmado.</p>:<>
              <div className="space-y-2 rounded-lg border p-2">
                <p className="text-sm font-medium">Comparar dois registros</p>
                <Label htmlFor="sx04-angle">Ângulo</Label><select id="sx04-angle" value={comparisonAngle} onChange={e=>setComparisonAngle(e.target.value as BodyPhoto["angle_code"])} className="min-h-11 w-full rounded-md border bg-background px-2 text-sm">{photoAngles.map(a=><option key={a.code} value={a.code}>{a.label}</option>)}</select>
                <div className="grid grid-cols-2 gap-2">{([{id:"sx04-first",label:"Primeiro registro",value:firstSet,set:setFirstSet},{id:"sx04-second",label:"Segundo registro",value:secondSet,set:setSecondSet}] as const).map(field=><div key={field.id} className="min-w-0 space-y-1"><Label htmlFor={field.id}>{field.label}</Label><select id={field.id} value={field.value} onChange={e=>field.set(e.target.value)} className="min-h-11 w-full rounded-md border bg-background px-1 text-sm"><option value="">Escolha</option>{body.photoSets.filter(set=>set.athlete_id===athleteId&&set.photos.some(photo=>photo.angle_code===comparisonAngle)).map((set,index)=><option key={set.id} value={set.id}>{set.captured_on} · {index+1}</option>)}</select></div>)}</div>
                {(()=>{
                  const first=body.photoSets.find(s=>s.id===firstSet&&s.athlete_id===athleteId);
                  const second=body.photoSets.find(s=>s.id===secondSet&&s.athlete_id===athleteId);
                  if(!first||!second||first.id===second.id)return <p className="text-xs text-muted-foreground">Escolha dois protocolos distintos.</p>;
                  if(first.protocol_version!==second.protocol_version)return <p className="text-xs text-muted-foreground">Protocolos diferentes: comparação não apresentada.</p>;
                  const pair=[first,second].map(set=>({set,photos:set.photos.filter(p=>p.angle_code===comparisonAngle&&p.athlete_id===athleteId)}));
                  if(pair.some(item=>item.photos.length!==1))return <p className="text-xs text-muted-foreground">Ângulo ausente ou ambíguo.</p>;
                  return <><div className="grid grid-cols-2 gap-2">{pair.map(({set,photos})=><div key={set.id} className="min-w-0"><p className="text-xs">{set.captured_on}</p><PrivatePhoto photo={photos[0]} label={photoAngles.find(a=>a.code===comparisonAngle)?.label??"Foto corporal"}/></div>)}</div><p className="text-xs text-muted-foreground">Mesmo ângulo e versão de protocolo; iluminação, distância e postura não foram verificadas. Sem inferência de composição corporal.</p></>;
                })()}
              </div>
              {body.photoSets.filter(set=>set.athlete_id===athleteId).map(set=><details key={set.id} className="rounded-lg border px-2"><summary className="min-h-11 py-3 cursor-pointer text-sm">{set.captured_on} · {set.photos.length} fotos · {set.protocol_version}</summary><PhotoSetDetails set={set} athleteId={athleteId}/></details>)}
              </>}
            </div>:showPhotos&&body.loading?<p role="status" className="text-xs">Consultando referências privadas…</p>:null}
          </>}
        </CardContent>
      </Card>
      <Card data-testid="sx04-history">
        <CardHeader className="px-3 pt-3 pb-2"><CardTitle className="text-base">Histórico de avaliações</CardTitle><p className="text-xs text-muted-foreground">Até 12 avaliações recentes. Registros anulados e substituídos permanecem no histórico.</p></CardHeader>
        <CardContent className="space-y-2 px-3 pb-3">
          {body.error||body.loading?<p role="status" className="text-sm text-muted-foreground">Histórico não confirmado. Atualize para consultar.</p>:body.assessments.length===0?<p className="text-sm text-muted-foreground">Nenhuma avaliação registrada.</p>:<>
            <WeightComparison assessments={body.assessments} athleteId={athleteId}/>
            {body.assessments.filter(a=>a.athlete_id===athleteId).map(assessment=>{
              const weightValue=measurementValue(assessment.measurements,"weight_kg");
              const waistValue=measurementValue(assessment.measurements,"waist_cm");
              return <div key={assessment.id} className="rounded-lg border px-2.5">
                <details><summary className="min-h-11 cursor-pointer py-3">
                  <span className="text-sm font-medium">{assessment.observed_on} · {assessment.status==="active"?"Ativa":assessment.status==="voided"?"Anulada":"Substituída"}</span>
                  <span className="block text-xs text-muted-foreground">Peso {weightValue==null?"—":formatNumber(weightValue)+" kg"} · Cintura {waistValue==null?"—":formatNumber(waistValue)+" cm"}</span>
                </summary>
                <div className="space-y-2 pb-2">
                  <p className="text-xs text-muted-foreground">Origem: {assessment.data_source} · confiança {assessment.confidence} · condição {contextLabel(assessment.conditions?.weighing_context)}</p>
                  {assessment.measurements.filter(m=>m.athlete_id===athleteId&&m.assessment_id===assessment.id).map(m=><p key={m.id} className="text-xs">{metricLabels[m.metric_code]??m.metric_code}: {formatNumber(m.value)} {m.unit_code==="pct"?"%":m.unit_code} · {methodLabel(m.method)} · confiança {m.confidence}</p>)}
                  {assessment.notes?<p className="text-xs break-words">{assessment.notes}</p>:null}
                  {assessment.status==="active"?<Button variant="outline" className="min-h-11 w-full" disabled={blocked} onClick={()=>setConfirmVoid(assessment.id)}><Trash2 className="mr-2 h-4 w-4" aria-hidden="true"/>Anular avaliação</Button>:null}
                  {confirmVoid===assessment.id&&assessment.status==="active"?<div className="space-y-2 rounded-md border p-2"><p className="text-sm">Anular esta avaliação? O histórico será preservado.</p><div className="grid grid-cols-2 gap-2"><Button className="min-h-11" variant="outline" onClick={()=>setConfirmVoid(null)} disabled={blocked}>Cancelar</Button><Button variant="destructive" className="min-h-11" disabled={blocked} onClick={()=>void run(()=>body.voidAssessment(assessment.id),"Anulação registrada. Confira o histórico.")}>Confirmar anulação</Button></div></div>:null}
                </div></details>
              </div>;
            })}
          </>}
        </CardContent>
      </Card>
    </div>
  );
}
const metricLabels:Record<string,string>={weight_kg:"Peso",waist_cm:"Cintura",hip_cm:"Quadril",chest_cm:"Peito",neck_cm:"Pescoço",body_fat_pct:"Gordura corporal",arm_left_cm:"Braço esquerdo",arm_right_cm:"Braço direito",thigh_left_cm:"Coxa esquerda",thigh_right_cm:"Coxa direita",calf_left_cm:"Panturrilha esquerda",calf_right_cm:"Panturrilha direita",lean_mass_kg:"Massa magra",skeletal_muscle_mass_kg:"Massa muscular esquelética"};
const methodLabel=(value:string)=>({scale:"Balança",tape:"Fita",bioimpedance:"Bioimpedância",caliper:"Adipômetro",dexa:"DEXA",estimated:"Estimativa",professional:"Profissional",other:"Outro"} as Record<string,string>)[value]??value;
const contextLabel=(value:unknown)=>value==="morning_fasted"?"Manhã em jejum":value==="morning_unfasted"?"Manhã sem jejum":value==="other"?"Outra condição":"Não informada";
function PrivatePhoto({photo,label}:{photo:BodyPhoto;label:string}){
 const [failed,setFailed]=useState(false);
 return photo.signed_url&&!failed?<img src={photo.signed_url} alt={label} loading="lazy" onError={()=>setFailed(true)} className="aspect-[3/4] w-full rounded-md border object-contain bg-muted/20"/>:<div className="flex aspect-[3/4] items-center justify-center rounded-md border text-xs text-muted-foreground"><ImageIcon className="mr-1 h-4 w-4" aria-hidden="true"/>Foto indisponível</div>;
}
function PhotoSetDetails({set,athleteId}:{set:import("../hooks/useHealthBodyM8").BodyPhotoSet;athleteId:string}){
 const [open,setOpen]=useState(false);
 return <div className="space-y-2 pb-2"><Button variant="outline" className="min-h-11 w-full" onClick={()=>setOpen(v=>!v)}>{open?"Recolher imagens":"Mostrar imagens deste protocolo"}</Button>{open?<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{set.photos.filter(p=>p.athlete_id===athleteId&&p.photo_set_id===set.id).map(photo=><div key={photo.id}><p className="text-xs">{photoAngles.find(a=>a.code===photo.angle_code)?.label??"Ângulo personalizado"}</p><PrivatePhoto key={photo.signed_url??photo.id} photo={photo} label={photoAngles.find(a=>a.code===photo.angle_code)?.label??"Foto corporal"}/></div>)}</div>:null}</div>;
}
export function WeightComparison({assessments,athleteId}:{assessments:import("../hooks/useHealthBodyM8").BodyAssessment[];athleteId:string}){
 const entries=assessments.filter(a=>a.athlete_id===athleteId&&a.status==="active").map(a=>({a,weights:a.measurements.filter(m=>m.athlete_id===athleteId&&m.assessment_id===a.id&&m.metric_code==="weight_kg"&&m.unit_code==="kg"&&Number.isFinite(Number(m.value))&&Number(m.value)>0)})).filter(x=>x.weights.length===1).sort((a,b)=>b.a.observed_at.localeCompare(a.a.observed_at));
 const current=entries[0];
 if(!current)return <p className="text-xs text-muted-foreground">Sem pesagem ativa confirmada no histórico consultado.</p>;
 const context=current.a.conditions?.weighing_context;
 const method=current.weights[0].method;
 const prior=entries.find(entry=>entry.a.observed_on<current.a.observed_on&&entry.a.conditions?.weighing_context===context&&(context==="morning_fasted"||context==="morning_unfasted")&&entry.weights[0].method===method&&(method==="scale"||method==="bioimpedance"));
 return <div className="space-y-1 rounded-lg bg-muted/25 p-3" data-testid="sx04-weight-comparison"><p className="text-xs text-muted-foreground">Última pesagem registrada · {current.a.observed_on}</p><p className="text-xl font-semibold tabular-nums">{formatNumber(current.weights[0].value)} kg</p><p className="text-xs">{methodLabel(method)} · {contextLabel(context)}</p>{prior?<><p className="text-xs">Referência de {prior.a.observed_on}: {formatNumber(prior.weights[0].value)} kg · diferença {formatSigned(Number(current.weights[0].value)-Number(prior.weights[0].value),"kg")}</p><p className="text-xs text-muted-foreground">Mesmo método e condição declarados; aparelho e hidratação não verificados. Não indica alteração de gordura.</p></>:<p className="text-xs text-muted-foreground">Sem referência comparável confirmada nesta consulta.</p>}</div>;
}
