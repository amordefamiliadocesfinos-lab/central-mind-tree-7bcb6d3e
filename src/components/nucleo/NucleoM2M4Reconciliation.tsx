import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import type { DevelopmentWorkstream, TechnicalEvidence } from "@/lib/nucleo/development.types";
import { KNOWLEDGE_ARCHIVE_SOURCES } from "@/lib/nucleo/knowledgeArchiveSourcesV12";

type RefRow={id:string;provider:string;source_access_class:string;authority_state:string;reference_state:string;content_imported:boolean};
type RefDB=Omit<Database,"public">&{public:Omit<Database["public"],"Tables">&{Tables:Database["public"]["Tables"]&{nucleo_source_references:{Row:RefRow;Insert:never;Update:never;Relationships:[]}}}};
const refClient=supabase as unknown as SupabaseClient<RefDB>;
const LIMIT=100;

/** M2/M4 apenas leitura: snapshots M3/M4 já autorizados pelo M5; M2 via RLS. */
export default function NucleoM2M4Reconciliation({workstreams,evidence}:{workstreams:DevelopmentWorkstream[];evidence:TechnicalEvidence[]}) {
  const [refs,setRefs]=useState<RefRow[]>([]);
  const [state,setState]=useState<"consultando"|"completo"|"indeterminado">("consultando");
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true;setRefs([]);setState("consultando");
    void refClient.from("nucleo_source_references")
      .select("id,provider,source_access_class,authority_state,reference_state,content_imported")
      .limit(LIMIT).then(result=>{
        if(!active)return;
        if(result.error||!result.data||result.data.length>=LIMIT){setState("indeterminado");return;}
        setRefs(result.data);setState("completo");
      }).catch(()=>{if(active)setState("indeterminado");});
    return ()=>{active=false;};
  },[revision]);
  const rows=useMemo(()=>{
    const byId=new Map(workstreams.map(item=>[item.id,item]));
    return workstreams.filter(item=>item.kind!=="modulo").map(front=>{
      const linked=evidence.filter(item=>item.workstream_id===front.id);
      let parent:DevelopmentWorkstream|undefined=front;
      const visited=new Set<string>();
      while(parent?.kind!=="modulo"&&parent?.parent_id&&!visited.has(parent.id)){
        visited.add(parent.id);parent=byId.get(parent.parent_id);
      }
      return {front,linked,moduleCode:parent?.kind==="modulo"?parent.code:"origem M3 não confirmada"};
    }).sort((a,b)=>a.moduleCode.localeCompare(b.moduleCode,"pt-BR")||a.front.code.localeCompare(b.front.code,"pt-BR"));
  },[workstreams,evidence]);
  return <section className="border rounded-lg p-3 md:p-4 space-y-3" aria-label="Reconciliação de fontes M2 e evidências M4">
    <div>
      <h4 className="text-sm font-semibold">Reconciliação M2/M4 — fontes e provas por frente</h4>
      <p className="text-xs text-muted-foreground">Somente registros M3/M4 já consultados sob RLS. Fontes M2 não são vinculadas automaticamente a frentes, e estado verificado não significa deploy ou homologação.</p>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {[
        ["Frentes com M4",rows.filter(row=>row.linked.length>0).length],
        ["Frentes sem registro M4",rows.filter(row=>row.linked.length===0).length],
        ["Evidências M4 consultadas",evidence.length],
        ["Registros M4 sem URL pública",evidence.filter(e=>!e.reference_url).length],
      ].map(([label,value])=><div key={String(label)} className="rounded border p-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
      </div>)}
    </div>
    <div className="border rounded p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h5 className="text-xs font-semibold">Metadados M2 sob RLS (consulta independente)</h5>
        <button type="button" disabled={state==="consultando"} onClick={()=>setRevision(n=>n+1)}
          className="text-xs underline underline-offset-2 disabled:opacity-50">Reconsultar M2</button>
      </div>
      {state==="consultando"&&<p role="status" className="text-xs">Consultando referências…</p>}
      {state==="indeterminado"&&<p role="status" className="text-xs">Fonte M2 indisponível, não autorizada ou leitura incompleta. Não inferir zero referências.</p>}
      {state==="completo"&&<>
        <p className="text-xs">{refs.length} referência(s) privadas consultadas; {refs.filter(x=>x.content_imported).length} marcada(s) com conteúdo importado.</p>
        {refs.map(x=><p key={x.id} className="text-xs text-muted-foreground">
          {x.provider} · {x.reference_state} · autoridade: {x.authority_state} · acesso: {x.source_access_class}
        </p>)}
      </>}
      <p className="text-xs text-muted-foreground">
        {KNOWLEDGE_ARCHIVE_SOURCES.length} identificadores históricos em ZIPs estão catalogados separadamente; não são registros M2 importados nem evidências M4.
      </p>
    </div>
    <div className="space-y-2">
      <h5 className="text-xs font-semibold">Frentes reais cadastradas ({rows.length})</h5>
      {rows.map(({front,linked,moduleCode})=><div key={front.id} className="border rounded p-3 space-y-1">
        <p className="text-xs font-semibold">{moduleCode} · {front.code} — {front.title}</p>
        <p className="text-xs text-muted-foreground">
          Estado declarado: {front.status.replaceAll("_"," ")} · M4: {linked.length} registro(s),
          {" "}{linked.filter(x=>x.observed_state==="verificado").length} verificado(s) na conferência anterior;
          {" "}{linked.filter(x=>!x.reference_url).length} sem URL pública.
        </p>
        {linked.length===0 ? <p className="text-xs">Sem registro M4 vinculado nesta leitura. Conferir fonte e decisão do responsável; não inferir ausência de desenvolvimento.</p> :
          <p className="text-xs text-muted-foreground">
            Tipos: {Array.from(new Set(linked.map(x=>x.kind))).join(", ")}.
            {linked.some(x=>x.kind==="migration"&&!x.reference_url)?" Migrations Supabase podem usar chaves internas válidas; não fabricar links.":""}
          </p>}
      </div>)}
    </div>
    <p className="text-xs text-muted-foreground">Nenhuma escrita, homologação, atribuição de especialista ou sincronização automática é realizada por esta leitura.</p>
  </section>;
}
