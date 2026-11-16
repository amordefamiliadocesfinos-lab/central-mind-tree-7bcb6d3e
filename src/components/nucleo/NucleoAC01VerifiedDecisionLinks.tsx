import {useEffect,useMemo,useState} from "react";
import type {SupabaseClient} from "@supabase/supabase-js";
import {supabase} from "@/integrations/supabase/client";
import type {Database} from "@/integrations/supabase/types";
import {Button} from "@/components/ui/button";
import {verifyAc01DecisionLinks,type DecisionRequestLinkV13,type DecisionActLinkV13}
 from "@/lib/nucleo/ac01VerifiedLinksV13";
import type {ReviewEventV13} from "@/lib/nucleo/ac01ReviewContinuityV13";

type DB=Omit<Database,"public">&{public:Omit<Database["public"],"Tables">&{
 Tables:Database["public"]["Tables"]&{
 nucleo_ac01_decision_requests:{Row:DecisionRequestLinkV13;Insert:never;Update:never;Relationships:[]};
 nucleo_ac01_decision_acts:{Row:DecisionActLinkV13;Insert:never;Update:never;Relationships:[]};
 };
}};
const db=supabase as unknown as SupabaseClient<DB>;
const LIMIT=100;
/** Somente leitura de IDs vinculados, sem aprovar ou publicar. */
export default function NucleoAC01VerifiedDecisionLinks({
 moduleId,contributionId,events,
}:{moduleId:string;contributionId:string;events:readonly ReviewEventV13[]}){
 const [requests,setRequests]=useState<DecisionRequestLinkV13[]>([]);
 const [decisions,setDecisions]=useState<DecisionActLinkV13[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true;setRequests([]);setDecisions([]);setLoading(true);setError("");
  void (async()=>{
   const [req,act]=await Promise.all([
    db.from("nucleo_ac01_decision_requests").select("id,module_id,contribution_id,review_event_id,requested_outcome,recorded_at")
     .eq("module_id",moduleId).eq("contribution_id",contributionId).limit(LIMIT),
    db.from("nucleo_ac01_decision_acts").select("id,contribution_id,decision_request_id,outcome,recorded_at")
     .eq("contribution_id",contributionId).limit(LIMIT),
   ]);
   if(!active)return;
   if(req.error||act.error||!req.data||!act.data||req.data.length>=LIMIT||act.data.length>=LIMIT)
    setError("Vínculos decisórios indisponíveis ou recorte parcial. Não inferir conclusão ou ausência de decisão.");
   else{setRequests(req.data);setDecisions(act.data);}
   setLoading(false);
  })().catch(()=>{if(active){setError("Erro ao consultar vínculos decisórios. Não inferir estado.");setLoading(false);}});
  return()=>{active=false};
 },[moduleId,contributionId,refresh]);
 const projected=useMemo(()=>verifyAc01DecisionLinks(moduleId,contributionId,events,requests,decisions),
  [moduleId,contributionId,events,requests,decisions]);
 return <section className="rounded border p-3 text-xs space-y-2"
  aria-label="Reconciliação consultiva de IDs de encaminhamentos, solicitações e decisões">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <strong>Vínculos de encaminhamento, solicitação e decisão</strong>
   <Button size="sm" type="button" variant="outline" disabled={loading}
    onClick={()=>setRefresh(x=>x+1)}>Reconsultar vínculos</Button>
  </div>
  <p className="text-muted-foreground">
   Cadeia verificada somente por IDs do Core sob RLS. Uma decisão registrada não
   comprova por si só a resolução de uma pendência ou publicação externa.
  </p>
  {loading&&<p role="status">Consultando vínculos do Core…</p>}
  {error&&<p role="alert" className="text-destructive">{error}</p>}
  {!loading&&!error&&<>
   {projected.lines.length===0&&<p>Nenhuma solicitação retornada para esta contribuição; isso não comprova ausência fora do recorte.</p>}
   {projected.lines.map(line=><article key={line.requestId} className="border-l-2 pl-2 space-y-1">
    <p>Solicitação {line.requestId.slice(0,8)}… · {line.requestedOutcome}</p>
    <p>Encaminhamento por ID: {line.referralConfirmed?"localizado":"não localizado na trilha visível"}</p>
    <p>Atos decisórios vinculados por ID: {line.decisions.length}</p>
    {line.decisions.map(d=><p key={d.id}>Ato {d.id.slice(0,8)}… · resultado {d.outcome}</p>)}
   </article>)}
   {(projected.referralWithoutVisibleRequest>0||projected.decisionsNotLinkedToVisibleRequest>0)&&
    <p role="status">Vínculos que exigem conferência: {projected.referralWithoutVisibleRequest} encaminhamento(s) sem solicitação visível;
      {" "+projected.decisionsNotLinkedToVisibleRequest} ato(s) sem pedido visível.</p>}
   <p className="font-medium">Resolução de pendência: não comprovada. Publicação externa: não verificada.</p>
  </>}
 </section>;
}
