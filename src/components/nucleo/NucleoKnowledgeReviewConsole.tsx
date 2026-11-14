import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { DevelopmentWorkstream, TechnicalEvidence } from "@/lib/nucleo/development.types";
import { MODULE_PROVENANCE } from "@/lib/nucleo/operationalProvenanceV12";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type FM = {
  id:string;module_id:string;section_code:string;version_no:number;title:string;body:string;
  source_reference:string;authority_state:string;evidence_level:string;recorded_at:string;
};
type FMDB=Omit<Database,"public">&{public:Omit<Database["public"],"Tables">&{
  Tables:Database["public"]["Tables"]&{
    nucleo_module_knowledge_revisions:{Row:FM;Insert:never;Update:never;Relationships:[]};
  };
}};
const client=supabase as unknown as SupabaseClient<FMDB>;
const LIMIT=300;
const FM_CODES=["FM-01","FM-02","FM-03","FM-04","FM-05","FM-06","FM-07","FM-08","FM-09","FM-10"] as const;
const LABELS:Record<string,string>={
  "FM-01":"Identidade","FM-02":"Visão rápida","FM-03":"Fronteiras",
  "FM-04":"Mapa de telas","FM-05":"Catálogo de ações","FM-06":"Jornadas práticas",
  "FM-07":"Dados e evidências","FM-08":"Governança do especialista",
  "FM-09":"Evolução","FM-10":"Aprendizagem",
};
function ancestorModule(front:DevelopmentWorkstream,byId:Map<string,DevelopmentWorkstream>):string|null{
  let item:DevelopmentWorkstream|undefined=front;const seen=new Set<string>();
  while(item && item.kind!=="modulo"){
    if(!item.parent_id||seen.has(item.id))return null;
    seen.add(item.id);item=byId.get(item.parent_id);
  }
  return item?.id??null;
}
/**
 * CA16/18/22: dados de M3/M4 já autorizados no M5; FM via RLS.
 * Uma revisão com data anterior à prova técnica PR é um possível gate
 * de atualização, não um diagnóstico factual do conteúdo do manual.
 * Nunca modifica FM, não inscreve agentes nem envia dados à IA.
 */
export default function NucleoKnowledgeReviewConsole({
  workstreams,evidence,
}:{workstreams:DevelopmentWorkstream[];evidence:TechnicalEvidence[]}) {
  const modules=useMemo(()=>workstreams.filter(w=>w.kind==="modulo"&&w.code!=="NUC")
    .sort((a,b)=>a.code.localeCompare(b.code,"pt-BR")),[workstreams]);
  const [moduleId,setModuleId]=useState<string>("");
  const [rows,setRows]=useState<FM[]>([]);
  const [readState,setReadState]=useState<"carregando"|"completo"|"indeterminado">("carregando");
  const [refresh,setRefresh]=useState(0);
  const [copyState,setCopyState]=useState("");
  const selected=modules.find(m=>m.id===moduleId)??modules[0];
  useEffect(()=>{
    if(!selected){setReadState("indeterminado");return;}
    let current=true;setReadState("carregando");setRows([]);setCopyState("");
    void client.from("nucleo_module_knowledge_revisions")
      .select("id,module_id,section_code,version_no,title,body,source_reference,authority_state,evidence_level,recorded_at")
      .eq("module_id",selected.id).order("recorded_at",{ascending:false}).limit(LIMIT)
      .then(result=>{
        if(!current)return;
        if(result.error||!result.data||result.data.length>=LIMIT){
          setReadState("indeterminado");return;
        }
        setRows(result.data);setReadState("completo");
      }).catch(()=>{if(current)setReadState("indeterminado");});
    return()=>{current=false;};
  },[selected?.id,refresh]);
  const details=useMemo(()=>{
    if(!selected||readState!=="completo")return null;
    const latest=new Map<string,FM>();
    for(const row of rows){
      const prior=latest.get(row.section_code);
      if(!prior||prior.version_no<row.version_no)latest.set(row.section_code,row);
    }
    const byId=new Map(workstreams.map(w=>[w.id,w]));
    const descendants=workstreams.filter(w=>w.kind!=="modulo"&&ancestorModule(w,byId)===selected.id);
    const ids=new Set(descendants.map(w=>w.id));
    const prEvidence=evidence.filter(e=>ids.has(e.workstream_id)&&e.kind==="pull_request"&&e.observed_state==="verificado");
    const linkedEvidence=evidence.filter(e=>ids.has(e.workstream_id));
    const pending=Array.from(latest.values()).flatMap(revision=>{
      const date=Date.parse(revision.recorded_at);
      if(!Number.isFinite(date))return [];
      const newer=prEvidence.filter(proof=>{
        // checked_at is a snapshot check, NOT PR merged_at: no temporal
        // claim that the code changed is possible from it alone.
        const mergedAt=typeof proof.snapshot?.merged_at==="string" ? Date.parse(proof.snapshot.merged_at) : NaN;
        return Number.isFinite(mergedAt)&&mergedAt>date;
      });
      return newer.length?[{revision,prCount:newer.length}]:[];
    });
    const insufficientDates=prEvidence.filter(proof=>
      typeof proof.snapshot?.merged_at!=="string"||
      !Number.isFinite(Date.parse(proof.snapshot.merged_at as string))).length;
    const source=MODULE_PROVENANCE[selected.code];
    return {latest,descendants,linkedEvidence,prEvidence,pending,insufficientDates,source};
  },[selected,readState,rows,workstreams,evidence]);
  const exportBundle=()=>{
    if(!selected||!details||readState!=="completo")return;
    const packet={
      contract:"nucleo_a_plus_v1_2_ca16_readonly_export_1",
      module:{id:selected.id,code:selected.code,title:selected.title,description:selected.description},
      disclaimer:"Consulta orientada a um agente autorizado; copiar não concede acesso, mandato, execução ou homologação. Não presumir informações ausentes.",
      authority:"Dados declarados, não homologação automática",
      provenance:(details.source?.sources??[]).map(s=>({label:s.label,path:s.path,authority:s.authority,note:s.note})),
      sections:FM_CODES.map(code=>{
        const rev=details.latest.get(code);
        return {code,label:LABELS[code],state:rev?"registro_core":"sem_revisao_core",
          revision:rev?{version:rev.version_no,title:rev.title,body:rev.body,
            source_reference:rev.source_reference,authority_state:rev.authority_state,
            evidence_level:rev.evidence_level,recorded_at:rev.recorded_at}:null};
      }),
      fronts:details.descendants.map(w=>({code:w.code,title:w.title,status:"declarado:"+w.status,next_action:w.next_action})),
      technical_evidence_summary:{count:details.linkedEvidence.length,
        checked_records_not_live:details.linkedEvidence.filter(e=>e.observed_state==="verificado").length},
      restrictions:["Somente leitura","Sem acesso a credenciais ou dados pessoais","Não executar comandos","Confirmar vigência e autoria com especialista"],
    };
    // Exportação explícita pelo humano já autorizado no M5; nenhuma transmissão automática.
    void navigator.clipboard.writeText(JSON.stringify(packet,null,2)).then(
      ()=>setCopyState("Pacote estruturado copiado. Compartilhe apenas com uma IA devidamente autorizada."),
      ()=>setCopyState("Cópia não confirmada. Confira as permissões do navegador.")
    );
  };
  return <section className="border rounded-lg p-3 md:p-4 space-y-3" aria-label="Conhecimento parametrizado e revisão assistida">
    <div>
      <h4 className="text-sm font-semibold">Conhecimento por módulo — CA-16 / CA-18 / CA-22</h4>
      <p className="text-xs text-muted-foreground">
        Consulta parametrizada dos módulos existentes. O catálogo de seções FM independe de criar componente por módulo.
        Nenhum conteúdo é enviado automaticamente a IA, e nenhum alerta altera o manual.
      </p>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="nucleo-knowledge-module" className="text-xs font-medium">Módulo</label>
      <select id="nucleo-knowledge-module" className="rounded border bg-background px-2 py-1.5 text-sm max-w-full"
        value={selected?.id??""} onChange={e=>{setModuleId(e.target.value);setCopyState("");}}>
        {modules.map(m=><option key={m.id} value={m.id}>{m.code} — {m.title}</option>)}
      </select>
      <Button type="button" size="sm" variant="outline" disabled={readState==="carregando"}
        onClick={()=>setRefresh(n=>n+1)}>Reconsultar conhecimento</Button>
    </div>
    {readState==="carregando"&&<p role="status" className="text-xs">Consultando seções FM sob RLS…</p>}
    {readState==="indeterminado"&&<p role="alert" className="text-xs text-destructive">
      A leitura FM foi negada, falhou ou atingiu o limite. Nenhum pacote ou conclusão de revisão é gerado.
    </p>}
    {selected&&details&&<>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{details.latest.size}/10 seções com registro FM</Badge>
        <Badge variant="outline">{details.descendants.length} frente(s)/subfrente(s) vinculada(s)</Badge>
        <Badge variant="outline">{details.linkedEvidence.length} evidência(s) M4 vinculada(s)</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {FM_CODES.map(code=>{
          const rev=details.latest.get(code);
          return <div key={code} className="rounded border p-3 space-y-1 text-xs">
            <p className="font-semibold">{code} — {LABELS[code]}</p>
            {rev?<details>
              <summary className="cursor-pointer">Core v{rev.version_no} · {rev.authority_state} · {rev.evidence_level}</summary>
              <p className="mt-2 font-medium">{rev.title}</p>
              <p className="whitespace-pre-wrap break-words mt-1">{rev.body}</p>
              <p className="text-muted-foreground break-words">Fonte declarada: {rev.source_reference||"não informada"}</p>
            </details>:<p className="text-muted-foreground">Sem registro no Core; modelos históricos podem existir fora deste inventário.</p>}
          </div>;
        })}
      </div>
      <div className="rounded border p-3 space-y-2">
        <h5 className="text-sm font-semibold">Revisão documental candidata — CA-18</h5>
        <p className="text-xs text-muted-foreground">
          Compara data de revisão FM somente com PR vinculada e verificada cujo snapshot
          informe explicitamente a data de merge. A comparação não demonstra que a PR alterou este manual.
        </p>
        {details.pending.length>0?details.pending.map(({revision,prCount})=><p key={revision.id} className="text-xs">
          {revision.section_code} v{revision.version_no}: {prCount} PR(s) com merge posterior na origem;
          revisão humana sugerida, sem alterar a revisão vigente.
        </p>):<p className="text-xs">
          Nenhuma diferença temporal comprovável nas seções consultadas. Não significa que o manual esteja atualizado.
        </p>}
        {details.insufficientDates>0&&<p className="text-xs text-muted-foreground">
          {details.insufficientDates} PR(s) M4 sem data de merge verificável no snapshot:
          situação indeterminada, não presumir revisão concluída.
        </p>}
        {details.latest.size===0&&<p className="text-xs text-muted-foreground">
          Não existem revisões FM registradas para este módulo; não há manual vigente no Core a alterar.
        </p>}
      </div>
      <div className="rounded border p-3 space-y-2">
        <h5 className="text-sm font-semibold">Pacote estruturado de consulta — CA-16</h5>
        <p className="text-xs">
          Exporta apenas o módulo selecionado, suas revisões FM consultadas, referências de origem
          e resumos de frentes/provas. Não inclui credenciais, dados de atendimento ou conteúdo de outras tabelas.
          A autorização do agente destinatário deve ser comprovada fora desta exportação.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={exportBundle}>Copiar pacote JSON para consulta autorizada</Button>
        {copyState&&<p role="status" className="text-xs">{copyState}</p>}
      </div>
    </>}
  </section>;
}
