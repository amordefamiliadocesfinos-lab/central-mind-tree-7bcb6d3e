import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type DecisionAct={
 id:string;contribution_id:string;decision_request_id:string;
 outcome:string;decided_by_auth_uid:string;authority_decision_ref:string;recorded_at:string;
};
type Publication={
 id:string;contribution_id:string;decision_act_id:string;previous_publication_id:string|null;
 executed_by_auth_uid:string;recorded_at:string;
};
type AuthorityDB=Omit<Database,"public">&{public:Omit<Database["public"],"Tables">&{
 Tables:Database["public"]["Tables"]&{
 nucleo_ac01_decision_acts:{Row:DecisionAct;Insert:never;Update:never;Relationships:[]};
 nucleo_ac01_publication_events:{Row:Publication;Insert:never;Update:never;Relationships:[]};
 };}};
const db=supabase as unknown as SupabaseClient<AuthorityDB>;
export default function NucleoAC01DecisionStatus({
 contributionId
}:{contributionId:string}){
 const [acts,setActs]=useState<DecisionAct[]>([]);
 const [publications,setPublications]=useState<Publication[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let alive=true;setLoading(true);setError("");setActs([]);setPublications([]);
  void Promise.all([
   db.from("nucleo_ac01_decision_acts").select("*").eq("contribution_id",contributionId).limit(100),
   db.from("nucleo_ac01_publication_events").select("*").eq("contribution_id",contributionId).limit(100),
  ]).then(([d,p])=>{
   if(!alive)return;
   if(d.error||p.error||!d.data||!p.data||d.data.length>=100||p.data.length>=100)
    setError("Situação decisória indisponível/parcial. Não inferir ausência de atos ou vigência.");
   else {setActs(d.data);setPublications(p.data);}
   setLoading(false);
  }).catch(()=>{if(alive){setError("Consulta interrompida; não inferir estado de vigência.");setLoading(false);}});
  return()=>{alive=false};
 },[contributionId,refresh]);
 return <div className="border rounded p-3 space-y-2" aria-label="Decisão e publicação AC-01 em consulta">
  <div className="flex items-center justify-between gap-2">
   <strong className="text-sm">Decisão competente / publicação</strong>
   <Button type="button" size="sm" variant="outline" disabled={loading} onClick={()=>setRefresh(n=>n+1)}>Reconsultar</Button>
  </div>
  <p className="text-xs text-muted-foreground">
   Atos distintos. A publicação interna AC-01 não altera nem substitui automaticamente o método vigente de outra fonte.
   Este painel é apenas de leitura; nenhuma capacidade de aprovação é dada por nucleo_manage.
  </p>
  {loading?<p className="text-xs">Consultando atos…</p>:error?<p role="alert" className="text-xs text-destructive">{error}</p>:<>
   {acts.length===0&&<Badge variant="outline">Nenhum ato decisório registrado nesta versão</Badge>}
   {acts.map(d=><div className="text-xs border-l-2 pl-2" key={d.id}>
    <p><strong>{d.outcome}</strong> · {new Date(d.recorded_at).toLocaleString("pt-BR")}</p>
    <p>Decisor autenticado: {d.decided_by_auth_uid.slice(0,8)}… · Prova: {d.authority_decision_ref}</p>
   </div>)}
   {publications.length===0&&<p className="text-xs text-muted-foreground">
    Nenhuma publicação interna AC-01 para esta versão; a vigência das fontes externas não pode ser inferida.
   </p>}
   {publications.map(p=><div key={p.id} className="text-xs border-l-2 pl-2">
    <p>Publicação registrada em {new Date(p.recorded_at).toLocaleString("pt-BR")}</p>
    <p>Executor autenticado: {p.executed_by_auth_uid.slice(0,8)}… · Histórico anterior: {p.previous_publication_id??"sem anterior registrado"}</p>
   </div>)}
  </>}
 </div>;
}
