import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import NucleoAC01ReviewTrail from "@/components/nucleo/NucleoAC01ReviewTrail";
import { continuityContext, deskFilter, latestContributions } from "@/lib/nucleo/ac01ReadOnlyDesk";
import type { ContributionMetadata, DeskState } from "@/lib/nucleo/ac01ReadOnlyDesk";
import { AC01_QUEUE_ISSUE_LABELS, type Ac01QueueIssue } from "@/lib/nucleo/ac01ConsolidationQueueV13";
import { preparePendingReviewGuidance } from "@/lib/nucleo/ac01PendingReviewGuidanceV13";

type Props={moduleName:string;declaredRole:string;rows:ContributionMetadata[];readAt:string;
 requestedReview?:{contributionId:string;issues:readonly Ac01QueueIssue[];seq:number}|null};
export default function NucleoContributionDesk({moduleName,declaredRole,rows,readAt,requestedReview}:Props) {
 const [query,setQuery]=useState("");
 const [state,setState]=useState<DeskState>("todas");
 const [selectedId,setSelectedId]=useState("");
 const [prepared,setPrepared]=useState("");
 const [notice,setNotice]=useState("");
 const latest=useMemo(()=>latestContributions(rows),[rows]);
 const visible=useMemo(()=>deskFilter(latest,state,query),[latest,state,query]);
 const selected=latest.find(r=>r.id===selectedId);
 const suggested=selected&&requestedReview?.contributionId===selected.id
  ?preparePendingReviewGuidance(requestedReview.issues):[];
 useEffect(()=>{
  if(!requestedReview)return;
  // A fila de revisão só opera a versão mais recente; não inventar atalho para histórico.
  setSelectedId(requestedReview.contributionId);setState("todas");setQuery("");
  setPrepared("");setNotice("");
 },[requestedReview]);
 const previous=selected?.parent_revision_id ? rows.find(r=>r.id===selected.parent_revision_id):null;
 const prepare=()=>{
   if(!selected)return;
   setPrepared([
     "RASCUNHO DE CONSOLIDAÇÃO — NÃO HOMOLOGADO / NÃO SALVO NO CORE",
     "Módulo: "+moduleName,
     "Papel declarado: "+selected.specialist_role,
     "Contribuição: "+selected.title+" · v"+selected.version_no,
     "Origem declarada: "+selected.source_kind+" · "+selected.source_locator,
     "Hash declarado: "+(selected.source_checksum_sha256||"não informado"),
     "Antecessor: "+(previous?"v"+previous.version_no+" · "+previous.source_locator:"não recuperado neste recorte"),
     "Diferenças de metadados: "+(previous ? [
       selected.title!==previous.title?"título":"",
       selected.source_locator!==previous.source_locator?"localizador":"",
       selected.source_checksum_sha256!==previous.source_checksum_sha256?"checksum":"",
       selected.note!==previous.note?"nota":"",
     ].filter(Boolean).join(", ")||"nenhuma declarada" : "comparação indisponível"),
     "Verificações pendentes: conteúdo original e direitos de acesso, conflitos, revisão por autoridade, decisão formal, destino canônico e readback.",
     "Nenhuma IA pode homologar, atualizar vigência ou inferir conteúdo privado destas referências.",
   ].join("\n"));
   setNotice("Rascunho preparado apenas nesta tela. Não salvo, enviado à IA ou homologado.");
 };
 const copy=async(value:string)=>{
   try{await navigator.clipboard.writeText(value);setNotice("Texto copiado. Transmita somente a destinatários autorizados.");}
   catch{setNotice("Cópia indisponível no navegador. Nenhum dado foi enviado.");}
 };
 return <div className="nucleo-v22-surface space-y-3 p-3 md:p-4" aria-label="Fila consultiva do gestor AC-01">
   <div>
     <h5 className="nucleo-v22-title text-lg">Fila do gestor · Conhecimento e Evolução</h5>
     <p className="text-xs text-muted-foreground">Fila derivada apenas das contribuições AC-01 visíveis, sem decisões ou vigências presumidas. Consulta em {new Date(readAt).toLocaleString("pt-BR")}.</p>
   </div>
   <div className="grid gap-2 sm:grid-cols-3">
     <div className="nucleo-v22-status-tile text-sm" data-state="planejado"><strong>{latest.length}</strong><p className="text-xs">Linhagens no recorte</p></div>
     <div className="nucleo-v22-status-tile text-sm" data-state="planejado"><strong>{latest.filter(r=>r.authority_state==="proposta").length}</strong><p className="text-xs">Propostas sem decisão</p></div>
     <div className="nucleo-v22-status-tile text-sm" data-state="em_andamento"><strong>{latest.filter(r=>r.authority_state==="em_evolucao").length}</strong><p className="text-xs">Em evolução</p></div>
   </div>
   <div className="grid gap-2 sm:grid-cols-2">
     <label className="text-xs">Buscar título, especialista, origem ou tipo
       <Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Localizar contribuição"/>
     </label>
     <label className="text-xs">Estado da proposta
       <select className="w-full h-10 rounded-md border bg-background px-2" value={state} onChange={e=>setState(e.target.value as DeskState)}>
         <option value="todas">Todas as pendências</option><option value="proposta">Propostas</option><option value="em_evolucao">Em evolução</option>
       </select>
     </label>
   </div>
   {visible.length===0&&<p className="text-sm text-muted-foreground">Nenhuma contribuição encontrada no filtro. A ausência de registros AC-01 não comprova ausência de métodos externos.</p>}
   <div className="grid gap-2 sm:grid-cols-2">
     {visible.map(item=><button key={item.id} type="button" onClick={()=>{setSelectedId(item.id);setPrepared("");setNotice("");}}
       className={"nucleo-v22-card-hover rounded-md border p-3 text-left text-sm hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring "+(selectedId===item.id?"nucleo-v22-selected":"")}
       aria-pressed={selectedId===item.id}>
       <div className="flex flex-wrap items-center gap-2"><strong>{item.title}</strong><Badge variant="outline">v{item.version_no}</Badge></div>
       <p className="text-xs mt-1">{item.specialist_role} · {item.contribution_kind}</p>
       <p className="text-xs text-muted-foreground">{item.authority_state} · {item.source_kind}</p>
     </button>)}
   </div>
   {selected&&<div className="nucleo-v22-soft-surface space-y-2 p-3 text-sm">
     <strong>Preparação de consolidação · {selected.title}</strong>
     <p className="text-xs">Versão {selected.version_no}; origem declarada: {selected.source_kind}. Conteúdo original não foi acessado.</p>
     <p className="text-xs break-all">Localizador: {selected.source_locator}</p>
     <p className="text-xs">Antecessor: {previous?"v"+previous.version_no:"indisponível neste recorte"} · Estado: {selected.authority_state}</p>
     <p className="text-xs text-muted-foreground">Ações governadas disponíveis: registrar comentário, solicitar refinamento, salvar minuta e encaminhar para avaliação. Nenhuma dessas ações constitui decisão homologatória ou alteração de vigência.</p>
     <Button size="sm" type="button" variant="outline" onClick={prepare}>Preparar minuta (sem salvar)</Button>
     {prepared&&<div className="space-y-2"><label className="text-xs">Minuta consultiva editável — permanece apenas nesta sessão
       <Textarea value={prepared} onChange={e=>setPrepared(e.target.value)} rows={10}/>
     </label><Button size="sm" variant="outline" type="button" onClick={()=>void copy(prepared)}>Copiar minuta</Button></div>}
     {suggested.length>0&&<div className="rounded border p-3 text-xs space-y-2"
       aria-label="Pendências encaminhadas para ações de revisão AC-01">
       <p className="font-semibold">Pendências para examinar nesta revisão</p>
       <p className="text-muted-foreground">Orientações de leitura, não eventos registrados. Se necessário, escolha manualmente a ação no formulário existente. Nenhuma pendência é encerrada por este atalho.</p>
       {suggested.map(item=><p key={item.issue} className="border-l-2 pl-2">
         {AC01_QUEUE_ISSUE_LABELS[item.issue]} · ação possível: {item.action==="solicitar_refinamento"?"Solicitar refinamento":"Comentário de análise"} · {item.instruction}
       </p>)}
     </div>}
     <NucleoAC01ReviewTrail key={selected.id} moduleId={selected.module_id} contributionId={selected.id} initialDraft={prepared}/>
   </div>}
   <div className="space-y-2 border-t pt-3">
     <h6 className="text-sm font-semibold">Contexto de continuidade para destinatário autorizado</h6>
     <p className="text-xs text-muted-foreground">Pacote de metadados para transição entre especialistas; não contém corpo dos documentos, credenciais, decisões soberanas ou confirmação de mandato. Conferir permissão da fonte antes de transmitir. Não enviado automaticamente a IA.</p>
     <Button type="button" size="sm" variant="outline" onClick={()=>void copy(JSON.stringify(continuityContext(moduleName,declaredRole,rows,readAt),null,2))}>Copiar contexto consultivo JSON</Button>
   </div>
   {notice&&<p role="status" className="text-xs">{notice}</p>}
 </div>;
}
