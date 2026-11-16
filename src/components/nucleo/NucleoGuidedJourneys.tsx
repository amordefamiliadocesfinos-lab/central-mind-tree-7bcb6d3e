import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MODULE_JOURNEYS_V12 } from "@/lib/nucleo/moduleJourneysV12";
import { MODULE_SCREENS_V12 } from "@/lib/nucleo/moduleScreenDiscoveriesV12";
import { MODULE_CONTROLS_V12 } from "@/lib/nucleo/moduleControlDiscoveriesV12";
import type { KnowledgeModule } from "@/lib/nucleo/operationalKnowledgeV12";

/** Navegador de conhecimento local. Nenhum checkbox de conclusão, writer ou telemetria. */
export type GuidedJourneyRequest={journeyId:string;controlLabel:string;requestId:number};
export default function NucleoGuidedJourneys({module,request}: {
 module:KnowledgeModule;request?:GuidedJourneyRequest|null;
}){
  const journeys=MODULE_JOURNEYS_V12[module.id]??[];
  const [activeJourney,setActiveJourney]=useState<string|null>(null);
  const [activeIndex,setActiveIndex]=useState(0);
  useEffect(()=>{setActiveJourney(null);setActiveIndex(0);},[module.id]);
  useEffect(()=>{
    if(!request)return;
    const found=journeys.find(item=>item.id===request.journeyId);
    const index=found?.steps.findIndex(step=>step.controlLabel===request.controlLabel)??-1;
    if(index<0)return;
    setActiveJourney(found!.id);
    setActiveIndex(index);
  },[request,module.id]);

  if(journeys.length===0)return null;
  const selected=journeys.find(item=>item.id===activeJourney)??null;
  const step=selected?.steps[activeIndex];
  const screen=step?MODULE_SCREENS_V12[module.id]?.find(item=>item.id===step.screenId):null;
  const control=step?.controlLabel?MODULE_CONTROLS_V12[module.id]?.find(item=>item.label===step.controlLabel):null;
  return <section id={module.id==="CRM"?"nucleo-crm-procedures":"nucleo-module-"+module.id.toLowerCase()+"-procedures"}
    className="scroll-mt-28 rounded-lg border p-3 md:p-4 space-y-4"
    tabIndex={-1}
    aria-label={"Jornadas orientadas por tarefa de "+module.name}>
    <div className="flex flex-wrap justify-between items-start gap-2">
      <div className="space-y-1">
        <h4 className="font-semibold">Escolha uma tarefa para entender o caminho</h4>
        <p className="text-xs text-muted-foreground">
          Roteiros de inspeção fundamentados no código. Este navegador não realiza operações,
          não salva progresso e não comprova que uma tarefa foi concluída.
        </p>
      </div>
      <Badge variant="outline">Orientação técnica · UAT pendente</Badge>
    </div>
    <div className="grid gap-2 sm:grid-cols-2" aria-label="Selecionar tarefa">
      {journeys.map(item=><button key={item.id} type="button"
        className={`rounded-md border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected?.id===item.id?"border-primary bg-muted/40":"hover:bg-muted/30"}`}
        aria-pressed={selected?.id===item.id}
        onClick={()=>{setActiveJourney(item.id);setActiveIndex(0);}}>
        <p className="font-semibold text-sm">{item.title}</p>
        <p className="text-xs text-muted-foreground mt-1">{item.goal}</p>
        <p className="text-xs text-muted-foreground mt-2">{item.steps.length} etapas · {item.kind==="consulta"?"consulta":"preparação sem gravação"}</p>
      </button>)}
    </div>
    {selected&&step&&screen&&<div className="rounded-lg border p-3 md:p-4 space-y-4" role="region"
      aria-label={"Etapas da tarefa "+selected.title}>
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Etapa {activeIndex+1} de {selected.steps.length} · {screen.area}</p>
          <h5 className="text-base font-semibold">{step.task}</h5>
        </div>
        <Badge variant="outline">{screen.name}</Badge>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden" role="progressbar"
        aria-label="Posição de leitura na jornada"
        aria-valuemin={1} aria-valuemax={selected.steps.length} aria-valuenow={activeIndex+1}
        aria-valuetext={"Etapa "+(activeIndex+1)+" de "+selected.steps.length+"; somente leitura, não comprova execução"}>
        <div className="h-full bg-primary transition-all"
          style={{width:`${((activeIndex+1)/selected.steps.length)*100}%`}}/>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md bg-muted/30 p-3 space-y-2">
          <p className="text-sm font-semibold">Onde olhar e o que fazer na inspeção</p>
          <p className="text-sm">{step.inspect}</p>
          {control&&<p className="text-xs text-muted-foreground">
            Controle relacionado: <strong>{control.label}</strong> — {control.observed}
          </p>}
        </div>
        <div className="rounded-md border p-3 space-y-2">
          <p className="text-sm font-semibold">O que deve ser conferido</p>
          <p className="text-sm">{step.verify}</p>
          <p className="text-xs text-muted-foreground">{step.limit}</p>
          {control&&<p className="text-xs text-muted-foreground">
            Pré-condição: {control.prerequisite}
          </p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {screen.route?
          <Button type="button" size="sm" variant="outline" asChild>
            <Link to={screen.route} target="_blank" rel="noopener noreferrer">Abrir tela em nova guia</Link>
          </Button>
          :module.route?<Button type="button" size="sm" variant="outline" asChild>
            <Link to={module.route} target="_blank" rel="noopener noreferrer">Abrir módulo em nova guia para localizar tela</Link>
          </Button>:null}
        <a href={control?.source??screen.source} target="_blank" rel="noopener noreferrer"
          className="text-xs underline inline-flex items-center gap-1">
          Ver fonte no GitHub <ExternalLink className="h-3 w-3" aria-hidden="true"/>
        </a>
        <span className="text-xs text-muted-foreground">Acessar uma tela não confirma operação.</span>
      </div>
      <nav aria-label="Ir diretamente a uma etapa de consulta" className="flex flex-wrap gap-2 border-t pt-3">
        {selected.steps.map((journeyStep,index)=>(
          <Button key={index} type="button" size="sm" variant={index===activeIndex?"default":"outline"}
            className="min-h-10 rounded-full" aria-pressed={index===activeIndex}
            aria-label={"Consultar etapa "+(index+1)+": "+journeyStep.task}
            onClick={()=>setActiveIndex(index)}>
            {index+1}
          </Button>
        ))}
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <Button type="button" size="sm" variant="outline" disabled={activeIndex===0}
          onClick={()=>setActiveIndex(i=>Math.max(0,i-1))}>
          <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true"/> Etapa anterior
        </Button>
        <span className="text-xs text-muted-foreground" role="status">
          {activeIndex+1}/{selected.steps.length} · somente navegação, sem confirmação de execução
        </span>
        <Button type="button" size="sm" variant="outline"
          disabled={activeIndex===selected.steps.length-1}
          onClick={()=>setActiveIndex(i=>Math.min(selected.steps.length-1,i+1))}>
          Próxima etapa <ArrowRight className="h-4 w-4 ml-1" aria-hidden="true"/>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground flex gap-2 items-start">
        <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true"/>
        Esta jornada não substitui a documentação vigente do especialista, um procedimento homologado,
        nem o teste de operador independente exigido no CA-15.
      </p>
    </div>}
  </section>;
}
