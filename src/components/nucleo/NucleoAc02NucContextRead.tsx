import {useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
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
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<Context|null>(null);
 const [error,setError]=useState("");
 const [copyStatus,setCopyStatus]=useState<"idle"|"copied"|"failed">("idle");
 const decisionSummary=result?buildConsultiveDecisionSummary(result):null;
 async function read(){
  if(busy)return;
  setBusy(true);setError("");setResult(null);setCopyStatus("idle");
  try{
   const user=await supabase.auth.getUser();
   if(user.error||!user.data.user){setError("Sessão pessoal não comprovada. Entre na conta autorizada.");return;}
   const response=await supabase.functions.invoke("nucleo-ac02-context-read",{body:{module_id:ID,include_checkpoint:true}});
   if(response.error||!isContext(response.data)){
    setError("Consulta indisponível, negada ou incompleta. Sem pacote de assunção certificado.");return;
   }
   setResult(response.data);
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
  {result&&<div className="space-y-2">
   <p role="status" className="text-xs font-medium">Contexto consultivo confirmado pela leitura autenticada. Nenhum sucessor ou mandato foi certificado.</p>
   <p className="text-xs">Mapa: {result.contribution.title} · v{result.contribution.version_no} · {result.contribution.authority_state}</p>
   <p className="text-xs break-all">Contribuição AC-01: {result.contribution.id}</p>
   <p className="text-xs">Especialidade descritiva: {result.specialist.specialty} — não homologada</p>
   <div className="space-y-2">{result.fronts.map(front=><div key={front.code} className="rounded-md border p-2 text-xs space-y-1">
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
      <p>AC-01 v{result.contribution.version_no} · estado informado pelo Core: <strong>{result.contribution.authority_state}</strong></p>
      <p className="text-muted-foreground">Fonte de origem: {result.contribution.source_kind} · {result.contribution.source_locator}</p>
      <p className="text-muted-foreground">Próximo movimento: manter a proposta e a linhagem até decisão documental competente.</p>
     </article>
     <article className="rounded-md border p-3 space-y-1 text-xs">
      <h6 className="font-semibold">2 · Evidência operacional</h6>
      <p>NUC-M4 · antes {result.checkpoint.status_before} / depois {result.checkpoint.status_after}</p>
      <p>Frente atual: <strong>{result.fronts.find(front=>front.code==="NUC-M4")?.status??"não informada"}</strong></p>
      <p className="text-muted-foreground">Aceite técnico restrito não substitui conclusão operacional nem vigência documental.</p>
     </article>
     <article className="rounded-md border p-3 space-y-1 text-xs">
      <h6 className="font-semibold">3 · Autoridade ainda separada</h6>
      <p>Especialidade: {result.specialist.specialty_state}</p>
      <p>Mandato: {result.specialist.mandate} · Sucessor: {result.specialist.successor}</p>
      <p className="text-muted-foreground">Homologação, publicação, mandato, entrega e recebimento exigem atos próprios.</p>
     </article>
    </div>
    <details className="rounded-md border p-3 text-xs">
     <summary className="cursor-pointer font-medium">Fontes e pontos para futura deliberação</summary>
     <div className="mt-2 space-y-2">
      <p>Contribuição AC-01: <span className="break-all">{result.contribution.id}</span>.</p>
      <p>Evento de checkpoint M4: <span className="break-all">{result.checkpoint.event_id}</span>.</p>
      <p>FM-09: {result.checkpoint.fm09==="sem_revisao_visivel_sob_rls"?"sem revisão visível sob a permissão atual":"revisão visível sem vigência certificada"}.
       FM-10: {result.checkpoint.fm10==="sem_revisao_visivel_sob_rls"?"sem revisão visível sob a permissão atual":"revisão visível sem vigência certificada"}.</p>
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
    <p>Decisão: {result.checkpoint.decision}</p>
    <p>Lição verificável: {result.checkpoint.lesson}</p>
    <p>Histórico: antes {result.checkpoint.status_before} → depois {result.checkpoint.status_after} · Evento {result.checkpoint.event_id}</p>
    <p>Antes: {result.checkpoint.before_action}</p>
    <p>Depois: {result.checkpoint.after_action}</p>
    <p>Próxima ação vigente: {result.checkpoint.current_action}</p>
    <p>FM-09: {result.checkpoint.fm09==="sem_revisao_visivel_sob_rls"?"Nenhuma revisão visível sob a permissão atual":"Há revisão visível, sem vigência certificada"} · FM-10: {result.checkpoint.fm10==="sem_revisao_visivel_sob_rls"?"Nenhuma revisão visível sob a permissão atual":"Há revisão visível, sem vigência certificada"}</p>
    <p>Fontes: <a className="underline" href={result.checkpoint.decision_source} target="_blank" rel="noopener noreferrer">Deliberação da Camada Mestre</a> · <a className="underline" href={result.checkpoint.checkpoint_source} target="_blank" rel="noopener noreferrer">Checkpoint F5 existente</a></p>
    <p className="text-muted-foreground">Registro consultivo; sem FM homologado, aceite de sucessor ou alteração de autoridade.</p>
   </section>
   <p className="text-xs text-muted-foreground">Verificado em {new Date(result.checked_at).toLocaleString("pt-BR")}. Fonte: Core, sob permissão do usuário.</p>
   <p className="text-xs text-muted-foreground">Limites: {result.limitations.join(" ")}</p>
  </div>}
 </section>;
}
