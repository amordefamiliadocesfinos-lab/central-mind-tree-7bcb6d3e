import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CRM_DRAFTS, CCH_DRAFTS, SHOPEE_DRAFTS, OPERACOES_DRAFTS, FINANCEIRO_DRAFTS, CAPTURA_DRAFTS, ROTINA_DRAFTS, DIGITAL_DRAFTS, ASSISTENTE_DRAFTS } from "@/lib/nucleo/operationalDraftsV12";
import { CRM_AUTHORITY_SOURCES_V12, CRM_CONTINUITY_CHECKPOINTS_V12, CRM_SPECIALIST_CA17 } from "@/lib/nucleo/crmAuthoritySourcesV12";
import { compareDocumentVersionsV13 } from "@/lib/nucleo/documentDiffV13";
import { numberDocumentDiffLinesV13 } from "@/lib/nucleo/documentDiffPresentationV13";
import { fmLinkedEvidence } from "@/lib/nucleo/fmLinkedEvidenceV13";
import { projectFm09Continuity } from "@/lib/nucleo/fmContinuityV13";
import type { DevelopmentEvent, DevelopmentWorkstream } from "@/lib/nucleo/development.types";
import NucleoTechnicalEvidence from "@/components/nucleo/NucleoTechnicalEvidence";
import {usePendingWriteFence} from "@/lib/nucleo/pendingWriteFenceV1";
import {makeWitness,witnessFieldsFm} from "@/lib/nucleo/writeRecoveryWitnessV1";

type FMSection = "FM-01" | "FM-02" | "FM-03" | "FM-04" | "FM-05" | "FM-06" | "FM-07" | "FM-08" | "FM-09" | "FM-10";
const sections: Record<FMSection, string> = {
  "FM-01": "Identidade",
  "FM-02": "Visão rápida",
  "FM-03": "Fronteiras",
  "FM-04": "Mapa de telas",
  "FM-05": "Catálogo de ações",
  "FM-06": "Jornadas práticas",
  "FM-07": "Dados e evidências",
  "FM-08": "Governança do especialista",
  "FM-09": "Evolução",
  "FM-10": "Aprendizagem",
};
type Revision = {
 id:string; module_id:string; section_code:FMSection; version_no:number; title:string; body:string;
 source_reference:string; authority_state:"rascunho"|"proposta"|"homologado"|"historico";
 evidence_level:"declarado"|"codigo_verificado"|"uso_real_verificado"|"proposta"|"nao_verificado";
 reviewed_by:string; recorded_at:string; recorded_by_auth_uid:string|null;
 registration_origin?:string; registration_reference?:string|null; registration_request_id?:string|null;
};
type RevisionTable = {
 Row:Revision;
 Insert:Pick<Revision,"module_id"|"section_code"|"version_no"|"title"|"body"> & Partial<Revision>;
 Update:never;
 Relationships:[];
};
type FMDatabase = Omit<Database,"public"> & {public: Omit<Database["public"],"Tables"> & {
 Tables:Database["public"]["Tables"] & {nucleo_module_knowledge_revisions:RevisionTable}
}};
const client=supabase as unknown as SupabaseClient<FMDatabase>;
const MAX_FM_HISTORY_ROWS = 300;

const GITHUB_BLOB_BASE =
  "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/main/";
const GITHUB_SOURCE_PATH = /^(?:src|docs|supabase|scripts)\/[a-zA-Z0-9_./-]+\.(?:tsx?|jsx?|md|sql|json|txt|ya?ml)$/;

type SourcePointer = { label: string; githubUrl: string | null };
/**
 * Referências são metadados declarados, NÃO prova de vigência nem importação B.
 * Somente caminhos relativos reconhecidos no repositório oficial ganham link;
 * referências de Biblioteca, versões históricas e texto livre ficam como texto.
 * O link indica localização provável na main, não existência/validação atual.
 */
function sourcePointers(reference: string): SourcePointer[] {
  return reference.split(";").map(raw => raw.trim()).filter(Boolean).map(label => {
    const githubUrl = GITHUB_SOURCE_PATH.test(label) &&
      !label.split("/").includes("..") && !label.split("/").includes(".")
      ? GITHUB_BLOB_BASE + label : null;
    return { label, githubUrl };
  });
}

function SourceReferences({reference}:{reference:string}) {
  const pointers = sourcePointers(reference);
  if (!pointers.length) return <p className="text-xs text-muted-foreground">Fonte não informada.</p>;
  return (
    <div className="space-y-1">
      {pointers.map((pointer,index) => (
        <div className="text-xs break-words" key={index}>
          {pointer.githubUrl ? (
            <a className="underline underline-offset-2" href={pointer.githubUrl}
              target="_blank" rel="noopener noreferrer">
              {pointer.label} (localizar na main)
            </a>
          ) : (
            <span>{pointer.label} — referência textual; consultar a origem</span>
          )}
        </div>
      ))}
    </div>
  );
}


type PendingFmAttempt={
 witness?:Awaited<ReturnType<typeof makeWitness>>;
 moduleId:string;sectionCode:FMSection;versionNo:number;title:string;body:string;sourceReference:string;authUid?:string;
};
const matchesPendingFmAttempt=(row:Revision,pending:PendingFmAttempt)=>(
 row.module_id===pending.moduleId&&row.section_code===pending.sectionCode&&
 row.version_no===pending.versionNo&&row.title===pending.title&&
 row.body===pending.body&&row.source_reference===pending.sourceReference&&
 row.authority_state==="rascunho"&&row.evidence_level==="declarado"&&
 Boolean(pending.authUid)&&row.recorded_by_auth_uid===pending.authUid&&
 Boolean(row.recorded_at)&&!Number.isNaN(Date.parse(row.recorded_at))
);
type DraftState={dirty:boolean;busy:boolean};
export default function NucleoModuleKnowledge({moduleId,moduleCode,onDraftStateChange,workstreams,events,onOpenAc01Stage,onOpenWorkstream,requestedSection}:{
  moduleId:string;moduleCode:string;onDraftStateChange?:(value:DraftState)=>void;
  workstreams?:readonly DevelopmentWorkstream[];events?:readonly DevelopmentEvent[];
  onOpenAc01Stage?:(stage:"vincular"|"versoes"|"refinar"|"vigencia"|"historico")=>void;
  onOpenWorkstream?:(id:string)=>void;
  requestedSection?:{section:FMSection;seq:number}|null;
}) {
  const fence=usePendingWriteFence("fm",moduleId);
  const [section,setSection]=useState<FMSection>("FM-01");
  useEffect(()=>{
    // Pedido de seção vindo do Atlas não equivale a descarte autorizado.
    // A navegação direta entre FM mantém a confirmação própria em changeSection.
    if(requestedSection?.section && !saving && !draftDirty && !writeUncertain && !fence.blocked)
      setSection(requestedSection.section);
  },[requestedSection?.seq,requestedSection?.section]);
  const [revisions,setRevisions]=useState<Revision[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [validationError,setValidationError]=useState<string|null>(null);
  const [reload,setReload]=useState(0);
  const [editorOpen,setEditorOpen]=useState(false);
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [source,setSource]=useState("");
  const [saving,setSaving]=useState(false);
  const [writeUncertain,setWriteUncertain]=useState(false);
  const [reconciliationNotice,setReconciliationNotice]=useState("");
  const [recovering,setRecovering]=useState(false);
  const pendingAttemptRef=useRef<PendingFmAttempt|null>(null);
  const [m4FrontId,setM4FrontId]=useState<string|null>(null);
  const [compareOlderId,setCompareOlderId]=useState("");
  const [compareNewerId,setCompareNewerId]=useState("");
  const draftDirty=Boolean(title.trim()||body.trim()||source.trim());
  useEffect(()=>{
    onDraftStateChange?.({dirty:draftDirty,busy:saving||writeUncertain||fence.blocked});
    return ()=>onDraftStateChange?.({dirty:false,busy:false});
  },[draftDirty,saving,writeUncertain,fence.blocked,onDraftStateChange]);
  useEffect(()=>{
    if(!draftDirty&&!saving&&!writeUncertain&&!fence.blocked)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    window.addEventListener("beforeunload",warn);
    return ()=>window.removeEventListener("beforeunload",warn);
  },[draftDirty,saving,writeUncertain,fence.blocked]);

  useEffect(()=>{
    let current=true;
    setRevisions([]);setLoading(true);setError(null);
    void Promise.resolve(client.from("nucleo_module_knowledge_revisions").select("*")
      .eq("module_id",moduleId).order("recorded_at",{ascending:false}).limit(MAX_FM_HISTORY_ROWS)
      .then(result=>{
        if(!current)return;
        // Limite atingido não prova exaustividade. Nunca calcular versão,
        // cobertura ou oferecer nova escrita a partir de histórico parcial.
        if(result.error||!result.data){
          setRevisions([]);
          setError("Ficha Viva indisponível: leitura negada ou incompleta. Confirme migration e autorização no Core.");
        } else if(result.data.length>=MAX_FM_HISTORY_ROWS){
          setRevisions([]);
          setError("Histórico da Ficha Viva atingiu o limite de leitura. A cobertura e a próxima versão são indeterminadas; não registre outra revisão antes de reconciliar o histórico completo.");
        } else {
          setRevisions(result.data);
          const pending=pendingAttemptRef.current;
          if(writeUncertain&&pending){
            const sameVersion=result.data.filter(row=>row.module_id===pending.moduleId&&
              row.section_code===pending.sectionCode&&row.version_no===pending.versionNo);
            if(sameVersion.length===1&&matchesPendingFmAttempt(sameVersion[0],pending)&&fence.clearConfirmed(pending.witness)){
              pendingAttemptRef.current=null;
              setWriteUncertain(false);
              setTitle("");setBody("");setSource("");setValidationError(null);
              setReconciliationNotice("Revisão anteriormente enviada localizada e integralmente conferida no histórico. Não reenviar.");
            }else if(sameVersion.length>0){
              setError("A versão esperada foi localizada, mas os dados divergem da tentativa. Estado indeterminado; não reenviar.");
            }else{
              setError("Tentativa anterior não localizada neste recorte. Estado continua indeterminado; não repetir a gravação.");
            }
          }
        }
        setLoading(false);
      })).catch(()=>{
        if(!current)return;
        setError("Consulta interrompida. Atualize a ficha e confirme o acesso antes de registrar.");
        setLoading(false);
      });
    return()=>{current=false};
  },[moduleId,reload]);

  useEffect(()=>{setTitle("");setBody("");setSource("");setValidationError(null);setEditorOpen(false);},[moduleId,section]);
  const history=useMemo(()=>revisions
    .filter(r=>r.section_code===section).sort((a,b)=>b.version_no-a.version_no),[revisions,section]);
  const latest=history[0];
  const older=history.find(r=>r.id===compareOlderId)??history[1];
  const newer=history.find(r=>r.id===compareNewerId)??history[0];
  const comparison=older&&newer&&older.id!==newer.id
    ?compareDocumentVersionsV13(older.body,newer.body):null;
  const numberedComparisonLines=comparison?.state==="completo"
    ?numberDocumentDiffLinesV13(comparison.lines):[];
  const openDraftEditor=()=>{
    if(loading||error||saving||writeUncertain||!fence.ready||fence.blocked)return;
    setEditorOpen(true);
    requestAnimationFrame(()=>{
      const editor=document.getElementById("nucleo-fm-draft-"+moduleId);
      editor?.scrollIntoView({behavior:"smooth",block:"start"});
      editor?.focus({preventScroll:true});
    });
  };
  const cancelDraftEditor=()=>{
    if(saving||writeUncertain||fence.blocked)return;
    if(draftDirty&&!window.confirm("Descartar este rascunho não salvo? Nenhuma revisão registrada será alterada."))return;
    setTitle("");setBody("");setSource("");setValidationError(null);setEditorOpen(false);
  };
  const refine=(revision:Revision)=>{
    if(loading||error||saving||writeUncertain||!fence.ready||fence.blocked)return;
    if((title.trim()||body.trim()||source.trim())&&!window.confirm(
      "Existe um rascunho não salvo. Substituí-lo pelo conteúdo da revisão selecionada?"
    ))return;
    setTitle(revision.title);
    setBody(revision.body);
    setSource(revision.source_reference);
    setValidationError(null);
    openDraftEditor();
  };
  const templates = {
    CRM: CRM_DRAFTS, SAU: CCH_DRAFTS, SHO: SHOPEE_DRAFTS,
    OPE: OPERACOES_DRAFTS, FIN: FINANCEIRO_DRAFTS,
    CAP: CAPTURA_DRAFTS, ROT: ROTINA_DRAFTS,
    DIG: DIGITAL_DRAFTS, ASS: ASSISTENTE_DRAFTS,
  } as const;
  const moduleTemplates = templates[moduleCode as keyof typeof templates];
  const referenceDraft = moduleTemplates?.[section];
  // A cobertura descreve somente modelos disponíveis no código e revisões
  // efetivamente lidas do Core. Não é indicador de homologação/implantação.
  const coverage = (Object.keys(sections) as FMSection[]).map(code => ({
    code,
    hasTemplate: Boolean(moduleTemplates?.[code]),
    revisionCount: revisions.filter(revision => revision.section_code === code).length,
  }));
  const templateCount = coverage.filter(entry => entry.hasTemplate).length;
  const persistedCount = coverage.filter(entry => entry.revisionCount > 0).length;
  const linkedEvidence=useMemo(()=>fmLinkedEvidence(moduleCode,section),[moduleCode,section]);
  const fm09=useMemo(()=>
    workstreams&&events?projectFm09Continuity(moduleId,workstreams,events):null,
    [moduleId,workstreams,events]);
  useEffect(()=>{setM4FrontId(null);},[moduleId,section]);

  const changeSection = (next: FMSection) => {
    if (next === section || saving || writeUncertain || fence.blocked) return;
    // Uma confirmação de descarte precisa esvaziar a minuta anterior.
    // Caso contrário, os campos antigos passam a aparecer na nova seção FM.
    if (draftDirty) {
      if (!window.confirm("Há um rascunho não salvo nesta seção. Descartá-lo e abrir outra seção?")) return;
      setTitle("");
      setBody("");
      setSource("");
      setValidationError(null);
    }
    setSection(next);
  };
  const prepareReference = () => {
    if (!referenceDraft || loading || saving || error) return;
    // Ação local explícita: pré-preenche apenas o formulário.
    // Não cria revisão no Core nem infere homologação.
    if ((title || body || source) && !window.confirm(
      "Substituir o conteúdo ainda não salvo por um modelo de consulta? Nenhuma revisão será gravada automaticamente."
    )) return;
    setTitle(referenceDraft.title);
    setBody(referenceDraft.body);
    setSource(referenceDraft.source);
  };
  const save=async()=>{
    const cleanTitle=title.trim(), cleanBody=body.trim(), cleanSource=source.trim();
    if(loading||error||saving||writeUncertain||!fence.ready||fence.blocked) return;
    if(cleanTitle.length<3||cleanTitle.length>180||cleanBody.length<10||cleanBody.length>12000||cleanSource.length>1500){
      setValidationError("Verifique título (3–180), conteúdo (10–12.000) e referência (até 1.500 caracteres).");return;
    }
    setSaving(true);setError(null);setReconciliationNotice("");setValidationError(null);
    // Snapshot imutável e testemunho salgado são preparados ANTES do INSERT.
    const version=(latest?.version_no??0)+1;
    const attempt:PendingFmAttempt={moduleId,sectionCode:section,versionNo:version,
      title:cleanTitle,body:cleanBody,sourceReference:cleanSource};
    try {
      const auth=await supabase.auth.getUser();
      if(auth.error||!auth.data.user){setError("Sessão não confirmada; nenhuma revisão enviada.");return;}
      attempt.authUid=auth.data.user.id;
      const fields=witnessFieldsFm({module_id:moduleId,section_code:section,version_no:version,
        title:cleanTitle,body:cleanBody,source_reference:cleanSource,
        authority_state:"rascunho",evidence_level:"declarado",recorded_by_auth_uid:attempt.authUid});
      const witness=await makeWitness("fm",moduleId,fields,{section,version,authUid:attempt.authUid});
      if(!fence.markStarted(witness)){
        setError("Não foi possível proteger a tentativa nesta sessão. Nenhum registro foi enviado.");
        return;
      }
      attempt.witness=witness;pendingAttemptRef.current=attempt;
      const result=await client.from("nucleo_module_knowledge_revisions").insert({
        module_id:moduleId,section_code:section,version_no:version,title:cleanTitle,body:cleanBody,
        source_reference:cleanSource,authority_state:"rascunho",evidence_level:"declarado",
      }).select("*").maybeSingle();
      if(result.error||!result.data) {
        setWriteUncertain(true);
        setError("Gravação não confirmada. Atualize o histórico antes de tentar novamente; outra revisão pode ter sido registrada.");
        return;
      }
      // Leitura independente por ID: não afirmar sucesso apenas pelo retorno do INSERT.
      const check=await client.from("nucleo_module_knowledge_revisions")
        .select("*").eq("id",result.data.id).maybeSingle();
      if(check.error||!check.data||!matchesPendingFmAttempt(check.data,attempt)){
        setWriteUncertain(true);
        setError("Envio efetuado, mas a revisão não foi integralmente confirmada. Recarregue o histórico antes de outra tentativa.");
        return;
      }
      if(!fence.clearConfirmed(witness)){
        setWriteUncertain(true);
        setError("Revisão confirmada, mas a trava local não foi liberada. Não repetir; reconcilie a sessão.");
        return;
      }
      pendingAttemptRef.current=null;
      setTitle("");setBody("");setSource("");setEditorOpen(false);
      setReload(n=>n+1);
    } catch {
      setWriteUncertain(true);
      // Erro de transporte é ambíguo: não repetir a escrita sem conferir a origem.
      setError("Conexão interrompida durante o registro ou a conferência. Recarregue o histórico antes de tentar novamente.");
    } finally {
      setSaving(false);
    }
  };
  const recoverPersistent=async()=>{
    if(!fence.ready||!fence.blocked||!fence.witness||saving||loading||recovering)return;
    const witness=fence.witness;
    if(witness.kind!=="fm"||witness.moduleId!==moduleId)return;
    setRecovering(true);setError(null);
    try{
      const result=await client.from("nucleo_module_knowledge_revisions").select("*")
        .eq("module_id",moduleId).eq("section_code",witness.section as FMSection)
        .eq("version_no",witness.version as number).limit(2);
      if(result.error||!result.data||result.data.length!==1){
        setError("Reconciliação FM inconclusiva: leitura falhou ou a versão não é única. Bloqueio preservado.");
        return;
      }
      const row=result.data[0];
      if(!await fence.verifyAndClear(witnessFieldsFm(row),
        {section:row.section_code,version:row.version_no})){
        setError("Registro localizado, mas sua impressão criptográfica não corresponde à tentativa. Bloqueio preservado.");
        return;
      }
      setWriteUncertain(false);pendingAttemptRef.current=null;
      setTitle("");setBody("");setSource("");setValidationError(null);
      setReconciliationNotice("Revisão anterior conferida integralmente no Core. Trava local liberada; não reenviar a tentativa anterior.");
      setReload(n=>n+1);
    }catch{
      setError("Falha na consulta de reconciliação FM. Bloqueio preservado.");
    }finally{setRecovering(false);}
  };
  return (
    <Card className="nucleo-v22-surface p-3 md:p-4 space-y-3" aria-label="Ficha Viva do módulo">
      <div>
        <h4 className="nucleo-v22-title text-lg">Ficha Viva — seções FM-01 a FM-10</h4>
        <p className="text-xs text-muted-foreground">Histórico por versão. O formulário cria apenas rascunhos declarados, nunca manuais homologados automaticamente.</p>
      </div>
      {saving&&<p role="status" className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
        Registrando revisão no Core. Não altere a seção até a confirmação da operação.
      </p>}
      {draftDirty&&!saving&&<p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-100">
        Rascunho não salvo em {section}. Revise e registre ou confirme o descarte antes de mudar de seção.
      </p>}
      <section aria-label="Cobertura documental por seção" className="nucleo-v22-soft-surface p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">{templateCount}/10 modelos locais</Badge>
          <Badge variant="outline">{loading ? "Consultando registros…" : error ? "Cobertura indeterminada — erro de leitura" : `${persistedCount}/10 seções com registro no Core`}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Modelo local é proposta de consulta; registro no Core é uma revisão com autoria. Nenhum dos dois equivale a homologação.
        </p>
        <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {coverage.map(entry => (
            <button type="button" key={entry.code}
              aria-pressed={section === entry.code}
              disabled={saving||writeUncertain||fence.blocked}
              onClick={() => changeSection(entry.code)}
              className={`nucleo-v22-area-card min-h-16 min-w-0 rounded-md border p-2.5 text-left text-sm leading-snug space-y-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${section === entry.code ? "border-primary bg-accent" : "hover:bg-muted"}`}>
              <span className="block font-semibold">{entry.code} · {sections[entry.code]}</span>
              <span className="block text-muted-foreground">
                {loading ? "Core: consultando" : error ? "Core: leitura indisponível" : entry.revisionCount > 0 ? `Core: ${entry.revisionCount} versão(ões)` : "Core: sem registro neste recorte"}
              </span>
              <span className="block text-muted-foreground">{entry.hasTemplate ? "Modelo disponível" : "Modelo pendente"}</span>
            </button>
          ))}
        </div>
      </section>
      {!loading&&!error&&<section aria-label="Leitura da revisão atual" className="space-y-3">
          {latest?<div className="nucleo-v22-soft-surface p-3 text-sm space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              <strong>{latest.title}</strong><Badge variant="secondary">v{latest.version_no}</Badge>
              <Badge variant="outline">{latest.authority_state}</Badge>
            </div>
            <p className="whitespace-pre-wrap break-words">{latest.body}</p>
            <p className="text-xs text-muted-foreground">Prova: {latest.evidence_level} · Registrada: {new Date(latest.recorded_at).toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">
              Autoria do registro: {latest.recorded_by_auth_uid ? `identificador autenticado ${latest.recorded_by_auth_uid.slice(0,8)}…` : latest.registration_origin==="administrativo_lovable" ? "registro administrativo Lovable · sem autoria humana Auth" : "não identificada no registro"}.
              {latest.reviewed_by ? ` Revisão declarada por: ${latest.reviewed_by} (não certifica aprovação).` : " Sem revisor declarado."}
            </p>
            <div className="space-y-1"><p className="text-xs font-medium">Fontes declaradas da revisão — não homologadas</p><SourceReferences reference={latest.source_reference}/></div>
          </div>:<p className="text-sm text-muted-foreground">Esta seção não tem versões no Core. Isso não significa que o conhecimento não exista em outras fontes.</p>}
        <Button type="button" className="min-h-11" disabled={saving||writeUncertain||!fence.ready||fence.blocked}
          aria-expanded={editorOpen} aria-controls={"nucleo-fm-draft-"+moduleId} onClick={openDraftEditor}>
          {draftDirty?"Retomar rascunho":"Criar rascunho"}
        </Button>
        {latest&&<Button type="button" size="sm" variant="outline" className="ml-2 min-h-11" disabled={saving||writeUncertain||!fence.ready||fence.blocked}
          onClick={()=>refine(latest)}>Refinar a última versão em novo rascunho</Button>}
      </section>}
      {onOpenAc01Stage&&
        <div className="rounded-md border p-3 space-y-2" aria-label="Continuidade entre Ficha Viva e AC-01">
          <p className="text-sm font-semibold">Continuar no ciclo documental do especialista</p>
          <p className="text-xs text-muted-foreground">
            A Ficha Viva e as contribuições AC-01 preservam históricos diferentes.
            A navegação não vincula documentos automaticamente, nem cria revisão,
            decisão, mandato ou publicação.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm"
              disabled={saving} onClick={()=>onOpenAc01Stage("vincular")}>
              Vincular fonte no AC-01
            </Button>
            <Button type="button" variant="outline" size="sm"
              disabled={saving} onClick={()=>onOpenAc01Stage("versoes")}>
              Consultar versões AC-01
            </Button>
            <Button type="button" variant="outline" size="sm"
              disabled={saving} onClick={()=>onOpenAc01Stage("refinar")}>
              Revisões e propostas
            </Button>
            <Button type="button" variant="outline" size="sm"
              disabled={saving} onClick={()=>onOpenAc01Stage("vigencia")}>
              Conferir vigência
            </Button>
            <Button type="button" variant="outline" size="sm"
              disabled={saving} onClick={()=>onOpenAc01Stage("historico")}>
              Consultar histórico AC-01
            </Button>
          </div>
        </div>}
      {["FM-04","FM-05","FM-06","FM-07","FM-08","FM-09","FM-10"].includes(section)&&
        <section className="rounded-md border p-3 space-y-2" aria-label="Vínculos de prova operacional da seção FM">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <h5 className="text-sm font-semibold">Vínculos de origem para {section}</h5>
            <Badge variant="outline">{linkedEvidence.length} referência(s) catalogada(s)</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Consulta ao inventário técnico e documental já existente no Núcleo.
            Estes vínculos NÃO são revisão FM gravada, validação de funcionamento, homologação
            nem comprovação de acesso ao documento original.
          </p>
          {linkedEvidence.length===0?<p role="status" className="text-xs text-muted-foreground">
            Ainda não há vínculo reconciliado para esta seção no módulo. Conferir fontes antes de registrar.
          </p>:<div className="max-h-80 overflow-y-auto space-y-2" role="list">
            {linkedEvidence.map(item=><article key={item.key} role="listitem" className="rounded border p-2 space-y-1">
              <div className="flex flex-wrap gap-2 items-center">
                <p className="text-xs font-semibold">{item.title}</p>
                <Badge variant="outline">{item.evidence==="codigo_catalogado"?"Código catalogado":item.evidence==="documento_declarado"?"Declaração documental":"Referência histórica"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
              {item.url?<a href={item.url} target="_blank" rel="noopener noreferrer"
                className="text-xs underline underline-offset-2">Conferir origem no GitHub</a>
                :<p className="text-xs break-all">Localizador da fonte: {item.reference} (não é link público)</p>}
            </article>)}
          </div>}
        </section>}
      {moduleCode==="CRM"&&section==="FM-08"&&<section
         aria-label="Método e ecossistema CRM — referências consultivas não certificadas"
         className="rounded-md border p-3 space-y-2">
         <h5 className="text-sm font-semibold">Método e ecossistema — distinção documental</h5>
         {CRM_AUTHORITY_SOURCES_V12.filter(item=>["CRM-PROCESSO","CRM-09.01"].includes(item.id)).map(item=><div
           key={item.id} className="rounded border p-2 text-xs space-y-1">
           <p className="font-semibold">{item.id==="CRM-PROCESSO"?"Candidato a método comercial":"Referência do ecossistema operacional"}: {item.title}</p>
           <p>Estado indicado na fonte: {item.sourceStatus}</p>
           <p className="text-muted-foreground">Limite: {item.reconciliation}</p>
           <p className="break-all text-muted-foreground">Origem: {item.archive} / {item.originalFile}</p>
         </div>)}
         <p className="text-xs text-muted-foreground">
           Referências distintas não comprovam designação formal de dois documentos vigentes.
           O Dicionário 09.03 permanece indicado como pronto para homologação no arquivo original;
           a citação posterior pelo Mapa 09.04 não certifica sua vigência.
           Não há revisão FM-08 homologada nem mandato certificado no Core por este índice.
         </p>
       </section>}
       {moduleCode==="CRM"&&section==="FM-09"&&<section
         aria-label="Marcos documentais de continuidade CRM — não homologação automática"
         className="rounded-md border p-3 space-y-3">
         <h5 className="text-sm font-semibold">Marcos documentais do CRM — fonte e limite</h5>
         <p className="text-xs text-muted-foreground">
           Referências consultivas do índice de proveniência existente. O marco formal do Estado
           Vigente não se confunde com os checkpoints técnicos mais recentes, com revisão FM-09
           registrada no Core ou com homologação operacional atual.
         </p>
         {CRM_AUTHORITY_SOURCES_V12.filter(item=>item.id==="CRM-ESTADO").map(item=><div
           key={item.id} className="rounded border p-2 text-xs space-y-1">
           <p className="font-semibold">Marco formal localizado: {item.title} · {item.version}</p>
           <p>Estado declarado na fonte: {item.sourceStatus}</p>
           <p className="text-muted-foreground">Limite: {item.reconciliation}</p>
           <p className="break-all text-muted-foreground">Origem: {item.archive} / {item.originalFile}</p>
         </div>)}
         <details className="rounded border p-2 text-xs">
           <summary className="cursor-pointer font-semibold">
             Checkpoints posteriores — técnicos e de sucessão ({CRM_CONTINUITY_CHECKPOINTS_V12.length})
           </summary>
           <div className="mt-2 space-y-2">
             {CRM_CONTINUITY_CHECKPOINTS_V12.map(item=><div key={item.id} className="rounded border p-2 space-y-1">
               <p className="font-semibold">{item.date} · {item.title}</p>
               <p>Estado documental: {item.state}</p>
               <p className="text-muted-foreground">Limite: {item.action}</p>
               <p className="break-all text-muted-foreground">Origem: {item.sourceLocation} / {item.originalFile}</p>
             </div>)}
           </div>
         </details>
         <p className="text-xs text-muted-foreground">
           Último checkpoint operacional formalmente aprovado após 03/10/2026: não comprovado
           neste índice. FM-09 no Core e mandato do especialista exigem certificações próprias.
         </p>
       </section>}
       {section==="FM-09"&&<section className="rounded-md border p-3 space-y-3"
        aria-label="Evolução declarada e histórico M3 do módulo">
        <h5 className="text-sm font-semibold">Desenvolvimento relacionado — registros M3/M4</h5>
        <p className="text-xs text-muted-foreground">
          Frente e próxima ação são estados declarados no Core. Histórico abaixo considera
          apenas a janela global de até 200 eventos carregada pela Central;
          ausência de registro nesta janela não comprova ausência de evento anterior.
        </p>
        {!fm09?<p role="status" className="text-xs text-muted-foreground">
          Recorte M3 não disponível nesta sessão; consultar a área Desenvolvimento do módulo.
        </p>:<>
          <p className="text-xs">Frentes e subfrentes vinculadas: {fm09.fronts.length} · Eventos no recorte: {fm09.events.length}</p>
          <div className="space-y-2">
            {fm09.fronts.length===0&&<p role="status" className="text-xs text-muted-foreground">
              Nenhuma frente vinculada na leitura M3 desta sessão; não inferir ausência de trabalho externo.
            </p>}
            {fm09.fronts.map(front=><div key={front.id} className="rounded border p-2 space-y-2">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="font-semibold text-xs">{front.code} · {front.title}</span>
                <Badge variant="outline">M3: {front.status.replaceAll("_"," ")}</Badge>
                <Badge variant="outline">Prova declarada: {front.evidenceState.replaceAll("_"," ")}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Próxima ação: {front.nextAction||"não declarada"}</p>
              {onOpenWorkstream&&<Button type="button" size="sm" variant="outline"
                onClick={()=>onOpenWorkstream(front.id)}>
                Abrir ficha M3 desta frente
              </Button>}
              <Button type="button" size="sm" variant="outline"
                aria-expanded={m4FrontId===front.id}
                onClick={()=>setM4FrontId(id=>id===front.id?null:front.id)}>
                {m4FrontId===front.id?"Ocultar evidências M4":"Consultar evidências M4 desta frente"}
              </Button>
              {m4FrontId===front.id&&<NucleoTechnicalEvidence workstreamId={front.id}/>}
            </div>)}
          </div>
          <details className="rounded-md border p-2 text-xs">
            <summary className="cursor-pointer font-semibold">
              Eventos M3 vinculados neste recorte ({fm09.events.length})
            </summary>
            <div className="mt-2 space-y-2">
              {fm09.events.length===0?<p>Não localizado na janela global carregada.</p>:
              fm09.events.map(event=><p key={event.id} className="border-b pb-1">
                {event.workstreamCode} · {event.eventType} · {new Date(event.recordedAt).toLocaleString("pt-BR")}
                {" · Autoria: "+(event.hasIdentifiedActor?"identificada no Core":"não identificada")}
              </p>)}
            </div>
          </details>
        </>}
      </section>}
      {section==="FM-10"&&<p className="rounded-md border p-3 text-xs text-muted-foreground">
        Referências nesta seção são candidatas a aprendizagem e não representam
        lições comprovadas em uso real. Somente revisões FM-10 efetivamente
        gravadas e lidas do Core aparecem no histórico da Ficha Viva,
        sem promoção automática a conhecimento vigente.
      </p>}
      {moduleCode==="CRM" && (section==="FM-01"||section==="FM-03"||section==="FM-07"||section==="FM-08") && (
        <details className="rounded-md border p-3 space-y-2" aria-label="Referências originais e autoridade documental CRM">
          <summary className="cursor-pointer text-sm font-semibold">
            CRM — fontes originais classificadas ({CRM_AUTHORITY_SOURCES_V12.length} grupos) e mandato CA-17
          </summary>
          <p className="text-xs text-muted-foreground mt-2">
            Índice de metadados consultados nos ZIPs originais. Não importa arquivos, não cria
            revisão FM e não certifica método ou especialista. Os estados são os que aparecem
            nos próprios documentos e podem exigir decisão de atualização.
          </p>
          <div className="space-y-2 mt-3">
            {CRM_AUTHORITY_SOURCES_V12.map(item=>(
              <div key={item.id} className="rounded border p-2 text-xs space-y-1">
                <p className="font-semibold">{item.id} · {item.title} ({item.version})</p>
                <p>Estado do arquivo-fonte: {item.sourceStatus}</p>
                <p className="text-muted-foreground">Autoridade documental: {item.authorityScope}</p>
                <p className="text-muted-foreground">Limite: {item.reconciliation}</p>
                <p className="break-all text-muted-foreground">Localizador original: {item.archive} / {item.originalFile}</p>
              </div>
            ))}
          </div>
          <div className="rounded border p-3 text-xs space-y-2" aria-label="Checkpoints posteriores CRM">
            <p className="font-semibold">Checkpoints posteriores — continuidade com estado documental explícito</p>
            <p className="text-muted-foreground">
              Fontes posteriores não substituem automaticamente os nove grupos originais.
              V1.2 está preparada, não vigente; repasse CRM 7 → CRM 8 não é mandato certificado.
            </p>
            {CRM_CONTINUITY_CHECKPOINTS_V12.map(item=>(
              <div key={item.id} className="rounded border p-2 space-y-1">
                <p className="font-semibold">{item.date} · {item.title}</p>
                <p>Estado: {item.state}</p>
                <p className="text-muted-foreground">{item.evidence}</p>
                <p className="text-muted-foreground">Próxima conciliação: {item.action}</p>
                <p className="break-all text-muted-foreground">Origem: {item.sourceLocation} / {item.originalFile}</p>
              </div>
            ))}
          </div>
          <div className="rounded border p-2 text-xs space-y-1">
            <p className="font-semibold">Especialista — CA-17</p>
            <p>{CRM_SPECIALIST_CA17.functionalRole}</p>
            <p>Referência técnica histórica: {CRM_SPECIALIST_CA17.historicalTechnicalRole}</p>
            <p>Sucessão documentada: {CRM_SPECIALIST_CA17.successionRecord}</p>
            <p>Mandato atual: {CRM_SPECIALIST_CA17.activeMandate}</p>
            <p className="text-muted-foreground">Próximo gate: {CRM_SPECIALIST_CA17.nextGate}</p>
          </div>
        </details>
      )}
      {reconciliationNotice&&<p role="status" className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">{reconciliationNotice}</p>}
      {fence.blocked&&!writeUncertain&&<p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">Tentativa pendente identificada nesta sessão ou após recarregamento. Sem o conteúdo original em memória, a liberação automática não é segura. Confira o Core com a governança antes de qualquer nova gravação.</p>}
      {fence.blocked&&<div className="space-y-2">
        <p className="text-xs text-muted-foreground">{fence.witness
          ?"Existe uma prova técnica sem conteúdo da minuta para conferência no Core. A liberação exige correspondência integral."
          :"Trava antiga sem testemunho técnico, ou sessão não verificada: não há evidência suficiente para liberação automática. Encaminhe à governança."}</p>
        {fence.witness&&<Button type="button" size="sm" variant="outline" disabled={recovering||saving||loading}
          onClick={()=>void recoverPersistent()}>{recovering?"Conferindo no Core…":"Reconciliar trava FM com o Core"}</Button>}
      </div>}
      {writeUncertain&&<p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        Gravação anterior indeterminada. Atualize o histórico para conferir a versão; não repita o registro nem altere a seção antes da reconciliação.
      </p>}
      {loading&&<p role="status" className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">Consultando revisões autorizadas…</p>}
      {error&&<p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {validationError&&<p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{validationError}</p>}
      <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={loading||saving} onClick={()=>{setError(null);setReload(n=>n+1);}}>Atualizar ficha</Button>
      {!loading&&!error&&(
        <>
          {history.length>1&&<details className="nucleo-v22-surface p-3 md:p-4 space-y-4" aria-label="Comparação de versões AC-01">
            <summary className="cursor-pointer text-sm font-semibold">Comparar versões</summary>
            <div className="space-y-1">
              <h5 className="nucleo-v22-title text-base">Conhecimento e Evolução — comparar versões</h5>
              <p className="text-sm text-muted-foreground">Comparação local dos corpos textuais FM registrados no Core, sem acesso automático a arquivos originais. Diferenças textuais não comprovam conflitos semânticos, aprovação ou vigência.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1 text-xs font-semibold">Versão A — origem
                <select aria-label="Versão de origem" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm font-normal"
                  value={older?.id??""} onChange={e=>setCompareOlderId(e.target.value)}>
                  {history.map(r=><option value={r.id} key={r.id}>v{r.version_no} · {r.title} ({r.authority_state})</option>)}
                </select>
              </label>
              <label className="block space-y-1 text-xs font-semibold">Versão B — destino da comparação
                <select aria-label="Versão para comparação" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm font-normal"
                  value={newer?.id??""} onChange={e=>setCompareNewerId(e.target.value)}>
                  {history.map(r=><option value={r.id} key={r.id}>v{r.version_no} · {r.title} ({r.authority_state})</option>)}
                </select>
              </label>
            </div>
            {older&&newer&&older.id!==newer.id&&(
              <div className="grid gap-3 md:grid-cols-2" aria-label="Identificação e fontes das versões comparadas">
                <article className="min-w-0 rounded-md border bg-muted/30 p-3 text-sm space-y-2">
                  <div className="flex flex-wrap items-center gap-2"><strong>Versão A · origem</strong><Badge variant="outline">v{older.version_no}</Badge></div>
                  <p className="break-words font-semibold">{older.title}</p>
                  <p className="text-xs">Estado declarado: {older.authority_state} · Evidência: {older.evidence_level}</p>
                  <p className="text-xs text-muted-foreground">Registrada: {new Date(older.recorded_at).toLocaleString("pt-BR")} · Autoria: {older.recorded_by_auth_uid?older.recorded_by_auth_uid.slice(0,8)+"…":older.registration_origin==="administrativo_lovable"?"registro administrativo Lovable":"não identificada"}</p>
                  <div className="border-t pt-2"><p className="mb-1 text-xs font-medium">Fontes declaradas da versão A — consultar origem</p><SourceReferences reference={older.source_reference}/></div>
                </article>
                <article className="min-w-0 rounded-md border border-sky-300 bg-sky-50/50 p-3 text-sm space-y-2 dark:border-sky-800 dark:bg-sky-950/20">
                  <div className="flex flex-wrap items-center gap-2"><strong>Versão B · destino</strong><Badge variant="outline">v{newer.version_no}</Badge></div>
                  <p className="break-words font-semibold">{newer.title}</p>
                  <p className="text-xs">Estado declarado: {newer.authority_state} · Evidência: {newer.evidence_level}</p>
                  <p className="text-xs text-muted-foreground">Registrada: {new Date(newer.recorded_at).toLocaleString("pt-BR")} · Autoria: {newer.recorded_by_auth_uid?newer.recorded_by_auth_uid.slice(0,8)+"…":newer.registration_origin==="administrativo_lovable"?"registro administrativo Lovable":"não identificada"}</p>
                  <div className="border-t pt-2"><p className="mb-1 text-xs font-medium">Fontes declaradas da versão B — consultar origem</p><SourceReferences reference={newer.source_reference}/></div>
                </article>
              </div>
            )}
            {!comparison&&<p role="status" className="rounded-md border p-3 text-sm text-muted-foreground">Selecione duas versões diferentes. Nenhuma diferença será inferida de uma versão isolada.</p>}
            {comparison&&<div className="space-y-3">
              {comparison.state==="indisponivel"?(
                <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
                  Comparação integral indisponível: {comparison.reason} Consulte as versões e fontes acima; nenhum diff parcial é exibido como integral.
                </p>
              ):(
                <>
                  <div className="flex flex-wrap items-center gap-2" role="status" aria-label="Resumo das diferenças textuais">
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100">+ {comparison.included} incluída(s) na B</Badge>
                    <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-100">− {comparison.removed} removida(s) da A</Badge>
                    <Badge variant="outline">{numberedComparisonLines.filter(row=>row.kind==="igual").length} mantida(s)</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">A e B indicam números de linha. Incluída: existe na B. Removida: consta na A. Uma edição pode aparecer como remoção seguida de inclusão.</p>
                  {comparison.included===0&&comparison.removed===0&&<p className="rounded-md border p-3 text-sm">Corpos textuais idênticos nesta comparação integral; fontes e estados declarados permanecem distintos e devem ser conferidos.</p>}
                  <div role="region" tabIndex={0} className="max-h-[26rem] overflow-auto rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Diferenças textuais das revisões — numeração das versões A e B">
                    <div className="sticky top-0 z-10 hidden grid-cols-[3.25rem_3.25rem_6rem_minmax(0,1fr)] gap-2 border-b bg-muted px-2 py-2 text-xs font-semibold sm:grid">
                      <span className="text-right">Linha A</span><span className="text-right">Linha B</span><span>Tipo</span><span>Texto da linha</span>
                    </div>
                    {numberedComparisonLines.map((row,index)=>(
                      <div key={index} className={"grid min-w-0 grid-cols-1 gap-1 border-b px-2 py-1.5 last:border-b-0 sm:grid-cols-[3.25rem_3.25rem_6rem_minmax(0,1fr)] sm:gap-2 "+
                        (row.kind==="incluido"?"bg-emerald-50/80 dark:bg-emerald-950/30":row.kind==="removido"?"bg-rose-50/80 dark:bg-rose-950/30":"bg-background")}>
                        <span className="text-xs font-medium text-muted-foreground sm:hidden">Linha A: {row.beforeLine??"—"} · Linha B: {row.afterLine??"—"}</span>
                        <span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">{row.beforeLine??"—"}</span>
                        <span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">{row.afterLine??"—"}</span>
                        <span className={"text-xs font-semibold "+(row.kind==="incluido"?"text-emerald-800 dark:text-emerald-200":row.kind==="removido"?"text-rose-800 dark:text-rose-200":"text-muted-foreground")}>
                          {row.kind==="incluido"?"Incluída":row.kind==="removido"?"Removida":"Mantida"}
                        </span>
                        <code className="min-w-0 whitespace-pre-wrap break-words font-mono text-xs">{row.value||" "}</code>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{comparison.reason}</p>
                </>
              )}
              <Button type="button" size="sm" variant="outline" disabled={saving}
                onClick={()=>newer&&refine(newer)}>Preparar refinamento da versão selecionada</Button>
            </div>}
          </details>}
           {history.length>1&&<details className="border rounded-md p-3 text-xs">
            <summary className="cursor-pointer">Histórico preservado ({history.length-1} revisão(ões) anterior(es))</summary>
            <div className="space-y-3 mt-2">
              {history.slice(1).map(r=><div key={r.id} className="border-t pt-2">
                <p className="font-medium">v{r.version_no} · {r.title} · {r.authority_state}</p>
                <p className="text-muted-foreground">Registrada: {new Date(r.recorded_at).toLocaleString("pt-BR")} · Autoria: {r.recorded_by_auth_uid ? `ID ${r.recorded_by_auth_uid.slice(0,8)}…` : r.registration_origin==="administrativo_lovable" ? "registro administrativo Lovable" : "não identificada"} · Revisão declarada: {r.reviewed_by || "não informada"}</p>
                <p className="whitespace-pre-wrap break-words mt-1">{r.body}</p>
                <p className="font-medium">Fontes declaradas da revisão</p><SourceReferences reference={r.source_reference}/>
              </div>)}
            </div>
          </details>}
          <div id={"nucleo-fm-draft-"+moduleId} tabIndex={-1} hidden={!editorOpen} className={"scroll-mt-28 rounded-lg border p-3 space-y-2 "+(!editorOpen?"hidden":"")}>
            <h5 className="font-medium text-base">Registrar nova revisão — rascunho não homologado</h5>
            {referenceDraft && (
              <div className="rounded-lg border border-sky-200 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/20 p-3 space-y-2">
                <p className="text-sm font-semibold">Modelo de referência {moduleCode} — {section}</p>
                <p className="text-sm text-muted-foreground">
                  Proposta fundamentada em fontes de código/documento, para leitura e ajustes pelo responsável.
                  Não é homologação, teste de uso real ou confirmação da vigência do especialista.
                </p>
                <p className="text-xs font-medium">Referências deste modelo local — conferir na origem</p>
                <SourceReferences reference={referenceDraft.source}/>
                <Button type="button" size="sm" variant="outline" disabled={saving||loading}
                  onClick={prepareReference}>Preparar rascunho com fontes</Button>
              </div>
            )}
            <label className="block text-xs space-y-1">Título
              <Input disabled={saving} value={title} onChange={e=>{setTitle(e.target.value);setValidationError(null);}} maxLength={180} placeholder={sections[section]}/>
            </label>
            <label className="block text-xs space-y-1">Descrição operacional
              <Textarea disabled={saving} value={body} onChange={e=>{setBody(e.target.value);setValidationError(null);}} rows={5} maxLength={12000} placeholder="Registre somente fatos e limites verificáveis. Não inclua dados pessoais ou credenciais."/>
            </label>
            <label className="block text-xs space-y-1">Fonte / documento original (referência, não cópia)
              <Input disabled={saving} value={source} onChange={e=>{setSource(e.target.value);setValidationError(null);}} maxLength={1500} placeholder="Caminho, ID de documento ou link original"/>
            </label>
            <p className="text-xs text-muted-foreground">A nova revisão recebe v{(latest?.version_no??0)+1}; a versão anterior permanece imutável. A aprovação normativa requer procedimento humano separado.</p>
            <Button type="button" size="sm" className="min-h-11" disabled={saving||loading||Boolean(error)||writeUncertain||!fence.ready||fence.blocked} onClick={()=>void save()}>
              {saving?"Registrando…":"Registrar revisão e conferir"}
            </Button>
            <Button type="button" size="sm" variant="outline" className="ml-2 min-h-11" disabled={saving||writeUncertain||fence.blocked} onClick={cancelDraftEditor}>Cancelar rascunho</Button>
          </div>
        </>
      )}
    </Card>
  );
}
