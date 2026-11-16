import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ExternalLink, Search, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MODULE_RECONCILIATION_V12 } from "@/lib/nucleo/moduleReconciliationV12";
import { MODULE_ORIGINAL_SOURCES_V12 } from "@/lib/nucleo/moduleOriginalSourcesV12";
import { MODULE_CONTROLS_V12 } from "@/lib/nucleo/moduleControlDiscoveriesV12";
import { MODULE_SCREENS_V12 } from "@/lib/nucleo/moduleScreenDiscoveriesV12";
import { MODULE_JOURNEYS_V12 } from "@/lib/nucleo/moduleJourneysV12";
import NucleoGuidedJourneys, { type GuidedJourneyRequest } from "@/components/nucleo/NucleoGuidedJourneys";
import type { KnowledgeModule } from "@/lib/nucleo/operationalKnowledgeV12";

type Props={module:KnowledgeModule;mode:"funcoes"|"conhecimento";isRegistered:boolean};

/**
 * Reaproveita fontes de reconciliação já versionadas no Núcleo. Não cria
 * cadastro, não realiza ações de negócio e não eleva referências a manuais.
 */
export default function NucleoModuleDiscovery({module,mode,isRegistered}:Props){
  const [search,setSearch]=useState("");
  const [journeyRequest,setJourneyRequest]=useState<GuidedJourneyRequest|null>(null);
  const controls=MODULE_CONTROLS_V12[module.id]??[];
  const screens=MODULE_SCREENS_V12[module.id]??[];
  const sources=MODULE_RECONCILIATION_V12[module.id]??[];
  const originals=MODULE_ORIGINAL_SOURCES_V12[module.id]??[];
  const journeys=MODULE_JOURNEYS_V12[module.id]??[];
  // Navegação proporcional a descobertas reais; nunca fabricar roteiro.
  const anchor=(kind:"screens"|"controls"|"procedures")=>module.id==="CRM"?
    "nucleo-crm-"+kind:"nucleo-module-"+module.id.toLowerCase()+"-"+kind;
  const go=(kind:"screens"|"controls"|"procedures")=>{
    setSearch("");
    requestAnimationFrame(()=>{
      const target=document.getElementById(anchor(kind));
      target?.scrollIntoView({behavior:"smooth",block:"start"});
      if(target instanceof HTMLElement&&target.tabIndex>=0)target.focus({preventScroll:true});
    });
  };
  const openRelatedJourney=(controlLabel:string)=>{
    const found=journeys.find(item=>item.steps.some(step=>step.controlLabel===controlLabel));
    if(!found)return;
    setJourneyRequest(previous=>({
      journeyId:found.id,controlLabel,requestId:(previous?.requestId??0)+1,
    }));
    go("procedures");
  };
  const query=search.trim().toLocaleLowerCase("pt-BR");
  const visibleControls=useMemo(()=>controls.filter(item=>!query||
    [item.label,item.screen,item.prerequisite,item.observed,item.limitation]
      .some(value=>value.toLocaleLowerCase("pt-BR").includes(query))),[controls,query]);
  const visibleScreens=useMemo(()=>screens.filter(item=>!query||
    [item.name,item.area,item.description].some(value=>value.toLocaleLowerCase("pt-BR").includes(query))),[screens,query]);
  const visibleOriginals=useMemo(()=>originals.filter(item=>!query||
    [item.title,item.version,item.archive,item.originalFile,item.sourceStatus,item.authorityScope]
      .some(value=>value.toLocaleLowerCase("pt-BR").includes(query))),[originals,query]);
  const visibleSources=useMemo(()=>sources.filter(item=>!query||
    [item.label,item.observed,item.nextGate].some(value=>
      value.toLocaleLowerCase("pt-BR").includes(query))),[sources,query]);
  return <section className="rounded-lg border p-3 md:p-4 space-y-3"
    aria-label={mode==="funcoes"?"Funcionalidades observadas no módulo":"Fontes de conhecimento para reconciliação"}>
    <div className="flex flex-wrap justify-between items-start gap-2">
      <div className="space-y-1">
        <h4 className="font-semibold text-sm">
          {mode==="funcoes"?"Telas e controles identificados no código":"Conhecimento e fontes verificáveis"}
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {mode==="funcoes"
            ?"Descoberta orientada pela implementação; abrir um botão não comprova resultado operacional."
            :"Referências do inventário existente. São pistas documentais para revisão humana, não Fichas Vivas homologadas."}
        </p>
      </div>
      <Badge variant="outline">{isRegistered?"Cadastro M3 visível":"Somente inventário, sem cadastro M3"}</Badge>
    </div>
    <div className="rounded-md border bg-muted/30 p-3 text-xs flex gap-2 items-start">
      <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true"/>
      <p>
        Código encontrado e mapa declarado não equivalem a deploy, readback, homologação,
        mandato do especialista ou autorização para executar ações de negócio. O Núcleo
        consulta, não realiza esses procedimentos.
      </p>
    </div>
    {(screens.length>0||controls.length>0||sources.length>0||originals.length>0)&&<label className="relative block max-w-lg">
      <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" aria-hidden="true"/>
      <Input aria-label="Buscar funcionalidade ou referência do módulo" className="pl-9"
        placeholder="Buscar botão, fluxo ou fonte…" value={search} onChange={e=>setSearch(e.target.value)}/>
    </label>}
    {mode==="funcoes"&&<>
      <nav aria-label={"Explorar telas, controles e roteiros existentes de "+module.name}
        className="rounded-xl border border-[#d2e3fc] bg-[#f5f9ff] p-3 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm font-semibold">Explore o módulo por intenção</p>
        <p className="mb-2 text-xs text-muted-foreground">
          Somente descobertas documentadas; quantidade não equivale a cobertura integral nem homologação.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {([
            {kind:"screens",label:"Telas identificadas",total:screens.length},
            {kind:"controls",label:"Controles descritos",total:controls.length},
            {kind:"procedures",label:"Roteiros de consulta",total:journeys.length},
          ] as const).map(item=>(
            <button key={item.kind} type="button" onClick={()=>go(item.kind)}
              disabled={item.total===0}
              aria-label={item.label+": "+(item.total?item.total+" registro(s) no catálogo":"cobertura não verificada")}
              className="min-h-11 rounded-xl border border-[#d2e3fc] bg-white px-3 py-2 text-left text-sm font-semibold text-[#174ea6] hover:bg-[#e8f0fe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-200">
              {item.label} · {item.total||"não verificado"}
            </button>
          ))}
        </div>
      </nav>
      <NucleoGuidedJourneys key={module.id} module={module} request={journeyRequest}/>
      <div id={module.id==="CRM"?"nucleo-crm-screens":anchor("screens")}
        className="scroll-mt-28 space-y-2" tabIndex={-1}
        aria-label="Mapa visual de telas do módulo">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <h5 className="text-sm font-semibold">Mapa de telas identificadas ({visibleScreens.length}/{screens.length})</h5>
          <Badge variant="outline">Código verificado · uso real não homologado</Badge>
        </div>
        {visibleScreens.length>0&&<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleScreens.map(item=><article key={item.id} className="rounded-lg border p-3 min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <p className="text-sm font-semibold">{item.name}</p>
              <Badge variant="outline">{item.area}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{item.description}</p>
            <p className="text-xs text-muted-foreground">
              {item.navigation==="rota_verificada"
                ?"Rota de aba inspecionada no código"
                :"Abrir módulo e selecionar a seção manualmente"}
            </p>
            <details className="rounded-md border p-2 text-xs">
              <summary className="cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Conferência e limites
              </summary>
              <p className="mt-2"><strong>Conferir:</strong> {item.check}</p>
              <p className="mt-2 text-muted-foreground"><strong>Limite:</strong> {item.limitation}</p>
            </details>
            <div className="flex flex-wrap gap-2 items-center">
              {item.route
                ? <Button size="sm" variant="outline" asChild><Link to={item.route} target="_blank" rel="noopener noreferrer">Abrir tela em nova guia</Link></Button>
                : module.route
                  ? <Button size="sm" variant="outline" asChild><Link to={module.route} target="_blank" rel="noopener noreferrer">Abrir módulo em nova guia</Link></Button>
                  : null}
              <a href={item.source} target="_blank" rel="noopener noreferrer"
                className="text-xs underline inline-flex items-center gap-1">
                Fonte <ExternalLink className="h-3 w-3" aria-hidden="true"/>
              </a>
            </div>
          </article>)}
        </div>}
        {screens.length===0&&<p className="text-sm text-muted-foreground">
          Mapa de telas ainda não detalhado para este domínio. A ausência de registro aqui
          não comprova que o módulo não possua telas.
        </p>}
      </div>
      <div id={module.id==="CRM"?"nucleo-crm-controls":anchor("controls")}
        className="flex scroll-mt-28 flex-wrap items-center justify-between gap-2"
        tabIndex={-1}>
        <h5 className="text-sm font-semibold">Controles e efeitos observados</h5>
        {journeys.length>0&&<Button type="button" variant="outline" size="sm"
          className="min-h-10 rounded-full"
          onClick={()=>go("procedures")}>
          Ver procedimentos orientados
        </Button>}
      </div>
      {visibleControls.length>0&&<div className="grid gap-3 lg:grid-cols-2">
        {visibleControls.map(item=><details key={item.label} className="rounded-md border p-3 min-w-0 group">
          <summary className="text-sm font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {item.label}
            <span className="block font-normal text-xs text-muted-foreground mt-1">{item.screen}</span>
          </summary>
          <dl className="mt-3 grid gap-2 text-xs">
            <div><dt className="font-semibold">Antes de usar</dt><dd>{item.prerequisite}</dd></div>
            <div><dt className="font-semibold">Observado no código</dt><dd>{item.observed}</dd></div>
            <div><dt className="font-semibold">Como conferir</dt><dd>{item.confirmation}</dd></div>
            <div><dt className="font-semibold">O que ainda não comprova</dt><dd>{item.limitation}</dd></div>
          </dl>
          {journeys.some(journey=>journey.steps.some(step=>step.controlLabel===item.label))&&
            <Button type="button" size="sm" variant="outline" className="mt-3 min-h-10"
              onClick={()=>openRelatedJourney(item.label)}>
              Ver procedimento relacionado
            </Button>}
          <a href={item.source} target="_blank" rel="noopener noreferrer"
            className="text-xs inline-flex items-center gap-1 underline mt-3">
            Conferir fonte no GitHub <ExternalLink className="h-3 w-3" aria-hidden="true"/>
          </a>
        </details>)}
      </div>}
      {controls.length===0&&<p className="text-sm text-muted-foreground">
        Ainda não há botões documentados individualmente para este módulo neste piloto.
        Consulte abaixo as superfícies identificadas e abra o próprio módulo para navegação autorizada.
      </p>}
      {module.route&&<Button variant="outline" size="sm" asChild>
        <Link to={module.route}>Abrir o módulo original</Link>
      </Button>}
    </>}
    {visibleSources.length>0&&<div className="space-y-2">
      <h5 className="text-sm font-semibold flex items-center gap-2">
        <BookOpen className="h-4 w-4" aria-hidden="true"/>
        {mode==="funcoes"?"Outras superfícies em levantamento":"Referências para aprender e reconciliar"}
      </h5>
      <div className="grid gap-2 lg:grid-cols-2">
        {visibleSources.map(item=><div key={item.reference+"|"+item.label}
          className="rounded-md border p-3 text-xs space-y-2 min-w-0">
          <p className="font-semibold text-sm">{item.label}</p>
          <Badge variant="outline">{item.evidenceKind==="codigo_presente"?"Código identificado":"Declaração documental"}</Badge>
          <p>{item.observed}</p>
          <p className="text-muted-foreground">A confirmar: {item.nextGate}</p>
          <a href={item.reference} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline">
            Conferir origem <ExternalLink className="h-3 w-3" aria-hidden="true"/>
          </a>
        </div>)}
      </div>
    </div>}
    {mode==="conhecimento"&&originals.length>0&&<section className="space-y-2" aria-label="Fontes originais e situação de autoridade">
      <div className="flex flex-wrap justify-between gap-2 items-center">
        <h5 className="text-sm font-semibold">Documentos originais identificados ({visibleOriginals.length}/{originals.length})</h5>
        <Badge variant="outline">Metadados do acervo · sem cópia do original</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Os caminhos abaixo pertencem aos arquivos originais fornecidos ao projeto. Não são
        links públicos, não indicam que o documento já foi importado ao Core e não autorizam
        alterar sua vigência.
      </p>
      <div className="grid gap-2 lg:grid-cols-2">
        {visibleOriginals.map(item=><details key={item.id} className="rounded-md border p-3 space-y-2">
          <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {item.title} <span className="font-normal text-xs text-muted-foreground">· {item.version}</span>
          </summary>
          <dl className="mt-3 space-y-2 text-xs break-words">
            <div><dt className="font-semibold">Estado na fonte</dt><dd>{item.sourceStatus}</dd></div>
            <div><dt className="font-semibold">Âmbito documental</dt><dd>{item.authorityScope}</dd></div>
            <div><dt className="font-semibold">Origem (arquivo ZIP)</dt><dd>{item.archive}</dd></div>
            <div><dt className="font-semibold">Caminho original</dt><dd className="font-mono break-all">{item.originalFile}</dd></div>
            <div><dt className="font-semibold">Verificação antes de usar</dt><dd>{item.reconciliation}</dd></div>
          </dl>
        </details>)}
      </div>
    </section>}
    {mode==="conhecimento"&&controls.length>0&&
      <p className="text-xs text-muted-foreground">
        {controls.length} controle(s) com observações técnicas disponíveis na seção Funcionalidades.
        Essas observações não são instruções normativas nem revisões FM.
      </p>}
    {visibleScreens.length===0&&visibleControls.length===0&&visibleSources.length===0&&visibleOriginals.length===0&&
      <p role="status" className="text-sm text-muted-foreground">
        {query?"Nenhum item corresponde à busca.":"Não há fonte funcional reconciliada neste catálogo. Cobertura não verificada."}
      </p>}
  </section>;
}
