import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { DevelopmentWorkstream, DevelopmentEvent, DevelopmentDependency } from "@/lib/nucleo/development.types";
import NucleoExecutiveDevelopment from "@/components/nucleo/NucleoExecutiveDevelopment";
import NucleoTechnicalEvidence from "@/components/nucleo/NucleoTechnicalEvidence";
import NucleoModuleKnowledge from "@/components/nucleo/NucleoModuleKnowledge";
import NucleoSpecialistContributions from "@/components/nucleo/NucleoSpecialistContributions";
import NucleoModuleDiscovery from "@/components/nucleo/NucleoModuleDiscovery";
import NucleoMandateRegistry from "@/components/nucleo/NucleoMandateRegistry";
import NucleoAc02ContinuityRead from "@/components/nucleo/NucleoAc02ContinuityRead";
import NucleoCrossModuleCoverage from "@/components/nucleo/NucleoCrossModuleCoverage";
import { MODULE_PROVENANCE, SOURCE_AUTHORITY_LABELS } from "@/lib/nucleo/operationalProvenanceV12";
import { BookOpen, ExternalLink, Layers, Search, ShieldCheck, GitBranch, FolderTree, Activity, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CRM_ACTIONS, CRM_JOURNEY, CRM_REFERENCE, MODULES_V12,
  type KnowledgeModule,
} from "@/lib/nucleo/operationalKnowledgeV12";

type Level = "overview" | "module" | "operation";
type ModuleSection = "funcoes" | "especialista" | "desenvolvimento" | "conhecimento";
type CrmStage = "modulo" | "telas" | "funcionalidades" | "procedimentos" | "especialista" | "conhecimento" | "desenvolvimento" | "evidencias";
const CRM_STAGE_NAV: ReadonlyArray<{id:CrmStage;label:string}> = [
  {id:"modulo",label:"Conhecer módulo"},
  {id:"telas",label:"Telas"},
  {id:"funcionalidades",label:"Funcionalidades"},
  {id:"procedimentos",label:"Como utilizar"},
  {id:"especialista",label:"Especialista"},
  {id:"conhecimento",label:"Conhecimento"},
  {id:"desenvolvimento",label:"Desenvolvimento"},
  {id:"evidencias",label:"Evidências"},
];
const MODULE_SECTIONS: Array<{id:ModuleSection;label:string;hint:string}> = [
  {id:"funcoes",label:"Operação",hint:"Telas, funções e como utilizar"},
  {id:"desenvolvimento",label:"Desenvolvimento",hint:"Frentes, prioridades e evidências"},
  {id:"especialista",label:"Especialistas",hint:"Responsabilidades, fontes e mandatos"},
  {id:"conhecimento",label:"Conhecimento e Evolução",hint:"Ficha Viva, versões e revisões"},
];
const specialistConfidence = (value: string | null | undefined): "declarado" | "nao_verificado" =>
  value && !/não verificado|não verificados|a conciliar|a reconciliar|vigência a conferir|vigência não/i.test(value)
    ? "declarado" : "nao_verificado";

const confidenceLabels = {
  codigo_verificado: "Verificado no código",
  declarado: "Declarado, a conciliar",
  nao_verificado: "Não verificado",
};

/** V1.2: descoberta orientada, sem escrita em outras frentes ou cópia documental. */
interface Props {
  workstreams: DevelopmentWorkstream[];
  events: DevelopmentEvent[];
  dependencies: DevelopmentDependency[];
  onSelectWorkstream: (id: string) => void;
  onPrepareModule: (module: KnowledgeModule) => void;
  searchRequestSeq?: number;
}

export default function NucleoOperationalAtlas({ workstreams, events, dependencies, onSelectWorkstream, onPrepareModule, searchRequestSeq = 0 }: Props) {
  const [search, setSearch] = useState("");
  // Atalho da visão executiva: preservar o termo já digitado e focar o campo existente.
  useEffect(()=>{
    if(!searchRequestSeq)return;
    setLevel("overview");
    let focusFrame=0;
    const viewFrame=requestAnimationFrame(()=>{
      focusFrame=requestAnimationFrame(()=>{
        const field=document.getElementById("nucleo-atlas-module-search");
        field?.scrollIntoView({behavior:"smooth",block:"center"});
        field?.focus({preventScroll:true});
      });
    });
    return()=>{cancelAnimationFrame(viewFrame);cancelAnimationFrame(focusFrame);};
  },[searchRequestSeq]);
  // UX01: ao retornar da ficha, exibir novamente a busca e os resultados
  // já filtrados, sem apagar o termo nem alterar o estado do cadastro.
  const returnToModuleResults=()=>{
    setLevel("overview");
    let focusFrame=0;
    requestAnimationFrame(()=>{
      focusFrame=requestAnimationFrame(()=>{
        const field=document.getElementById("nucleo-atlas-module-search");
        field?.scrollIntoView({behavior:"smooth",block:"center"});
        field?.focus({preventScroll:true});
      });
    });
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>("overview");
  const [moduleSection,setModuleSection] = useState<ModuleSection>("funcoes");
  const [actionSearch, setActionSearch] = useState("");
  const [crmJourneyMode, setCrmJourneyMode] = useState<"gestor"|"operador">("operador");
  const [evidenceFrontId, setEvidenceFrontId] = useState<string | null>(null);
  const [knowledgeOpen,setKnowledgeOpen]=useState(false);
  // UX-A3B: montar painéis documentais somente após visita e preservá-los
  // quando o gestor alternar entre Especialistas e Conhecimento no mesmo módulo.
  const [specialistVisited,setSpecialistVisited]=useState(false);
  // Os painéis do especialista são apresentados sob demanda. Quando visitados,
  // permanecem montados para preservar rascunhos AC-01 e consultas AC-02.
  const [specialistPanel,setSpecialistPanel]=useState<"papel"|"mandato"|"continuidade"|"documentos">("papel");
  const [specialistPanelVisited,setSpecialistPanelVisited]=useState<Array<"mandato"|"continuidade"|"documentos">>([]);
  const [ac01Request,setAc01Request]=useState<{stage:"vincular"|"versoes"|"refinar"|"vigencia"|"historico";seq:number}|null>(null);
  const [fmSectionRequest,setFmSectionRequest]=useState<{section:"FM-09";seq:number}|null>(null);
  const openSpecialistPanel=(id:"papel"|"mandato"|"continuidade"|"documentos")=>{
    setSpecialistPanel(id);
    if(id!=="papel")setSpecialistPanelVisited(current=>current.includes(id)?current:[...current,id]);
  };
  const [knowledgeVisited,setKnowledgeVisited]=useState(false);
  const [fmDraftState,setFmDraftState]=useState({dirty:false,busy:false});
  const [specialistDraftState,setSpecialistDraftState]=useState({dirty:false,busy:false});
  // O Core é a fonte do cadastro. O inventário GitHub apenas complementa rotas
  // observadas e mantém entradas ainda não catalogadas como não verificadas.
  // Novos módulos M3 aparecem aqui sem alterações de código.
  const governanceRoot = workstreams.find(item => item.kind === "modulo" && item.code === "NUC");
  const governanceFronts = governanceRoot ? workstreams.filter(item => item.parent_id === governanceRoot.id) : [];
  const registeredModules = useMemo(
    () => workstreams.filter(item => item.kind === "modulo" && item.code !== "NUC"),
    [workstreams],
  );
  // Contagem apenas dos registros do Core — não porcentagem de implementação.
  // Exclui a ficha raiz NUC para não contabilizar governança duas vezes.
  const monitored = workstreams.filter(item => item.code !== "NUC");
  const summary = {
    modules: registeredModules.length,
    governanceFronts: governanceFronts.length,
    active: monitored.filter(item => item.status === "em_andamento").length,
    validating: monitored.filter(item => item.status === "em_validacao").length,
    completed: monitored.filter(item =>
      item.status === "concluido" && item.evidence_state === "comprovada").length,
    blocked: monitored.filter(item => item.status === "bloqueado").length,
  };
  // A Central carrega até 200 eventos M3; não representa um feed global do GitHub.
  const recentEvents = useMemo(() => [...events]
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
    .slice(0, 5), [events]);
  const workstreamsById = useMemo(() =>
    new Map(workstreams.map(item => [item.id, item])), [workstreams]);
  const catalog = useMemo<KnowledgeModule[]>(() => {
    const byCode = new Map(MODULES_V12.map(module => [module.id, module]));
    for (const record of workstreams.filter(item => item.kind === "modulo")) {
      const source = byCode.get(record.code);
      byCode.set(record.code, source ? {
        ...source, name: record.title, purpose: record.description || source.purpose,
        specialist: record.specialist || source.specialist,
        specialistConfidence: record.specialist ? specialistConfidence(record.specialist) : source.specialistConfidence,
      } : {
        id: record.code, name: record.title,
        domain: record.code==="NUC"?"Governança":"Domínio ainda não classificado",
        route: record.code==="NUC"?"/nucleo":null,
        purpose: record.description || "Finalidade detalhada não verificada.",
        coverage: "inventario_de_rotas", specialist: record.specialist || null,
        specialistConfidence: specialistConfidence(record.specialist),
        source: record.code==="NUC"?"Rota /nucleo verificada em src/App.tsx e módulo no Core M3":"Ficha do módulo no Core M3 — estado declarado, sem prova externa de rota",
      });
    }
    // NUC possui quadro de governança próprio: não duplicá-lo no catálogo operacional.
    return [...byCode.values()].filter(module=>module.id!=="NUC");
  }, [workstreams]);
  const modules = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return catalog.filter(item => !term ||
      [item.name, item.domain, item.id, item.specialist ?? ""].some(value => value.toLocaleLowerCase("pt-BR").includes(term)));
  }, [catalog, search]);
  // Prioridades de CONSULTA: cartões ordenados por lacunas verificáveis M3.
  // Não representa prioridade comercial calculada, progresso ou homologação.
  const portfolioAttention = catalog.map(module => {
    const record = workstreams.find(item=>item.kind==="modulo"&&item.code===module.id);
    const fronts = record ? workstreams.filter(item=>item.kind==="frente"&&item.parent_id===record.id) : [];
    const critical = fronts.filter(front=>front.status==="bloqueado"||front.priority==="critica");
    // Mostrar a ação da FRENTE que gerou atenção, nunca substituí-la
    // silenciosamente pela ação genérica do cadastro do módulo.
    const focusFront = critical.find(front=>front.next_action.trim()) ?? critical[0]
      ?? fronts.find(front=>front.status!=="concluido"&&front.next_action.trim())
      ?? fronts.find(front=>front.status!=="concluido") ?? null;
    const actionOwner = focusFront ?? record;
    const pending=fronts.some(front=>front.status!=="concluido");
    return {module,record,fronts,critical,focusFront,actionOwner,
      reason:critical.length>0
        ? `${critical.length} frente(s) com bloqueio ou prioridade crítica declarada(s)`
        : record && fronts.length===0
          ? "Módulo no Core ainda sem frente M3 vinculada"
          : !record
            ? "Módulo no catálogo sem cadastro M3 confirmado"
            : "Acompanhar o estado e as próximas ações das frentes",
      rank:critical.length>0?0:pending?1:record&&fronts.length===0?2:!record?3:4};
  }).sort((a,b)=>a.rank-b.rank||a.module.id.localeCompare(b.module.id,"pt-BR")).slice(0,4);
  const selected = catalog.find(item => item.id === selectedId) ?? null;
  const currentModuleArea = MODULE_SECTIONS.find(item => item.id === moduleSection) ?? MODULE_SECTIONS[0];
  const selectedProvenance = selected ? MODULE_PROVENANCE[selected.id] : undefined;
  const selectedRecord = workstreams.find(item => item.kind === "modulo" && item.code === selectedId);
  const selectedFronts = selectedRecord ? workstreams.filter(item => item.parent_id === selectedRecord.id) : [];
  const selectedSubfronts = selectedFronts.flatMap(front => workstreams.filter(item => item.parent_id === front.id));
  // Resumo apenas dos registros descendentes existentes no Core M3.
  // Não equivale a progresso percentual, evidência de deploy ou homologação.
  const moduleWork = [...selectedFronts, ...selectedSubfronts];
  const modulePending = moduleWork.filter(item => item.status !== "concluido");
  const moduleBlocked = modulePending.filter(item => item.status === "bloqueado");
  const moduleAwaitingAction = modulePending.filter(item => !item.next_action.trim());
  // FM-08/FM-09: recorte por papel declarado, sem atribuir frentes sem responsável
  // ou promover o vínculo textual M3 a mandato do especialista.
  const specialistRole = selectedRecord?.specialist.trim() || "";
  const specialistWork = specialistRole
    ? moduleWork.filter(item => item.specialist.trim() === specialistRole)
    : [];
  const specialistPending = specialistWork.filter(item => item.status !== "concluido");
  const specialistPriority = [...specialistPending].sort((a,b) =>
    Number(b.status==="bloqueado")-Number(a.status==="bloqueado") ||
    ({critica:0,alta:1,normal:2,baixa:3}[a.priority] -
     {critica:0,alta:1,normal:2,baixa:3}[b.priority]) ||
    a.code.localeCompare(b.code,"pt-BR")).slice(0,3);
  const specialistLatestEvent = events
    .filter(event => specialistWork.some(item => item.id === event.workstream_id))
    .sort((a,b)=>b.recorded_at.localeCompare(a.recorded_at))[0];

  const moduleStatusCounts = {
    andamento: moduleWork.filter(item => item.status === "em_andamento").length,
    validacao: moduleWork.filter(item => item.status === "em_validacao").length,
    bloqueadas: moduleBlocked.length,
    concluidasComProvaDeclarada: moduleWork.filter(item =>
      item.status === "concluido" && item.evidence_state === "comprovada").length,
  };
  const priorityRank = { critica: 0, alta: 1, normal: 2, baixa: 3 };
  const attentionItems = [...modulePending]
    .sort((a,b) => Number(b.status === "bloqueado") - Number(a.status === "bloqueado") ||
      priorityRank[a.priority] - priorityRank[b.priority] ||
      a.code.localeCompare(b.code, "pt-BR"))
    .slice(0, 8);
  const actions = useMemo(() => {
    const term = actionSearch.trim().toLocaleLowerCase("pt-BR");
    return CRM_ACTIONS.filter(action => !term ||
      [action.label, action.screen, action.expectedEffect].some(value => value.toLocaleLowerCase("pt-BR").includes(term)));
  }, [actionSearch]);
  const choose = (item: KnowledgeModule) => {
    // Retomar o mesmo módulo não descarta área, pesquisa e seleção.
    if (item.id !== selectedId) {
      if (fmDraftState.busy || specialistDraftState.busy) {
        window.alert("Gravação em andamento ou registro indeterminado. Reconcilie antes de mudar de módulo.");
        return;
      }
      if ((fmDraftState.dirty || specialistDraftState.dirty) && !window.confirm(
        "Existem rascunhos não salvos na Ficha Viva ou no especialista. Descartá-los e abrir outro módulo?"
      )) return;
      setFmDraftState({dirty:false,busy:false});
      setSpecialistDraftState({dirty:false,busy:false});
      setModuleSection("funcoes");
      setActionSearch("");
      setCrmJourneyMode("operador");
      setEvidenceFrontId(null);
      setKnowledgeOpen(false);
      setSpecialistVisited(false);
      setSpecialistPanel("papel");
      setSpecialistPanelVisited([]);
      setAc01Request(null);
      setFmSectionRequest(null);
      setKnowledgeVisited(false);
    }
    setSelectedId(item.id);
    setLevel("module");
    requestAnimationFrame(()=>{
      const heading=document.getElementById("nucleo-atlas-module-heading");
      heading?.scrollIntoView({behavior:"smooth",block:"start"});
      heading?.focus({preventScroll:true});
    });
  };
  const selectModuleArea = (area: ModuleSection) => {
    setModuleSection(area);
    if (area === "especialista") setSpecialistVisited(true);
    if (area === "conhecimento") {
      setKnowledgeVisited(true);
      setKnowledgeOpen(true);
    }
    setEvidenceFrontId(null);
    requestAnimationFrame(() => document.getElementById("nucleo-module-section-content")?.focus({ preventScroll: true }));
  };

  const openFm09Continuity=()=>{
    // A solicitação FM-09 muda a seção ativa: não remapear um rascunho local
    // para outra seção nem navegar durante uma gravação indeterminada.
    if(fmDraftState.busy||specialistDraftState.busy){
      window.alert("Gravação em andamento ou estado indeterminado. Reconcilie antes de abrir FM-09.");
      return;
    }
    if(fmDraftState.dirty){
      window.alert("Existe um rascunho não salvo na Ficha Viva. Salve ou limpe o rascunho na seção atual antes de abrir FM-09.");
      return;
    }
    setFmSectionRequest(previous=>({section:"FM-09",seq:(previous?.seq??0)+1}));
    selectModuleArea("conhecimento");
  };
  const openAc01FromFm=(stage:"vincular"|"versoes"|"refinar"|"vigencia"|"historico")=>{
    if(fmDraftState.busy||specialistDraftState.busy){
      window.alert("Gravação em andamento ou estado indeterminado; reconcilie antes de navegar.");
      return;
    }
    // A Ficha Viva continua montada: o rascunho ainda não salvo permanece preservado.
    openSpecialistPanel("documentos");
    setAc01Request(previous=>({stage,seq:(previous?.seq??0)+1}));
    selectModuleArea("especialista");
  };
  // A mesma jornada da ficha existe para TODOS os módulos do catálogo.
  // Telas, funções e roteiros vêm do inventário real; lacunas permanecem explícitas.
  const openModuleStage = (stage: CrmStage) => {
    const area: ModuleSection = stage === "especialista" ? "especialista"
      : stage === "conhecimento" ? "conhecimento"
      : stage === "desenvolvimento" || stage === "evidencias" ? "desenvolvimento"
      : "funcoes";
    selectModuleArea(area);
    const prefix = selectedId==="CRM" ? "nucleo-crm-" : "nucleo-module-"+selectedId?.toLowerCase()+"-";
    const anchors: Partial<Record<CrmStage,string>> = {
      modulo:"nucleo-atlas-module-heading",
      telas:prefix+"screens",
      funcionalidades:prefix+"controls",
      procedimentos:prefix+"procedures",
      evidencias:"nucleo-module-evidence",
    };
    const anchor = anchors[stage];
    if(anchor) requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const element=document.getElementById(anchor);
      element?.scrollIntoView({behavior:"smooth",block:"start"});
      if (element instanceof HTMLElement && element.tabIndex >= 0) element.focus({preventScroll:true});
    }));
  };
  return (
    <section className="space-y-3" aria-label="Atlas operacional do Painel Central — piloto V1.2">
      <Card className="nucleo-v22-surface p-4 md:p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4" aria-hidden="true" />
              <h2 className="nucleo-v22-title text-lg">Painel Central — módulos e operação</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Acompanhe módulos, frentes e procedimentos. O Núcleo governa essas informações, mas não entra na contagem dos módulos acompanhados.
            </p>
          </div>
          <Badge variant="outline">Piloto — cobertura parcial</Badge>
        </div>
        <nav className="nucleo-v22-tabs grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center" aria-label="Navegação do Núcleo">
          <Button type="button" size="sm" className="nucleo-v22-pill min-h-11 w-full whitespace-normal sm:w-auto" variant={level==="overview"?"default":"outline"}
            aria-pressed={level==="overview"} onClick={returnToModuleResults}>Painel Geral</Button>
          <Button type="button" size="sm" className="nucleo-v22-pill min-h-11 w-full max-w-full min-w-0 whitespace-normal break-words text-left sm:w-auto"
            variant={level==="module"?"default":"outline"} disabled={!selected}
            aria-label={selected ? "Retomar ficha do módulo " + selected.name : "Nenhum módulo selecionado"}
            aria-pressed={level==="module"} onClick={() => setLevel("module")}>
            {selected ? "Módulo · "+selected.name : "Selecionar módulo"}
          </Button>
          {selected?.id==="CRM" && <Button type="button" size="sm" className="nucleo-v22-pill min-h-11 w-full whitespace-normal sm:w-auto"
            variant={level==="operation"?"default":"outline"}
            aria-pressed={level==="operation"} onClick={() => setLevel("operation")}>Jornada prática CRM</Button>}
        </nav>
        <div className="rounded-md border p-3 text-sm leading-relaxed text-muted-foreground">
          <ShieldCheck className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          {registeredModules.length} módulo(s) acompanhado(s) cadastrado(s) no Core; os demais cartões representam rotas ou fontes em investigação.
          As informações ainda não equivalem a um inventário global homologado nem autorizam a IA a executar operações.
        </div>
      </Card>

      {level==="overview" && (
        <section aria-label="Indicadores do acompanhamento" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Leitura rápida do gestor</h3>
            <p className="text-xs text-muted-foreground">Contagem das fichas M3 autorizadas, sem porcentagem inferida</p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label:"Módulos no Core", value:summary.modules, style:"border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100" },
              { label:"Frentes NUC", value:summary.governanceFronts, style:"border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100" },
              { label:"Em andamento", value:summary.active, style:"border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100" },
              { label:"Em validação", value:summary.validating, style:"border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100" },
              { label:"Concluídas com prova", value:summary.completed, style:"border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100" },
              { label:"Bloqueadas", value:summary.blocked, style:"border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" },
            ].map(item => (
              <div key={item.label} className={`nucleo-v22-board-column rounded-xl border p-3 md:p-4 shadow-sm ${item.style}`}>
                <p className="text-sm font-medium leading-snug">{item.label}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {level==="overview" && (
        <section className="space-y-3" aria-label="Por onde começar — atenção do gestor">
          <div className="flex flex-wrap justify-between items-start gap-2">
            <div>
              <h3 className="text-base font-semibold">Por onde começar</h3>
              <p className="text-xs text-muted-foreground">Atalhos de consulta organizados por lacunas e prioridades declaradas no M3. Não são decisões nem alertas automáticos.</p>
            </div>
            <Badge variant="outline">Leitura do catálogo e do Core</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {portfolioAttention.map(({module,fronts,reason,focusFront,actionOwner})=>(
              <button type="button" key={module.id} onClick={()=>choose(module)}
                className="nucleo-v22-card-hover rounded-xl border p-4 text-left min-w-0 hover:border-primary/60 hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">{module.id}</Badge>
                  <span className="text-xs text-muted-foreground">{fronts.length} frente(s) M3</span>
                </div>
                <p className="font-semibold text-sm mt-3">{module.name}</p>
                <p className="text-xs text-muted-foreground mt-1 min-h-12 leading-relaxed">{reason}</p>
                {focusFront && <p className="text-xs mt-2 leading-relaxed"><span className="font-medium">Frente em atenção:</span> {focusFront.code} · {focusFront.title}</p>}
                {focusFront?.blocker.trim() && <p className="text-xs mt-1 leading-relaxed"><span className="font-medium">Bloqueio declarado:</span> {focusFront.blocker}</p>}
                {focusFront && <p className="text-xs mt-1"><span className="font-medium">Situação:</span> {focusFront.status.replaceAll("_"," ")==="em validacao"?"Em validação":focusFront.status.replaceAll("_"," ")==="em andamento"?"Em andamento":focusFront.status.replaceAll("_"," ")}</p>}
                <p className="text-xs mt-2 leading-relaxed line-clamp-3" title={actionOwner?.next_action||undefined}><span className="font-medium">Próxima ação {focusFront?"da frente":"do módulo"}:</span> {actionOwner?.next_action.trim()||"não cadastrada no Core para este recorte"}</p>
                <span className="block text-sm font-medium text-primary mt-3">Explorar módulo</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {level==="overview" && (
        <Card className="nucleo-v22-surface p-4 md:p-5 space-y-4 border-l-4 border-l-[#1a73e8]" aria-label="Núcleo — ambiente de governança">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-muted p-2"><FolderTree className="h-5 w-5" aria-hidden="true" /></div>
              <div>
                <h3 className="text-base font-semibold">Núcleo — ambiente de governança</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Supervisiona a arquitetura, os especialistas e a evolução dos módulos. Não é um módulo operacional do catálogo abaixo.</p>
              </div>
            </div>
            <Badge variant="outline">Estrutura separada</Badge>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5"><GitBranch className="h-4 w-4" aria-hidden="true" /> {governanceFronts.length} frentes do Núcleo no Core</span>
            <span className="text-muted-foreground">Navegue pela árvore e pela ficha de governança abaixo, sem duplicar seus registros.</span>
          </div>
          {governanceRoot && (
            <div className="pl-12 sm:pl-0 pt-2 pb-4">
              <Button type="button" variant="outline" size="sm" className="min-h-11 px-5"
                onClick={() => onSelectWorkstream(governanceRoot.id)}>
                Abrir ficha de governança
              </Button>
            </div>
          )}
        </Card>
      )}

      {level==="overview" && (
        <Card className="nucleo-v22-surface p-4 md:p-5 space-y-4" aria-label="Módulos operacionais acompanhados">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div>
              <h3 className="font-semibold text-base">Módulos do Painel Central</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{catalog.length} módulo(s) identificado(s) no catálogo · {registeredModules.length} cadastrado(s) no Core. O Núcleo de governança não entra nesta contagem. Para módulos sem frentes vinculadas, o inventário de fontes é apenas diagnóstico para reconciliação humana; não cadastra nem homologa frentes.</p>
            </div>
            <Badge variant="secondary">Não representa progresso global</Badge>
          </div>
          <label className="relative block max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input id="nucleo-atlas-module-search" aria-label="Buscar módulo ou domínio" className="pl-9" value={search} onChange={event=>setSearch(event.target.value)}
              placeholder="Buscar CRM, Financeiro, Operações…" />
          </label>
          <NucleoCrossModuleCoverage modules={modules} workstreams={workstreams} onOpenModule={choose} onPrepareModule={onPrepareModule} />
          {modules.length===0 && <p role="status" className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
            {catalog.length===0
              ? "Nenhum módulo identificado no catálogo deste recorte. Não comprova ausência de módulos na organização."
              : search.trim()
                ? "Nenhum módulo corresponde à busca atual. Altere ou limpe o termo para consultar os módulos identificados."
                : "Nenhum módulo disponível no recorte consultado. Consulte as fontes antes de concluir ausência de cadastro."}
          </p>}
        </Card>
      )}

      {level==="overview" && (
        <Card className="nucleo-v22-surface p-4 md:p-5 space-y-4" aria-label="Atividade recente registrada no Core">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold inline-flex items-center gap-2">
                <Activity className="h-4 w-4 text-sky-700 dark:text-sky-300" aria-hidden="true"/>
                Atividade recente
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Últimas alterações carregadas da trilha de auditoria M3, não de um feed geral do GitHub.
              </p>
            </div>
            <Badge variant="outline">Histórico do Core</Badge>
          </div>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground" role="status">Nenhuma atividade disponível nesta consulta.</p>
          ) : (
            <ol className="space-y-2">
              {recentEvents.map(event => {
                const front = workstreamsById.get(event.workstream_id);
                return (
                  <li key={event.id} className="rounded-lg border p-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-semibold">{front?.title ?? "Registro histórico"}</p>
                      <p className="text-sm text-muted-foreground">
                        {event.event_type === "criado" ? "Ficha criada" : "Ficha atualizada"}
                      </p>
                      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" aria-hidden="true"/>
                        {new Date(event.recorded_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    {front && <Button type="button" variant="outline" size="sm"
                      onClick={() => onSelectWorkstream(front.id)}>Abrir ficha</Button>}
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      )}

      {/* A ficha permanece montada no panorama e na jornada CRM; a seleção persiste. */}
      {selected && (
        <Card className={"nucleo-v22-surface p-4 md:p-5 space-y-4 " + (level === "module" ? "" : "hidden")}
          aria-hidden={level !== "module"}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground">Ficha do módulo selecionado</p>
              <p className="text-sm font-medium">{selected.id} · {selected.name}</p>
            </div>
            <Button type="button" variant="outline" size="sm"
              onClick={returnToModuleResults}>Voltar ao Painel Geral</Button>
          </div>
          <nav aria-label="Localização dentro do Núcleo"
            className="flex flex-wrap items-center gap-2 rounded-xl bg-[#f5f9ff] px-3 py-2 text-xs dark:bg-slate-800">
            <span className="text-muted-foreground">Núcleo / Painel Geral</span>
            <span aria-hidden="true" className="text-[#1a73e8]">›</span>
            <span className="font-semibold">{selected.name}</span>
            <span aria-hidden="true" className="text-[#1a73e8]">›</span>
            <span aria-current="page" className="font-semibold text-[#174ea6] dark:text-blue-200">{currentModuleArea.label}</span>
          </nav>
          <div id={selected.id==="CRM"?"nucleo-crm-module-summary":undefined}
            className="scroll-mt-28 flex flex-wrap items-start justify-between gap-3"
            tabIndex={selected.id==="CRM"?-1:undefined}>
            <div>
              <p className="font-mono text-xs text-muted-foreground">{selected.id} · {selected.domain}</p>
              <h3 id="nucleo-atlas-module-heading" tabIndex={-1} className="scroll-mt-24 font-semibold text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]">{selected.name}</h3>
              <p className="text-sm leading-relaxed mt-1">{selected.purpose}</p>
            </div>
            <Badge variant={selected.coverage==="piloto_parcial"?"secondary":"outline"}>
              {selected.coverage==="piloto_parcial"?"Ficha parcial":"Cobertura não verificada"}
            </Badge>
          </div>
          {(
            <nav aria-label={"Jornada funcional — "+selected.name}
              className="rounded-2xl border border-[#d2e3fc] bg-[#e8f0fe] p-3 dark:border-blue-900 dark:bg-blue-950/30">
              <p className="text-sm font-semibold text-[#174ea6] dark:text-blue-200">Explore o módulo por intenção</p>
              <p className="mb-2 text-xs text-[#3c4043] dark:text-slate-300">
                Escolha diretamente o que precisa entender. Não é necessário seguir a ordem.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
                {CRM_STAGE_NAV.map((step,index)=>(
                  <button key={step.id} type="button" onClick={()=>openModuleStage(step.id)}
                    className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-[#c6dafc] bg-white px-2 py-2 text-left text-xs font-semibold text-[#174ea6] hover:bg-[#f4f8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8] dark:border-blue-900 dark:bg-slate-900 dark:text-blue-200">
                    <span className="shrink-0 rounded-full bg-[#e8f0fe] px-2 py-1 tabular-nums dark:bg-blue-950">{index+1}</span>
                    <span className="break-words">{step.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#5f6368] dark:text-slate-400">
                Navegação de leitura do código e do Core. Não comprova operação, mandato, fonte vigente ou prova técnica M4.
              </p>
            </nav>
          )}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="Resumo factual do módulo">
            {[
              {label:"Frentes vinculadas",value:selectedFronts.length,note:"Core M3"},
              {label:"Pendências declaradas",value:modulePending.length,note:"Frentes e subfrentes"},
              {label:"Sem próxima ação",value:moduleAwaitingAction.length,note:"Pendências M3"},
              {label:"Fontes catalogadas",value:selectedProvenance?.sources.length ?? 0,note:"Referências; não homologações"},
            ].map(metric=><div key={metric.label} className="rounded-lg border p-3 min-w-0">
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{metric.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{metric.note}</p>
            </div>)}
          </div>
          <div className="nucleo-v22-soft-surface p-2 space-y-2">
            <p className="px-1 text-xs text-muted-foreground">
              Escolha uma área para consultar as informações existentes deste módulo.
            </p>
            <nav className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
              aria-label={"Áreas da ficha do módulo "+selected.name}>
              {MODULE_SECTIONS.map(item=>(
                <button key={item.id} type="button" onClick={() => selectModuleArea(item.id)}
                  aria-pressed={moduleSection===item.id}
                  aria-controls="nucleo-module-section-content"
                  className={`nucleo-v22-area-card min-w-0 rounded-md border px-3 py-3 text-left min-h-[70px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${moduleSection===item.id?"border-primary bg-primary/5 shadow-sm":"border-border bg-background hover:bg-muted/60"}`}>
                  <span className="block text-sm font-semibold leading-snug">{item.label}</span>
                  <span className="mt-1 block text-sm leading-snug text-muted-foreground">{item.hint}</span>
                </button>
              ))}
            </nav>
          </div>
          <div id="nucleo-module-section-content" role="region" tabIndex={-1}
            aria-labelledby="nucleo-module-active-section-heading"
            className="space-y-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="border-b pb-3">
              <p className="text-xs font-medium text-muted-foreground">Área selecionada</p>
              <h4 id="nucleo-module-active-section-heading" className="text-base font-semibold">{currentModuleArea.label}</h4>
              <p className="text-sm text-muted-foreground">{currentModuleArea.hint}</p>
            </div>
          {moduleSection==="funcoes" && <div className="grid gap-3 md:grid-cols-2">
            <div className="border rounded-lg p-3 space-y-2">
              <h4 className="font-medium text-sm">Acesso e responsabilidade</h4>
              <p className="text-sm">Rota: <code>{selected.route??"não verificada"}</code></p>
              <p className="text-sm">Especialista: {selected.specialist??"Vínculo não verificado"}</p>
              <p className="text-sm text-muted-foreground">{confidenceLabels[selected.specialistConfidence]}</p>
              {selected.route && <Button size="sm" asChild variant="outline"><Link to={selected.route}>Abrir módulo</Link></Button>}
            </div>
            <div className="border rounded-lg p-3 space-y-2">
              <h4 className="font-medium text-sm">Fonte e método</h4>
              <p className="text-sm leading-relaxed">{selectedProvenance?.methodSummary ?? (selected.id==="CRM"?CRM_REFERENCE.method:"Método, escopo e checkpoint ainda precisam de fontes vigentes.")}</p>
              {selected.source.startsWith("https://") ?
                <a href={selected.source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline">
                  Conferir código de origem <ExternalLink className="h-3 w-3" aria-hidden="true"/>
                </a> :
                <p className="text-xs text-muted-foreground">{selected.source}</p>}
            </div>
          </div>}
          {selectedRecord && (moduleSection==="especialista" || specialistVisited) && (
            <section hidden={moduleSection!=="especialista"} className="rounded-lg border p-3 md:p-4 space-y-3" aria-label="Especialista, método e autoridade formal">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Especialista, método e frentes vinculadas</h4>
                <p className="text-xs text-muted-foreground">
                  A responsabilidade textual do M3, a proveniência do método e o mandato
                  registrado no Core são evidências diferentes. Nenhuma é promovida automaticamente.
                </p>
              </div>
              <nav aria-label="Consultar aspectos do especialista" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  {id:"papel",label:"Papel e método"},
                  {id:"mandato",label:"Mandatos e limites"},
                  {id:"continuidade",label:"Continuidade AC-02"},
                  {id:"documentos",label:"Documentos AC-01"},
                ] as const).map(item=>(
                  <button key={item.id} type="button"
                    aria-pressed={specialistPanel===item.id}
                    aria-controls={"nucleo-specialist-"+item.id}
                    onClick={()=>openSpecialistPanel(item.id)}
                    className={"min-h-11 min-w-0 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8] "+
                      (specialistPanel===item.id?"border-[#1a73e8] bg-[#e8f0fe] text-[#174ea6] dark:bg-blue-950 dark:text-blue-200":"border-[#dce5f1] bg-white hover:bg-[#f5f9ff] dark:border-slate-700 dark:bg-slate-800")}>
                    {item.label}
                  </button>
                ))}
              </nav>
              <div id="nucleo-specialist-papel" hidden={specialistPanel!=="papel"}
                className="space-y-3" aria-hidden={specialistPanel!=="papel"}>
                <div className="grid gap-2 sm:grid-cols-2">
                <div className="border rounded-md p-3 space-y-1">
                  <p className="text-xs font-semibold">Responsável declarado no M3</p>
                  <p className="text-sm">{selectedRecord.specialist || "Não informado"}</p>
                  <Badge variant="outline">Declaração textual — não certifica</Badge>
                </div>
                <div className="border rounded-md p-3 space-y-1">
                  <p className="text-xs font-semibold">Método e fontes identificadas</p>
                  <p className="text-sm">
                    {selectedProvenance
                      ? `${selectedProvenance.sources.length} fonte(s) no catálogo versionado`
                      : "Sem proveniência catalogada"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedProvenance?.ownerBoundary ?? "Método e autoridade ainda não reconciliados."}
                  </p>
                </div>
              </div>
              <section className="rounded-md border p-3 space-y-3" aria-label="Pendências e evidências do papel declarado">
                <div>
                  <p className="font-semibold text-sm">Continuidade das frentes do especialista · M3</p>
                  <p className="text-xs text-muted-foreground">
                    Vínculo por nome de responsável declarado nesta ficha. Não comprova mandato,
                    autoria de entregas, deploy ou aceite; registros sem esse vínculo não são atribuídos automaticamente.
                  </p>
                </div>
                {specialistRole ? <>
                  <p className="text-xs">
                    {specialistWork.length} frente(s)/subfrente(s) com vínculo textual exato;
                    {" "}{specialistPending.length} pendente(s);
                    {" "}{specialistPending.filter(item=>item.evidence_state!=="comprovada").length} pendente(s) sem prova marcada como comprovada no M3.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Último evento M3 localizado para esse vínculo: {specialistLatestEvent
                      ? new Date(specialistLatestEvent.recorded_at).toLocaleString("pt-BR")+" · evento administrativo"
                      : "não localizado nos 200 eventos globais carregados; histórico anterior pode existir"}.
                  </p>
                  {specialistPriority.length>0 ? <div className="space-y-2">
                    {specialistPriority.map(item=><div key={item.id} className="rounded-md border p-2 space-y-1 text-xs">
                      <p className="font-semibold">{item.code} · {item.title}</p>
                      <p>Situação: {item.status.replaceAll("_"," ")} · Prova M3: {item.evidence_state.replaceAll("_"," ")}</p>
                      <p>Bloqueio: {item.blocker.trim()||"Não registrado"}</p>
                      <p>Próxima ação: {item.next_action.trim()||"Não registrada"}</p>
                      <Button type="button" size="sm" variant="outline" onClick={()=>onSelectWorkstream(item.id)}>Abrir ficha e evidências M3/M4</Button>
                    </div>)}
                  </div> : <p className="text-xs text-muted-foreground">
                    Nenhuma pendência vinculada por nome neste recorte. Isso não comprova inexistência de trabalho externo ao M3.
                  </p>}
                </> : <p className="text-xs text-muted-foreground">
                  Responsável não informado no módulo M3; não é possível atribuir frentes a um especialista nesta leitura.
                </p>}
                <Button type="button" size="sm" variant="outline" onClick={()=>selectModuleArea("desenvolvimento")}>
                  Ver todas as frentes e provas do módulo
                </Button>
              </section>
              <div className="rounded-md border p-3 space-y-2" aria-label="Conhecimento e Evolução AC-01">
                <p className="font-semibold text-sm">Conhecimento e Evolução do especialista</p>
                <p className="text-xs text-muted-foreground">
                  A Ficha Viva reúne fontes e revisões por módulo. A proposta é vinculada ao papel funcional
                  declarado, sem atribuir mandato ao autor nem homologar documento. Comparação de versões
                  e preparação de refinamento ficam no histórico FM existente.
                </p>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => selectModuleArea("conhecimento")}>
                  Consultar versões e registrar rascunho
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="min-h-10 rounded-full"
                  onClick={()=>selectModuleArea("desenvolvimento")}>Acompanhar frentes e pendências M3</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Fontes e responsabilidades textuais não conferem mandato. Consulte autorizações e história nas áreas próprias.
              </p>
              </div>
              <div id="nucleo-specialist-mandato" hidden={specialistPanel!=="mandato"}
                aria-hidden={specialistPanel!=="mandato"}>
                {specialistPanelVisited.includes("mandato")&&<NucleoMandateRegistry modules={[selectedRecord]}/>}
              </div>
              <div id="nucleo-specialist-continuidade" hidden={specialistPanel!=="continuidade"}
                aria-hidden={specialistPanel!=="continuidade"}>
                {specialistPanelVisited.includes("continuidade")&&
                  <NucleoAc02ContinuityRead key={selectedRecord.id} moduleId={selectedRecord.id} moduleCode={selectedRecord.code}
                    onViewWorkstreams={()=>selectModuleArea("desenvolvimento")}
                    onViewDocuments={()=>openSpecialistPanel("documentos")}
                    onViewMandates={()=>openSpecialistPanel("mandato")}/> }
              </div>
              <div id="nucleo-specialist-documentos" hidden={specialistPanel!=="documentos"}
                aria-hidden={specialistPanel!=="documentos"}>
                {specialistPanelVisited.includes("documentos")&&
                  <NucleoSpecialistContributions key={selectedRecord.id} moduleId={selectedRecord.id}
                    moduleName={selectedRecord.title} declaredRole={selectedRecord.specialist||""}
                    requestedStage={ac01Request}
                    onDraftStateChange={setSpecialistDraftState}/>}
              </div>
            </section>
          )}
          {moduleSection==="especialista" && specialistPanel==="papel" && selectedProvenance && (
            <section className="rounded-lg border p-3 md:p-4 space-y-3" aria-label="Fontes e autoridade documental">
              <div>
                <h4 className="font-semibold text-sm">Fontes documentais e autoridade</h4>
                <p className="text-sm text-muted-foreground mt-1">{selectedProvenance.ownerBoundary}</p>
                <p className="text-xs text-muted-foreground mt-1">Metadados de referência presentes no GitHub; sem importação para o Núcleo ou atualização automática.</p>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {selectedProvenance.sources.map(source => (
                  <div key={source.path} className="rounded-lg border p-3 space-y-2 min-w-0">
                    <p className="text-sm font-medium">{source.label}</p>
                    <p className="text-xs text-muted-foreground">{SOURCE_AUTHORITY_LABELS[source.authority]}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{source.note}</p>
                    <a href={source.path} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1 text-sm underline underline-offset-2">
                      Abrir fonte original <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </div>
                ))}
              </div>
            </section>
          )}
          {moduleSection==="desenvolvimento" && selectedRecord && <div className="rounded-md border p-3 flex flex-wrap gap-2 items-center justify-between">
            <p className="text-xs text-muted-foreground">Confronte as frentes M3 com a evolução FM-09 registrada e seus limites documentais.</p>
            <Button type="button" size="sm" variant="outline" onClick={openFm09Continuity}>
              Consultar evolução e conhecimento FM-09
            </Button>
          </div>}
          {moduleSection==="desenvolvimento" && selectedRecord &&
            <NucleoExecutiveDevelopment workstreams={workstreams} dependencies={dependencies}
              events={events} moduleId={selectedRecord.id} onOpenWorkstream={onSelectWorkstream}/>}
          {moduleSection==="desenvolvimento" && selectedRecord && (
              <div className="rounded-lg border p-3 space-y-2">
                <h4 className="font-semibold text-sm">Frentes reais vinculadas no Core</h4>
                <p className="text-xs text-muted-foreground">Estado declarado pela governança, diferente de implantação, aceite e uso real. Provas M4 são registros históricos consultados sob permissão; não são verificação GitHub ao vivo.</p>
                <div id="nucleo-module-evidence" className="flex scroll-mt-28 flex-wrap items-center gap-2" tabIndex={-1}>
                  <Badge variant="outline">{selectedFronts.length} frente(s) direta(s)</Badge>
                  <Badge variant="outline">{selectedSubfronts.length} subfrente(s) vinculada(s)</Badge>
                  <Button type="button" size="sm" variant="outline"
                    aria-expanded={evidenceFrontId === selectedRecord.id}
                    onClick={() => setEvidenceFrontId(current => current === selectedRecord.id ? null : selectedRecord.id)}>
                    {evidenceFrontId === selectedRecord.id ? "Ocultar evidências do módulo" : "Ver evidências do módulo"}
                  </Button>
                </div>
                {evidenceFrontId === selectedRecord.id && <NucleoTechnicalEvidence workstreamId={selectedRecord.id} />}
                <section className="rounded-md border p-3 space-y-3" aria-label="Pendências e evolução declarada do módulo">
                  <div>
                    <h5 className="text-sm font-semibold">Pendências e evolução registrada</h5>
                    <p className="text-xs text-muted-foreground">
                      Leitura dos estados M3 das frentes e subfrentes vinculadas.
                      Contagens não medem percentual executado nem homologação.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="rounded border p-2">
                      <p className="text-xs text-muted-foreground">Em andamento</p>
                      <p className="text-lg font-semibold tabular-nums">{moduleStatusCounts.andamento}</p>
                    </div>
                    <div className="rounded border p-2">
                      <p className="text-xs text-muted-foreground">Em validação</p>
                      <p className="text-lg font-semibold tabular-nums">{moduleStatusCounts.validacao}</p>
                    </div>
                    <div className="rounded border p-2">
                      <p className="text-xs text-muted-foreground">Bloqueadas</p>
                      <p className="text-lg font-semibold tabular-nums">{moduleStatusCounts.bloqueadas}</p>
                    </div>
                    <div className="rounded border p-2">
                      <p className="text-xs text-muted-foreground">Concluídas com prova declarada</p>
                      <p className="text-lg font-semibold tabular-nums">{moduleStatusCounts.concluidasComProvaDeclarada}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {modulePending.length} pendência(s) cadastrada(s) · {moduleAwaitingAction.length} sem próxima ação informada.
                    O estado de prova é o valor declarado no cadastro, não verificação externa.
                  </p>
                  {attentionItems.length > 0 ? (
                    <div className="space-y-2">
                      <h6 className="text-xs font-semibold">Prioridades para acompanhamento ({attentionItems.length} de {modulePending.length})</h6>
                      {attentionItems.map(item => (
                        <div key={item.id} className="rounded border p-2 flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm font-medium">{item.code} · {item.title}</p>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline">{item.status.replaceAll("_", " ")}</Badge>
                              <Badge variant="secondary">Prioridade: {item.priority}</Badge>
                              <Badge variant="outline">{item.evidence_state.replaceAll("_", " ")}</Badge>
                            </div>
                            {item.blocker && <p className="text-xs text-muted-foreground">Bloqueio declarado: {item.blocker}</p>}
                            <p className="text-xs">Próxima ação: {item.next_action.trim() || "Não informada"}</p>
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={() => onSelectWorkstream(item.id)}>
                            Abrir ficha M3
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {moduleWork.length === 0
                        ? "Nenhuma frente ou subfrente cadastrada neste módulo."
                        : "Nenhuma pendência aberta nos registros atuais. Isso não confirma homologação."}
                    </p>
                  )}
                </section>
                {selectedSubfronts.length > 0 && (
                  <div className="rounded-md border p-3 space-y-2">
                    <p className="font-medium text-sm">Subfrentes existentes — acompanhamento documental</p>
                    <p className="text-xs text-muted-foreground">Estados e provas pertencem às fichas M3. Não indicam deploy ou homologação automática.</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {selectedSubfronts.map(subfront => (
                        <div key={subfront.id} className="rounded-lg border p-3 space-y-2 min-w-0">
                          <div className="flex flex-wrap justify-between items-center gap-2">
                            <p className="font-semibold text-sm">{subfront.code}</p>
                            <Badge variant="outline">{subfront.status.replaceAll("_"," ")}</Badge>
                          </div>
                          <p className="text-sm">{subfront.title}</p>
                          <p className="text-xs text-muted-foreground">Frente pai: {workstreamsById.get(subfront.parent_id ?? "")?.code ?? "Vínculo não encontrado"}</p>
                          <p className="text-xs text-muted-foreground">{subfront.evidence_state.replaceAll("_", " ")} · {subfront.specialist || "Especialista não informado"}</p>
                          <p className="text-xs text-muted-foreground line-clamp-3">{subfront.next_action || "Sem próxima ação declarada"}</p>
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => onSelectWorkstream(subfront.id)}>
                              Abrir ficha na Central
                            </Button>
                            <Button type="button" size="sm" variant="outline"
                              aria-expanded={evidenceFrontId === subfront.id}
                              onClick={() => setEvidenceFrontId(current => current === subfront.id ? null : subfront.id)}>
                              {evidenceFrontId === subfront.id ? "Ocultar provas" : "Ver provas M4"}
                            </Button>
                          </div>
                          {evidenceFrontId === subfront.id && <NucleoTechnicalEvidence workstreamId={subfront.id} />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedFronts.length ? selectedFronts.map(front => (
                  <div key={front.id} className="rounded-md border p-3 flex flex-wrap justify-between items-start gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="font-medium text-sm">{front.code} · {front.title}</p>
                      <p className="text-xs text-muted-foreground">{front.status.replaceAll("_", " ")} · {front.evidence_state.replaceAll("_", " ")} · {front.specialist || "Especialista não informado"}</p>
                      <p className="text-xs">Próxima ação: {front.next_action || "Não registrada"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => onSelectWorkstream(front.id)}>Abrir frente na Central</Button>
                      <Button type="button" size="sm" variant="outline" aria-expanded={evidenceFrontId === front.id}
                        onClick={() => setEvidenceFrontId(current => current === front.id ? null : front.id)}>
                        {evidenceFrontId === front.id ? "Ocultar provas" : "Ver provas GitHub/Supabase"}
                      </Button>
                    </div>
                    {evidenceFrontId === front.id && <div className="w-full border-t pt-2"><NucleoTechnicalEvidence workstreamId={front.id}/></div>}
                  </div>
                )) : <p className="text-xs text-muted-foreground">Nenhuma frente vinculada ao módulo no Core foi encontrada nesta sessão.</p>}
              </div>
          )}
          {(fmDraftState.dirty || specialistDraftState.dirty) && (
            <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-100">
              Rascunho não salvo neste módulo. Salve ou confirme o descarte antes de trocar de módulo.
            </p>
          )}
          {selectedRecord && (moduleSection==="conhecimento" || knowledgeVisited) && (
            <div hidden={moduleSection!=="conhecimento"} className="space-y-3">
              <p className="text-sm text-muted-foreground">As seções FM distinguem modelos locais de versões efetivamente gravadas no Core. Referências históricas não se tornam vigentes automaticamente.</p>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Contribuições e governança AC-01</p>
                  <p className="text-xs text-muted-foreground">O especialista mantém propostas, revisões, solicitações e decisões em consulta separada da Ficha Viva. Nenhuma aprovação é inferida.</p>
                </div>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => selectModuleArea("especialista")}>
                  Consultar ciclo AC-01 do especialista
                </Button>
              </div>
              <Button type="button" variant="outline" size="sm" aria-expanded={knowledgeOpen}
                onClick={()=>setKnowledgeOpen(open=>!open)}>
                {knowledgeOpen?"Ocultar Ficha Viva":"Abrir Ficha Viva FM-01–FM-10"}
              </Button>
              {knowledgeVisited && (
                <div hidden={!knowledgeOpen}>
                  <NucleoModuleKnowledge key={selectedRecord.id} moduleId={selectedRecord.id} moduleCode={selectedRecord.code}
                    workstreams={workstreams} events={events}
                    onOpenAc01Stage={openAc01FromFm}
                    onOpenWorkstream={onSelectWorkstream}
                    requestedSection={fmSectionRequest}
                    onDraftStateChange={setFmDraftState}/>
                </div>
              )}
            </div>
          )}
          {moduleSection==="conhecimento" && <NucleoModuleDiscovery
            key={selected.id+"-conhecimento"} module={selected} mode="conhecimento" isRegistered={Boolean(selectedRecord)}/>}
          {moduleSection==="conhecimento" && !selectedRecord && <p className="rounded-md border p-3 text-sm text-muted-foreground">
            Módulo identificado em fontes, mas não cadastrado no Core M3 nesta leitura; Ficha Viva ainda não comprovada.
          </p>}
          {moduleSection==="especialista" && !selectedRecord && <p className="rounded-md border p-3 text-sm text-muted-foreground">
            Responsabilidade e mandato ainda não foram comprovados no Core para este módulo. Não inferir autoridade do nome do especialista.
          </p>}
          {moduleSection==="desenvolvimento" && !selectedRecord && <p className="rounded-md border p-3 text-sm text-muted-foreground">
            Não há cadastro M3 visível nesta leitura; isso não equivale a ausência de desenvolvimento nas fontes.
          </p>}
          {moduleSection==="funcoes" && (selected.id==="CRM" ? (
            <>
              <div className="rounded-md border p-3 space-y-1 text-xs">
                <p className="font-semibold">Checkpoint de especialista — referência histórica, não norma vigente</p>
                <p>CRM UX 02: mapa A3.1 / B3.1-A, com oito incrementos registrados como mergeados no checkpoint de 16/10/2026. A vigência do método e a homologação de uso real exigem reconciliação.</p>
                <a className="underline underline-offset-2" target="_blank" rel="noopener noreferrer"
                  href="https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/main/docs/crm/CRM_UX_02_MAPA_EXECUCAO_A31_B31A.md">
                  Consultar fonte documental original
                </a>
              </div>
              <NucleoModuleDiscovery key={selected.id+"-funcoes"}
                module={selected} mode="funcoes" isRegistered={Boolean(selectedRecord)}/>
              <Button size="sm" onClick={()=>setLevel("operation")}><BookOpen className="h-4 w-4 mr-1.5" /> Ver como operar e comprovar</Button>
            </>
          ) : <NucleoModuleDiscovery key={selected.id+"-funcoes"}
            module={selected} mode="funcoes" isRegistered={Boolean(selectedRecord)}/>)}
          </div>
        </Card>
      )}

      {selected?.id==="CRM" && level==="operation" && (
        <Card className="p-4 md:p-5 space-y-4">
          <div className="space-y-2">
            <Button type="button" variant="outline" size="sm" onClick={()=>{
              setLevel("module");setModuleSection("funcoes");
            }}>Voltar às funcionalidades do CRM</Button>
            <p className="text-xs text-muted-foreground">CRM · Piloto A+ V1.2 · Código e M3, não homologação de uso real</p>
            <h3 className="font-semibold text-lg">Jornadas de gestor e operador</h3>
            <p className="text-sm text-muted-foreground">
              O gestor acompanha frente, prova e conhecimento. O operador consulta controles e confirma o efeito no CRM.
              Nenhuma etapa constitui aceite automático.
            </p>
            <div className="flex flex-wrap gap-2" aria-label="Selecionar jornada CRM">
              <Button type="button" size="sm" variant={crmJourneyMode==="gestor"?"default":"outline"}
                aria-pressed={crmJourneyMode==="gestor"} onClick={()=>setCrmJourneyMode("gestor")}>
                Gestor — acompanhar desenvolvimento
              </Button>
              <Button type="button" size="sm" variant={crmJourneyMode==="operador"?"default":"outline"}
                aria-pressed={crmJourneyMode==="operador"} onClick={()=>setCrmJourneyMode("operador")}>
                Operador — tratar atendimento
              </Button>
            </div>
          </div>
          {crmJourneyMode==="gestor" && (
            <section className="space-y-3" aria-label="Jornada do gestor CRM">
              <div className="rounded-lg border p-3 space-y-2">
                <h4 className="text-sm font-semibold">1. Selecionar a frente e ler seu estado declarado</h4>
                <p className="text-xs text-muted-foreground">
                  Frentes vinculadas ao módulo CRM no Core M3. Titularidade e status são declarativos.
                </p>
                {selectedFronts.length===0 && <p className="text-xs">
                  Nenhuma frente CRM vinculada nesta consulta; não inferir progresso.
                </p>}
                {selectedFronts.map(front=><div key={front.id} className="rounded border p-3 space-y-2">
                  <p className="text-sm font-medium">{front.code} · {front.title}</p>
                  <p className="text-xs">Estado: {front.status.replaceAll("_"," ")} · Próxima ação: {front.next_action||"não informada"}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={()=>onSelectWorkstream(front.id)}>
                      Abrir ficha e histórico M3
                    </Button>
                    <Button type="button" size="sm" variant="outline"
                      aria-expanded={evidenceFrontId===front.id}
                      onClick={()=>setEvidenceFrontId(id=>id===front.id?null:front.id)}>
                      {evidenceFrontId===front.id?"Ocultar evidências":"Conferir evidências M4"}
                    </Button>
                  </div>
                  {evidenceFrontId===front.id && <NucleoTechnicalEvidence workstreamId={front.id}/>}
                </div>)}
              </div>
              <div className="rounded-lg border p-3 space-y-2">
                <h4 className="text-sm font-semibold">2. Confrontar fontes, método e Ficha Viva</h4>
                <p className="text-xs">A Ficha Viva FM-01–FM-10 e a proveniência são consultadas na ficha do módulo.
                  Modelos locais e documentos históricos não são homologações.</p>
                <Button type="button" size="sm" variant="outline" onClick={()=>{
                  setLevel("module");
                  selectModuleArea("conhecimento");
                }}>Abrir Ficha Viva CRM e fontes</Button>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <h4 className="text-sm font-semibold">3. Conferir critérios de aceite</h4>
                <p className="text-xs text-muted-foreground">
                  Diferenciar PR mergeada, CI, deploy, teste real e decisão humana.
                  O checkpoint CRM UX02 não homologa a jornada autenticada do gestor.
                </p>
              </div>
            </section>
          )}
          {crmJourneyMode==="operador" && (
            <>
          <div>
            <h4 className="font-semibold text-sm mb-2">Passos da tarefa</h4>
            <ol className="list-decimal pl-6 space-y-2 text-sm">
              {CRM_JOURNEY.map((step,i)=><li key={i}>{step}</li>)}
            </ol>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Catálogo dos controles relevantes</h4>
            <Input aria-label="Buscar ação do CRM" placeholder="Buscar botão, efeito ou tela" value={actionSearch} onChange={event=>setActionSearch(event.target.value)} />
            {actions.map(action=>(
              <details key={action.label} className="border rounded-md p-3 group">
                <summary className="text-sm font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{action.label} <span className="text-xs font-normal text-muted-foreground">· {action.screen}</span></summary>
                <dl className="grid gap-2 text-xs mt-3">
                  <div><dt className="font-semibold">Antes de usar</dt><dd>{action.prerequisite}</dd></div>
                  <div><dt className="font-semibold">Efeito esperado</dt><dd>{action.expectedEffect}</dd></div>
                  <div><dt className="font-semibold">Confirmação</dt><dd>{action.confirmation}</dd></div>
                  <div><dt className="font-semibold">Limite</dt><dd>{action.limit}</dd></div>
                </dl>
                <a href={action.source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline mt-2">
                  Ver evidência no código <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </details>
            ))}
            {actions.length===0 && <p role="status" className="text-xs text-muted-foreground">Nenhuma ação encontrada.</p>}
          </div>
          <div className="rounded-lg border p-3 space-y-1 text-xs">
            <h4 className="font-semibold">Prova e limitações</h4>
            <p>{CRM_REFERENCE.checkpoint}</p><p>{CRM_REFERENCE.limitation}</p>
            <a href={CRM_REFERENCE.source} target="_blank" rel="noopener noreferrer" className="underline">Consultar origem técnica</a>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <h4 className="text-sm font-semibold">Conferência do operador — ensaio real pendente</h4>
            <p className="text-xs text-muted-foreground">
              Resultado é um fato ocorrido; Adiar não fabrica resultado; abrir WhatsApp não comprova entrega.
              Conferir histórico e próxima ação no CRM após retorno confirmado; em falha ambígua,
              verificar antes de repetir.
            </p>
          </div>
          <Button size="sm" variant="outline" asChild><Link to="/contatos/inbox">Abrir caixa de atendimentos</Link></Button>
            </>
          )}
        </Card>
      )}
    </section>
  );
}
