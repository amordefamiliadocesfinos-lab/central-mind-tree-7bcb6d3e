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
import { assessAc01FmCandidates, compareAc01FmSource } from "@/lib/nucleo/ac01FmSourceMatchV13";
import { buildAc01FmLineage } from "@/lib/nucleo/ac01FmLineageV13";
import { buildAc01ConsolidationQueue, AC01_QUEUE_ISSUE_LABELS, type Ac01QueueIssue } from "@/lib/nucleo/ac01ConsolidationQueueV13";
import { prepareAc01AssistedComparison } from "@/lib/nucleo/ac01AssistedComparisonV13";
import { deriveAc01ReviewCriteria } from "@/lib/nucleo/ac01ReviewCriteriaV13";
import { prepareAc01HumanReviewBrief } from "@/lib/nucleo/ac01HumanReviewBriefV13";
import { summarizeAc01ContributionV13 } from "@/lib/nucleo/ac01ContributionSummaryV13";
import NucleoAC01ReviewContinuityRead from "@/components/nucleo/NucleoAC01ReviewContinuityRead";
import NucleoAc01ContentComparison from "@/components/nucleo/NucleoAc01ContentComparison";

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
 {key:"vigente",title:"Vigência e comprovação"},
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
 moduleId,moduleName,declaredRole,contributions,readAt,requestedTab,requestedContribution,onOpenPendingReview,
}:{moduleId:string;moduleName:string;declaredRole:string;contributions:Ac01Record[];readAt:string;
 requestedTab?:{key:Tab;seq:number}|null;
 requestedContribution?:{contributionId:string;seq:number}|null;
 onOpenPendingReview?:(contributionId:string,issues:readonly Ac01QueueIssue[])=>void}) {
 const [tab,setTab]=useState<Tab>("vigente");
 useEffect(()=>{if(requestedTab)setTab(requestedTab.key);},[requestedTab]);
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
 const [reviewHistoryOpen,setReviewHistoryOpen]=useState(false);
 useEffect(()=>{
  if(!requestedContribution)return;
  if(!contributions.some(c=>c.module_id===moduleId&&c.id===requestedContribution.contributionId))return;
  setSelectedId(requestedContribution.contributionId);
  setTab("decisao");setReviewHistoryOpen(false);
  setQuery("");setCategory("todas");setTargetId("");
 },[requestedContribution,moduleId,contributions]);
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
 const queue=useMemo(()=>!loading&&!error?buildAc01ConsolidationQueue(contributions,reqs,decisions,publications,fm):[],
  [loading,error,contributions,reqs,decisions,publications,fm]);
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
 const relatedFM=selected?assessAc01FmCandidates(selected,fm):[];
 const selectedFM=fm.find(x=>x.id===targetId)??null;
 const selectedMatch=selected&&selectedFM?compareAc01FmSource(selected,selectedFM):null;
 const assisted=selected?prepareAc01AssistedComparison(selected,contributions,selectedFM):null;
 const review=selected?deriveAc01ReviewCriteria(selected,contributions,reqs,decisions,publications,selectedFM):null;
 const reviewBrief=selected?prepareAc01HumanReviewBrief(selected,contributions,reqs,decisions,publications,selectedFM):null;
 const summary=selected?summarizeAc01ContributionV13(selected,contributions,reqs,decisions,publications,selectedFM):null;
 const lineage=selected?buildAc01FmLineage(selected,contributions,reqs,decisions,publications,fm):null;
 const activeFM=fm.filter(x=>["vigente","homologado","aprovado"].includes(x.authority_state.toLowerCase()));
 const renderRecord=(c:Ac01Record,prefix="")=><button key={prefix+c.id} type="button"
  onClick={()=>{setSelectedId(c.id);setReviewHistoryOpen(false);}}
  aria-pressed={selectedId===c.id}
  className={"nucleo-v22-card-hover text-left rounded-md border p-3 text-sm hover:bg-muted/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring "+(selectedId===c.id?"nucleo-v22-selected":"")}>
   <div className="flex flex-wrap items-center gap-2"><strong>{c.title}</strong><Badge variant="outline">v{c.version_no}</Badge></div>
   <p className="text-xs mt-1">{c.specialist_role} · {c.contribution_kind} · {c.source_kind}</p>
   <p className="text-xs text-muted-foreground">Origem preservada; estado declarado: {c.authority_state}</p>
  </button>;
 return <section className="nucleo-v22-surface p-3 md:p-4 space-y-3" aria-label="Ciclo documental governado AC-01">
  <div className="flex flex-wrap items-start justify-between gap-2">
   <div><h4 className="nucleo-v22-title text-lg">Ciclo documental · {moduleName}</h4>
    <p className="text-xs text-muted-foreground">Consulta do Core e da Ficha Viva, sem ativar delegações, decisões nem publicação. Dados lidos em {snapshotAt?new Date(snapshotAt).toLocaleString("pt-BR"):"consulta pendente"}.</p></div>
   <Button size="sm" type="button" variant="outline" disabled={loading}
    onClick={()=>setRefresh(x=>x+1)}>Reconsultar</Button>
  </div>
  <div className="nucleo-v22-tabs flex flex-wrap" role="group" aria-label="Estados documentais">
   {TABS.map(t=><Button key={t.key} size="sm" type="button" className="nucleo-v22-pill" variant={tab===t.key?"default":"outline"}
     aria-pressed={tab===t.key} onClick={()=>{setTab(t.key);setSelectedId("");}}>{t.title}</Button>)}
  </div>
  {loading&&<p role="status" className="rounded-md border bg-muted/30 p-3 text-sm">Consultando fontes governadas…</p>}
  {error&&<p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
  {!loading&&!error&&<>
   <div className="grid gap-2 sm:grid-cols-2">
    <label className="text-sm font-medium">Buscar contribuições
     <Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Título, papel, origem"/>
    </label>
    <label className="text-sm font-medium">Categoria documental
     <select className="w-full min-h-11 border rounded-md bg-background px-3 text-sm" value={category}
      onChange={e=>setCategory(e.target.value)}>
      <option value="todas">Todas as categorias</option>
      {AC01_DOCUMENT_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
     </select>
    </label>
   </div>
   <div className="flex flex-wrap gap-2">
    <Badge variant="outline" className="nucleo-v22-ac01-count">{visibleProposals.length} propostas</Badge>
    <Badge variant="outline" className="nucleo-v22-ac01-count">{visibleEvolving.length} em evolução</Badge>
    <Badge variant="outline" className="nucleo-v22-ac01-count">{pending.length} pedidos aguardando decisão</Badge>
    <Badge variant="outline" className="nucleo-v22-ac01-count">{published.length} publicações AC-01 no recorte</Badge>
   </div>
   {tab==="vigente"&&<div className="space-y-2">
    <p className="nucleo-v22-guard text-xs">Vigente canônico exige fonte original + ato competente + sincronização comprovada. Publicação interna AC-01 não comprova a vigência em Drive/GitHub/Ficha Viva.</p>
    {activeFM.length>0?<div className="space-y-2"><strong className="text-sm">Fichas Vivas — autoridade declarada, não comprovada externamente</strong>
     {activeFM.map(x=><div key={x.id} className="rounded border p-3 text-xs">
      <strong>{x.section_code} · {x.title} · v{x.version_no}</strong>
      <p>Estado declarado: {x.authority_state}</p>
      <p className="break-all">Fonte: {x.source_reference||"não informada"}</p>
     </div>)}<p className="text-xs text-muted-foreground">A declaração FM não é homologação AC-01 por inferência.</p></div>
    :<p className="text-xs">Nenhuma Ficha Viva com estado vigente/homologado foi retornada nesta consulta. Isto não certifica ausência de método válido nas fontes externas.</p>}
    {currentByScope.size>0?<div className="space-y-2"><strong className="text-sm">Últimas publicações internas AC-01 — sem atualização automática da fonte canônica</strong>
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
   {tab==="decisao"&&<section className="rounded-md border p-3 space-y-2"
      aria-label="Fila consultiva de consolidação documental CA-26 e CA-28">
      <h5 className="text-sm font-semibold">Pendências para consolidação assistida</h5>
      <p className="text-xs text-muted-foreground">
        Visão derivada do mesmo recorte AC-01 e FM já consultado. Sem ato decisório,
        publicação ou consolidação automática. Ausência de pendência neste recorte
        não comprova homologação ou completude histórica.
      </p>
      <p className="text-xs">Cadeias documentais: {queue.length} · com pendências: {queue.filter(item=>item.issues.length>0).length}</p>
      {queue.length===0&&<p role="status" className="text-xs text-muted-foreground">
        Nenhuma contribuição registrada neste recorte. Documentos externos não foram inspecionados.
      </p>}
      {queue.filter(item=>category==="todas"||item.kind===category)
        .filter(item=>!declaredRole||item.role===declaredRole)
        .filter(item=>!query.trim()||[item.title,item.role,item.kind]
          .some(value=>value.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))))
        .map(item=><article key={item.lineageId} className="rounded border p-2 text-xs space-y-2">
          <div className="flex flex-wrap justify-between gap-2">
            <p className="font-semibold">{item.title} · v{item.version} · {item.kind}</p>
            <Badge variant="outline">{item.status==="exige_conciliacao"?"Conciliação necessária":"Revisão humana necessária"}</Badge>
          </div>
          <p>{item.matchedFm} referência(s) FM com localizador textualmente idêntico, sem vínculo canônico.</p>
          {item.issues.map(issue=><p key={issue} className="text-muted-foreground">Pendência: {AC01_QUEUE_ISSUE_LABELS[issue]}</p>)}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="button" variant="outline"
              onClick={()=>{setSelectedId(item.contributionId);setReviewHistoryOpen(false);}}>
              Examinar linhagem no AC-01
            </Button>
            {onOpenPendingReview&&<Button size="sm" type="button" variant="outline"
              onClick={()=>onOpenPendingReview(item.contributionId,item.issues)}>
              Abrir ações de revisão existentes
            </Button>}
          </div>
        </article>)}
    </section>}
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
   {summary&&<section className="rounded-md border p-3 space-y-3 text-xs"
      aria-label="Estado documental consolidado da contribuição selecionada">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm">Estado documental · {summary.title} · v{summary.version}</strong>
        <Badge variant="outline">Contribuição {summary.declaredState}</Badge>
      </div>
      <p className="text-muted-foreground">
        Resumo do recorte AC-01 autorizado, sem certificação de autoridade,
        resolução de pendências, publicação externa ou homologação.
      </p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <div className="rounded border p-2"><strong>{summary.visibleVersions}</strong><p>Versões visíveis</p></div>
        <div className="rounded border p-2"><strong>{summary.chainIssueCount}</strong><p>Lacunas de linhagem</p></div>
        <div className="rounded border p-2"><strong>{summary.requestCount}</strong><p>Solicitações registradas</p></div>
        <div className="rounded border p-2"><strong>{summary.decisionCount}</strong><p>Decisões ligadas por IDs</p></div>
        <div className="rounded border p-2"><strong>{summary.internalPublicationCount}</strong><p>Publicações internas ligadas</p></div>
        <div className="rounded border p-2"><strong>{summary.pendingReviewCount}</strong><p>Critérios pendentes</p></div>
      </div>
      <p className="break-all">Origem declarada: {summary.sourceKind} · {summary.sourceLocator}</p>
      <p>Referência FM: {summary.validFmTarget
         ?summary.locatorMatch==="localizador_identico"?"Localizador idêntico, sem associação canônica"
          :summary.locatorMatch==="referencia_insuficiente"?"Referência insuficiente"
          :"Origem divergente ou não reconciliada"
         :"Nenhum destino FM selecionado"}</p>
      <p>Critérios: {summary.foundRecordCount} registro(s) localizado(s);
        {" "+summary.needsCheckCount} a conferir; {" "+summary.pendingReviewCount} pendente(s).</p>
      <p className="font-medium">Autoridade não certificada nesta prévia ·
        pendências não encerradas · publicação externa não verificada.</p>
    </section>}
   {selected&&<div id="nucleo-ac01-selected-evidence" className="rounded border p-3 space-y-1 text-xs">
    <strong>Referência selecionada: {selected.title} · v{selected.version_no}</strong>
    <p>Especialidade: {selected.specialist_role}; categoria: {selected.contribution_kind}</p>
    <p>Autor autenticado: {selected.recorded_by_auth_uid.slice(0,8)}… · registrado em {new Date(selected.recorded_at).toLocaleString("pt-BR")}</p>
    <p className="break-all">Original preservado em: {selected.source_kind} · {selected.source_locator}</p>
    <p className="text-muted-foreground">Qualquer comparação de conteúdo requer acesso válido à fonte original. Sem diffs fictícios nem aprovação implícita.</p>
    {lineage&&<details className="rounded-md border p-3 space-y-2" aria-label="Linhagem documental e atos registrados">
      <summary className="cursor-pointer font-semibold">Rastrear versões, pedidos, decisões, publicações internas e candidatos FM ({lineage.entries.length} versão(ões))</summary>
      <p className="mt-2 text-muted-foreground">
        Os IDs e vínculos de atos AC-01 provêm do Core; os candidatos FM são comparados
        apenas por localizador de origem e NÃO possuem vínculo persistido. Publicação
        AC-01 não confirma publicação no documento externo nem revisão FM homologada.
      </p>
      {lineage.issues.map((issue,index)=><p key={index} role="status" className="rounded border p-2">
        Reconciliação necessária: {issue}
      </p>)}
      {lineage.entries.map(entry=><article key={entry.id} className="rounded border p-2 space-y-1">
        <p className="font-semibold">Contribuição v{entry.version} · {entry.authorityState}</p>
        <p className="text-muted-foreground">ID: {entry.id} · anterior: {entry.parentId??"inicial"} · {new Date(entry.recordedAt).toLocaleString("pt-BR")}</p>
        <p className="break-all">Origem declarada: {entry.sourceLocator}</p>
        <p>Solicitações vinculadas por ID: {entry.requests.length} · decisões com solicitação no recorte: {entry.decisions.length} · publicações internas: {entry.publications.length}</p>
        {entry.requests.map(request=><p key={request.id}>Pedido: {request.outcome} · {new Date(request.recordedAt).toLocaleString("pt-BR")}</p>)}
        {entry.decisions.map(decision=><p key={decision.id}>Decisão registrada: {decision.outcome} · solicitação {decision.requestId.slice(0,8)}…</p>)}
        {entry.publications.map(pub=><p key={pub.id}>
          Publicação interna {pub.id.slice(0,8)}… · {pub.chainConfirmed?"decisão ligada por ID neste recorte":"decisão correspondente não confirmada neste recorte"} · {new Date(pub.recordedAt).toLocaleString("pt-BR")}
        </p>)}
      </article>)}
      <div className="rounded border p-2 space-y-1">
        <p className="font-semibold">Revisões FM candidatas do módulo (não vinculadas por ID): {lineage.fmCandidates.length}</p>
        {lineage.fmCandidates.length===0&&<p>Sem revisão FM retornada neste recorte; não significa ausência de fonte externa.</p>}
        {lineage.fmCandidates.map(candidate=><p key={candidate.id}>
          {candidate.section} · v{candidate.version} · {candidate.declaredAuthority} ·
          {candidate.match==="localizador_identico"?" localizador textualmente idêntico"
            :candidate.match==="referencia_insuficiente"?" origem insuficiente":" localizadores divergentes"}
        </p>)}
      </div>
    </details>}

    <div className="nucleo-v22-guard space-y-2 border-t pt-2"><strong>Prévia de reconciliação canônica — bloqueada</strong>
     <p className="text-muted-foreground">
       AC-01 e FM têm registros independentes, sem vínculo de contribuição para revisão por ID.
       Coincidência de localizador é somente uma pista textual: não comprova o mesmo conteúdo,
       versão, validade, publicação, homologação ou associação persistida.
     </p>
     <p>Revisões FM no recorte deste módulo: {relatedFM.length} ·
       Localizador idêntico: {relatedFM.filter(item=>item.match==="localizador_identico").length}</p>
     {relatedFM.length===0&&<p role="status">Nenhuma revisão FM retornada nesta consulta.
       Não inferir ausência do documento na fonte externa.</p>}
     <label className="block">Alvo de Ficha Viva para análise (sem alteração)
       <select className="w-full rounded border bg-background p-2" value={targetId} onChange={e=>setTargetId(e.target.value)}>
        <option value="">Não selecionado</option>
        {fm.map(x=><option key={x.id} value={x.id}>
          {x.section_code} · {x.title} · v{x.version_no} ·
          {selected?compareAc01FmSource(selected,x)==="localizador_identico"
            ?" localizador declarado idêntico"
            :compareAc01FmSource(selected,x)==="referencia_insuficiente"
              ?" origem insuficiente":" localizador divergente"
            :" origem não comparada"}
        </option>)}
       </select>
     </label>
     {selectedMatch&&<p role="status" className="rounded-md border p-2">
       Comparação do alvo: {selectedMatch==="localizador_identico"
         ?"localizador textualmente idêntico — vínculo NÃO comprovado"
         :selectedMatch==="referencia_insuficiente"
           ?"origem insuficiente para comparar"
           :"localizador divergente — conferir versões e fontes"}.
       {selectedFM&&" Estado declarado FM: "+selectedFM.authority_state+"; sem promoção de autoridade."}
     </p>}
     {assisted&&<details className="rounded-md border p-3 space-y-3"
       aria-label="Preparação de consolidação assistida e comparação de metadados">
       <summary className="cursor-pointer font-semibold">Examinar lado a lado a origem, a versão anterior e a revisão FM</summary>
       <p className="mt-2 text-muted-foreground">
         Esta comparação usa apenas metadados presentes no Core: não há texto do arquivo
         original nem corpo da revisão FM nesta consulta. Nenhuma diferença de conteúdo
         externo é presumida; o documento vigente não é alterado.
       </p>
       {assisted.issues.map((issue,index)=><p key={index} role="status" className="rounded border p-2">
         Limite de verificação: {issue}
       </p>)}
       <div className="grid gap-2 md:grid-cols-2">
         <article className="rounded-md border p-3 space-y-2">
           <p className="font-semibold">Contribuição AC-01 · v{assisted.current.version}</p>
           <p>{assisted.current.title}</p>
           <p>Estado: {assisted.current.authority}</p>
           <p>Origem: {assisted.current.kind}</p>
           <p className="break-all">Localizador: {assisted.current.source}</p>
           <p>Anterior: {assisted.previous?"v"+assisted.previous.version:"indisponível ou inicial"}</p>
         </article>
         <article className="rounded-md border p-3 space-y-2">
           <p className="font-semibold">Revisão FM selecionada (somente análise)</p>
           {assisted.destination?<div className="space-y-2">
             <p>{assisted.destination.section} · v{assisted.destination.version} · {assisted.destination.title}</p>
             <p>Estado declarado: {assisted.destination.authority}</p>
             <p className="break-all">Fontes declaradas: {assisted.destination.source||"não informadas"}</p>
             <p>Origem: {assisted.originMatch==="localizador_identico"
               ?"localizador idêntico, sem vínculo comprovado"
               :assisted.originMatch==="referencia_insuficiente"
                 ?"referência insuficiente":"localizador divergente"}</p>
           </div>:<p>Nenhuma revisão FM válida selecionada neste módulo.</p>}
         </article>
       </div>
       <div className="space-y-2">
         <p className="font-semibold">Diferenças de metadados AC-01 · anterior versus atual</p>
         <p role="status" className="text-xs text-muted-foreground">
           Metadados comparados: {assisted.summary.included} inclusão(ões), {assisted.summary.removed} remoção(ões),
           {" "}{assisted.summary.changed} alteração(ões), {assisted.summary.maintained} mantido(s) e
           {" "}{assisted.summary.indeterminate} indeterminado(s). Não representa diferenças de texto dos documentos.
         </p>
         {assisted.differences.map(diff=><div key={diff.label} className="rounded border p-2 space-y-1">
           <p className="font-medium">{diff.label} · {diff.kind==="indeterminado"?"sem anterior comparável":diff.kind}</p>
           <div className="grid gap-2 md:grid-cols-2">
             <p className="break-all">Anterior: {diff.previous}</p>
             <p className="break-all">Atual: {diff.current}</p>
           </div>
         </div>)}
         <p className="text-muted-foreground">
           Resultado apenas consultivo: sem diff de conteúdo externo, sem diff do corpo FM,
           sem consolidação canônica, aprovação ou publicação automatizada.
         </p>
       </div>
     </details>}
     {selected&&assisted?.previous&&contributions.find(c=>c.id===assisted.previous?.id)&&
      <NucleoAc01ContentComparison key={selected.id+moduleId}
       previous={contributions.find(c=>c.id===assisted.previous?.id)!} current={selected} />}
     {review&&<section className="rounded-md border p-3 space-y-2"
       aria-label="Critérios verificáveis para revisão humana e consolidação assistida">
       <div className="flex flex-wrap items-center justify-between gap-2">
         <p className="font-semibold">Critérios de revisão antes de consolidar</p>
         <Badge variant="outline">{review.pendingCount} pendência(s) identificada(s)</Badge>
       </div>
       <p className="text-muted-foreground">
         Conferência do recorte AC-01/FM carregado. Estado registrado ou sem pendência
         encontrada não dispensa revisão independente, aprovação competente,
         verificação da fonte original nem publicação controlada.
       </p>
       <div className="grid gap-2 md:grid-cols-2">
         {review.criteria.map(criterion=><article key={criterion.code}
           className="rounded border p-2 space-y-1">
           <div className="flex flex-wrap items-center gap-2">
             <p className="font-semibold">{criterion.title}</p>
             <Badge variant="outline">{criterion.result==="registrado"?"Registro localizado":
               criterion.result==="conferir"?"Conferir": "Pendente"}</Badge>
           </div>
           <p className="text-muted-foreground">{criterion.detail}</p>
         </article>)}
       </div>
       <p className="font-medium">Consolidação e publicação continuam bloqueadas: este painel não registra aceite nem executa escrita.</p>
     </section>}
     <div className="rounded-md border p-3 space-y-2">
       <div className="flex flex-wrap items-center justify-between gap-2">
         <p className="text-sm font-semibold">Continuidade da revisão independente</p>
         <Button type="button" size="sm" variant="outline"
           aria-expanded={reviewHistoryOpen}
           onClick={()=>setReviewHistoryOpen(open=>!open)}>
           {reviewHistoryOpen?"Ocultar histórico de revisão":"Consultar trilha de revisão AC-01"}
         </Button>
       </div>
       <p className="text-xs text-muted-foreground">
         Consulte os eventos reais da contribuição selecionada. Nenhum comentário,
         pedido de refinamento, minuta ou encaminhamento equivale a decisão ou publicação.
       </p>
       {reviewHistoryOpen&&<NucleoAC01ReviewContinuityRead
         key={selected.id} moduleId={moduleId} contributionId={selected.id}/>}
     </div>
     {reviewBrief&&<details className="rounded-md border p-3 space-y-3"
       aria-label="Preparação do repasse para revisão humana AC-01">
       <summary className="cursor-pointer font-semibold">
         Preparar conferência humana de origem, versões e decisões ({reviewBrief.unverifiedTasks} verificação(ões) aberta(s))
       </summary>
       <p className="mt-2 text-muted-foreground">
         Resumo temporário do recorte já autorizado. Não é documento de aprovação,
         não contém conteúdo externo, não substitui o original e não certifica
         que todas as versões ou atos históricos foram retornados.
       </p>
       <div className="grid gap-2 md:grid-cols-2">
         <div className="rounded border p-2 space-y-1">
           <p className="font-semibold">Identificação para revisão</p>
           <p className="break-all">Contribuição ID: {reviewBrief.contributionId} · v{reviewBrief.contributionVersion}</p>
           <p className="break-all">Cadeia ID: {reviewBrief.lineageId} · {reviewBrief.visibleVersions} versão(ões) visíveis</p>
           <p className="break-all">Localizador original: {reviewBrief.originalLocator}</p>
         </div>
         <div className="rounded border p-2 space-y-1">
           <p className="font-semibold">Destino e atos localizados</p>
           <p>{reviewBrief.target?reviewBrief.target.section+" · FM v"+reviewBrief.target.version:"Sem destino FM reconciliado"}</p>
           <p>Pedidos por ID: {reviewBrief.requests.length} · decisões vinculadas: {reviewBrief.decisions.length}</p>
           <p>Publicações internas com decisão relacionada: {reviewBrief.internalPublications.length}</p>
           <p>Publicação externa: não verificada</p>
         </div>
       </div>
       {reviewBrief.chainIssues.map((issue,index)=><p key={index} role="status" className="rounded border p-2">
         Lacuna na cadeia: {issue}
       </p>)}
       <div className="space-y-2">
         <p className="font-semibold">Ações que o revisor deverá conferir fora desta prévia</p>
         {reviewBrief.tasks.map(task=><article key={task.code} className="rounded border p-2 space-y-1">
           <p className="font-medium">{task.label} · {task.status==="registrado"?"registro localizado":task.status==="conferir"?"conferência necessária":"pendência"}</p>
           <p>{task.requiredAction}</p>
           <p className="text-muted-foreground">Limite atual: {task.reason}</p>
         </article>)}
       </div>
       <p className="font-medium">Repasse informativo: a revisão, o aceite, a decisão e a publicação permanecem fora desta ação.</p>
     </details>}
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
