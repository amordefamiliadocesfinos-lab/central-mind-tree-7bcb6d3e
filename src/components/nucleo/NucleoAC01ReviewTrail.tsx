import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import NucleoAC01DecisionIntake from "@/components/nucleo/NucleoAC01DecisionIntake";

type ReviewKind="comentario"|"solicitar_refinamento"|"minuta_consolidacao"|"encaminhar_decisao";
type ReviewRow={
 id:string;contribution_id:string;module_id:string;event_kind:ReviewKind;body:string;
 actor_auth_uid:string;recorded_at:string;request_id:string;
};
type ReviewDB=Omit<Database,"public">&{public:Omit<Database["public"],"Tables">&{
 Tables:Database["public"]["Tables"]&{nucleo_ac01_review_events:{
  Row:ReviewRow;Insert:Partial<ReviewRow>;Update:never;Relationships:[];
 }};
}};
const db=supabase as unknown as SupabaseClient<ReviewDB>;
const MAX=200;
const kinds:{value:ReviewKind;label:string}[]=[
 {value:"comentario",label:"Comentário de análise"},
 {value:"solicitar_refinamento",label:"Solicitar refinamento"},
 {value:"minuta_consolidacao",label:"Salvar minuta de consolidação não homologada"},
 {value:"encaminhar_decisao",label:"Encaminhar para decisão competente (não homologar)"},
];

export default function NucleoAC01ReviewTrail({
 moduleId,contributionId,initialDraft
}:{moduleId:string;contributionId:string;initialDraft?:string}){
 const [rows,setRows]=useState<ReviewRow[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [kind,setKind]=useState<ReviewKind>("comentario");
 const [body,setBody]=useState("");
 const [saving,setSaving]=useState(false);
 const [notice,setNotice]=useState("");
 const [revision,setRevision]=useState(0);
 const pendingRequest=useRef<string|null>(null);
 const uncertain=useRef(false);
 useEffect(()=>{
   setRows([]);setError("");setBody("");setKind("comentario");setNotice("");
   pendingRequest.current=null;uncertain.current=false;
 },[moduleId,contributionId]);
 useEffect(()=>{
   let active=true;setLoading(true);setError("");
   void db.from("nucleo_ac01_review_events").select("*")
     .eq("contribution_id",contributionId).eq("module_id",moduleId)
     .order("recorded_at",{ascending:true}).limit(MAX)
     .then(result=>{
       if(!active)return;
       if(result.error||!result.data||result.data.length>=MAX){
         setRows([]);
         setError("Histórico de análise indisponível ou parcial; não é seguro gravar nem concluir que não há eventos.");
       }else{
         setRows(result.data);
         if(uncertain.current&&pendingRequest.current){
           const match=result.data.find(r=>r.request_id===pendingRequest.current);
           if(match){
             uncertain.current=false;pendingRequest.current=null;
             setBody("");setNotice("Evento anterior localizado por request_id; releitura confirmada.");
           }else setNotice("Resultado anterior indeterminado: não repetir nem trocar o identificador automaticamente.");
         }
       }
       setLoading(false);
     }).catch(()=>{if(active){setRows([]);setError("Erro na leitura da trilha; consultar novamente.");setLoading(false);}});
   return()=>{active=false};
 },[contributionId,moduleId,revision]);
 const submit=async()=>{
   if(loading||error||saving||uncertain.current)return;
   const clean=body.trim();
   if(clean.length<12||clean.length>6000){setNotice("Informe entre 12 e 6.000 caracteres.");return;}
   if(!window.confirm("Registrar evento imutável de "+kinds.find(x=>x.value===kind)?.label+"? Isso NÃO é decisão, homologação ou atualização de vigência."))return;
   setSaving(true);setNotice("");
   const requestId=pendingRequest.current??crypto.randomUUID();
   pendingRequest.current=requestId;
   try{
     const result=await db.from("nucleo_ac01_review_events").insert({
       module_id:moduleId,contribution_id:contributionId,event_kind:kind,body:clean,request_id:requestId,
     }).select("*").maybeSingle();
     if(result.error||!result.data){
       uncertain.current=true;
       setNotice("Gravação não confirmada: estado indeterminado. Reconsultar por request_id antes de qualquer repetição.");
       return;
     }
     const check=await db.from("nucleo_ac01_review_events").select("*").eq("id",result.data.id).maybeSingle();
     if(check.error||!check.data||check.data.request_id!==requestId||
        check.data.module_id!==moduleId||check.data.contribution_id!==contributionId||
        check.data.event_kind!==kind||check.data.body!==clean){
       uncertain.current=true;setNotice("Insert retornou, mas o readback não confirmou o evento. Não repetir.");return;
     }
     pendingRequest.current=null;setBody("");
     setNotice("Evento persistido e confirmado por readback; documento não homologado.");
     setRevision(n=>n+1);
   }catch{
     uncertain.current=true;setNotice("Falha no transporte. Estado indeterminado; reconsultar antes de qualquer repetição.");
   }finally{setSaving(false);}
 };
 return <div className="space-y-2 rounded-md border p-3" aria-label="Trilha governada de refinamento AC-01">
  <strong className="text-sm">Comentários, refinamentos e encaminhamentos</strong>
  <p className="text-xs text-muted-foreground">
   Histórico append-only desta revisão; identidade autenticada registrada pelo Core.
   Pedido de decisão não é decisão tomada. Nenhuma atualização da fonte vigente ocorre aqui.
  </p>
  <Button type="button" size="sm" variant="outline" disabled={loading||saving}
    onClick={()=>setRevision(n=>n+1)}>Reconsultar trilha</Button>
  {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
  {!loading&&!error&&<div className="space-y-2">
    {rows.length===0&&<p className="text-xs text-muted-foreground">Nenhum evento registrado nesta revisão.</p>}
    {rows.map(row=><div key={row.id} className="border-l-2 pl-3 text-xs space-y-1">
      <strong>{kinds.find(k=>k.value===row.event_kind)?.label??row.event_kind}</strong>
      <p className="whitespace-pre-wrap break-words">{row.body}</p>
      <p className="text-muted-foreground">Autoria autenticada: {row.actor_auth_uid.slice(0,8)}… · {new Date(row.recorded_at).toLocaleString("pt-BR")}</p>
    </div>)}
  </div>}
  {!loading&&!error&&<NucleoAC01DecisionIntake key={contributionId} moduleId={moduleId} contributionId={contributionId} referrals={rows.filter(r=>r.event_kind==="encaminhar_decisao").map(r=>({id:r.id,recorded_at:r.recorded_at}))}/>}
  <div className="space-y-2 rounded-md bg-muted/30 p-2">
   <label className="block text-xs">Tipo de evento
    <select value={kind} onChange={e=>setKind(e.target.value as ReviewKind)}
      className="w-full h-10 rounded-md border bg-background px-2"
      disabled={saving||loading||!!error||uncertain.current}>
      {kinds.map(k=><option key={k.value} value={k.value}>{k.label}</option>)}
    </select>
   </label>
   {initialDraft&&<Button size="sm" variant="outline" type="button"
     disabled={saving||loading||!!error||uncertain.current}
     onClick={()=>{setKind("minuta_consolidacao");setBody(initialDraft.slice(0,6000));}}>
      Usar minuta local preparada
    </Button>}
   <label className="block text-xs">Justificativa, comentário ou minuta (sem credenciais/conteúdo privado não autorizado)
     <Textarea rows={5} value={body} onChange={e=>setBody(e.target.value)}
       maxLength={6000} disabled={saving||loading||!!error||uncertain.current}/>
   </label>
   <Button size="sm" type="button" onClick={()=>void submit()}
    disabled={saving||loading||!!error||uncertain.current}>{saving?"Conferindo readback…":"Registrar evento e conferir no Core"}</Button>
   {notice&&<p role="status" className="text-xs">{notice}</p>}
  </div>
 </div>;
}
