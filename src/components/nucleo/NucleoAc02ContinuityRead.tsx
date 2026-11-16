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
type ReadResponse={
 contract:string;
 module?:{id:string;code:string};
 ac02_assumption_export?:SafeExport;
};
const MAX_CHARS=100_000;
const isSafe=(value:unknown):value is SafeExport=>{
 if(!value||typeof value!=="object")return false;
 const p=value as Partial<SafeExport>;
 return p.kind==="nucleo_ac02_pacote_oficial_assuncao_rascunho"&&
  p.status==="rascunho_nao_homologado"&&p.privateSourcesIncluded===false&&
  typeof p.text==="string"&&p.text.length>0&&p.text.length<=MAX_CHARS&&
  Array.isArray(p.unresolved)&&p.unresolved.every(v=>typeof v==="string");
};
export default function NucleoAc02ContinuityRead({moduleId,moduleCode}:{
 moduleId:string;moduleCode:string;
}){
 const [busy,setBusy]=useState(false);
 const [draft,setDraft]=useState<SafeExport|null>(null);
 const [error,setError]=useState("");
 const [copied,setCopied]=useState(false);
 const counter=useRef(0);
 useEffect(()=>{
  counter.current++;setDraft(null);setError("");setCopied(false);setBusy(false);
  return ()=>{counter.current++;};
 },[moduleId,moduleCode]);
 async function prepare(){
  const id=++counter.current;
  setBusy(true);setError("");setDraft(null);setCopied(false);
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
      !isSafe(response.ac02_assumption_export)){
     throw new Error("Resposta de continuidade ausente, parcial ou incompatível; nenhum pacote preparado.");
   }
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
