import {useEffect,useRef,useState} from "react";
import {useAuth} from "@/contexts/AuthContext";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import NucleoIdentityContext from "@/components/nucleo/NucleoIdentityContext";
type Front={code:string;title:string;status:string;evidence_state:string;next_action:string;evidence_count:number};
type Contribution={id:string;title:string;version_no:number;authority_state:string;source_kind:string;source_locator:string};
type Checkpoint={
 front_code:"NUC-M4";event_id:string;recorded_at:string;
 status_before:"em_validacao";status_after:"em_validacao";
 decision:string;decision_source:string;checkpoint_source:string;lesson:string;
 before_action:string;after_action:string;current_action:string;
 learning_state:"historico_verificado_sem_fm_homologado";
 fm09:string;fm10:string;authority:"consultivo_nao_homologado";source_scope:string;
};
type Context={
 checkpoint:Checkpoint;
 continuity_context?:unknown;
 contract:"nucleo_ac02_context_nuc_v1";
 status:"consultivo_nao_homologado";
 module:{id:string;code:"NUC"};
 specialist:{role:string;specialty:string;specialty_state:string;mandate:string;successor:string};
 contribution:Contribution;
 fronts:Front[];
 limitations:string[];
 checked_at:string;
};
const ID="636768e6-e782-4c7d-8132-e7381621be12";
const CONTRIBUTION_ID="80f64bfb-cfa0-4012-a2ad-b75226881c2d";
// Link fixo para a origem já referenciada pelo contrato AC-01 do piloto NUC.
// Um locator vindo do Core nunca é usado diretamente como URL.
// `main` mostra a fonte atual: não certifica os bytes da proposta registrada.
const PILOT_MAP_SOURCE="docs/architecture/MAPA_CONTINUIDADE_CANONICA_ESPECIALISTAS_NUCLEO20_V1_1_CONGELADO_PLANEJAMENTO_2026-11-19.md";
const PILOT_MAP_URL="https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/main/"+PILOT_MAP_SOURCE;


// U06 is additive: legacy responses still support the original consultive journey.
// Only allowlisted metadata and the root action are displayed, never FM bodies or locators.
type U06Meta={root:{next_action_record:string;updated_at:string};sections:{code:string;version:number;authority:string}[];revisions:{id:string;version:number;authority:string}[]};
type U06Diagnostic={state:"legacy"|"incomplete"}|{state:"current";data:U06Meta};
function inspectU06(value:unknown):U06Diagnostic{
 const obj=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:null;
 const str=(v:unknown):v is string=>typeof v==="string"&&v.trim().length>0;
 const version=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>0;
 if(value===undefined)return {state:"legacy"};
 const c=obj(value),root=obj(c?.root);
 if(!c||c.kind!=="nucleo_ac02_leitura_contextual_u06"||c.authority!=="consultivo_nao_homologado"||
    !root||root.id!==ID||root.code!=="NUC"||typeof root.next_action_record!=="string"||
    !str(root.updated_at)||!Number.isFinite(Date.parse(root.updated_at))||
    !Array.isArray(c.sections)||c.sections.length!==4||!Array.isArray(c.ac01_revisions)||
    c.ac01_revisions.length===0||c.ac01_revisions.length>=100)return {state:"incomplete"};
 const expected=["FM-03","FM-08","FM-09","FM-10"];
 const sections:U06Meta["sections"]=[];
 for(const item of c.sections){
  const row=obj(item),r=obj(row?.revision);
  if(!row||row.state!=="registro_core"||!str(row.section_code)||!expected.includes(row.section_code)||
     sections.some(x=>x.code===row.section_code)||!r||r.section_code!==row.section_code||
     !version(r.version_no)||!str(r.authority_state))return {state:"incomplete"};
  sections.push({code:row.section_code,version:r.version_no,authority:r.authority_state});
 }
 const revisions:U06Meta["revisions"]=[];
 for(const item of c.ac01_revisions){
  const r=obj(item);
  if(!r||!str(r.id)||!version(r.version_no)||!str(r.authority_state)||revisions.some(x=>x.id===r.id))
   return {state:"incomplete"};
  revisions.push({id:r.id,version:r.version_no,authority:r.authority_state});
 }
 return {state:"current",data:{root:{next_action_record:root.next_action_record,updated_at:root.updated_at},sections,revisions}};
}

const isContext=(v:unknown):v is Context=>{
 if(!v||typeof v!=="object")return false;
 const item=v as Partial<Context>;
 return item.contract==="nucleo_ac02_context_nuc_v1"&&
   item.status==="consultivo_nao_homologado"&&item.module?.id===ID&&item.module?.code==="NUC"&&
   item.contribution?.id===CONTRIBUTION_ID&&item.contribution.authority_state==="proposta"&&
   item.contribution.version_no===1&&Array.isArray(item.fronts)&&item.fronts.length===6&&
   item.fronts.every(f=>/^NUC-M[0-5]$/.test(f.code)&&Number.isSafeInteger(f.evidence_count)&&
      typeof f.next_action==="string")&&
   new Set(item.fronts.map(f=>f.code)).size===6&&Array.isArray(item.limitations)&&
   item.checkpoint?.front_code==="NUC-M4"&&item.checkpoint.event_id==="96415dff-3efb-4b09-8fb3-ac39f113fde4"&&
   item.checkpoint.status_before==="em_validacao"&&item.checkpoint.status_after==="em_validacao"&&
   item.checkpoint.authority==="consultivo_nao_homologado"&&
   item.checkpoint.learning_state==="historico_verificado_sem_fm_homologado"&&
   ["sem_revisao_visivel_sob_rls","revisao_visivel_sem_assertiva_de_vigencia"].includes(item.checkpoint.fm09)&&
   ["sem_revisao_visivel_sob_rls","revisao_visivel_sem_assertiva_de_vigencia"].includes(item.checkpoint.fm10);
};
/**
 * Resumo de DELIBERAÇÃO FUTURA construído somente com a projeção AC-02
 * autenticada, sem consultar documentos privados ou escrever no Core.
 * Texto copiável exige ação explícita e nunca equivale a aceite/homologação.
 */
function buildConsultiveDecisionSummary(context:Context):string{
 const m4=context.fronts.find(front=>front.code==="NUC-M4");
 const fm=(value:string)=>value==="sem_revisao_visivel_sob_rls"
   ?"sem revisão visível sob a permissão da consulta"
   :"revisão visível sem vigência certificada";
 const recordedAt=Number.isNaN(Date.parse(context.checked_at))
   ?context.checked_at:new Date(context.checked_at).toLocaleString("pt-BR");
 return [
  "NÚCLEO 2.0 — SUBSÍDIO CONSULTIVO À CAMADA MESTRE",
  "Natureza: preparação de leitura; NÃO é decisão, homologação, mandato nem pacote de assunção.",
  `Consulta AC-02: ${recordedAt} · contrato ${context.contract} · ${context.status}`,
  "",
  "1. ORIGEM DOCUMENTAL AC-01",
  `Título: ${context.contribution.title}`,
  `Contribuição: ${context.contribution.id} · versão ${context.contribution.version_no} · estado ${context.contribution.authority_state}`,
  `Origem: ${context.contribution.source_kind} · ${context.contribution.source_locator}`,
  "A proposta preserva sua versão e origem; não é método homologado ou vigente.",
  "",
  "2. F5 — CHECKPOINT OPERACIONAL NUC-M4",
  `Frente M3: NUC-M4 · estado lido: ${m4?.status??"não informado"}`,
  `Evento: ${context.checkpoint.event_id} · antes ${context.checkpoint.status_before} → depois ${context.checkpoint.status_after}`,
  `Decisão registrada: ${context.checkpoint.decision}`,
  `Lição: ${context.checkpoint.lesson}`,
  `Próxima ação M3: ${context.checkpoint.current_action}`,
  `Origem da decisão: ${context.checkpoint.decision_source}`,
  `Origem do checkpoint: ${context.checkpoint.checkpoint_source}`,
  `FM-09: ${fm(context.checkpoint.fm09)}; FM-10: ${fm(context.checkpoint.fm10)}.`,
  "Aceite técnico não equivale a encerramento operacional ou vigência documental.",
  "",
  "3. FRONTEIRAS DE AUTORIDADE",
  `Especialidade: ${context.specialist.specialty} (${context.specialist.specialty_state})`,
  `Mandato: ${context.specialist.mandate} · sucessor: ${context.specialist.successor}`,
  "Qualquer decisão de conteúdo/vigência, publicação, mandato, entrega e sucessão exige ato competente separado.",
  "",
  "4. PONTOS PARA DELIBERAÇÃO FUTURA — NÃO APROVADOS",
  "Conferir a origem e a versão da contribuição AC-01 e a evidência F5 no Core.",
  "Distinguir proposta documental, aceite técnico M4 e conclusão operacional.",
  "Não presumir F6/F7, sucessor, nem autorização de escrita ou migração F1/F2.",
  `Restrições informadas pelo Core: ${context.limitations.join(" ")}`,
  "",
  "FIM DO SUBSÍDIO CONSULTIVO — nenhuma alteração ou decisão foi realizada."
 ].join("\n");
}
export default function NucleoAc02NucContextRead(){
 const {session,loading}=useAuth();
 const sessionUid=loading?null:session?.user?.id??null;
 // A identidade corrente é lida também após respostas assíncronas.
 const identityRef=useRef<string|null>(sessionUid);
 identityRef.current=sessionUid;
 const [resultOwner,setResultOwner]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<Context|null>(null);
 const [error,setError]=useState("");
 const [copyStatus,setCopyStatus]=useState<"idle"|"copied"|"failed">("idle");
 const [focusedFront,setFocusedFront]=useState("NUC-M4");
 const visibleResult=sessionUid&&resultOwner===sessionUid?result:null;
 const decisionSummary=visibleResult?buildConsultiveDecisionSummary(visibleResult):null;
 const u06=visibleResult?inspectU06(visibleResult.continuity_context):null;
 useEffect(()=>{
  // Apenas mudança de identidade encerra o contexto, nunca refresh do token.
  setResult(null);setResultOwner(null);setError("");setCopyStatus("idle");
 },[sessionUid]);
 async function read(){
  if(busy)return;
  setBusy(true);setError("");setResult(null);setResultOwner(null);setCopyStatus("idle");
  try{
   const user=await supabase.auth.getUser();
   if(user.error||!user.data.user||user.data.user.id!==sessionUid){setError("Sessão pessoal não comprovada. Entre na conta autorizada.");return;}
   const requestUid=user.data.user.id;
   const response=await supabase.functions.invoke("nucleo-ac02-context-read",{body:{module_id:ID,include_checkpoint:true}});
   if(response.error||!isContext(response.data)){
    setError("Consulta indisponível, negada ou incompleta. Sem pacote de assunção certificado.");return;
   }
   // Descartar resposta antiga se houve troca de usuário durante a consulta.
   if(identityRef.current!==requestUid)return;
   const current=await supabase.auth.getUser();
   if(current.error||current.data.user?.id!==requestUid)return;
   if(identityRef.current!==requestUid)return;
   setResultOwner(requestUid);setResult(response.data);
  }catch{setError("Falha ao consultar o contexto protegido; nenhum estado foi alterado.");}
  finally{setBusy(false);}
 }
 return <section id="nucleo-ac02-consulta" tabIndex={-1} className="scroll-mt-28 rounded-xl border p-3 space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Assunção consultiva do Núcleo AC-02">
  <div className="space-y-1">
   <h4 className="text-sm font-semibold">Continuidade do Especialista Núcleo · AC-02</h4>
   <p className="text-xs text-muted-foreground">Consulta restrita por sessão e permissão. Não concede mandato, não homologa mapa nem entrega contexto a outro usuário.</p>
  </div>
  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>void read()}>
   {busy?"Consultando Core…":"Preparar contexto NUC para continuidade"}
  </Button>
  {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
  {visibleResult&&<div className="space-y-2">
   <p role="status" className="text-xs font-medium">Contexto consultivo confirmado pela leitura autenticada. Nenhum sucessor ou mandato foi certificado.</p>
   <p className="text-xs">Mapa: {visibleResult.contribution.title} · v{visibleResult.contribution.version_no} · {visibleResult.contribution.authority_state}</p>
   <p className="text-xs break-all">Contribuição AC-01: {visibleResult.contribution.id}</p>
   {u06&&<section className="rounded-lg border p-3 space-y-2 text-xs" aria-label="Diagnóstico da projeção contextual U06">
    <h5 className="font-semibold text-sm">Contexto de continuidade U06</h5>
    {u06.state==="legacy"&&<p role="status">Resposta legada: projeção U06 não recebida. A consulta anterior permanece disponível.</p>}
    {u06.state==="incomplete"&&<p role="status">Projeção U06 incompleta ou incompatível. Sem confirmação de cobertura contextual.</p>}
    {u06.state==="current"&&<>
     <p role="status">Projeção contextual U06 recebida e validada · consultivo_nao_homologado</p>
     <p>Raiz NUC · atualização do Core: {u06.data.root.updated_at}</p>
     <p>Seções FM recebidas: {u06.data.sections.length}/4</p>
     <ul>{u06.data.sections.map(row=><li key={row.code}>{row.code} · v{row.version} · {row.authority}</li>)}</ul>
     <p>Revisões AC-01 recebidas: {u06.data.revisions.length}</p>
     <ul>{u06.data.revisions.map(row=><li key={row.id} className="break-all">{row.id} · v{row.version} · {row.authority}</li>)}</ul>
     <details><summary className="cursor-pointer font-medium">Registro integral da próxima ação NUC</summary>
      <p className="whitespace-pre-wrap break-words">{u06.data.root.next_action_record}</p>
     </details>
    </>}
    <p className="text-muted-foreground">Diagnóstico da resposta desta sessão, não certifica vigência, mandato, sucessão, homologação ou acesso pelo Chat normal.</p>
   </section>}
   <p className="text-xs">Especialidade descritiva: {visibleResult.specialist.specialty} — não homologada</p>
   <section className="rounded-lg border p-3 space-y-2" aria-label="Identidade e vínculos de atuação">
    <h5 className="text-sm font-semibold">Especialidade e contexto de atuação</h5>
    <dl className="grid gap-2 sm:grid-cols-2 text-xs">
     <div><dt className="text-muted-foreground">Especialidade descritiva</dt><dd className="font-medium">{visibleResult.specialist.specialty}</dd></div>
     <div><dt className="text-muted-foreground">Papel funcional declarado</dt><dd>{visibleResult.specialist.role}</dd></div>
     <div><dt className="text-muted-foreground">Módulo de atuação consultado</dt><dd>{visibleResult.module.code} · <span className="break-all">{visibleResult.module.id}</span></dd></div>
     <div><dt className="text-muted-foreground">Identidade persistente / vínculo N:N</dt><dd>Consulte os vínculos autorizados abaixo; esta projeção descritiva não certifica o cadastro relacional.</dd></div>
     <div><dt className="text-muted-foreground">Método geral</dt><dd>Não certificado nesta consulta; a proposta AC-01 abaixo é uma referência de planejamento.</dd></div>
     <div><dt className="text-muted-foreground">Adaptação contextual</dt><dd>Frentes M3 e próximas ações abaixo; não equivalem a um método local vigente.</dd></div>
    </dl>
    <NucleoIdentityContext moduleId={ID} frontId={null}/>
    <p className="text-xs text-muted-foreground">Mandato: {visibleResult.specialist.mandate} · Sucessor: {visibleResult.specialist.successor}. A consulta não herda autoridade e não cria vínculo de atuação.</p>
    <div className="flex flex-wrap gap-2">
     <Button type="button" size="sm" variant="outline" onClick={()=>{const item=document.getElementById("nucleo-ac01-piloto");item?.scrollIntoView({block:"start"});item?.focus({preventScroll:true});}}>Consultar registro AC-01</Button>
     <Button type="button" size="sm" variant="outline" onClick={()=>{const item=document.getElementById("nucleo-ac02-quadro-decisao");item?.scrollIntoView({block:"start"});item?.focus({preventScroll:true});}}>Consultar continuidade e aprendizagem</Button>
    </div>
   </section>
   <section className="rounded-lg border p-3 space-y-3" aria-label="Painel de próximas ações das frentes NUC">
    <div className="space-y-1">
     <h5 className="font-semibold text-sm">Próximas ações · consulta do Core</h5>
     <p className="text-xs text-muted-foreground">
      Selecione uma frente para ler sua próxima ação original. A seleção só organiza a consulta:
      não muda prioridade, responsável, estado ou permissão.
     </p>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Selecionar frente NUC">
     {visibleResult.fronts.map(front=><Button key={front.code} type="button" size="sm"
      className="h-auto min-h-11 whitespace-normal justify-start text-left"
      variant={focusedFront===front.code?"secondary":"outline"}
      aria-pressed={focusedFront===front.code}
      onClick={()=>setFocusedFront(front.code)}>
      {front.code} · {front.status.replaceAll("_"," ")}
     </Button>)}
    </div>
    {visibleResult.fronts.filter(front=>front.code===focusedFront).map(front=><article key={front.code}
      className="rounded-md border p-3 space-y-2 text-xs" aria-live="polite">
     <h6 className="font-semibold text-sm">{front.code} · {front.title}</h6>
     <p>Estado no Core: <strong>{front.status}</strong> · Evidência: {front.evidence_state} · Registros M4 visíveis: {front.evidence_count}</p>
     <p className="font-medium">Próxima ação registrada:</p>
     <p className="whitespace-pre-wrap break-words">{front.next_action||"Sem próxima ação informada."}</p>
     <Button type="button" size="sm" variant="outline" onClick={()=>{
      const item=document.getElementById("nucleo-ac02-front-"+front.code);
      item?.scrollIntoView({behavior:"smooth",block:"start"});
      item?.focus({preventScroll:true});
     }}>Ver ficha completa da frente</Button>
    </article>)}
    <p className="text-xs text-muted-foreground">
     Este painel não atribui prioridade nova nem altera o planejamento M3.
     Testes e homologações adiados permanecem pendentes, sem bloquear consultas e avanços independentes.
    </p>
   </section>
   <div className="space-y-2">{visibleResult.fronts.map(front=><div key={front.code} id={"nucleo-ac02-front-"+front.code} tabIndex={-1} className="scroll-mt-28 rounded-md border p-2 text-xs space-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <p className="font-semibold">{front.code} · {front.title}</p>
    <p>Estado: {front.status} · Evidência: {front.evidence_state} · Provas M4 acessíveis: {front.evidence_count}</p>
    <p>Próxima ação M3: {front.next_action}</p>
   </div>)}</div>
   <section id="nucleo-ac02-quadro-decisao" tabIndex={-1} className="scroll-mt-28 rounded-lg border p-3 space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Quadro consultivo para preparar decisão documental">
    <div className="space-y-1">
     <h5 className="font-semibold text-sm">Quadro de preparação para decisão · sem homologação</h5>
     <p className="text-xs text-muted-foreground">
      Organiza somente o contexto recebido nesta consulta AC-02. Não inicia F6, não cria ato da Camada Mestre,
      não homologa conteúdo e não altera o estado de qualquer frente.
     </p>
    </div>
    <div className="grid gap-2 md:grid-cols-3">
     <article className="rounded-md border p-3 space-y-1 text-xs">
      <h6 className="font-semibold">1 · Proposta documental</h6>
      <p>AC-01 v{visibleResult.contribution.version_no} · estado informado pelo Core: <strong>{visibleResult.contribution.authority_state}</strong></p>
      <p className="text-muted-foreground">Fonte de origem: {visibleResult.contribution.source_kind} · {visibleResult.contribution.source_locator}</p>
      {visibleResult.contribution.source_kind==="github"&&visibleResult.contribution.source_locator===PILOT_MAP_SOURCE&&
       <p><a href={PILOT_MAP_URL} target="_blank" rel="noopener noreferrer"
        className="underline underline-offset-2">Abrir mapa na origem GitHub</a>
        <span className="block text-muted-foreground">Consulta ao arquivo atual da branch main; não certifica SHA-256, versão vigente ou homologação.</span></p>}
      <p className="text-muted-foreground">Próximo movimento: manter a proposta e a linhagem até decisão documental competente.</p>
     </article>
     <article className="rounded-md border p-3 space-y-1 text-xs">
      <h6 className="font-semibold">2 · Evidência operacional</h6>
      <p>NUC-M4 · antes {visibleResult.checkpoint.status_before} / depois {visibleResult.checkpoint.status_after}</p>
      <p>Frente atual: <strong>{visibleResult.fronts.find(front=>front.code==="NUC-M4")?.status??"não informada"}</strong></p>
      <p className="text-muted-foreground">Aceite técnico restrito não substitui conclusão operacional nem vigência documental.</p>
     </article>
     <article className="rounded-md border p-3 space-y-1 text-xs">
      <h6 className="font-semibold">3 · Autoridade ainda separada</h6>
      <p>Especialidade: {visibleResult.specialist.specialty_state}</p>
      <p>Mandato: {visibleResult.specialist.mandate} · Sucessor: {visibleResult.specialist.successor}</p>
      <p className="text-muted-foreground">Homologação, publicação, mandato, entrega e recebimento exigem atos próprios.</p>
     </article>
    </div>
    <details className="rounded-md border p-3 text-xs">
     <summary className="cursor-pointer font-medium">Fontes e pontos para futura deliberação</summary>
     <div className="mt-2 space-y-2">
      <p>Contribuição AC-01: <span className="break-all">{visibleResult.contribution.id}</span>.</p>
      <p>Evento de checkpoint M4: <span className="break-all">{visibleResult.checkpoint.event_id}</span>.</p>
      <p>FM-09: {visibleResult.checkpoint.fm09==="sem_revisao_visivel_sob_rls"?"sem revisão visível sob a permissão atual":"revisão visível sem vigência certificada"}.
       FM-10: {visibleResult.checkpoint.fm10==="sem_revisao_visivel_sob_rls"?"sem revisão visível sob a permissão atual":"revisão visível sem vigência certificada"}.</p>
      <p className="text-muted-foreground">Para decisão posterior, conferir fonte, conteúdo, versão, competência e efeito do ato.
       A ausência de revisão visível sob RLS não certifica inexistência global.</p>
     </div>
    </details>
    {decisionSummary&&<details className="rounded-md border p-3 text-xs space-y-2">
     <summary className="cursor-pointer font-medium">Preparar subsídio consultivo para a Camada Mestre</summary>
     <p className="mt-2 text-muted-foreground">
      Gerado exclusivamente com os campos da leitura AC-02 acima. Nenhuma decisão, homologação ou gravação é criada.
      Antes de encaminhar a outra pessoa, confira se ela possui autorização para acessar o contexto.
     </p>
     <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-sans text-xs" aria-label="Prévia do subsídio consultivo">{decisionSummary}</pre>
     <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={()=>void (async()=>{
       try{
        await navigator.clipboard.writeText(decisionSummary);
        setCopyStatus("copied");
       }catch{setCopyStatus("failed");}
      })()}>Copiar subsídio consultivo</Button>
      <span role="status" className="text-xs text-muted-foreground">
       {copyStatus==="copied"?"Texto copiado; nenhuma alteração foi realizada.":copyStatus==="failed"
        ?"Cópia indisponível; selecione o texto da prévia.":""}
      </span>
     </div>
    </details>}
    <nav aria-label="Navegação entre origem documental e preparação de continuidade" className="flex flex-wrap gap-2">
     <Button type="button" size="sm" variant="outline" onClick={()=>{
      const target=document.getElementById("nucleo-ac01-piloto");
      target?.scrollIntoView({behavior:"smooth",block:"start"});
      target?.focus({preventScroll:true});
     }}>Voltar à origem AC-01</Button>
     <Button type="button" size="sm" variant="outline" onClick={()=>{
      const target=document.getElementById("nucleo-ac02-consulta");
      target?.scrollIntoView({behavior:"smooth",block:"start"});
      target?.focus({preventScroll:true});
     }}>Voltar ao contexto AC-02</Button>
    </nav>
    <p className="text-xs text-muted-foreground">Próximo avanço consultivo: organizar as evidências para a Camada Mestre,
     sem simular aceite ou alterar o Core. Testes adicionais e homologação foram adiados pelo proprietário.</p>
   </section>
   <section className="rounded-lg border p-3 text-xs space-y-2" aria-label="F5 — aprendizado e checkpoint do Núcleo">
    <p className="font-semibold">F5 · Aprendizado recuperado da NUC-M4</p>
    <p>Decisão: {visibleResult.checkpoint.decision}</p>
    <p>Lição verificável: {visibleResult.checkpoint.lesson}</p>
    <p>Histórico: antes {visibleResult.checkpoint.status_before} → depois {visibleResult.checkpoint.status_after} · Evento {visibleResult.checkpoint.event_id}</p>
    <p>Antes: {visibleResult.checkpoint.before_action}</p>
    <p>Depois: {visibleResult.checkpoint.after_action}</p>
    <p>Próxima ação vigente: {visibleResult.checkpoint.current_action}</p>
    <p>FM-09: {visibleResult.checkpoint.fm09==="sem_revisao_visivel_sob_rls"?"Nenhuma revisão visível sob a permissão atual":"Há revisão visível, sem vigência certificada"} · FM-10: {visibleResult.checkpoint.fm10==="sem_revisao_visivel_sob_rls"?"Nenhuma revisão visível sob a permissão atual":"Há revisão visível, sem vigência certificada"}</p>
    <p>Fontes: <a className="underline" href={visibleResult.checkpoint.decision_source} target="_blank" rel="noopener noreferrer">Deliberação da Camada Mestre</a> · <a className="underline" href={visibleResult.checkpoint.checkpoint_source} target="_blank" rel="noopener noreferrer">Checkpoint F5 existente</a></p>
    <p className="text-muted-foreground">Registro consultivo; sem FM homologado, aceite de sucessor ou alteração de autoridade.</p>
   </section>
   <p className="text-xs text-muted-foreground">Verificado em {new Date(visibleResult.checked_at).toLocaleString("pt-BR")}. Fonte: Core, sob permissão do usuário.</p>
   <p className="text-xs text-muted-foreground">Limites: {visibleResult.limitations.join(" ")}</p>
  </div>}
 </section>;
}
