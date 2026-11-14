import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ExternalLink, Search, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MODULE_RECONCILIATION_V12 } from "@/lib/nucleo/moduleReconciliationV12";
import { MODULE_CONTROLS_V12 } from "@/lib/nucleo/moduleControlDiscoveriesV12";
import type { KnowledgeModule } from "@/lib/nucleo/operationalKnowledgeV12";

type Props={module:KnowledgeModule;mode:"funcoes"|"conhecimento";isRegistered:boolean};

/**
 * Reaproveita fontes de reconciliação já versionadas no Núcleo. Não cria
 * cadastro, não realiza ações de negócio e não eleva referências a manuais.
 */
export default function NucleoModuleDiscovery({module,mode,isRegistered}:Props){
  const [search,setSearch]=useState("");
  const controls=MODULE_CONTROLS_V12[module.id]??[];
  const sources=MODULE_RECONCILIATION_V12[module.id]??[];
  const query=search.trim().toLocaleLowerCase("pt-BR");
  const visibleControls=useMemo(()=>controls.filter(item=>!query||
    [item.label,item.screen,item.prerequisite,item.observed,item.limitation]
      .some(value=>value.toLocaleLowerCase("pt-BR").includes(query))),[controls,query]);
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
    {(controls.length>0||sources.length>0)&&<label className="relative block max-w-lg">
      <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" aria-hidden="true"/>
      <Input aria-label="Buscar funcionalidade ou referência do módulo" className="pl-9"
        placeholder="Buscar botão, fluxo ou fonte…" value={search} onChange={e=>setSearch(e.target.value)}/>
    </label>}
    {mode==="funcoes"&&<>
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
    {mode==="conhecimento"&&controls.length>0&&
      <p className="text-xs text-muted-foreground">
        {controls.length} controle(s) com observações técnicas disponíveis na seção Funcionalidades.
        Essas observações não são instruções normativas nem revisões FM.
      </p>}
    {visibleControls.length===0&&visibleSources.length===0&&
      <p role="status" className="text-sm text-muted-foreground">
        {query?"Nenhum item corresponde à busca.":"Não há fonte funcional reconciliada neste catálogo. Cobertura não verificada."}
      </p>}
  </section>;
}
