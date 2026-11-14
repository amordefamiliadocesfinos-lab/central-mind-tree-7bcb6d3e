import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import NucleoAC01DecisionStatus from "@/components/nucleo/NucleoAC01DecisionStatus";

type DecisionRequest={
 id:string;contribution_id:string;module_id:string;review_event_id:string;
 requested_outcome:"avaliar_aprovacao"|"devolver_refinamento"|"avaliar_rejeicao";
 authority_source_locator:string;authority_decision_ref:string;justification:string;
 candidate_decider_auth_uid:string|null;submitter_auth_uid:string;request_id:string;recorded_at:string;
};
type DecisionDB=Omit<Database,"public">&{public:Omit<Database["public"],"Tables">&{
 Tables:Database["public"]["Tables"]&{nucleo_ac01_decision_requests:{
 Row:DecisionRequest;Insert:Partial<DecisionRequest>;Update:never;Relationships:[];
 }};}};
const db=supabase as unknown as SupabaseClient<DecisionDB>;
export default function NucleoAC01DecisionIntake({
 moduleId,contributionId,referrals,
}:{moduleId:string;contributionId:string;referrals:Array<{id:string;recorded_at:string}>}){
 const [rows,setRows]=useState<DecisionRequest[]>([]);
 const [reading,setReading]=useState(true);
 const [error,setError]=useState("");
 const [referral,setReferral]=useState("");
 const [outcome,setOutcome]=useState<DecisionRequest["requested_outcome"]>("avaliar_aprovacao");
 const [authority,setAuthority]=useState("");
 const [evidence,setEvidence]=useState("");
 const [justification,setJustification]=useState("");
 const [saving,setSaving]=useState(false);
 const [feedback,setFeedback]=useState("");
 const [tick,setTick]=useState(0);
 const requestRef=useRef<string|null>(null);
 const uncertain=useRef(false);
 useEffect(()=>{setRows([]);setReferral("");setAuthority("");setEvidence("");
 setJustification("");setFeedback("");requestRef.current=null;uncertain.current=false;},[moduleId,contributionId]);
 useEffect(()=>{
  let active=true;setReading(true);setError("");setRows([]);
  void db.from("nucleo_ac01_decision_requests").select("*")
    .eq("module_id",moduleId).eq("contribution_id",contributionId)
    .order("recorded_at",{ascending:false}).limit(100)
    .then(result=>{
     if(!active)return;
     if(result.error||!result.data||result.data.length>=100){
      setError("Histórico de solicitações indisponível/parcial; nenhuma nova solicitação liberada.");
     }else{
      setRows(result.data);
      if(uncertain.current&&requestRef.current){
       if(result.data.some(x=>x.request_id===requestRef.current)){
        uncertain.current=false;requestRef.current=null;setFeedback("Solicitação anterior localizada e reconciliada.");
        setJustification("");
       }else setFeedback("Solicitação anterior ainda indeterminada. Não reenviar com outro identificador.");
      }
     }
     setReading(false);
    }).catch(()=>{if(active){setError("Falha de leitura. Reconsultar antes de escrever.");setReading(false);}});
  return ()=>{active=false};
 },[moduleId,contributionId,tick]);
 const save=async()=>{
  const clean=justification.trim(),source=authority.trim();
  if(saving||reading||error||uncertain.current)return;
  if(!referrals.some(r=>r.id===referral)||source.length<8||source.length>1500||
   clean.length<20||clean.length>4000||evidence.length>800){
   setFeedback("Selecione encaminhamento existente e informe fonte da autoridade (8–1500) e justificativa (20–4000).");return;
  }
  if(!window.confirm("REGISTRAR SOMENTE SOLICITAÇÃO PARA DECISÃO? Não é autorização, decisão, homologação ou atualização de vigência."))return;
  setSaving(true);setFeedback("");
  const requestId=requestRef.current??crypto.randomUUID();requestRef.current=requestId;
  try{
   const insert=await db.from("nucleo_ac01_decision_requests").insert({
    contribution_id:contributionId,module_id:moduleId,review_event_id:referral,
    requested_outcome:outcome,authority_source_locator:source,
    authority_decision_ref:evidence.trim(),justification:clean,
    candidate_decider_auth_uid:null,request_id:requestId,
   }).select("*").maybeSingle();
   if(insert.error||!insert.data){uncertain.current=true;setFeedback("Gravação indeterminada. Reconsultar; não duplicar.");return;}
   const check=await db.from("nucleo_ac01_decision_requests").select("*").eq("id",insert.data.id).maybeSingle();
   if(check.error||!check.data||check.data.request_id!==requestId||
     check.data.contribution_id!==contributionId||check.data.module_id!==moduleId||
     check.data.review_event_id!==referral||check.data.requested_outcome!==outcome){
    uncertain.current=true;setFeedback("Readback inconsistente; não repetir.");return;
   }
   requestRef.current=null;setJustification("");
   setFeedback("Solicitação registrada e confirmada. A decisão competente continua pendente.");
   setTick(n=>n+1);
  }catch{uncertain.current=true;setFeedback("Transporte interrompido; resultado indeterminado.");}
  finally{setSaving(false);}
 };
 return <section className="space-y-3 rounded border p-3" aria-label="Solicitação governada de decisão AC-01">
  <NucleoAC01DecisionStatus contributionId={contributionId}/>
  <h6 className="text-sm font-semibold">Solicitações para decisão competente — não homologadas</h6>
  <p className="text-xs text-muted-foreground">O gestor pode instruir a solicitação, mas acesso ao Núcleo não confere poder de homologação. A autoridade decisora e o ato formal serão verificados por contrato separado. Nenhum documento será promovido aqui.</p>
  <Button size="sm" type="button" variant="outline" disabled={reading||saving} onClick={()=>setTick(n=>n+1)}>Reconsultar solicitações</Button>
  {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
  {!reading&&!error&&<div className="space-y-1">
   {rows.length===0&&<p className="text-xs text-muted-foreground">Nenhuma solicitação formal registrada nesta revisão.</p>}
   {rows.map(r=><div key={r.id} className="border-l-2 pl-3 text-xs">
    <p><strong>Solicitação pendente</strong> · {r.requested_outcome.replaceAll("_"," ")}</p>
    <p className="break-words">{r.justification}</p>
    <p className="text-muted-foreground">Autor: {r.submitter_auth_uid.slice(0,8)}… · {new Date(r.recorded_at).toLocaleString("pt-BR")}</p>
    <p className="break-all">Fonte declarada da autoridade: {r.authority_source_locator}</p>
   </div>)}
  </div>}
  <div className="space-y-2">
   <label className="block text-xs">Encaminhamento de origem
    <select value={referral} disabled={reading||!!error||saving||uncertain.current}
     onChange={e=>setReferral(e.target.value)} className="w-full h-10 rounded border bg-background px-2">
     <option value="">Selecione evento de encaminhamento confirmado</option>
     {referrals.map(r=><option key={r.id} value={r.id}>{new Date(r.recorded_at).toLocaleString("pt-BR")} · {r.id.slice(0,8)}</option>)}
    </select>
   </label>
   <label className="block text-xs">Parecer solicitado
    <select value={outcome} disabled={reading||!!error||saving||uncertain.current}
      onChange={e=>setOutcome(e.target.value as DecisionRequest["requested_outcome"])}
      className="w-full h-10 rounded border bg-background px-2">
     <option value="avaliar_aprovacao">Solicitar avaliação de aprovação</option>
     <option value="devolver_refinamento">Solicitar devolução para refinamento</option>
     <option value="avaliar_rejeicao">Solicitar avaliação de rejeição</option>
    </select>
   </label>
   <label className="block text-xs">Fonte declarada da autoridade competente (não equivale à prova)
    <Input value={authority} onChange={e=>setAuthority(e.target.value)} maxLength={1500}
      disabled={reading||!!error||saving||uncertain.current}/>
   </label>
   <label className="block text-xs">Referência de decisão pré-existente, se houver
    <Input value={evidence} onChange={e=>setEvidence(e.target.value)} maxLength={800}
      disabled={reading||!!error||saving||uncertain.current}/>
   </label>
   <label className="block text-xs">Justificativa para apreciação humana
    <Textarea rows={4} value={justification} onChange={e=>setJustification(e.target.value)}
      maxLength={4000} disabled={reading||!!error||saving||uncertain.current}/>
   </label>
   <Button size="sm" type="button" disabled={reading||!!error||saving||uncertain.current||!referrals.length}
     onClick={()=>void save()}>{saving?"Conferindo persistência…":"Registrar solicitação (sem decidir)"}</Button>
   {feedback&&<p role="status" className="text-xs">{feedback}</p>}
  </div>
 </section>;
}
