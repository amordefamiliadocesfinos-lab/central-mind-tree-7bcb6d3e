import { useState } from "react";
import { selectAttention } from "@/lib/nucleo/workstreamPriority";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DevelopmentWorkstream } from "@/lib/nucleo/development.types";
import type { KnowledgeModule } from "@/lib/nucleo/operationalKnowledgeV12";
import { MODULE_PROVENANCE } from "@/lib/nucleo/operationalProvenanceV12";
import { MODULE_RECONCILIATION_V12 } from "@/lib/nucleo/moduleReconciliationV12";
import { preparedReferences } from "@/lib/nucleo/preparedReferences";

type Filter = "todos" | "precisa_reconciliar" | "somente_catalogo" | "sem_frente" | "com_frente";

/**
 * Cobertura transversal M3 V1.2. Somente vínculos pai–filho do Core
 * e proveniências de leitura versionadas no GitHub. Nunca deduz que
 * ausência de cadastro significa ausência de trabalho no módulo.
 */
export default function NucleoCrossModuleCoverage({
  modules, workstreams, onOpenModule, onPrepareModule, onOpenWorkstream,
}:{
  modules:KnowledgeModule[];
  workstreams:DevelopmentWorkstream[];
  onOpenModule:(module:KnowledgeModule)=>void;
  onPrepareModule:(module:KnowledgeModule)=>void;
  onOpenWorkstream:(id:string)=>void;
}) {
  const [filter,setFilter]=useState<Filter>("todos");
  const [preparation,setPreparation]=useState("");
  async function prepareReferences(code:string,id:string){
    try{
      const references=preparedReferences.filter(p=>p.moduleId===id);
      if(!references.length)throw new Error("Sem referências preparadas.");
      const batch={contract:"nucleo_assisted_reference_review_v1",moduleCode:code,moduleId:id,
        state:"revisao_sem_escrita",references:references.map(p=>({...p,
          action:p.retained?"conciliar_existente":"revisar_no_ac01"}))};
      await navigator.clipboard.writeText(JSON.stringify(batch,null,2));
      setPreparation(`Inventário ${code} copiado: ${references.length} referência(s), incluindo retidas. Nenhum registro foi gravado.`);
    }catch{setPreparation("Não foi possível preparar ou copiar o lote. Nenhum registro foi gravado.");}
  }
  const rows=modules.map(module => {
    const record=workstreams.find(item => item.kind==="modulo" && item.code===module.id);
    const fronts=record ? workstreams.filter(item =>
      item.kind==="frente" && item.parent_id===record.id) : [];
    const frontIds=new Set(fronts.map(item=>item.id));
    const subfronts=workstreams.filter(item =>
      item.kind==="subfrente" && item.parent_id!==null && frontIds.has(item.parent_id));
    const provenance=MODULE_PROVENANCE[module.id];
    const candidates=MODULE_RECONCILIATION_V12[module.id] ?? [];
    // Evidência transversal: destacar uma frente real, nunca substituir
    // sua próxima ação pela declaração genérica do cadastro do módulo.
    const pendingFronts=[...fronts,...subfronts].filter(front=>front.status!=="concluido");
    const attentionFront=selectAttention(pendingFronts);
    return {module,record,fronts,subfronts,provenance,candidates,attentionFront};
  });
  const preparedCount=rows.reduce((total,row)=>total+preparedReferences.filter(p=>p.moduleId===row.record?.id&&!p.retained).length,0);
  const retainedCount=rows.reduce((total,row)=>total+preparedReferences.filter(p=>p.moduleId===row.record?.id&&p.retained).length,0);
  const missing=rows.filter(row=>row.record && row.fronts.length===0).length;
  const notRegistered=rows.filter(row=>!row.record).length;
  const reconcileCount=missing+notRegistered;
  const linked=rows.filter(row=>row.fronts.length>0).length;
  const visible=rows.filter(row=>filter==="todos" ||
    (filter==="precisa_reconciliar" && (!row.record || row.fronts.length===0)) ||
    (filter==="somente_catalogo" && !row.record) ||
    (filter==="sem_frente" && row.record && row.fronts.length===0) ||
    (filter==="com_frente" && row.fronts.length>0));
  return (
    <section className="space-y-3" aria-label="Matriz transversal de cobertura M3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">{rows.filter(row=>row.record).length} módulo(s) no Core</Badge>
        <Badge variant="secondary">{linked} com frente vinculada</Badge>
        <Badge variant="outline">{missing} sem frente vinculada</Badge>
        <Badge variant="outline">{notRegistered} somente no catálogo</Badge>
      </div>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">Sobre a cobertura e referências preparadas</summary>
        <div className="mt-2 space-y-2">
      <div className="rounded-lg border p-3 space-y-1" aria-label="Inventário documental preparado AC-01">
        <h4 className="text-sm font-semibold">Alimentação documental preparada</h4>
        <p className="text-xs">{preparedCount} referência(s) candidata(s) · {retainedCount} retida(s) para conciliação</p>
        <p className="text-xs text-muted-foreground">Inventário estático por UUID do módulo. Não mede registros persistidos, vigência ou homologação. Consulte Documentos AC-01 para conferir o Core e carregar minutas.</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Fila de reconciliação: {reconcileCount} módulo(s) exigem conferência de cadastro ou vínculo.
        Nenhuma ficha é criada ou homologada automaticamente. A preparação abre somente um formulário.
      </p>
      <p className="text-xs text-muted-foreground">
        Matriz baseada nas relações M3 carregadas nesta sessão. Uma frente sem vínculo
        não significa trabalho inexistente. Referências de código e método não são
        evidências M4, mandato formal, deploy ou homologação.
      </p>
        </div>
      </details>
      <div className="flex flex-wrap gap-2" aria-label="Filtrar cobertura">
        <Button type="button" size="sm" variant={filter==="todos"?"default":"outline"}
          aria-pressed={filter==="todos"} onClick={()=>setFilter("todos")}>Todos</Button>
        <Button type="button" size="sm" variant={filter==="precisa_reconciliar"?"default":"outline"}
          aria-pressed={filter==="precisa_reconciliar"} onClick={()=>setFilter("precisa_reconciliar")}>Precisa reconciliar ({reconcileCount})</Button>
        <Button type="button" size="sm" variant={filter==="somente_catalogo"?"default":"outline"}
          aria-pressed={filter==="somente_catalogo"} onClick={()=>setFilter("somente_catalogo")}>Sem cadastro M3 ({notRegistered})</Button>
        <Button type="button" size="sm" variant={filter==="sem_frente"?"default":"outline"}
          aria-pressed={filter==="sem_frente"} onClick={()=>setFilter("sem_frente")}>Sem frente vinculada</Button>
        <Button type="button" size="sm" variant={filter==="com_frente"?"default":"outline"}
          aria-pressed={filter==="com_frente"} onClick={()=>setFilter("com_frente")}>Com frente vinculada</Button>
      </div>
      {preparation&&<p role="status" className="text-xs">{preparation}</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map(({module,record,fronts,subfronts,provenance,candidates,attentionFront})=>(
          <article key={module.id} className="rounded-lg border p-4 space-y-2 min-w-0">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">{module.id}</span>
              <Badge variant={fronts.length>0?"secondary":"outline"}>
                {record ? fronts.length>0?"Com frente vinculada":"Cadastro sem frente":"Somente no catálogo"}
              </Badge>
            </div>
            <h4 className="text-sm font-semibold">{module.name}</h4>
            <p className="text-sm">Estado registrado: {record?.status.replaceAll("_"," ") ?? "não cadastrado"}</p>
            <p className="text-sm text-muted-foreground">{fronts.length} frente(s) · {subfronts.length} subfrente(s){attentionFront? " · Em atenção: "+attentionFront.code:""}</p>
            <Button type="button" size="sm" className="min-h-11" onClick={()=>onOpenModule(module)}>
              Abrir módulo e fontes
            </Button>
            <details className="rounded-lg border p-2">
              <summary className="cursor-pointer text-sm font-medium">Ver frentes, próxima ação e fontes</summary>
              <div className="mt-2 space-y-2">
            <p className="text-xs leading-relaxed"><span className="font-medium">Especialista:</span> {record?.specialist.trim()||module.specialist||"não identificado no cadastro"}</p>
            <p className="text-xs text-muted-foreground">
              Estado do módulo: {record?.status.replaceAll("_"," ") ?? "não cadastrado"} — declarativo
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{fronts.length} frente(s)</Badge>
              <Badge variant="outline">{subfronts.length} subfrente(s)</Badge>
              <Badge variant="outline">{provenance?.sources.length ?? 0} fonte(s) catalogada(s)</Badge>
            </div>
            {record&&(()=>{
              const prepared=preparedReferences.filter(p=>p.moduleId===record.id);
              return prepared.length>0?<details className="rounded-md border p-2 space-y-2">
                <summary className="cursor-pointer text-xs font-medium">{prepared.filter(p=>!p.retained).length} candidata(s) AC-01 · {prepared.filter(p=>p.retained).length} retida(s)</summary>
                <p className="text-xs text-muted-foreground">Fontes preparadas, não confirmação de persistência. Abra o módulo e Documentos AC-01 para registrar pelo escritor oficial.</p>
                {prepared.map(p=><div key={p.requestId} className="border-t pt-2 text-xs break-words">
                  <p className="font-medium">{p.title}</p>
                  <p>{p.retained?"Retida para conciliação":"Candidata à curadoria"} — {p.note}</p>
                  <a href={p.locator} target="_blank" rel="noopener noreferrer" className="underline">Conferir original</a>
                </div>)}
              </details>:null;
            })()}
            {fronts.length>0 ? (
              <p className="text-xs text-muted-foreground break-words">
                Vínculos: {fronts.map(front=>front.code).join(", ")}
                {subfronts.length>0 ? ` · subfrentes: ${subfronts.map(front=>front.code).join(", ")}` : ""}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhuma frente ligada a este módulo na consulta M3. Não criar uma frente por inferência.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Método: {provenance?"fontes indicadas; conferir autoridade na ficha":"proveniência ainda não catalogada"}
            </p>
            {fronts.length===0 && candidates.length>0 && (
              <details className="rounded-md border p-2 space-y-2">
                <summary className="text-xs font-medium cursor-pointer">
                  {candidates.length} superfície(s) documentada(s) para reconciliação — não cadastradas como frentes
                </summary>
                <div className="mt-2 space-y-3">
                  {candidates.map(item=>(
                    <div key={item.reference+item.label} className="space-y-1 border-t pt-2">
                      <p className="text-xs font-semibold">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.observed}</p>
                      <p className="text-xs">Pendência: {item.nextGate}</p>
                      <a href={item.reference} target="_blank" rel="noopener noreferrer"
                        className="text-xs underline underline-offset-2">Conferir fonte no GitHub</a>
                      <p className="text-xs text-muted-foreground">
                        {item.evidenceKind==="codigo_presente"?"Código presente — sem aceite de uso real":"Declaração do mapa — sem aceite automático"}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            )}
            <div className="rounded-md border bg-muted/20 p-3 space-y-1.5" aria-label={`Atenção do módulo ${module.id}`}>
              {attentionFront ? (
                <>
                  <p className="text-xs font-medium leading-relaxed">{attentionFront.kind==="subfrente"?"Subfrente":"Frente"} em atenção: {attentionFront.code} · {attentionFront.title}</p>
                  <p className="text-xs text-muted-foreground">Situação declarada: {attentionFront.status.replaceAll("_"," ")}</p>
                  {attentionFront.blocker.trim() && <p className="text-xs break-words"><span className="font-medium">Bloqueio:</span> {attentionFront.blocker}</p>}
                  <p className="text-xs break-words"><span className="font-medium">Próxima ação {attentionFront.kind==="subfrente"?"da subfrente":"da frente"}:</span> {attentionFront.next_action.trim()||"não informada no Core"}</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">{fronts.length===0
                    ?"Sem frente M3 vinculada — situação da operação não verificada"
                    :"Sem frente pendente declarada neste recorte M3 — não equivale a homologação"}</p>
                  <p className="text-xs break-words"><span className="font-medium">Próxima ação do módulo:</span> {record?.next_action.trim()||"não informada no Core"}</p>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {attentionFront && <Button type="button" variant="outline" size="sm"
                onClick={()=>onOpenWorkstream(attentionFront.id)}>
                {attentionFront.kind==="subfrente" ? <>Abrir ficha da subfrente {attentionFront.code}</> : <>Abrir ficha da frente {attentionFront.code}</>}
              </Button>}
              {!record && <Button type="button" size="sm" onClick={()=>onPrepareModule(module)}>
                Preparar cadastro M3
              </Button>}
              {record&&preparedReferences.some(source=>source.moduleId===record.id)&&
                <Button type="button" size="sm" variant="outline"
                  onClick={()=>void prepareReferences(module.id,record.id)}>
                  Preparar referências AC-01
                </Button>}
            </div>
              </div>
            </details>
          </article>
        ))}
      </div>
      {visible.length===0 && <p className="text-sm text-muted-foreground">
        Nenhum módulo corresponde aos filtros atuais. Isso não representa ausência de módulos no sistema.
      </p>}
    </section>
  );
}
