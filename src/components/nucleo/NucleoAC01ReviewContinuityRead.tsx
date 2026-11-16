import { useEffect,useMemo,useState } from "react";
import type {SupabaseClient} from "@supabase/supabase-js";
import {supabase} from "@/integrations/supabase/client";
import type {Database} from "@/integrations/supabase/types";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {REVIEW_EVENT_LABELS_V13,summarizeAc01ReviewContinuity,type ReviewEventV13}
 from "@/lib/nucleo/ac01ReviewContinuityV13";

type ReadDB=Omit<Database,"public">&{public:Omit<Database["public"],"Tables">&{
 Tables:Database["public"]["Tables"]&{nucleo_ac01_review_events:{
 Row:ReviewEventV13;Insert:never;Update:never;Relationships:[];
 }};
}};
const db=supabase as unknown as SupabaseClient<ReadDB>;
const LIMIT=200;

/** Só consulta a revisão selecionada sob RLS; não replica o escritor da trilha. */
export default function NucleoAC01ReviewContinuityRead({
 moduleId,contributionId,
}:{moduleId:string;contributionId:string}){
 const [records,setRecords]=useState<ReviewEventV13[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [readAt,setReadAt]=useState("");
 useEffect(()=>{
  let active=true;
  setRecords([]);setLoading(true);setError("");setReadAt("");
  void db.from("nucleo_ac01_review_events").select("*")
   .eq("module_id",moduleId).eq("contribution_id",contributionId)
   .order("recorded_at",{ascending:true}).limit(LIMIT)
   .then(result=>{
    if(!active)return;
    if(result.error||!result.data||result.data.length>=LIMIT){
     setError("Trilha indisponível ou recorte parcial. Nenhuma conclusão documental pode ser inferida.");
    }else{
     setRecords(result.data);setReadAt(new Date().toISOString());
    }
    setLoading(false);
   }).catch(()=>{if(active){setError("Leitura interrompida; reconsulte a trilha.");setLoading(false);}});
  return()=>{active=false};
 },[moduleId,contributionId,refresh]);
 const summary=useMemo(()=>summarizeAc01ReviewContinuity(moduleId,contributionId,records),
  [moduleId,contributionId,records]);
 return <section className="rounded-md border p-3 space-y-2"
  aria-label="Acompanhamento somente leitura da revisão independente AC-01">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <h5 className="text-sm font-semibold">Trilha de revisão da contribuição selecionada</h5>
   <Button type="button" variant="outline" size="sm" disabled={loading}
    onClick={()=>setRefresh(n=>n+1)}>Reconsultar trilha</Button>
  </div>
  <p className="text-xs text-muted-foreground">
   Leitura RLS de eventos da revisão selecionada. Comentários, minutas e encaminhamentos
   não comprovam revisão independente concluída, atendimento de refinamento, decisão ou publicação.
  </p>
  {loading&&<p role="status" className="text-xs">Consultando histórico de revisão…</p>}
  {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
  {!loading&&!error&&<>
   <div className="flex flex-wrap gap-2">
    <Badge variant="outline">{summary.events.length} evento(s) no recorte</Badge>
    <Badge variant="outline">{summary.refinementRequests} pedido(s) de refinamento</Badge>
    <Badge variant="outline">{summary.draftCount} minuta(s)</Badge>
    <Badge variant="outline">{summary.referrals} encaminhamento(s)</Badge>
   </div>
   <p className="text-xs text-muted-foreground">
    Consulta em {new Date(readAt).toLocaleString("pt-BR")}.
    Situação dos refinamentos: não verificada. Competência e decisão: não verificadas nesta trilha.
   </p>
   {summary.events.length===0?<p className="text-xs text-muted-foreground">
    Nenhum evento encontrado nesta leitura. Não comprova ausência de revisão externa.
   </p>:<ol className="space-y-2">
    {summary.events.map(item=><li key={item.id} className="border-l-2 pl-3 text-xs space-y-1">
     <p className="font-medium">{REVIEW_EVENT_LABELS_V13[item.event_kind]}</p>
     <p className="whitespace-pre-wrap break-words">{item.body}</p>
     <p className="text-muted-foreground">Autor autenticado {item.actor_auth_uid.slice(0,8)}…
      {" · "+new Date(item.recorded_at).toLocaleString("pt-BR")}</p>
    </li>)}
   </ol>}
  </>}
 </section>;
}
