import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
 AC01_DOCUMENT_CATEGORIES, AC01_FUNCTIONS, AC01_AUTHORITY_PROCEDURE, buildAc01DocumentView, declaredAuthorityCoverage, canonicalReadinessPreview,
 type Ac01Record, type Ac01Request, type Ac01Decision, type Ac01Publication,
 type Ac01Mandate, type Ac01Grant, type Ac01Revocation, type Ac01FM,
} from "@/lib/nucleo/ac01DocumentGovernance";

type Tables={
 nucleo_ac01_decision_requests:{Row:Ac01Request;Insert:never;Update:never;Relationships:[]};
 nucleo_ac01_decision_acts:{Row:Ac01Decision;Insert:never;Update:never;Relationships:[]};
 nucleo_ac01_publication_events:{Row:Ac01Publication;Insert:never;Update:never;Relationships:[]};
 nucleo_ac01_authority_grants:{Row:Ac01Grant;Insert:never;Update:never;Relationships:[]};
 nucleo_ac01_authority_revocations:{Row:Ac01Revocation;Insert:never;Update:never;Relationships:[]};
 nucleo_specialist_mandate_records:{Row:Ac01Mandate;Insert:never;Update:never;Relationships:[]};
 nucleo_module_knowledge_revisions:{Row:Ac01FM;Insert:never;Update:never;Relationships:[]};
};
type DB=Omit<Database,"public">&{public:Omit<Database["public"],"Tables">&{Tables:Database["public"]["Tables"]&Tables;}};
const db=supabase as unknown as SupabaseClient<DB>;
type Tab="vigente"|"propostas"|"evolucao"|"decisao"|"historico"|"competencias";
const TABS:Array<{key:Tab;title:string}>=[
 {key:"vigente",title:"Vigente"},
 {key:"propostas",title:"Propostas"},
 {key:"evolucao",title:"Em evolução"},
 {key:"decisao",title:"Para decidir"},
 {key:"historico",title:"Histórico"},
 {key:"competencias",title:"Competências"},
];
const CAP=180;
/**
 * Visualização agregada dos contratos existentes, restrita ao módulo já lido.
 * Fontes externas/Fichas Vivas não são promovidas por publicação AC-01.
 * Não inventar estado de vigente quando contratos estiverem vazios ou incompletos.
 */
export default function NucleoAC01DocumentGovernance({
 moduleId,moduleName,declaredRole,contributions,readAt,
}:{moduleId:string;moduleName:string;declaredRole:string;contributions:Ac01Record[];readAt:string}) {
 const [tab,setTab]=useState<Tab>("vigente");
 const [query,setQuery]=useState("");
 const [category,setCategory]=useState("todas");
 const [refresh,setRefresh]=useState(0);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [snapshotAt,setSnapshotAt]=useState("");
 const [reqs,setReqs]=useState<Ac01Request[]>([]);
 const [decisions,setDecisions]=useState<Ac01Decision[]>([]);
 const [publications,setPublications]=useState<Ac01Publication[]>([]);
 const [mandates,setMandates]=useState<Ac01Mandate[]>([]);
 const [grants,setGrants]=useState<Ac01Grant[]>([]);
 const [revocations,setRevocations]=useState<Ac01Revocation[]>([]);
 const [targetId,setTargetId]=useState("");
 const [fm,setFm]=useState<Ac01FM[]>([]);
 const [selectedId,setSelectedId]=useState("");
 useEffect(()=>{
  let mounted=true;
  setLoading(true);setError("");setSnapshotAt("");
  setReqs([]);setDecisions([]);setPublications([]);setMandates([]);setGrants([]);setRevocations([]);setFm([]);
  if(contributions.length>=CAP) {
   setError("Recorte AC-01 incompleto; não inferir qual referência é vigente ou quais decisões estão abertas.");
   setLoading(false);return()=>{mounted=false};
  }
  const ids=contributions.map(x=>x.id);
  void (async()=>{
    // A ausência de contribuições não equivale à ausência de Fichas Vivas ou mandatos.
    const [requests,acts,pubs,mandateRows,authority,knowledge]=await Promise.all([
     db.from("nucleo_ac01_decision_requests").select("*").eq("module_id",moduleId).limit(CAP),
     ids.length?db.from("nucleo_ac01_decision_acts").select("*").in("contribution_id",ids).limit(CAP)
       :Promise.resolve({data:[] as Ac01Decision[],error:null}),
     ids.length?db.from("nucleo_ac01_publication_events").select("*").in("contribution_id",ids).limit(CAP)
       :Promise.resolve({data:[] as Ac01Publication[],error:null}),
     db.from("nucleo_specialist_mandate_records").select("*").eq("module_id",moduleId).limit(CAP),
     db.from("nucleo_ac01_authority_grants").select("*").eq("module_id",moduleId).limit(CAP),
     db.from("nucleo_module_knowledge_revisions")
       .select("id,module_id,section_code,version_no,title,authority_state,source_reference,recorded_at")
       .eq("module_id",moduleId).limit(CAP),
    ]);
    if(!mounted)return;
    // Reunir revogações somente das delegações efetivamente visíveis deste módulo.
    const grantIds=(authority.data??[]).map(g=>g.id);
    const revocationRows=grantIds.length
      ?await db.from("nucleo_ac01_authority_revocations").select("*")
        .in("authority_grant_id",grantIds).limit(CAP)
      :{data:[] as Ac01Revocation[],error:null};
    if(!mounted)return;
    const responses=[requests,acts,pubs,mandateRows,authority,revocationRows,knowledge];
    if(responses.some(x=>x.error||!x.data||x.data.length>=CAP)){
     setError("Uma das fontes governadas falhou ou ultrapassou o limite do recorte. Estado consolidado indisponível.");
    }else{
     setReqs(requests.data as Ac01Request[]);
     setDecisions(acts.data as Ac01Decision[]);
     setPublications(pubs.data as Ac01Publication[]);
     setMandates(mandateRows.data as Ac01Mandate[]);
     setGrants(authority.data as Ac01Grant[]);
     setRevocations(revocationRows.data as Ac01Revocation[]);
     setFm(knowledge.data as Ac01FM[]);
     setSnapshotAt(new Date().toISOString());
    }
    setLoading(false);
  })().catch(()=>{if(mounted){setError("Falha ao ler governança; nenhum estado anterior foi reutilizado.");setLoading(false);}});
  return()=>{mounted=false};
 },[moduleId,contributions,refresh]);
 const view=useMemo(()=>buildAc01DocumentView(contributions,reqs,decisions,publications),
  [contributions,reqs,decisions,publications]);
 const matches=(c:Ac01Record)=>(
  (category==="todas"||c.contribution_kind===category) &&
  (!declaredRole || c.specialist_role===declaredRole) &&
  (!query.trim()||[c.title,c.specialist_role,c.contribution_kind,c.source_kind,c.source_locator]
   .some(s=>s.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))))
 );
 const visibleProposals=view.proposals.filter(matches);
 const visibleEvolving=view.evolving.filter(matches);
 const pending=view.pendingRequests.filter(x=>x.contribution&&matches(x.contribution));
 const previous=view.history.filter(matches);
 const published=view.internalPublications.filter(x=>x.contribution&&matches(x.contribution));
 const currentByScope=new Map<string,(typeof published)[number]>();
 for(const p of published){
  const c=p.contribution!;
  const key=[c.module_id,c.specialist_role,c.contribution_kind].join("|");
  const prior=currentByScope.get(key);
  if(!prior||p.recorded_at>prior.recorded_at)currentByScope.set(key,p);
 }
 const selected=contributions.find(c=>c.id===selectedId);
 const now=snapshotAt||readAt;
 const scopedGrants=declaredAuthorityCoverage(moduleId,declaredRole,category==="todas"?"metodo":category,grants,mandates,now,revocations);
 const preview=selected?canonicalReadinessPreview(selected,fm.find(x=>x.id===targetId)??null,decisions,publications):null;
 const activeFM=fm.filter(x=>["vigente","homologado","aprovado"].includes(x.authority_state.toLowerCase()));
 const renderRecord=(c:Ac01Record,prefix="")=><button key={prefix+c.id} type="button"
  onClick={()=>setSelectedId(c.id)}
  aria-pressed={selectedId===c.id}
  className={"text-left rounded-md border p-3 text-sm hover:bg-muted/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring "+(selectedId===c.id?"border-primary":"")}>
   <div className="flex flex-wrap items-center gap-2"><strong>{c.title}</strong><Badge variant="outline">v{c.version_no}</Badge></div>
   <p className="text-xs mt-1">{c.specialist_role} · {c.contribution_kind} · {c.source_kind}</p>
   <p className="text-xs text-muted-foreground">Origem preservada; estado declarado: {c.authority_state}</p>
  </button>;
 return <section className="rounded-lg border p-3 md:p-4 space-y-3" aria-label="Ciclo documental governado AC-01">
  <div className="flex flex-wrap items-start justify-between gap-2">
   <div><h4 className="font-semibold text-sm">Ciclo documental · {moduleName}</h4>
    <p className="text-xs text-muted-foreground">Consulta do Core e da Ficha Viva, sem ativar delegações, decisões nem publicação. Dados lidos em {snapshotAt?new Date(snapshotAt).toLocaleString("pt-BR"):"consulta pendente"}.</p></div>
   <Button size="sm" type="button" variant="outline" disabled={loading}
    onClick={()=>setRefresh(x=>x+1)}>Reconsultar</Button>
  </div>
  <div className="flex flex-wrap gap-2" role="group" aria-label="Estados documentais">
   {TABS.map(t=><Button key={t.key} size="sm" type="button" variant={tab===t.key?"default":"outline"}
     aria-pressed={tab===t.key} onClick={()=>{setTab(t.key);setSelectedId("");}}>{t.title}</Button>)}
  </div>
  {loading&&<p className="text-sm">Consultando fontes governadas…</p>}
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {!loading&&!error&&<>
   <div className="grid gap-2 sm:grid-cols-2">
    <label className="text-xs">Buscar contribuições
     <Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Título, papel, origem"/>
    </label>
    <label className="text-xs">Categoria documental
     <select className="w-full h-10 border rounded-md bg-background px-2" value={category}
      onChange={e=>setCategory(e.target.value)}>
      <option value="todas">Todas as categorias</option>
      {AC01_DOCUMENT_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
     </select>
    </label>
   </div>
   <div className="flex flex-wrap gap-2">
    <Badge variant="outline">{visibleProposals.length} propostas</Badge>
    <Badge variant="outline">{visibleEvolving.length} em evolução</Badge>
    <Badge variant="outline">{pending.length} pedidos aguardando decisão</Badge>
    <Badge variant="outline">{published.length} publicações AC-01 no recorte</Badge>
   </div>
   {tab==="vigente"&&<div className="space-y-2">
    <p className="text-xs text-muted-foreground">Vigente canônico exige fonte original + ato competente + sincronização comprovada. Publicação interna AC-01 não comprova a vigência em Drive/GitHub/Ficha Viva.</p>
    {activeFM.length>0?<div className="space-y-2"><strong className="text-xs">Fichas Vivas com estado de autoridade declarado</strong>
     {activeFM.map(x=><div key={x.id} className="rounded border p-3 text-xs">
      <strong>{x.section_code} · {x.title} · v{x.version_no}</strong>
      <p>Estado declarado: {x.authority_state}</p>
      <p className="break-all">Fonte: {x.source_reference||"não informada"}</p>
     </div>)}<p className="text-xs text-muted-foreground">A declaração FM não é homologação AC-01 por inferência.</p></div>
    :<p className="text-xs">Nenhuma Ficha Viva com estado vigente/homologado foi retornada nesta consulta. Isto não certifica ausência de método válido nas fontes externas.</p>}
    {currentByScope.size>0?<div className="space-y-2"><strong className="text-xs">Últimas publicações internas AC-01 no recorte</strong>
     {[...currentByScope.values()].map(p=><div key={p.id} className="rounded border p-3 text-xs">
       <strong>{p.contribution?.title} · v{p.contribution?.version_no}</strong>
       <p>Publicação interna em {new Date(p.recorded_at).toLocaleString("pt-BR")}, não reconcilia automaticamente fontes externas.</p>
       <p className="break-all">Referência original: {p.contribution?.source_locator}</p>
     </div>)}</div>:<p className="text-xs">Nenhuma publicação AC-01 registrada no recorte.</p>}
   </div>}
   {tab==="propostas"&&<div className="grid gap-2 md:grid-cols-2">
    {visibleProposals.map(c=>renderRecord(c))}
    {visibleProposals.length===0&&<p className="text-xs text-muted-foreground">Sem propostas AC-01 no filtro. Fontes externas permanecem preservadas.</p>}
   </div>}
   {tab==="evolucao"&&<div className="grid gap-2 md:grid-cols-2">
    {visibleEvolving.map(c=>renderRecord(c))}
    {visibleEvolving.length===0&&<p className="text-xs text-muted-foreground">Sem revisões em evolução no filtro.</p>}
   </div>}
   {tab==="decisao"&&<div className="space-y-2">
    {pending.map(r=><div key={r.id} className="rounded border p-3 text-xs">
     <strong>{r.contribution?.title} · pedido de {r.requested_outcome.replaceAll("_"," ")}</strong>
     <p>Registrado em {new Date(r.recorded_at).toLocaleString("pt-BR")} · solicitante {r.submitter_auth_uid.slice(0,8)}…</p>
     <p className="text-muted-foreground">Sem ato decisório vinculado no Core; sem autorização de homologação nesta interface.</p>
    </div>)}
    {pending.length===0&&<p className="text-xs text-muted-foreground">Nenhuma solicitação pendente no recorte. Ausência de pedido não equivale a aprovação.</p>}
   </div>}
   {tab==="historico"&&<div className="space-y-2">
    <strong className="text-xs">Revisões preservadas</strong>
    <div className="grid gap-2 md:grid-cols-2">{previous.map(c=>renderRecord(c,"old"))}</div>
    {previous.length===0&&<p className="text-xs text-muted-foreground">Nenhuma revisão anterior no recorte.</p>}
    <strong className="text-xs">Atos decisórios registrados</strong>
    {view.decisions.map(d=><p className="text-xs border-l-2 pl-2" key={d.id}>{d.outcome} · {new Date(d.recorded_at).toLocaleString("pt-BR")} · autor autenticado {d.decided_by_auth_uid.slice(0,8)}…</p>)}
    {view.decisions.length===0&&<p className="text-xs text-muted-foreground">Nenhum ato decisório AC-01 no recorte.</p>}
   </div>}
   {tab==="competencias"&&<div className="space-y-3">
    <p className="text-xs text-muted-foreground">Matriz de funções aplicável a cada especialidade e a cada categoria documental. Nenhuma função é concedida por esta tela.</p>
    <div className="space-y-2">{AC01_FUNCTIONS.map(x=><article key={x.role} className="rounded border p-3 text-xs">
     <strong>{x.role}</strong>
     <p>Ações previstas: {[
       x.propose?"propor":"",x.review?"revisar":"",x.decide?"decidir":"",x.publish?"publicar":""
      ].filter(Boolean).join(" / ")||"instituir competência documental mediante ato formal"}</p>
     <p className="text-muted-foreground">Condição: {x.prerequisite}</p>
    </article>)}</div>
    <p className="text-xs">Escopo selecionado: {declaredRole||"papel ainda não confirmado"} · {category==="todas"?"todas as categorias (sem delegação coletiva)":category}.</p>
    {category!=="todas"&&<p className="text-xs">Delegações declaradas com mandato não revogado neste recorte: {scopedGrants.length}. Isto não comprova permissão técnica para decidir ou publicar.</p>}
    <div className="space-y-2"><strong className="text-xs">Ciclo das delegações (consulta)</strong>{grants.filter(g=>!declaredRole||g.specialist_role===declaredRole).map(g=><p key={g.id} className="text-xs border-l-2 pl-2">{g.authority_kind} · {g.contribution_kind} · {g.delegate_auth_uid.slice(0,8)}… · {revocations.some(r=>r.authority_grant_id===g.id)?"REVOGADA / SUSPENSA":"Sem revogação registrada no recorte"}{g.supersedes_grant_id?" · substitui "+g.supersedes_grant_id.slice(0,8)+"…":""}</p>)}{grants.length===0&&<p className="text-xs text-muted-foreground">Nenhuma delegação existente no Core para este módulo.</p>}</div>
    <p className="text-xs text-muted-foreground">Certificar, delegar, revogar e substituir responsáveis dependem do ato documentado da Camada Mestre, e da trilha formal; nenhuma escrita está habilitada.</p>
    <details className="rounded border p-3 text-xs">
     <summary className="cursor-pointer font-semibold">Procedimento de certificação, substituição e publicação (preparação sem execução)</summary>
     <div className="mt-2 space-y-2">
      {AC01_AUTHORITY_PROCEDURE.map(p=><div className="border-l-2 pl-2" key={p.code}>
        <strong>{p.code} · {p.step}</strong><p>{p.detail}</p>
      </div>)}
     </div>
    </details>
   </div>}
   {selected&&<div className="rounded border p-3 space-y-1 text-xs">
    <strong>Referência selecionada: {selected.title} · v{selected.version_no}</strong>
    <p>Especialidade: {selected.specialist_role}; categoria: {selected.contribution_kind}</p>
    <p>Autor autenticado: {selected.recorded_by_auth_uid.slice(0,8)}… · registrado em {new Date(selected.recorded_at).toLocaleString("pt-BR")}</p>
    <p className="break-all">Original preservado em: {selected.source_kind} · {selected.source_locator}</p>
    <p className="text-muted-foreground">Qualquer comparação de conteúdo requer acesso válido à fonte original. Sem diffs fictícios nem aprovação implícita.</p>
    <div className="space-y-2 border-t pt-2"><strong>Prévia de reconciliação canônica — bloqueada</strong>
     <label className="block">Alvo de Ficha Viva para análise (sem alteração)
       <select className="w-full rounded border bg-background p-2" value={targetId} onChange={e=>setTargetId(e.target.value)}>
        <option value="">Não selecionado</option>
        {fm.map(x=><option key={x.id} value={x.id}>{x.section_code} · {x.title} · v{x.version_no}</option>)}
       </select>
     </label>
     {preview&&<><Badge variant="outline">{preview.action}</Badge>
       <p>Origem v{preview.sourceVersion} · destino v{preview.targetVersion??"não selecionado"}</p>
       <ul className="list-disc pl-4">{preview.blockers.map(b=><li key={b}>{b}</li>)}</ul>
       <details><summary className="cursor-pointer">Plano técnico preparado — não executável</summary>
        <ol className="list-decimal pl-4">{preview.steps.map(t=><li key={t}>{t}</li>)}</ol>
       </details></>}
    </div>
   </div>}
  </>}
 </section>;
}
