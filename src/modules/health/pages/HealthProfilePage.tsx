import {useRef,useState} from "react";
import {Button} from "@/components/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {useHealthAthlete} from "../hooks/useHealthAthlete";
import {useHealthProfileM1,type ConsentType,type ConsentDecision} from "../hooks/useHealthProfileM1";

const experience={beginner:"Iniciante",intermediate:"Intermediário",advanced:"Avançado",returning:"Retornando",unknown:"Não informado"};
const sides={right:"Direito",left:"Esquerdo",mixed:"Misto",unknown:"Não informado"};
const goals={hypertrophy:"Hipertrofia",strength:"Força",fat_loss:"Perda de gordura",recomposition:"Recomposição",health:"Saúde geral",performance:"Performance",maintenance:"Manutenção",custom:"Personalizado"};
const phases={build:"Construção",cut:"Déficit / corte",recomp:"Recomposição",maintenance:"Manutenção",performance:"Performance",reentry:"Retorno",custom:"Personalizada"};
const locations={gym:"Academia",home:"Casa",outdoor:"Ao ar livre",travel:"Viagem",other:"Outro"};
const timing={morning:"Manhã",afternoon:"Tarde",evening:"Noite",variable:"Variável"};
const availability={available:"Disponível",limited:"Limitado",unavailable:"Indisponível",unknown:"Não confirmado"};
const priority={"1":"1 — Principal","2":"2 — Alta","3":"3 — Média","4":"4 — Baixa","5":"5 — Complementar"};
const consentLabels:{type:ConsentType;title:string;description:string}[]=[
 {type:"health_data_processing",title:"Dados do módulo Saúde",description:"Decisão sobre registrar e usar dados dentro das funções do Saúde."},
 {type:"private_media_storage",title:"Mídia privada",description:"Decisão sobre armazenamento de fotos e vídeos privados."},
 {type:"media_analysis",title:"Análise de mídia",description:"Decisão sobre análises técnicas futuras; não habilita análise automática."},
 {type:"coach_sharing",title:"Compartilhamento com profissional",description:"Decisão sobre compartilhamento explícito; não concede acesso por si só."},
 {type:"notifications",title:"Notificações",description:"Decisão sobre lembretes e notificações do Saúde."},
];
const decisionLabel=(v:string|undefined)=>v==="granted"?"Concedido":v==="denied"?"Negado":v==="revoked"?"Revogado":"Sem decisão registrada";
const str=(v:unknown)=>v==null?"":String(v);
const nullable=(v:string)=>v.trim()||null;
const num=(v:string)=>v.trim()?Number(v.replace(",",".")):null;
const numeric=(v:string,min:number,max:number,integer=false)=>!v.trim()||(/^\d+(?:[.,]\d+)?$/.test(v.trim())&&Number(v.replace(",","."))>=min&&Number(v.replace(",","."))<=max&&(!integer||Number.isInteger(Number(v.replace(",",".")))));
const localDay=()=>{const now=new Date();return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);};
const option=(v:string,opts:Record<string,string>)=>opts[v]??(v||"Não informado");
const selectClass="min-h-11 w-full rounded-md border border-input bg-background px-2 text-sm";
type Values=Record<string,string>;
type Field={key:string;label:string;kind?:"date"|"decimal"|"integer"|"text"|"notes"|"select";options?:Record<string,string>;suffix?:string};
type Run=(action:()=>Promise<void>,message:string)=>Promise<boolean>;
function Editor({id,title,description,initial,fields,blocked,run,save,validate,sourceKey="",unavailableReason}:{id:string;title:string;description:string;initial:Values;fields:Field[];blocked:boolean;run:Run;save:(v:Values)=>Promise<void>;validate:(v:Values)=>string|null;sourceKey?:string;unavailableReason?:string}){
 const [draft,setDraft]=useState<Values|null>(null);
 const [baseline,setBaseline]=useState("");
 const signature=JSON.stringify([sourceKey,initial]);
 const stale=draft!==null&&baseline!==signature;
 const dirty=draft!==null&&JSON.stringify(draft)!==JSON.stringify(initial);
 const problem=draft?validate(draft):null;
 return <Card data-testid={"sx06-"+id}><CardHeader className="px-3 pt-3 pb-2"><CardTitle className="text-base">{title}</CardTitle><p className="text-xs text-muted-foreground">{description}</p></CardHeader><CardContent className="space-y-3 px-3 pb-3">
  <div className="grid grid-cols-2 gap-2">{fields.filter(f=>f.kind!=="notes").map(f=><div key={f.key} className="min-w-0 rounded-md bg-muted/25 p-2"><p className="text-xs text-muted-foreground">{f.label}</p><p className="break-words text-sm font-medium">{f.options?option(initial[f.key],f.options):initial[f.key]?initial[f.key]+(f.suffix??""):"Não informado"}</p></div>)}</div>
  {fields.filter(f=>f.kind==="notes"&&initial[f.key]).map(f=><details key={f.key}><summary className="min-h-11 py-3 cursor-pointer text-sm">{f.label} salvas</summary><p className="text-xs whitespace-pre-wrap break-words">{initial[f.key]}</p></details>)}
  {unavailableReason?<p role="status" className="text-xs text-muted-foreground">{unavailableReason}</p>:null}
  {draft===null?<Button variant="outline" className="min-h-11 w-full" disabled={blocked||Boolean(unavailableReason)} onClick={()=>{setDraft({...initial});setBaseline(signature);}}>Editar {title.toLowerCase()}</Button>:<div className="space-y-2 rounded-lg border p-2">
   {stale?<p role="alert" className="text-sm">A referência salva mudou. Descarte o rascunho para editar os dados atualizados.</p>:null}
   {fields.map(f=><div key={f.key} className="space-y-1"><Label htmlFor={id+"-"+f.key}>{f.label}</Label>{f.kind==="select"?<select id={id+"-"+f.key} value={draft[f.key]} disabled={blocked||stale} className={selectClass} onChange={e=>setDraft(v=>v?{...v,[f.key]:e.target.value}:v)}><option value="">Não informado / escolher</option>{Object.entries(f.options??{}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>:f.kind==="notes"?<Textarea id={id+"-"+f.key} value={draft[f.key]} disabled={blocked||stale} onChange={e=>setDraft(v=>v?{...v,[f.key]:e.target.value}:v)}/>:<Input id={id+"-"+f.key} className="min-h-11" type={f.kind==="date"?"date":"text"} inputMode={f.kind==="decimal"?"decimal":f.kind==="integer"?"numeric":undefined} value={draft[f.key]} disabled={blocked||stale} onChange={e=>setDraft(v=>v?{...v,[f.key]:e.target.value}:v)}/>}</div>)}
   {problem?<p className="text-xs text-muted-foreground">{problem}</p>:null}
   <Button className="min-h-11 w-full" disabled={blocked||stale||!dirty||Boolean(problem)||Boolean(unavailableReason)} onClick={()=>void(async()=>{if(await run(()=>save(draft),title+" atualizado."))setDraft(null);})()}>Salvar {title.toLowerCase()}</Button>
   <Button variant="outline" className="min-h-11 w-full" disabled={blocked} onClick={()=>setDraft(null)}>Descartar rascunho de {title.toLowerCase()}</Button>
  </div>}
 </CardContent></Card>;
}
export function HealthProfilePage(){
 const {athlete,loading}=useHealthAthlete();
 if(loading)return <p role="status" className="p-3 text-sm">Carregando perfil…</p>;
 if(!athlete?.id)return <p className="p-3 text-sm">Perfil indisponível.</p>;
 return <ProfileContent key={athlete.id} athleteId={athlete.id} displayName={athlete.display_name}/>;
}
function ProfileContent({athleteId,displayName}:{athleteId:string;displayName?:string|null}){
 const m=useHealthProfileM1(athleteId);
 const [busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[reviewed,setReviewed]=useState(false),[notice,setNotice]=useState("");
 const [equipmentName,setEquipmentName]=useState(""),[equipmentCategory,setEquipmentCategory]=useState(""),[addOpen,setAddOpen]=useState(false);
 const [consent,setConsent]=useState<{type:ConsentType;decision:ConsentDecision;previousId:string|null}|null>(null);
 const lock=useRef(false);
 const scoped=[m.profile,m.activeGoal,m.activePhase,m.preferences,m.primaryLocation,...m.locations,...m.equipment,...Object.values(m.latestConsents)].every(x=>!x||x.athlete_id===athleteId);
 const blocked=busy||m.loading||m.saving||Boolean(m.error)||!scoped||failed;
 const run:Run=async(action,message)=>{
  if(blocked||lock.current)return false;
  lock.current=true;setBusy(true);setNotice("");
  try{await action();setNotice(message);return true;}
  catch{setFailed(true);setReviewed(false);setConsent(null);setNotice("Resultado não confirmado. Confira os dados salvos antes de repetir.");return false;}
  finally{lock.current=false;setBusy(false);}
 };
 const readback=async()=>{if(lock.current)return;lock.current=true;setBusy(true);setReviewed(false);try{await m.reload(true);setReviewed(true);setNotice("Confira o perfil atualizado antes de liberar nova ação.");}catch{setNotice("Consulta não confirmada.");}finally{lock.current=false;setBusy(false);}};
 const usable=!m.error&&scoped;
 const p=m.profile,g=m.activeGoal,phase=m.activePhase,loc=m.primaryLocation,pref=m.preferences;
 const currentConsent=consent?m.latestConsents[consent.type]:null;
 const consentStale=consent!==null&&(currentConsent?.id??null)!==consent.previousId;
 return <div className="space-y-3 pb-4">
  <div><h2 className="text-xl font-semibold">Meu perfil</h2><p className="text-sm text-muted-foreground">{displayName||"Perfil individual"} · contexto declarado, não avaliação técnica.</p></div>
  {m.loading?<p role="status" className="text-sm">Atualizando perfil…</p>:null}
  {!usable?<p role="alert" className="text-sm text-destructive">Perfil indisponível. Atualize antes de editar.</p>:null}
  {notice?<p role={failed?"alert":"status"} className="text-sm">{notice}</p>:null}
  {failed||!usable?<Button className="min-h-11 w-full" variant="outline" disabled={busy||m.loading} onClick={()=>void readback()}>Conferir perfil</Button>:null}
  {failed&&reviewed&&usable?<Button className="min-h-11 w-full" variant="outline" disabled={busy||m.loading} onClick={()=>{setFailed(false);setReviewed(false);setNotice("");}}>Conferi; liberar nova ação</Button>:null}
  <div className={!usable||m.loading?"hidden":"space-y-3"} aria-hidden={!usable||m.loading}>
   <Card data-testid="sx06-summary"><CardHeader className="px-3 pt-3 pb-2"><CardTitle className="text-lg">Meu contexto atual</CardTitle></CardHeader><CardContent className="space-y-2 px-3 pb-3"><div className="rounded-lg bg-muted/25 p-3"><p className="text-xs text-muted-foreground">Objetivo principal registrado</p><p className="font-semibold break-words">{g?.title??"Nenhum objetivo definido"}</p><p className="text-xs">{g?option(g.goal_type,goals):"Escolha explicitamente quando desejar."}</p></div><div className="grid grid-cols-2 gap-2"><div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Experiência declarada</p><p className="text-sm font-medium">{option(str(p?.training_experience_level),experience)}</p></div><div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Fase registrada</p><p className="text-sm font-medium break-words">{phase?.title??"Não definida"}</p></div></div><p className="text-xs text-muted-foreground">Experiência, objetivo, fase e confiança da avaliação técnica são distintos. O perfil não limita o treino nem prescreve mudanças.</p></CardContent></Card>
   <Editor id="basic" title="Perfil básico" description="Peso, medidas e fotos ficam em Evolução." initial={{birth:str(p?.date_of_birth),height:str(p?.height_cm),experience:str(p?.training_experience_level),side:str(p?.dominant_side),notes:str(p?.profile_notes)}} fields={[{key:"birth",label:"Data de nascimento",kind:"date"},{key:"height",label:"Altura",kind:"decimal",suffix:" cm"},{key:"experience",label:"Experiência de treino",kind:"select",options:experience},{key:"side",label:"Lado dominante",kind:"select",options:sides},{key:"notes",label:"Observações do perfil",kind:"notes"}]} sourceKey={p?.updated_at} blocked={blocked} run={run} validate={v=>!numeric(v.height,80,260)?"Altura deve estar entre 80 e 260 cm ou vazia.":v.birth&&(!/^\d{4}-\d{2}-\d{2}$/.test(v.birth)||!Number.isFinite(Date.parse(v.birth))||v.birth>localDay())?"Data de nascimento inválida.":null} save={v=>m.saveProfile({date_of_birth:nullable(v.birth),height_cm:num(v.height),training_experience_level:nullable(v.experience),dominant_side:nullable(v.side),profile_notes:nullable(v.notes)})}/>
   <Editor id="goal" title="Objetivo" description="Escolha o objetivo e sua prioridade; não há padrão presumido." initial={{type:str(g?.goal_type),title:str(g?.title),priority:str(g?.priority),notes:str(g?.notes)}} fields={[{key:"title",label:"Nome do objetivo"},{key:"type",label:"Tipo de objetivo",kind:"select",options:goals},{key:"priority",label:"Prioridade",kind:"select",options:priority},{key:"notes",label:"Detalhes do objetivo",kind:"notes"}]} sourceKey={g?.id+":"+g?.updated_at} blocked={blocked} run={run} validate={v=>v.title.trim().length<2||!Object.hasOwn(goals,v.type)||!Object.hasOwn(priority,v.priority)?"Informe nome, tipo e prioridade.":null} save={v=>m.saveGoal({goal_type:v.type,title:v.title.trim(),priority:Number(v.priority),notes:nullable(v.notes)})}/>
   <Editor id="phase" title="Fase atual" description="A fase descreve o momento, sem substituir o objetivo." initial={{type:str(phase?.phase_type),title:str(phase?.title),notes:str(phase?.objective_notes)}} fields={[{key:"title",label:"Nome da fase"},{key:"type",label:"Tipo de fase",kind:"select",options:phases},{key:"notes",label:"Detalhes da fase",kind:"notes"}]} sourceKey={[g?.id,g?.updated_at,phase?.id,phase?.updated_at].join(":")} unavailableReason={!g?"Salve primeiro o objetivo principal.":phase&&phase.goal_id!==g.id?"A fase ativa pertence a outro objetivo. Revise o vínculo antes de editar.":undefined} blocked={blocked} run={run} validate={v=>v.title.trim().length<2||!Object.hasOwn(phases,v.type)?"Informe nome e tipo da fase.":null} save={v=>m.savePhase({phase_type:v.type,title:v.title.trim(),objective_notes:nullable(v.notes)})}/>
   <Editor id="location" title="Local principal" description="Contexto declarado de treino; não identifica aparelhos físicos automaticamente." initial={{name:str(loc?.name),type:str(loc?.location_type),notes:str(loc?.notes)}} fields={[{key:"name",label:"Nome do local"},{key:"type",label:"Tipo de local",kind:"select",options:locations},{key:"notes",label:"Detalhes do local",kind:"notes"}]} sourceKey={loc?.id+":"+loc?.updated_at} blocked={blocked} run={run} validate={v=>v.name.trim().length<2||!Object.hasOwn(locations,v.type)?"Informe nome e tipo de local.":null} save={v=>m.savePrimaryLocation({name:v.name.trim(),location_type:v.type,notes:nullable(v.notes)})}/>
   <Card><CardHeader className="px-3 pt-3 pb-2"><CardTitle className="text-base">Equipamentos declarados</CardTitle><p className="text-xs text-muted-foreground">Disponibilidade informada, não catálogo M2.</p></CardHeader><CardContent className="space-y-2 px-3 pb-3">{m.equipment.length===0?<p className="text-sm">Nenhum equipamento declarado.</p>:m.equipment.map(e=><div key={e.id} className="space-y-1 rounded-md border p-2"><p className="text-sm font-medium break-words">{e.display_name}</p><p className="text-xs text-muted-foreground">{e.category??"Sem categoria"} · {option(e.availability,availability)}</p><Label htmlFor={"equipment-"+e.id}>Disponibilidade</Label><select id={"equipment-"+e.id} className={selectClass} value={e.availability} disabled={blocked} onChange={event=>{const value=event.target.value as keyof typeof availability;if(Object.hasOwn(availability,value)&&value!==e.availability)void run(()=>m.setEquipmentAvailability(e.id,value),"Disponibilidade atualizada.");}}>{Object.entries(availability).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>)}
   <Button variant="outline" className="min-h-11 w-full" disabled={blocked} onClick={()=>setAddOpen(v=>!v)}>{addOpen?"Recolher cadastro":"Adicionar equipamento"}</Button>{addOpen?<div className="space-y-2"><Label htmlFor="equip-name">Nome do equipamento</Label><Input id="equip-name" className="min-h-11" value={equipmentName} disabled={blocked} onChange={e=>setEquipmentName(e.target.value)}/><Label htmlFor="equip-category">Categoria (opcional)</Label><Input id="equip-category" className="min-h-11" value={equipmentCategory} disabled={blocked} onChange={e=>setEquipmentCategory(e.target.value)}/><p className="text-xs">Vínculo: {loc?.name??"Sem local definido"}.</p><Button className="min-h-11 w-full" disabled={blocked||equipmentName.trim().length<2} onClick={()=>void(async()=>{if(await run(()=>m.addEquipment(equipmentName.trim(),nullable(equipmentCategory)),"Equipamento adicionado.")){setEquipmentName("");setEquipmentCategory("");setAddOpen(false);}})()}>Salvar equipamento</Button></div>:null}</CardContent></Card>
   <Editor id="preferences" title="Preferências" description="Preferências de rotina, não obrigação de treino. Unidade e local padrão existentes são preservados." initial={{minutes:str(pref?.preferred_session_minutes),sessions:str(pref?.preferred_sessions_per_week),time:str(pref?.training_time_preference),notes:str(pref?.notes)}} fields={[{key:"minutes",label:"Duração preferida",kind:"integer",suffix:" min"},{key:"sessions",label:"Sessões por semana",kind:"integer"},{key:"time",label:"Horário preferido",kind:"select",options:timing},{key:"notes",label:"Observações de rotina",kind:"notes"}]} sourceKey={pref?.updated_at} blocked={blocked} run={run} validate={v=>!numeric(v.minutes,15,240,true)||!numeric(v.sessions,1,14,true)?"Informe minutos inteiros de 15–240 e sessões inteiras de 1–14, ou deixe vazio.":null} save={v=>m.savePreferences({preferred_session_minutes:num(v.minutes),preferred_sessions_per_week:num(v.sessions),training_time_preference:nullable(v.time),notes:nullable(v.notes)})}/>
   <Card data-testid="sx06-consents"><CardHeader className="px-3 pt-3 pb-2"><CardTitle className="text-base">Privacidade e consentimentos</CardTitle><p className="text-xs text-muted-foreground">Decisões independentes. Sem decisão não equivale a negar, conceder ou revogar.</p></CardHeader><CardContent className="space-y-2 px-3 pb-3">{consentLabels.map(item=>{const last=m.latestConsents[item.type];return <section key={item.type} className="space-y-2 rounded-lg border p-3"><p className="font-medium text-sm">{item.title}</p><p className="text-xs text-muted-foreground">{item.description}</p><p className="text-sm">{decisionLabel(last?.decision)}</p>{last?<p className="text-xs text-muted-foreground">{last.occurred_at} · política {last.policy_version}</p>:null}<div className="grid grid-cols-2 gap-2">{last?.decision!=="granted"?<Button className="min-h-11" variant="outline" disabled={blocked||Boolean(consent)} onClick={()=>setConsent({type:item.type,decision:"granted",previousId:last?.id??null})}>Conceder</Button>:null}{last?.decision==="granted"?<Button className="min-h-11" variant="outline" disabled={blocked||Boolean(consent)} onClick={()=>setConsent({type:item.type,decision:"revoked",previousId:last.id})}>Revogar</Button>:!last?<Button className="min-h-11" variant="outline" disabled={blocked||Boolean(consent)} onClick={()=>setConsent({type:item.type,decision:"denied",previousId:null})}>Negar</Button>:null}</div>{consent?.type===item.type?<div className="space-y-2 rounded-md border p-2"><p className="text-sm">Confirmar decisão: {decisionLabel(consent.decision).toLowerCase()}?</p><p className="text-xs">O evento anterior permanece registrado. Não implica exclusão retroativa de dados nem concessão de novas permissões.</p>{consentStale?<p role="alert" className="text-xs">A decisão anterior mudou. Cancele e confira.</p>:null}<div className="grid grid-cols-2 gap-2"><Button variant="outline" className="min-h-11" disabled={blocked} onClick={()=>setConsent(null)}>Cancelar</Button><Button className="min-h-11" disabled={blocked||consentStale} onClick={()=>void(async()=>{if(await run(()=>m.recordConsent(consent.type,consent.decision),"Decisão registrada."))setConsent(null);})()}>Confirmar decisão</Button></div></div>:null}</section>;})}<p className="text-xs text-muted-foreground">Registros de decisão M1 existentes; não representam política jurídica final nem habilitam E5, análise automática ou compartilhamento por si só.</p></CardContent></Card>
  </div>
 </div>;
}
