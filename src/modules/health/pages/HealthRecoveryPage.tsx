import {useState,useRef} from "react";
import {Moon,BatteryCharging,RefreshCw} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {useHealthAthlete} from "../hooks/useHealthAthlete";
import {useHealthRecoveryM9,type RecoveryMetricCode,type SleepPeriod,type RecoveryMetricInput} from "../hooks/useHealthRecoveryM9";

const metrics: {code:RecoveryMetricCode;label:string;low:string;high:string}[]=[
 {code:"sleep_quality",label:"Qualidade do sono",low:"Muito ruim",high:"Muito boa"},
 {code:"physical_recovery",label:"Recuperação física",low:"Muito baixa",high:"Muito boa"},
 {code:"training_readiness",label:"Prontidão percebida",low:"Muito baixa",high:"Muito boa"},
 {code:"general_fatigue",label:"Fadiga geral",low:"Muito baixa",high:"Muito alta"},
 {code:"sleepiness",label:"Sonolência",low:"Ausente",high:"Muito alta"},
 {code:"muscular_fatigue",label:"Fadiga muscular",low:"Muito baixa",high:"Muito alta"},
 {code:"mental_fatigue",label:"Fadiga mental",low:"Muito baixa",high:"Muito alta"},
 {code:"muscle_soreness",label:"Dor muscular",low:"Ausente",high:"Muito alta"},
 {code:"disposition",label:"Disposição",low:"Muito ruim",high:"Muito boa"},
];
export function localDay(){const now=new Date();return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);}
const fmt=(n:number|null|undefined)=>n==null||!Number.isFinite(Number(n))||Number(n)<0?"—":Math.floor(Math.round(Number(n))/60)+"h"+String(Math.round(Number(n))%60).padStart(2,"0");
const number=(v:string,max:number,integer=false)=>{if(!v.trim())return null;if(!/^\d+(?:[.,]\d+)?$/.test(v.trim()))return NaN;const n=Number(v.replace(",","."));return Number.isFinite(n)&&n>=0&&n<=max&&(!integer||Number.isInteger(n))?n:NaN;};
const coverage=(v:string)=>({unobserved:"Não observado",sparse:"Escasso",partial:"Parcial",complete:"Completo"} as Record<string,string>)[v]??v;
const source=(v:string)=>({USER_REPORTED:"Declarado",MEASURED:"Medido",DEVICE_ESTIMATED:"Estimativa de dispositivo",IMPORTED:"Importado",SYSTEM_DERIVED:"Calculado",PROFESSIONAL_RECORDED:"Registro profissional"} as Record<string,string>)[v]??v;
const periodLabel=(v:string)=>v==="nap"?"Cochilo":v==="nocturnal"?"Sono noturno":"Outro período";
const statusLabel=(v:string)=>v==="active"?"Ativo":v==="voided"?"Anulado":v==="superseded"?"Substituído":v;
const selectClass="min-h-11 w-full rounded-md border border-input bg-background px-2 text-sm";
const deviceLabels:Record<string,string>={sleep_duration_minutes_estimated:"Duração de sono estimada",time_in_bed_minutes:"Tempo na cama",sleep_latency_minutes_estimated:"Latência estimada",wake_after_sleep_onset_minutes_estimated:"Tempo acordado após início do sono (estimado)",awakenings_count_estimated:"Despertares estimados",awake_minutes_estimated:"Minutos acordado estimados",sleep_stage_light_minutes_estimated:"Sono leve estimado",sleep_stage_deep_minutes_estimated:"Sono profundo estimado",sleep_stage_rem_minutes_estimated:"Sono REM estimado",resting_heart_rate_bpm:"Frequência cardíaca de repouso",hrv_rmssd_ms:"HRV RMSSD",respiratory_rate_breaths_per_min:"Frequência respiratória"};
const reasonLabels:Record<string,string>={NO_SLEEP_DATA:"Sem dados de sono.",NO_USABLE_SLEEP_DURATION:"Sem duração utilizável.",TIME_IN_BED_ONLY:"Somente tempo na cama.",INSUFFICIENT_SLEEP_COVERAGE:"Cobertura de duração insuficiente.",INSUFFICIENT_SLEEP_TIMING_COVERAGE:"Cobertura de horários insuficiente.",RECOVERY_UNOBSERVED:"Recuperação não observada.",FATIGUE_UNOBSERVED:"Fadiga não observada.",READINESS_UNOBSERVED:"Prontidão não observada.",DEVICE_ESTIMATE_ONLY:"Somente estimativas de dispositivo.",MIXED_SLEEP_SOURCES:"Fontes de sono diferentes.",INSUFFICIENT_COMPARABLE_DAYS:"Dias comparáveis insuficientes.",HRV_METHOD_NOT_COMPARABLE:"Método de HRV não comparável."};
type SleepForm={sleepDate:string;periodType:SleepPeriod["period_type"];hours:string;bed:string;start:string;wake:string;out:string;awakenings:string;awake:string;notes:string};
const emptySleep=():SleepForm=>({sleepDate:localDay(),periodType:"nocturnal",hours:"",bed:"",start:"",wake:"",out:"",awakenings:"",awake:"",notes:""});
export function validateSleep(form:SleepForm){
 const hours=number(form.hours,48),awakenings=number(form.awakenings,500,true),awake=number(form.awake,2880,true);
 if([hours,awakenings,awake].some(n=>n!==null&&Number.isNaN(n)))return "Confira duração (0–48h), despertares inteiros (0–500) e minutos acordado (0–2880).";
 if(!/^\d{4}-\d{2}-\d{2}$/.test(form.sleepDate)||form.sleepDate>localDay()||!Number.isFinite(Date.parse(form.sleepDate)))return "Informe uma data de referência válida, não futura.";
 const times=[form.bed,form.start,form.wake,form.out].filter(Boolean);
 if(times.length&&times.every(t=>t.slice(0,10)!==form.sleepDate))return "A data de referência deve corresponder a um dos dias informados no período.";
 const ms=times.map(v=>new Date(v).getTime());
 if(ms.some(v=>!Number.isFinite(v)||v>Date.now())||ms.some((v,i)=>i>0&&v<ms[i-1]))return "Confira a ordem e as datas dos horários, inclusive após a meia-noite.";
 if(ms.length>1&&ms[ms.length-1]-ms[0]>2880*60000)return "O intervalo informado ultrapassa 48 horas.";
 if(form.start&&form.wake&&awake!==null&&awake>(new Date(form.wake).getTime()-new Date(form.start).getTime())/60000)return "Minutos acordado não podem superar o intervalo informado.";
 if(hours===null&&!times.length&&awakenings===null&&awake===null&&!form.notes.trim())return "Informe pelo menos uma observação; campos vazios permanecem desconhecidos.";
 return null;
}
export function HealthRecoveryPage(){
 const {athlete,loading}=useHealthAthlete();
 if(loading)return <p role="status" className="p-3 text-sm">Carregando perfil…</p>;
 if(!athlete?.id)return <p className="p-3 text-sm">Perfil indisponível.</p>;
 return <RecoveryContent key={athlete.id} athleteId={athlete.id}/>;
}
function RecoveryContent({athleteId}:{athleteId:string}){
 const recovery=useHealthRecoveryM9(athleteId);
 const [windowDays,setWindowDays]=useState<7|14|28>(7);
 const [section,setSection]=useState<"sleep"|"checkin"|null>(null);
 const [form,setForm]=useState(emptySleep);
 const [values,setValues]=useState<Partial<Record<RecoveryMetricCode,number>>>({});
 const [notes,setNotes]=useState("");
 const [busy,setBusy]=useState(false);
 const [failed,setFailed]=useState(false);
 const [reviewed,setReviewed]=useState(false);
 const [notice,setNotice]=useState("");
 const [stateNeedsRefresh,setStateNeedsRefresh]=useState(false);
 const [confirm,setConfirm]=useState<{kind:"sleep"|"checkin";id:string}|null>(null);
 const lock=useRef(false);
 const blocked=busy||recovery.saving||recovery.loading||Boolean(recovery.error)||failed;
 const usable=!recovery.loading&&!recovery.error;
 const current=usable?recovery.states.find(s=>s.athlete_id===athleteId&&s.window_days===windowDays):undefined;
 const sleeps=usable?recovery.sleepPeriods.filter(s=>s.athlete_id===athleteId):[];
 const checkins=usable?recovery.checkins.filter(s=>s.athlete_id===athleteId):[];
 const groups=Array.from(new Set(checkins.map(c=>c.checkin_event_id))).map(id=>({id,rows:checkins.filter(c=>c.checkin_event_id===id)}));
 const latest=sleeps.find(s=>s.status==="active"&&s.period_type==="nocturnal");
 const stateOlderThanFacts=Boolean(current&&[...sleeps,...checkins].some(f=>Date.parse(f.created_at)>Date.parse(current.computed_at)));
 const history=[...sleeps.map(s=>({kind:"sleep" as const,id:s.id,date:s.sleep_date,entry:s})),...groups.map(g=>({kind:"checkin" as const,id:g.id,date:g.rows[0].observed_on,entry:g}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);
 const run=async(action:()=>Promise<unknown>,message:string,mutatesFacts=true)=>{
  if(blocked||lock.current)return;
  lock.current=true;setBusy(true);setNotice("");
  if(mutatesFacts)setStateNeedsRefresh(true);
  try{await action();setNotice(message);setConfirm(null);}
  catch{setFailed(true);setReviewed(false);setConfirm(null);setNotice("Resultado não confirmado. Pode haver registros parciais; atualize e confira antes de repetir.");}
  finally{lock.current=false;setBusy(false);}
 };
 const readback=async()=>{
  if(lock.current||busy||recovery.loading)return;
  lock.current=true;setBusy(true);setReviewed(false);
  try{await recovery.reload(true);setReviewed(true);setNotice("Confira os registros atualizados antes de liberar nova ação.");}
  catch{setNotice("Consulta não confirmada.");}
  finally{lock.current=false;setBusy(false);}
 };
 const error=validateSleep(form);
 const change=(key:keyof SleepForm,value:string)=>setForm(f=>({...f,[key]:value}));
 const saveSleep=()=>{
  if(error)return;
  void run(async()=>{await recovery.recordSleepPeriod({sleepDate:form.sleepDate,periodType:form.periodType,bedAt:form.bed||null,sleepStartAt:form.start||null,finalWakeAt:form.wake||null,outOfBedAt:form.out||null,declaredSleepMinutes:form.hours.trim()?Math.round(number(form.hours,48)!*60):null,awakeningsCount:number(form.awakenings,500,true),awakeMinutes:number(form.awake,2880,true),notes:form.notes});setForm(emptySleep());setSection(null);},"Sono registrado. Confira o histórico.");
 };
 const saveCheckin=()=>{const payload=Object.entries(values).map(([metric_code,value_ordinal])=>({metric_code:metric_code as RecoveryMetricCode,value_ordinal})) as RecoveryMetricInput[];if(!payload.length)return;void run(async()=>{await recovery.recordRecoveryCheckin(payload,new Date(),notes);setValues({});setNotes("");setSection(null);},"Check-in registrado. Confira as percepções salvas.");};
 const metricControl=(metric:typeof metrics[number])=><fieldset key={metric.code} className="space-y-1 rounded-lg border p-2"><legend className="px-1 text-sm font-medium">{metric.label}</legend><div className="grid grid-cols-5 gap-1">{[1,2,3,4,5].map(n=><Button key={n} className="min-h-11 px-0" disabled={blocked} aria-label={metric.label+": "+n} aria-pressed={values[metric.code]===n} variant={values[metric.code]===n?"default":"outline"} onClick={()=>setValues(v=>({...v,[metric.code]:n}))}>{n}</Button>)}</div><div className="flex justify-between gap-1 text-xs text-muted-foreground"><span>{metric.low}</span><span>{metric.high}</span></div>{values[metric.code]!==undefined?<Button variant="ghost" className="min-h-11 w-full" disabled={blocked} onClick={()=>setValues(v=>{const next={...v};delete next[metric.code];return next;})}>Não informar {metric.label.toLowerCase()}</Button>:<p className="text-xs text-muted-foreground">Não informado</p>}</fieldset>;
 return <div className="space-y-3 pb-4">
  <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><h2 className="text-xl font-semibold">Sono e recuperação</h2><p className="text-sm text-muted-foreground">Sono e percepções registrados, sem decisão automática de treino.</p></div><Button variant="outline" className="min-h-11" disabled={blocked} onClick={()=>void run(async()=>{await recovery.refreshStates();setStateNeedsRefresh(false);},"Indicadores atualizados.",false)}><RefreshCw className="mr-2 h-4 w-4"/>Atualizar estado</Button></div>
  {recovery.error?<p role="alert" className="text-sm text-destructive">Consulta indisponível: {recovery.error}</p>:null}
  {recovery.loading?<p role="status" className="text-sm">Consultando recuperação…</p>:null}
  {notice?<p role={failed?"alert":"status"} className="text-sm">{notice}</p>:null}
  {failed||recovery.error?<Button variant="outline" className="min-h-11 w-full" disabled={busy||recovery.loading} onClick={()=>void readback()}>Conferir registros</Button>:null}
  {failed&&reviewed&&usable?<Button variant="outline" className="min-h-11 w-full" onClick={()=>{setFailed(false);setReviewed(false);setForm(emptySleep());setValues({});setNotes("");setSection(null);setNotice("");}}>Conferi; liberar nova ação</Button>:null}
  <Card data-testid="sx05-overview"><CardHeader className="px-3 pt-3 pb-2"><CardTitle className="text-lg">Meu descanso</CardTitle></CardHeader><CardContent className="space-y-3 px-3 pb-3">
   {latest?<div className="rounded-lg bg-muted/25 p-3"><p className="text-xs text-muted-foreground">Último sono noturno registrado · {latest.sleep_date} · {source(latest.data_source)}</p><p className="text-2xl font-semibold tabular-nums">{fmt(latest.declared_sleep_minutes)}</p><p className="text-xs">Duração registrada no campo declarado · confiança {latest.confidence}</p><p className="text-xs text-muted-foreground">Tempo na cama: {fmt(latest.calculated_time_in_bed_minutes)} · estimativa calculada: {fmt(latest.calculated_sleep_minutes)}</p></div>:<p className="text-sm text-muted-foreground">{usable?"Nenhum sono noturno confirmado nesta consulta.":"Sono não confirmado."}</p>}
   <div className="grid grid-cols-3 gap-2">{([7,14,28] as const).map(n=><Button key={n} aria-pressed={n===windowDays} variant={n===windowDays?"default":"outline"} className="min-h-11" onClick={()=>setWindowDays(n)}>{n} dias</Button>)}</div>
   {current?<div className="space-y-2"><p className="text-xs text-muted-foreground">{current.window_start_date} a {current.as_of_date} · cálculo {current.computed_at} · confiança {current.confidence}</p>{stateNeedsRefresh||stateOlderThanFacts||current.as_of_date!==localDay()?<p role="status" className="text-xs">Estado anterior; atualize para incluir registros recentes.</p>:null}<div className="rounded-md bg-muted/25 p-3"><p className="text-xs">Sono médio registrado</p><p className="text-xl font-semibold">{fmt(current.average_sleep_minutes)}</p><p className="text-xs">{current.sleep_duration_observed_days}/{current.window_days} dias · {coverage(current.sleep_duration_coverage)}</p></div><div className="grid grid-cols-2 gap-2">{[["Qualidade",current.sleep_quality_coverage,current.sleep_quality_observed_days],["Recuperação",current.recovery_coverage,current.recovery_observed_days],["Fadiga",current.fatigue_coverage,current.fatigue_observed_days],["Prontidão",current.readiness_coverage,current.readiness_observed_days],["Horários",current.sleep_timing_coverage,current.sleep_timing_observed_days]].map(([label,c,d])=><div key={label} className="rounded-md border p-2"><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{coverage(String(c))} · {d}/{windowDays} dias</p></div>)}</div><details><summary className="min-h-11 py-3 cursor-pointer text-sm">Origem, cobertura e limites</summary><ul className="space-y-1 text-xs text-muted-foreground">{current.reason_codes.map(c=><li key={c}>{reasonLabels[c]??c}</li>)}</ul><p className="text-xs">Algoritmo {current.algorithm_version}. Sem score composto.</p></details></div>:<p className="text-sm text-muted-foreground">Nenhum estado confirmado nesta janela.</p>}
   <p className="text-xs text-muted-foreground">— = informação desconhecida. Tempo na cama não equivale a sono efetivo. Estimativa calculada depende dos horários e despertares informados.</p>
  </CardContent></Card>
  <div className="grid grid-cols-2 gap-2"><Button className="min-h-12 h-auto whitespace-normal" variant={section==="checkin"?"outline":"default"} disabled={blocked} onClick={()=>setSection(v=>v==="sleep"?null:"sleep")}><Moon className="mr-1 h-4 w-4 shrink-0"/>Registrar sono</Button><Button variant={section==="checkin"?"default":"outline"} className="min-h-12 h-auto whitespace-normal" disabled={blocked} onClick={()=>setSection(v=>v==="checkin"?null:"checkin")}><BatteryCharging className="mr-1 h-4 w-4 shrink-0"/>Check-in</Button></div>
  {section==="sleep"?<Card data-testid="sx05-sleep"><CardHeader className="px-3 pt-3 pb-2"><CardTitle className="text-base">Registrar sono declarado</CardTitle></CardHeader><CardContent className="space-y-3 px-3 pb-3">
   <Label htmlFor="sleep-date">Data de referência do período</Label><Input id="sleep-date" type="date" max={localDay()} className="min-h-11" value={form.sleepDate} disabled={blocked} onChange={e=>change("sleepDate",e.target.value)}/>
   <Label htmlFor="sleep-type">Tipo de período</Label><select id="sleep-type" className={selectClass} value={form.periodType} disabled={blocked} onChange={e=>change("periodType",e.target.value)}><option value="nocturnal">Noite</option><option value="nap">Cochilo</option><option value="other">Outro</option></select>
   <Label htmlFor="sleep-hours">Duração declarada (horas)</Label><Input id="sleep-hours" inputMode="decimal" className="min-h-11" value={form.hours} placeholder="Ex.: 7,5" disabled={blocked} onChange={e=>change("hours",e.target.value)}/>
   <details className="rounded-lg border px-2"><summary className="min-h-11 py-3 cursor-pointer text-sm">Horários e despertares (opcionais)</summary><div className="space-y-2 pb-2"><p className="text-xs text-muted-foreground">Informe a data e a hora reais de cada evento, inclusive após a meia-noite. Nenhuma virada de data será presumida.</p>{([["bed","Deitei"],["start","Dormi aproximadamente"],["wake","Acordei"],["out","Levantei"]] as const).map(([key,label])=><div key={key}><Label htmlFor={"sleep-"+key}>{label}</Label><Input id={"sleep-"+key} type="datetime-local" className="min-h-11 min-w-0" value={form[key]} disabled={blocked} onChange={e=>change(key,e.target.value)}/></div>)}<div className="grid grid-cols-2 gap-2"><div><Label htmlFor="sleep-awakenings">Despertares</Label><Input id="sleep-awakenings" inputMode="numeric" className="min-h-11" value={form.awakenings} disabled={blocked} onChange={e=>change("awakenings",e.target.value)}/></div><div><Label htmlFor="sleep-awake">Minutos acordado</Label><Input id="sleep-awake" inputMode="numeric" className="min-h-11" value={form.awake} disabled={blocked} onChange={e=>change("awake",e.target.value)}/></div></div></div></details>
   <Label htmlFor="sleep-notes">Observações (opcional)</Label><Textarea id="sleep-notes" value={form.notes} disabled={blocked} onChange={e=>change("notes",e.target.value)}/>
   {error?<p className="text-xs text-muted-foreground">{error}</p>:null}<Button className="min-h-11 w-full" disabled={blocked||Boolean(error)} onClick={saveSleep}>Salvar sono</Button>
  </CardContent></Card>:null}
  {section==="checkin"?<Card data-testid="sx05-checkin"><CardHeader className="px-3 pt-3 pb-2"><CardTitle className="text-base">Como você se sente?</CardTitle><p className="text-xs text-muted-foreground">Responda somente o que quiser observar. A escala é específica para cada percepção.</p></CardHeader><CardContent className="space-y-3 px-3 pb-3">{metrics.slice(0,4).map(metricControl)}<details className="rounded-lg border px-2"><summary className="min-h-11 py-3 cursor-pointer text-sm">Outras percepções</summary><div className="space-y-2 pb-2">{metrics.slice(4).map(metricControl)}</div></details><Label htmlFor="checkin-notes">Observação geral (opcional)</Label><Textarea id="checkin-notes" value={notes} disabled={blocked} onChange={e=>setNotes(e.target.value)}/><p className="text-xs text-muted-foreground">{Object.keys(values).length} percepções selecionadas. Texto não vira nota.</p><Button className="min-h-11 w-full" disabled={blocked||!Object.keys(values).length} onClick={saveCheckin}>Salvar check-in</Button></CardContent></Card>:null}
  <Card><CardHeader className="px-3 pt-3 pb-2"><CardTitle className="text-base">Dispositivos · consulta</CardTitle></CardHeader><CardContent className="px-3 pb-3"><p className="text-xs text-muted-foreground">Observações já importadas são exibidas separadamente. Não há nova integração nem medição clínica.</p>{recovery.deviceError?<p role="alert" className="text-sm">Consulta de dispositivos indisponível.</p>:usable?<details><summary className="min-h-11 py-3 cursor-pointer text-sm">Observações de dispositivo (até 60)</summary>{recovery.deviceObservations.length===0?<p className="text-xs">Nenhuma observação confirmada.</p>:recovery.deviceObservations.filter(o=>o.athlete_id===athleteId&&o.status==="active").map(o=><div key={o.id} className="border-t py-2 text-xs"><p className="font-medium">{deviceLabels[o.metric_code]??o.metric_code}: {o.numeric_value} {o.unit_code}</p><p>{o.observed_on} · {o.provider} · {o.device_model??"Modelo não informado"} · confiança {o.confidence}</p><p className="text-muted-foreground">Janela: {o.window_start_at??"—"} a {o.window_end_at??"—"} · versão {o.provider_algorithm_version??"—"}</p></div>)}</details>:null}</CardContent></Card>
  <Card data-testid="sx05-history"><CardHeader className="px-3 pt-3 pb-2"><CardTitle className="text-base">Histórico recente</CardTitle><p className="text-xs text-muted-foreground">Até 30 entradas agrupadas, a partir de 90 períodos e 180 métricas consultadas. Um grupo pode estar incompleto.</p></CardHeader><CardContent className="space-y-2 px-3 pb-3">
   {!usable?<p className="text-sm">Histórico não confirmado.</p>:history.length===0?<p className="text-sm">Nenhum registro consultado.</p>:history.map(item=><details key={item.kind+item.id} className="rounded-lg border px-2"><summary className="min-h-11 cursor-pointer py-3 text-sm">{item.kind==="sleep"?periodLabel(item.entry.period_type)+" · "+statusLabel(item.entry.status):"Check-in de recuperação"} · {item.date}</summary><div className="space-y-2 pb-2">
    {item.kind==="sleep"?<><p className="text-xs">Origem: {source(item.entry.data_source)} · confiança {item.entry.confidence}</p><p className="text-xs">Duração declarada: {fmt(item.entry.declared_sleep_minutes)} · Tempo na cama: {fmt(item.entry.calculated_time_in_bed_minutes)} · Estimativa calculada: {fmt(item.entry.calculated_sleep_minutes)}</p><p className="text-xs">Horários: {item.entry.bed_at??"—"} / {item.entry.sleep_start_at??"—"} / {item.entry.final_wake_at??"—"} / {item.entry.out_of_bed_at??"—"} · fuso {item.entry.timezone??"—"}</p><p className="text-xs">Despertares: {item.entry.awakenings_count??"—"} · acordado: {fmt(item.entry.awake_during_period_minutes)}</p>{item.entry.notes?<p className="text-xs break-words">{item.entry.notes}</p>:null}{item.entry.status==="active"?<Button variant="outline" className="min-h-11 w-full" disabled={blocked} onClick={()=>setConfirm({kind:"sleep",id:item.id})}>Anular período</Button>:null}</>:item.entry.rows.map(row=><div key={row.id} className="space-y-1 border-t py-2"><p className="text-sm">{metrics.find(m=>m.code===row.metric_code)?.label??row.metric_code}: {row.value_ordinal??"Sem nota"} · {statusLabel(row.status)}</p><p className="text-xs text-muted-foreground">{source(row.data_source)} · {row.scale_version} · confiança {row.confidence}</p>{row.raw_text?<p className="text-xs break-words">{row.raw_text}</p>:null}{row.status==="active"?<Button variant="outline" className="min-h-11 w-full" disabled={blocked} onClick={()=>setConfirm({kind:"checkin",id:row.id})}>Anular apenas {metrics.find(m=>m.code===row.metric_code)?.label.toLowerCase()??row.metric_code}</Button>:null}</div>)}
    {confirm&&(item.kind==="sleep"?confirm.kind==="sleep"&&confirm.id===item.id:confirm.kind==="checkin"&&item.entry.rows.some(r=>r.id===confirm.id))?<div className="space-y-2 rounded-md border p-2"><p className="text-sm">Anular {confirm.kind==="sleep"?"este período":"somente a percepção selecionada"}? O histórico permanece preservado.</p><div className="grid grid-cols-2 gap-2"><Button variant="outline" className="min-h-11" disabled={blocked} onClick={()=>setConfirm(null)}>Cancelar</Button><Button variant="destructive" className="min-h-11" disabled={blocked} onClick={()=>void run(()=>confirm.kind==="sleep"?recovery.voidSleepPeriod(confirm.id):recovery.voidRecoveryCheckin(confirm.id),"Anulação registrada.")}>Confirmar anulação</Button></div></div>:null}
   </div></details>)}
  </CardContent></Card>
 </div>;
}
