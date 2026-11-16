import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
type ReadResponse={
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
export default function NucleoAc02ContinuityRead({moduleId,moduleCode}:{
 moduleId:string;moduleCode:string;
}){
 const [busy,setBusy]=useState(false);
 const [draft,setDraft]=useState<SafeExport|null>(null);
 const [registry,setRegistry]=useState<RegistryProjection|null>(null);
 const [error,setError]=useState("");
 const [copied,setCopied]=useState(false);
 const counter=useRef(0);
 useEffect(()=>{
  counter.current++;setDraft(null);setRegistry(null);setError("");setCopied(false);setBusy(false);
  return ()=>{counter.current++;};
 },[moduleId,moduleCode]);
 async function prepare(){
  const id=++counter.current;
  setBusy(true);setError("");setDraft(null);setRegistry(null);setCopied(false);
  try{
   if(!/^[A-Z]{3}$/.test(moduleCode)||moduleCode==="NUC")throw new Error("Módulo incompatível com o contrato consultivo.");
   const {data,error:invokeError}=await supabase.functions.invoke("nucleo-knowledge-read",{
    body:{module_code:moduleCode,include_ac02:true,include_assumption_export:true},
   });
   if(id!==counter.current)return;
   if(invokeError)throw new Error("Consulta protegida indisponível ou não autorizada. Confirme sessão, permissão e implantação no Cloud.");
   const response=data as ReadResponse|null;
   if(response?.contract!=="nucleo_a_plus_ca16_ca18_v1"||
      response.module?.id!==moduleId||response.module.code!==moduleCode||
      !isSafe(response.ac02_assumption_export)||!isRegistry(response.ac02)){
     throw new Error("Resposta de continuidade ausente, parcial ou incompatível; nenhum pacote preparado.");
   }
   setRegistry(response.ac02.global);
   setDraft(response.ac02_assumption_export);
  }catch(e){
   if(id===counter.current)setError(e instanceof Error?e.message:"Falha indeterminada ao consultar o Core.");
  }finally{
   if(id===counter.current)setBusy(false);
  }
 }
 async function copy(){
  if(!draft)return;
  setCopied(false);
  try{
   await navigator.clipboard.writeText(draft.text);
   setCopied(true);
  }catch{
   setError("Não foi possível copiar. O rascunho continua disponível para revisão manual nesta sessão.");
  }
 }
 return <section className="rounded-md border p-3 space-y-3" aria-label="Continuidade do especialista AC-02">
  <div className="flex flex-wrap gap-2 items-center justify-between">
   <h5 className="font-semibold text-sm">Continuidade do especialista · AC-02</h5>
   <Badge variant="outline">Rascunho consultivo, não mandato</Badge>
  </div>
  <p className="text-xs text-muted-foreground">
   Consulta o Core pela sessão autenticada e concessão nucleo_manage. Não concede acesso,
   não transmite conteúdo automaticamente e não certifica fontes, método ou recebimento.
  </p>
  <Button type="button" size="sm" variant="outline" onClick={prepare} disabled={busy}>
   {busy?"Consultando Core…":"Preparar contexto de continuidade"}
  </Button>
  {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
  {draft&&<div className="space-y-3">
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
