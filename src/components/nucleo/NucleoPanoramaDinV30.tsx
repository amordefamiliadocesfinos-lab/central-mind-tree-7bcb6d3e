import { humanWorkName } from "@/lib/nucleo/humanLanguageV1";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { DevelopmentStatus, DevelopmentWorkstream } from "@/lib/nucleo/development.types";
import { factualFraction, operationalMetrics } from "@/lib/nucleo/progressMetricsV30";
import type { FactualFraction } from "@/lib/nucleo/progressMetricsV30";

type Props = {
  workstreams: DevelopmentWorkstream[];
  onFocusModule: (moduleId: string) => void;
  onFocusStatus: (status: DevelopmentStatus) => void;
};

const statusDisplay: Array<{key: DevelopmentStatus; label: string; color: string}> = [
  { key: "planejado", label: "Planejadas", color: "#94a3b8" },
  { key: "em_andamento", label: "Em andamento", color: "#1a73e8" },
  { key: "bloqueado", label: "Bloqueadas", color: "#ea4335" },
  { key: "em_validacao", label: "Em validação", color: "#fbbc04" },
  { key: "concluido", label: "Concluídas declaradas", color: "#34a853" },
];

function NucleoFractionBar({title,measure,color}:{
  title:string;measure:FactualFraction;color:string;
}) {
  const percent=measure.percent;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-xs font-medium text-[#3c4043] dark:text-slate-200">{title}</p>
        <span className="text-xs font-semibold tabular-nums">
          {measure.numerator}/{measure.denominator}
          {" · "}{percent===null?"não mensurável":percent+"%"}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#e8eef6] dark:bg-slate-700"
        role="img" aria-label={title+": "+measure.numerator+" de "+measure.denominator+
          (percent===null?" (percentual indisponível)":" ("+percent+"%)")}>
        {percent!==null&&<span className="block h-full rounded-full" style={{width:percent+"%",backgroundColor:color}} />}
      </div>
    </div>
  );
}

// A classificação de módulo usa apenas a relação pai-filho já existente no Core M3.
export function moduleIdForWorkstream(
  item: DevelopmentWorkstream,
  byId: Map<string, DevelopmentWorkstream>,
): string | null {
  if (item.kind === "modulo") return item.id;
  const parent = item.parent_id ? byId.get(item.parent_id) : undefined;
  if (!parent) return null;
  if (parent.kind === "modulo") return parent.id;
  if (parent.kind === "frente" && parent.parent_id) {
    const grandparent = byId.get(parent.parent_id);
    return grandparent?.kind === "modulo" ? grandparent.id : null;
  }
  return null;
}

export function NucleoStatusDistribution({
  records,
  label,
  onFocusStatus,
}: {
  records: DevelopmentWorkstream[];
  label: string;
  onFocusStatus: (status: DevelopmentStatus) => void;
}) {
  const total = records.length;
  return (
    <div className="space-y-2" aria-label={label}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{label}</p>
        <span className="text-xs tabular-nums text-muted-foreground">{total} frente(s)/subfrente(s)</span>
      </div>
      {total === 0 ? (
        <p role="status" className="rounded-lg bg-slate-50 p-3 text-xs text-muted-foreground dark:bg-slate-800">
          Nenhuma frente no recorte. Não há percentual calculável.
        </p>
      ) : (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#e8eef6]"
            role="img" aria-label={"Distribuição factual por situação entre " + total + " registros, detalhada na legenda."}>
            {statusDisplay.map(state => {
              const n = records.filter(record => record.status === state.key).length;
              return n > 0 ? (
                <span key={state.key} style={{width:(n / total * 100) + "%",backgroundColor:state.color}}
                  aria-hidden="true" />
              ) : null;
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {statusDisplay.map(state => {
              const n = records.filter(record => record.status === state.key).length;
              return <button type="button" key={state.key} onClick={()=>onFocusStatus(state.key)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-xs text-[#3c4043] transition-colors hover:bg-[#e8f0fe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8] dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label={"Mostrar somente frentes: " + state.label}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor:state.color}} aria-hidden="true"/>
                {state.label}: <strong className="tabular-nums">{n}/{total} ({factualFraction(n,total).percent}%)</strong>
              </button>;
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function NucleoPanoramaDinV30({workstreams,onFocusModule,onFocusStatus}:Props) {
  const [showModules,setShowModules]=useState(false);
  const [showCoverage,setShowCoverage]=useState(false);
  const byId=new Map(workstreams.map(item => [item.id,item]));
  const fronts=workstreams.filter(item => item.kind !== "modulo" && item.code !== "NUC");
  const coverage=operationalMetrics(workstreams);
  const modules=workstreams.filter(item => item.kind === "modulo" && item.code !== "NUC");
  const groups=modules.map(module => {
    const records=fronts.filter(item => moduleIdForWorkstream(item,byId) === module.id);
    return {module,records,blocked:records.filter(item=>item.status==="bloqueado").length};
  }).filter(group => group.records.length > 0)
    .sort((a,b) => b.blocked-a.blocked || b.records.length-a.records.length || a.module.code.localeCompare(b.module.code,"pt-BR"));

  return (
    <section aria-label="Panorama dinâmico de frentes M3" className="rounded-2xl border border-[#dce5f1] bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-4">
      <NucleoStatusDistribution records={fronts} label="Distribuição das frentes por situação" onFocusStatus={onFocusStatus}/>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#e5ecf5] pt-3 dark:border-slate-700">
        <div>
          <p className="text-sm font-semibold">Cobertura dos registros M3</p>
          <p className="text-xs text-muted-foreground">Barras do cadastro declarado, não de maturidade ou da prova M4.</p>
        </div>
        <Button type="button" size="sm" variant="outline" className="min-h-10 rounded-full"
          aria-controls="nucleo-din-coverage" aria-expanded={showCoverage}
          onClick={()=>setShowCoverage(value=>!value)}>
          {showCoverage?"Recolher cobertura":"Ver barras de cobertura"}
        </Button>
      </div>
      <div id="nucleo-din-coverage" hidden={!showCoverage}
        className={showCoverage?"mt-3 grid gap-3 rounded-xl bg-[#f5f9ff] p-3 dark:bg-slate-800":"hidden"}>
        <NucleoFractionBar title="Com próxima ação registrada" measure={coverage.nextAction} color="#1a73e8"/>
        <NucleoFractionBar title="Frentes concluídas declaradas" measure={coverage.completedDeclared} color="#34a853"/>
        <NucleoFractionBar title="Evidência declarada como comprovada no M3" measure={coverage.evidenceDeclaredM3} color="#fbbc04"/>
        <p className="text-xs text-muted-foreground">
          Fonte: registros M3 carregados; denominador: frentes e subfrentes elegíveis.
          Não representa evidência técnica M4 examinada, qualidade da ação, homologação ou avanço total do módulo.
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#e5ecf5] pt-3 dark:border-slate-700">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Panorama por módulo</p>
          <p className="text-xs text-muted-foreground">Somente frentes e subfrentes M3 vinculadas a módulos cadastrados.</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="min-h-10 rounded-full"
          aria-controls="nucleo-din-modules" aria-expanded={showModules}
          onClick={()=>setShowModules(value=>!value)}>
          {showModules?"Recolher módulos":"Ver distribuição por módulo"}
        </Button>
      </div>
      <div id="nucleo-din-modules" hidden={!showModules} className={showModules?"mt-3 space-y-2":"hidden"}>
        {groups.length===0 ? <p className="p-3 text-sm text-muted-foreground">Sem frentes vinculadas a módulos neste recorte.</p> :
        groups.map(group=>(
          <button key={group.module.id} type="button"
            className="w-full rounded-xl border border-[#dce5f1] bg-[#f7faff] p-3 text-left transition-colors hover:border-[#8ab4f8] hover:bg-[#e8f0fe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8] dark:border-slate-700 dark:bg-slate-800"
            onClick={()=>onFocusModule(group.module.id)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">{humanWorkName(group.module.code,group.module.title)}</span>
              <span className="text-xs text-muted-foreground">{group.records.length} frentes/subfrentes · {group.blocked} bloqueada(s)</span>
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#e5eaf1]" aria-hidden="true">
              {statusDisplay.map(state=>{
                const n=group.records.filter(row=>row.status===state.key).length;
                return n>0?<span key={state.key} style={{width:(n/group.records.length*100)+"%",backgroundColor:state.color}}/>:null;
              })}
            </div>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#3c4043] dark:text-slate-300">
              {statusDisplay.filter(state=>group.records.some(row=>row.status===state.key)).map(state=>{
                const n=group.records.filter(row=>row.status===state.key).length;
                return <span key={state.key}>{state.label}: {n}/{group.records.length} ({factualFraction(n,group.records.length).percent}%)</span>;
              })}
            </p>
            <p className="mt-1 text-xs text-[#174ea6] dark:text-blue-300">Abrir foco do módulo</p>
          </button>
        ))}
      </div>
      <div className="sr-only">Os indicadores de situação usam dados M3 declarados, não comprovam avanço integral do módulo ou evidência técnica M4.</div>
    </section>
  );
}
