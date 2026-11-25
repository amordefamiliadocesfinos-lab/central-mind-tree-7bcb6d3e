import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { preparedReferences } from "@/lib/nucleo/preparedReferences";
import { useAuth } from "@/contexts/AuthContext";

/**
 * AC-02 / CA-16/29 — consumidor funcional do endpoint protegido já existente.
 * Somente metadados e texto consultivo previamente expurgado pelo servidor;
 * exige autenticação real e nucleo_manage no backend. Não transmite a terceiros.
 */
type SafeExport={
 kind:"nucleo_ac02_pacote_oficial_assuncao_rascunho";
 status:"rascunho_nao_homologado";
 version:string;text:string;unresolved:string[];privateSourcesIncluded:false;
};
type RegistryItem={
  id:string;domain:string;label:string;value:string;
  validity:string;evidence:string;source:string;sourceVersion:string;
  checkedAt:string|null;visibility:"publico_nao_secreto";
  notes:string;
};
type RegistryObservation={
  id:string;recordId:string;value:string;status:"observado"|"falha"|"indeterminado";
  observedAt:string;source:string;sourceVersion:string;visibility:"publico_nao_secreto";
};
type RegistryProjection={
  kind:"nucleo_ac02_registro_mestre_consultivo";
  stable:RegistryItem[];observations:RegistryObservation[];
  conflicts:string[];missingChecks:string[];usageLimit:string;
};
type RegistryEnvelope={kind:"nucleo_ac02_assuncao_rascunho";global:RegistryProjection};
// Only the existing authenticated response; no new query, storage or portable export.
type LearningSection="FM-09"|"FM-10";
type LearningRevision={id:string;version:number;title:string;body:string;authority:string;evidence:string;recordedAt:string;sourcePresent:boolean};
type LearningView={section:LearningSection;state:"presente"|"ausente"|"indeterminado";revision?:LearningRevision};
export function readLearningSections(value:unknown,moduleId:string):LearningView[]{
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const record=(v:unknown):Record<string,unknown>|null=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:null;
 return (["FM-09","FM-10"] as const).map((section):LearningView=>{
  const unknown:LearningView={section,state:"indeterminado"};
  if(!Array.isArray(value)||value.length!==10)return unknown;
  const rows=value.map(record);
  if(rows.some(r=>!r)||new Set(rows.map(r=>r?.section_code)).size!==10||
    !rows.every(r=>typeof r?.section_code==="string"&&/^FM-(0[1-9]|10)$/.test(r.section_code)))return unknown;
  const row=rows.find(r=>r?.section_code===section);
  if(row?.state==="sem_registro"&&row.revision===null)return {section,state:"ausente"};
  const r=record(row?.revision);
  if(row?.state!=="registro_core"||!r||r.module_id!==moduleId||r.section_code!==section||
   typeof r.id!=="string"||!uuid.test(r.id)||typeof r.version_no!=="number"||!Number.isSafeInteger(r.version_no)||r.version_no<1||
   typeof r.title!=="string"||r.title.length>1000||typeof r.body!=="string"||r.body.length>100000||
   typeof r.authority_state!=="string"||!["rascunho","proposta","homologado","historico"].includes(r.authority_state)||
   typeof r.evidence_level!=="string"||!["declarado","codigo_verificado","uso_real_verificado","proposta","nao_verificado"].includes(r.evidence_level)||
   typeof r.recorded_at!=="string"||!Number.isFinite(Date.parse(r.recorded_at)))return unknown;
  return {section,state:"presente",revision:{id:r.id,version:r.version_no,title:r.title,body:r.body,authority:r.authority_state,evidence:r.evidence_level,recordedAt:r.recorded_at,sourcePresent:typeof r.source_reference==="string"&&r.source_reference.trim().length>0}};
 });
}

type ReadResponse={
 sections?:unknown;
 contract:string;
 module?:{id:string;code:string};
 ac02_assumption_export?:SafeExport;
 ac02?:RegistryEnvelope;
};
const MAX_CHARS=100_000;
const registryDomainNames:Record<string,string>={identidade:"Identidade",repositorio:"Código oficial",servico:"Serviços",ambiente:"Ambientes",diretriz:"Diretrizes"};
const handoffStages=["PREPARADO","DISPONIBILIZADO","ENTREGUE","RECEBIDO","ACEITO"] as const;
const isSafe=(value:unknown):value is SafeExport=>{
 if(!value||typeof value!=="object")return false;
 const p=value as Partial<SafeExport>;
 return p.kind==="nucleo_ac02_pacote_oficial_assuncao_rascunho"&&
  p.status==="rascunho_nao_homologado"&&p.privateSourcesIncluded===false&&
  typeof p.text==="string"&&p.text.length>0&&p.text.length<=MAX_CHARS&&
  Array.isArray(p.unresolved)&&p.unresolved.every(v=>typeof v==="string");
};
const isRegistry=(value:unknown):value is RegistryEnvelope=>{
 if(!value||typeof value!=="object")return false;
 const envelope=value as Partial<RegistryEnvelope>;
 const registry=envelope.global as Partial<RegistryProjection>|undefined;
 return envelope.kind==="nucleo_ac02_assuncao_rascunho"&&
  registry?.kind==="nucleo_ac02_registro_mestre_consultivo"&&
  Array.isArray(registry.stable)&&registry.stable.length>0&&registry.stable.length<=40&&
  registry.stable.every(row=>row.visibility==="publico_nao_secreto"&&typeof row.id==="string"&&
   typeof row.label==="string"&&typeof row.value==="string"&&typeof row.source==="string"&&
   typeof row.sourceVersion==="string"&&typeof row.notes==="string")&&
  Array.isArray(registry.observations)&&registry.observations.length<=60&&
  registry.observations.every(row=>row.visibility==="publico_nao_secreto"&&
   ["observado","falha","indeterminado"].includes(row.status)&&
   typeof row.recordId==="string"&&typeof row.value==="string"&&
   typeof row.observedAt==="string"&&typeof row.source==="string")&&
  Array.isArray(registry.conflicts)&&Array.isArray(registry.missingChecks);
};
// P3: expor somente a classe/status da falha autorizada. Nunca retornar tokens,
// payloads do Core ou texto livre da exceção para a tela.
function explainAc02ReadFailure(error:unknown):string {
 const value=error as {name?:unknown;context?:{status?:unknown}}|null;
 const name=value?.name;
 const status=value?.context?.status;
 if(name==="FunctionsFetchError")return "AC-02: falha de rede ao alcançar a função protegida. Conferir conexão e endpoint implantado; consulta não comprovada.";
 if(name==="FunctionsRelayError")return "AC-02: gateway da função indisponível. Conferir implantação e logs do endpoint; consulta não comprovada.";
 if(name==="FunctionsHttpError"){
  if(status===401)return "AC-02: HTTP 401 — sessão ou JWT recusado pela função. Conferir autenticação na mesma sessão; nenhum pacote preparado.";
  if(status===403)return "AC-02: HTTP 403 — permissão nucleo_manage não confirmada ou negada. Conferir concessão vigente com a autoridade competente; não alterar permissões aqui.";
  if(status===404)return "AC-02: HTTP 404 — função ou módulo não localizado. Conferir endpoint implantado e cadastro M3 do CRM, sem presumir qual falhou.";
  if(status===400||status===413)return "AC-02: requisição rejeitada pelo contrato (HTTP "+status+"). Conferir módulo e versão da função implantada.";
  if(status===503||status===500)return "AC-02: serviço ou leitura protegida indisponível (HTTP "+status+"). Conferir logs da função, configuração e recorte autorizado; nenhum dado certificado.";
  return "AC-02: função respondeu com falha HTTP "+(typeof status==="number"?status:"não identificada")+". Conferir status e logs sem liberar autoridade.";
 }
 return "AC-02: falha não classificada na consulta protegida. Conferir sessão, rede e implantação; nenhum pacote preparado.";
}
// Apenas classes textuais documentadas na função oficial; jamais exibir
// o corpo bruto da resposta HTTP, que pode conter dados de infraestrutura.
async function classifyAc02ContractRejection(error:unknown):Promise<string|null>{
 const candidate=error as {name?:unknown;context?:unknown}|null;
 if(candidate?.name!=="FunctionsHttpError"||!(candidate.context instanceof Response)||
    candidate.context.status!==400)return null;
 const response=candidate.context;
 const length=Number(response.headers.get("content-length")??"0");
 if(length>2048||!response.headers.get("content-type")?.includes("application/json"))return null;
 try{
  const parsed:unknown=await response.clone().json();
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return null;
  const reason=(parsed as {error?:unknown}).error;
  switch(reason){
   case "JSON inválido":return "Validação identificada: JSON inválido na função.";
   case "Corpo inválido":return "Validação identificada: corpo JSON incompatível.";
   case "Informe module_code válido e opções booleanas include_review/include_ac02":
    return "Validação identificada: módulo, opções ou versão de contrato incompatíveis.";
   case "Utilize módulo operacional externo":
    return "Validação identificada: módulo NUC recusado pelo contrato.";
   default:return "Validação HTTP 400 não reconhecida neste contrato; confrontar a revisão implantada e os logs autorizados.";
  }
 }catch{return null;}
}
export default function NucleoAc02ContinuityRead({moduleId,moduleCode,onViewWorkstreams,onViewDocuments,onViewMandates,onViewResume,onViewLearning}:{
 moduleId:string;moduleCode:string;
 onViewWorkstreams?:()=>void;onViewDocuments?:()=>void;onViewMandates?:()=>void;
 onViewResume?:()=>void;onViewLearning?:(section:LearningSection)=>void;
}){
 const {session,loading}=useAuth();
 const sessionUid=loading?null:session?.user?.id??null;
 const scopeRef=useRef({sessionUid,moduleId,moduleCode});
 scopeRef.current={sessionUid,moduleId,moduleCode};
 const [owner,setOwner]=useState<{uid:string;moduleId:string;moduleCode:string}|null>(null);
 const [busy,setBusy]=useState(false);
 const [draft,setDraft]=useState<SafeExport|null>(null);
 const [registry,setRegistry]=useState<RegistryProjection|null>(null);
 const [learning,setLearning]=useState<LearningView[]>([]);
 const [error,setError]=useState("");
 const [copied,setCopied]=useState(false);
 const counter=useRef(0);
 const visibleDraft=owner?.uid===sessionUid&&owner?.moduleId===moduleId&&owner?.moduleCode===moduleCode?draft:null;
 const sources=visibleDraft?preparedReferences.filter(p=>p.moduleId===moduleId):[];
 useEffect(()=>{
  counter.current++;setOwner(null);setDraft(null);setRegistry(null);setLearning([]);setError("");setCopied(false);setBusy(false);
  return ()=>{counter.current++;};
 },[moduleId,moduleCode,sessionUid]);
 async function prepare(){
  const id=++counter.current;
  setBusy(true);setError("");setOwner(null);setDraft(null);setRegistry(null);setLearning([]);setCopied(false);
  try{
   if(!/^[A-Z]{3}$/.test(moduleCode)||moduleCode==="NUC")throw new Error("Módulo incompatível com o contrato consultivo.");
   const user=await supabase.auth.getUser();
   if(id!==counter.current)return;
   if(!sessionUid||user.error||user.data.user?.id!==sessionUid)throw new Error("Sessão pessoal não comprovada.");
   const {data,error:invokeError}=await supabase.functions.invoke("nucleo-knowledge-read",{
    body:{module_code:moduleCode,include_ac02:true,include_assumption_export:true},
   });
   if(id!==counter.current)return;
   if(invokeError){
     const classification=await classifyAc02ContractRejection(invokeError);
     if(id!==counter.current)return;
     throw new Error(explainAc02ReadFailure(invokeError)+(classification?" "+classification:""));
    }
   const response=data as ReadResponse|null;
   if(response?.contract!=="nucleo_a_plus_ca16_ca18_v1"||
      response.module?.id!==moduleId||response.module.code!==moduleCode||
      !isSafe(response.ac02_assumption_export)||!isRegistry(response.ac02)){
     throw new Error("Resposta de continuidade ausente, parcial ou incompatível; nenhum pacote preparado.");
   }
   const current=await supabase.auth.getUser();
   if(id!==counter.current||scopeRef.current.sessionUid!==sessionUid||scopeRef.current.moduleId!==moduleId||scopeRef.current.moduleCode!==moduleCode)return;
   if(current.error||current.data.user?.id!==sessionUid)throw new Error("Identidade da consulta não confirmada.");
   setOwner({uid:sessionUid,moduleId,moduleCode});
   setRegistry(response.ac02.global);
   setLearning(readLearningSections(response.sections,moduleId));
   setDraft(response.ac02_assumption_export);
  }catch(e){
   if(id===counter.current)setError(e instanceof Error?e.message:"Falha indeterminada ao consultar o Core.");
  }finally{
   if(id===counter.current)setBusy(false);
  }
 }
 async function copy(){
  if(!draft||!visibleDraft||!sessionUid)return;
  setCopied(false);
  try{
   const current=await supabase.auth.getUser();
   if(current.error||current.data.user?.id!==sessionUid||scopeRef.current.sessionUid!==sessionUid||scopeRef.current.moduleId!==moduleId||scopeRef.current.moduleCode!==moduleCode)return;
   await navigator.clipboard.writeText(draft.text);
   setCopied(true);
  }catch{
   setError("Não foi possível copiar. O rascunho continua disponível para revisão manual nesta sessão.");
  }
 }
 return <section id="nucleo-ac02-module-context" tabIndex={-1} className="rounded-md border p-3 space-y-3 scroll-mt-28 focus-visible:ring-2 focus-visible:ring-ring" aria-label="Continuidade do especialista AC-02">
  <div className="flex flex-wrap gap-2 items-center justify-between">
   <h5 className="font-semibold text-sm">Continuidade do especialista · AC-02</h5>
   <Badge variant="outline">Rascunho consultivo, não mandato</Badge>
  </div>
  <p className="text-xs text-muted-foreground">
   Consulta o Core pela sessão autenticada e concessão nucleo_manage. Não concede acesso,
   não transmite conteúdo automaticamente e não certifica fontes, método ou recebimento.
  </p>
  <Button type="button" className="min-h-11" onClick={prepare} disabled={busy}>
   {busy?"Consultando Core…":"Preparar contexto de continuidade"}
  </Button>
  <nav aria-label="Conferir contexto antes da assunção" className="rounded-md border p-3 space-y-2">
   <p className="text-xs font-semibold">Localizar o contexto para continuar</p>
   <p className="text-xs text-muted-foreground">
    Consulte o último checkpoint e a próxima ação nas frentes M3, as versões em AC-01 e os limites de mandato.
    Esses registros precisam ser conferidos na fonte; nenhum é declarado aceito por esta navegação.
   </p>
   <div className="flex flex-wrap gap-2">
    {onViewWorkstreams&&<Button type="button" size="sm" variant="outline" onClick={onViewWorkstreams}>Frentes e checkpoints M3</Button>}
    {onViewDocuments&&<Button type="button" size="sm" variant="outline" onClick={onViewDocuments}>Documentos e versões AC-01</Button>}
    {onViewMandates&&<Button type="button" size="sm" variant="outline" onClick={onViewMandates}>Mandatos e limites</Button>}
   </div>
  </nav>
  {busy&&<p role="status" className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
    Consultando contexto AC-02 no Core. O resultado ainda não foi validado e nenhum pacote foi preparado.
  </p>}
  {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
  {visibleDraft&&draft&&<div className="space-y-3">
   <p role="status" className="text-xs">
    Contexto recebido do endpoint. {draft.unresolved.length} ressalva(s) de continuidade.
    O texto permanece NÃO HOMOLOGADO até verificação humana.
   </p>
   {registry&&<div className="space-y-3 rounded-xl border border-[#d2e3fc] bg-[#f5f9ff] p-3 dark:border-blue-900 dark:bg-blue-950/20"
       aria-label="Registro Mestre AC-02 — identidade e verificação">
     <div>
       <p className="text-sm font-semibold text-[#174ea6] dark:text-blue-200">Registro Mestre do ecossistema · AC-02</p>
       <p className="mt-1 text-xs text-muted-foreground">
         Metadados não secretos autorizados; identidade declarada pela Camada Mestre é diferente de situação técnica verificada.
       </p>
     </div>
     <div className="grid gap-2 sm:grid-cols-2">
       {registry.stable.map(row=>{
         const observations=registry.observations.filter(observation=>observation.recordId===row.id);
         return <div key={row.id} className="min-w-0 rounded-lg border bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900">
           <p className="font-semibold text-sm">{row.label}</p>
           <p className="mt-1 break-all font-medium">{row.value}</p>
           <p className="mt-1 text-muted-foreground">Fonte declarada: {row.sourceVersion} · {row.validity==="declarado_oficial"?"Oficial declarado":row.validity}</p>
           {observations.map(item=><div key={item.id} className="mt-2 rounded-lg border border-[#dce5f1] bg-[#f5f9ff] p-2 dark:border-slate-700 dark:bg-slate-800">
             <p className="font-medium">Verificação independente: {item.status==="observado"?"Observação técnica datada":item.status==="falha"?"Falha de consulta":"Indeterminada"}</p>
             <p className="break-all">Valor observado: {item.value}</p>
             <p className="text-muted-foreground">Fonte: {item.sourceVersion} · {new Date(item.observedAt).toLocaleString("pt-BR")}</p>
           </div>)}
           {observations.length===0&&<p className="mt-2 text-muted-foreground">Sem verificação dinâmica nesta leitura.</p>}
           <details className="mt-2">
             <summary className="cursor-pointer font-medium">Fonte e limites</summary>
             <p className="mt-1 break-words">{row.notes}</p>
             <p className="mt-1 break-all">{row.source}</p>
           </details>
           <p className="mt-1 text-muted-foreground">{registryDomainNames[row.domain]||"Outro domínio"}</p>
         </div>;
       })}
     </div>
     {(registry.conflicts.length>0||registry.missingChecks.length>0)&&
       <details className="rounded-lg border border-amber-300 p-3 text-xs dark:border-amber-800">
         <summary className="cursor-pointer font-semibold">Divergências e conferências pendentes</summary>
         <ul className="mt-2 list-disc space-y-1 pl-5">
           {[...registry.conflicts,...registry.missingChecks].map((entry,index)=><li key={index}>{entry}</li>)}
         </ul>
       </details>}
     <p className="text-xs text-muted-foreground">{registry.usageLimit}</p>
   </div>}
   <section className="rounded-md border p-3 space-y-3" aria-label="Experiências e checkpoints F5">
    <h6 className="font-semibold text-sm">Evolução e aprendizagem · F5</h6>
    <p className="text-xs text-muted-foreground">Revisões retornadas pela leitura autorizada do Core. O conteúdo consultado nesta sessão não integra o pacote portátil. Estado e evidência são declarados na revisão, não verificados por este painel.</p>
    {learning.map(item=><article key={item.section} className="rounded-md border p-2 space-y-2 text-xs">
     <p className="font-semibold">{item.section} · {item.section==="FM-09"?"Evolução e checkpoint":"Erros, acertos e aprendizagem"}</p>
     {item.state==="ausente"&&<p>Sem revisão retornada neste recorte autorizado; não significa ausência global de conhecimento.</p>}
     {item.state==="indeterminado"&&<p>Leitura ausente ou incompatível. Consulte a Ficha Viva na origem.</p>}
     {item.revision&&<>
      <p className="font-medium">{item.revision.title} · v{item.revision.version}</p>
      <p>Autoridade declarada: {item.revision.authority} · Evidência declarada: {item.revision.evidence}</p>
      <p className="break-all">Revisão {item.revision.id} · {new Date(item.revision.recordedAt).toLocaleString("pt-BR")}</p>
      <p>Referência de origem: {item.revision.sourcePresent?"preenchida, conferir na Ficha Viva":"ausente na revisão"}</p>
      <details><summary className="cursor-pointer font-medium">Ler conteúdo original da revisão retornada</summary>
       <p className="whitespace-pre-wrap break-words max-h-80 overflow-auto mt-2">{item.revision.body}</p>
      </details>
     </>}
     {onViewLearning&&<Button type="button" size="sm" variant="outline" onClick={()=>onViewLearning(item.section)}>Abrir seção {item.section} e versões na Ficha Viva</Button>}
    </article>)}
    <p className="text-xs text-muted-foreground">Confronte FM-09/10 com fatos M3/M4 e versões anteriores antes de reutilizar uma lição ou retomar uma frente. Nenhuma decisão ou aceite é inferido.</p>
    {onViewWorkstreams&&<Button type="button" variant="outline" size="sm" onClick={onViewWorkstreams}>Conferir frentes e evidências M3/M4</Button>}
    {onViewResume&&<Button type="button" variant="outline" size="sm" onClick={onViewResume}>Retomar próximas ações registradas</Button>}
   </section>
   <details className="rounded-md border p-3 space-y-2" aria-label="Índice consultivo de fontes versionadas">
    <summary className="cursor-pointer text-sm font-semibold">Fontes versionadas para recuperar conhecimento</summary>
    <p className="text-xs text-muted-foreground">Catálogo estático de referências preparadas, separado do pacote oficial. Os links identificam commits e os checksums registram a origem inventariada. Não certificam vigência, leitura atual, permissão externa ou registro AC-01 nesta consulta.</p>
    {sources.length===0?<p className="text-xs">Nenhuma referência preparada neste catálogo para o módulo. Consulte AC-01; não significa ausência de fontes.</p>:
     <ul className="space-y-2">{sources.map(ref=><li key={ref.requestId} className="rounded-md border p-2 text-xs space-y-1">
       <a className="font-semibold underline break-words" href={ref.locator} target="_blank" rel="noopener noreferrer">{ref.title}</a>
       <p className="break-all">SHA-256 inventariado: {ref.checksum}</p>
       <p className="text-muted-foreground">{ref.note}</p>
     </li>)}</ul>}
    <p className="text-xs text-muted-foreground">Abra a origem com sua própria autorização; confira método, versões, FM-09/10 e decisões no Core. Nenhum conteúdo privado é copiado ou transferido por este índice.</p>
   </details>
   <section aria-label="Etapas de assunção — comprovações" className="rounded-xl border p-3">
     <h6 className="text-sm font-semibold">Situação do Pacote Oficial de Assunção</h6>
     <p className="text-xs text-muted-foreground">Preparação é somente um rascunho da sessão. Não existe aqui registro de disponibilização, entrega, recebimento ou aceite.</p>
     <ol className="mt-2 grid gap-2 sm:grid-cols-5">
       {handoffStages.map((stage,index)=><li key={stage}
         className={"rounded-lg border p-2 text-xs "+(index===0?"border-blue-200 bg-[#e8f0fe] text-[#174ea6] dark:border-blue-900 dark:bg-blue-950":"bg-muted/20")}>
         <p className="font-semibold">{index+1}. {stage}</p>
         <p className="mt-1">{index===0?"Rascunho gerado nesta sessão — não homologado":"Não comprovado pelo backend consultado"}</p>
       </li>)}
     </ol>
   </section>
   {draft.unresolved.length>0&&<details className="rounded-md border p-2 text-xs">
    <summary className="font-semibold cursor-pointer">Ver pendências e limites</summary>
    <ul className="list-disc pl-5 mt-2 space-y-1">
     {draft.unresolved.map((line,index)=><li key={index}>{line}</li>)}
    </ul>
   </details>}
   <label className="block space-y-1">
    <span className="text-xs font-semibold">Pacote para revisão humana — sem fontes privadas</span>
    <textarea readOnly rows={9} value={draft.text}
     className="w-full rounded-md border bg-muted/20 p-2 text-xs font-mono leading-relaxed"
     aria-label="Rascunho de continuidade para revisão"/>
   </label>
   <Button type="button" size="sm" variant="outline" onClick={()=>{void copy();}}>
    Copiar rascunho revisado
   </Button>
   {copied&&<p role="status" className="text-xs text-muted-foreground">
    Texto copiado localmente por ação explícita. Recebimento e aceite NÃO comprovados.
   </p>}
  </div>}
 </section>;
}
