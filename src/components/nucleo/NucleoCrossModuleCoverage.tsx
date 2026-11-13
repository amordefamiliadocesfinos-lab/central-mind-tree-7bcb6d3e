import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DevelopmentWorkstream } from "@/lib/nucleo/development.types";
import type { KnowledgeModule } from "@/lib/nucleo/operationalKnowledgeV12";
import { MODULE_PROVENANCE } from "@/lib/nucleo/operationalProvenanceV12";
import { MODULE_RECONCILIATION_V12 } from "@/lib/nucleo/moduleReconciliationV12";

type Filter = "todos" | "sem_frente" | "com_frente";

/**
 * Cobertura transversal M3 V1.2. Somente vínculos pai–filho do Core
 * e proveniências de leitura versionadas no GitHub. Nunca deduz que
 * ausência de cadastro significa ausência de trabalho no módulo.
 */
export default function NucleoCrossModuleCoverage({
  modules, workstreams, onOpenModule,
}:{
  modules:KnowledgeModule[];
  workstreams:DevelopmentWorkstream[];
  onOpenModule:(module:KnowledgeModule)=>void;
}) {
  const [filter,setFilter]=useState<Filter>("todos");
  const rows=modules.map(module => {
    const record=workstreams.find(item => item.kind==="modulo" && item.code===module.id);
    const fronts=record ? workstreams.filter(item =>
      item.kind==="frente" && item.parent_id===record.id) : [];
    const frontIds=new Set(fronts.map(item=>item.id));
    const subfronts=workstreams.filter(item =>
      item.kind==="subfrente" && item.parent_id!==null && frontIds.has(item.parent_id));
    const provenance=MODULE_PROVENANCE[module.id];
    const candidates=MODULE_RECONCILIATION_V12[module.id] ?? [];
    return {module,record,fronts,subfronts,provenance,candidates};
  });
  const missing=rows.filter(row=>row.record && row.fronts.length===0).length;
  const linked=rows.filter(row=>row.fronts.length>0).length;
  const visible=rows.filter(row=>filter==="todos" ||
    (filter==="sem_frente" && row.record && row.fronts.length===0) ||
    (filter==="com_frente" && row.fronts.length>0));
  return (
    <section className="space-y-3" aria-label="Matriz transversal de cobertura M3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">{rows.filter(row=>row.record).length} módulo(s) no Core</Badge>
        <Badge variant="secondary">{linked} com frente vinculada</Badge>
        <Badge variant="outline">{missing} sem frente vinculada</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Matriz baseada nas relações M3 carregadas nesta sessão. Uma frente sem vínculo
        não significa trabalho inexistente. Referências de código e método não são
        evidências M4, mandato formal, deploy ou homologação.
      </p>
      <div className="flex flex-wrap gap-2" aria-label="Filtrar cobertura">
        <Button type="button" size="sm" variant={filter==="todos"?"default":"outline"}
          aria-pressed={filter==="todos"} onClick={()=>setFilter("todos")}>Todos</Button>
        <Button type="button" size="sm" variant={filter==="sem_frente"?"default":"outline"}
          aria-pressed={filter==="sem_frente"} onClick={()=>setFilter("sem_frente")}>Sem frente vinculada</Button>
        <Button type="button" size="sm" variant={filter==="com_frente"?"default":"outline"}
          aria-pressed={filter==="com_frente"} onClick={()=>setFilter("com_frente")}>Com frente vinculada</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map(({module,record,fronts,subfronts,provenance,candidates})=>(
          <article key={module.id} className="rounded-lg border p-4 space-y-2 min-w-0">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">{module.id}</span>
              <Badge variant={fronts.length>0?"secondary":"outline"}>
                {record ? fronts.length>0?"Vínculo M3 existente":"Vínculo M3 pendente":"Cadastro M3 não encontrado"}
              </Badge>
            </div>
            <h4 className="text-sm font-semibold">{module.name}</h4>
            <p className="text-xs text-muted-foreground">
              Estado do módulo: {record?.status.replaceAll("_"," ") ?? "não cadastrado"} — declarativo
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{fronts.length} frente(s)</Badge>
              <Badge variant="outline">{subfronts.length} subfrente(s)</Badge>
              <Badge variant="outline">{provenance?.sources.length ?? 0} fonte(s) catalogada(s)</Badge>
            </div>
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
            <p className="text-xs line-clamp-3" title={record?.next_action||undefined}>
              Próxima ação declarada: {record?.next_action.trim() || "não informada"}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={()=>onOpenModule(module)}>
              Abrir módulo, frentes e fontes
            </Button>
          </article>
        ))}
      </div>
      {visible.length===0 && <p className="text-sm text-muted-foreground">
        Nenhum módulo corresponde aos filtros atuais. Isso não representa ausência de módulos no sistema.
      </p>}
    </section>
  );
}
