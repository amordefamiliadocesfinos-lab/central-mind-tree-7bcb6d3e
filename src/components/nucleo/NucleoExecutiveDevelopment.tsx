import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NucleoTechnicalEvidence from "@/components/nucleo/NucleoTechnicalEvidence";
import { summarizeDevelopmentCheckpoint } from "@/lib/nucleo/developmentCheckpointV12";
import type { DevelopmentDependency, DevelopmentEvent, DevelopmentWorkstream } from "@/lib/nucleo/development.types";

type Scope="todos"|"bloqueadas"|"prioritarias"|"sem_acao"|"sem_prova";
type Props={
  workstreams:DevelopmentWorkstream[];
  dependencies:DevelopmentDependency[];
  events:DevelopmentEvent[];
  onOpenWorkstream:(id:string)=>void;
  moduleId?:string;
};
const priorityOrder: Record<DevelopmentWorkstream["priority"],number>={critica:0,alta:1,normal:2,baixa:3};
const statusOrder: Record<DevelopmentWorkstream["status"],number>={bloqueado:0,em_andamento:1,em_validacao:2,planejado:3,concluido:4};
const text=(value:string|undefined|null)=>value?.trim()||"Não informado";
const when=(value:string)=>{const d=new Date(value);return Number.isFinite(d.valueOf())?d.toLocaleString("pt-BR"):"Data indisponível";};

/**
 * M3/M4/M5, consulta apenas. "Último evento" refere-se ao recorte global
 * de 200 eventos lido pela Central e não representa auditoria exaustiva.
 */
export default function NucleoExecutiveDevelopment({workstreams,dependencies,events,onOpenWorkstream,moduleId}:Props){
  const [scope,setScope]=useState<Scope>("todos");
  const [search,setSearch]=useState("");
  const [expanded,setExpanded]=useState<string|null>(null);
  const [checkpointOpen,setCheckpointOpen]=useState<string|null>(null);
  const byId=useMemo(()=>new Map(workstreams.map(item=>[item.id,item])),[workstreams]);
  const entries=useMemo(()=>workstreams.filter(item=>item.kind!=="modulo"&&(
    !moduleId||item.parent_id===moduleId||(
      item.parent_id!==null&&byId.get(item.parent_id)?.parent_id===moduleId
    )
  )),[workstreams,moduleId,byId]);
  const eventsByFront=useMemo(()=>{
    const index=new Map<string,DevelopmentEvent[]>();
    for(const event of events){
      const list=index.get(event.workstream_id)??[];
      list.push(event);
      index.set(event.workstream_id,list);
    }
    for(const list of index.values())list.sort((a,b)=>b.recorded_at.localeCompare(a.recorded_at));
    return index;
  },[events]);
  const latestByFront=useMemo(()=>{
    const m=new Map<string,DevelopmentEvent>();
    for(const event of events){
      const prev=m.get(event.workstream_id);
      if(!prev||event.recorded_at>prev.recorded_at)m.set(event.workstream_id,event);
    }
    return m;
  },[events]);
  const mapped=entries.map(item=>{
    const parent=byId.get(item.parent_id??"");
    const module=item.kind==="frente"?parent:byId.get(parent?.parent_id??"");
    const ownDeps=dependencies.filter(d=>d.workstream_id===item.id);
    const linked=ownDeps.map(d=>({edge:d,target:byId.get(d.depends_on_id)}));
    return {item,module,linked,latest:latestByFront.get(item.id),checkpoints:(eventsByFront.get(item.id)??[]).slice(0,3)};
  });
  const counts={
    blocked:mapped.filter(({item})=>item.status==="bloqueado").length,
    priority:mapped.filter(({item})=>item.status!=="concluido"&&["critica","alta"].includes(item.priority)).length,
    noAction:mapped.filter(({item})=>item.status!=="concluido"&&!item.next_action.trim()).length,
    noProof:mapped.filter(({item})=>item.evidence_state!=="comprovada").length,
    links:mapped.reduce((sum,row)=>sum+row.linked.length,0),
  };
  const visible=mapped.filter(({item,module})=>{
    const term=search.toLocaleLowerCase("pt-BR").trim();
    const matches=!term||[item.code,item.title,item.specialist,item.next_action,item.blocker,module?.code,module?.title]
      .some(v=>v?.toLocaleLowerCase("pt-BR").includes(term));
    if(!matches)return false;
    if(scope==="bloqueadas")return item.status==="bloqueado";
    if(scope==="prioritarias")return item.status!=="concluido"&&["critica","alta"].includes(item.priority);
    if(scope==="sem_acao")return item.status!=="concluido"&&!item.next_action.trim();
    if(scope==="sem_prova")return item.evidence_state!=="comprovada";
    return true;
  }).sort((a,b)=>statusOrder[a.item.status]-statusOrder[b.item.status]
    ||priorityOrder[a.item.priority]-priorityOrder[b.item.priority]
    ||a.item.code.localeCompare(b.item.code,"pt-BR"));
  return <section className="rounded-lg border p-3 md:p-4 space-y-4" aria-label={moduleId?"Visão executiva do módulo":"Visão executiva transversal do desenvolvimento"}>
    <div className="flex flex-wrap justify-between items-start gap-2">
      <div className="space-y-1">
        <h3 className="font-semibold text-base">Frentes que precisam de atenção</h3>
        <p className="text-xs text-muted-foreground">
          Prioridades, bloqueios e responsáveis declarados no M3; dependências e eventos reais carregados nesta sessão.
          Sem pontuação artificial de progresso ou conclusão automática.
        </p>
      </div>
      <Badge variant="outline">Leitura M3 · provas M4 sob demanda</Badge>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2" aria-label="Indicadores executivos de registros carregados">
      {[
        ["Bloqueadas",counts.blocked],
        ["Alta/crítica abertas",counts.priority],
        ["Sem próxima ação",counts.noAction],
        ["Prova não comprovada",counts.noProof],
        ["Dependências cadastradas",counts.links],
      ].map(([name,count])=><div key={name} className="rounded-md bg-muted/30 border p-3">
        <p className="text-xs text-muted-foreground">{name}</p>
        <p className="text-xl font-bold tabular-nums">{count}</p>
      </div>)}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {([
        ["todos","Todas"],["bloqueadas","Bloqueadas"],["prioritarias","Prioridade alta/crítica"],
        ["sem_acao","Sem próxima ação"],["sem_prova","Sem prova comprovada"],
      ] as Array<[Scope,string]>).map(([id,label])=>
        <Button type="button" key={id} size="sm" variant={scope===id?"default":"outline"}
          aria-pressed={scope===id} onClick={()=>setScope(id)}>{label}</Button>)}
      <Input aria-label="Buscar frente, especialista ou próxima ação" placeholder="Buscar frente, responsável ou ação…"
        className="w-full sm:max-w-xs" value={search} onChange={event=>setSearch(event.target.value)}/>
    </div>
    <p className="text-xs text-muted-foreground" role="status">{visible.length} de {mapped.length} frentes/subfrentes neste recorte.</p>
    {visible.length===0&&<p className="text-sm text-muted-foreground border rounded-md p-3">
      Nenhum registro corresponde ao filtro na leitura atual. Isso não comprova inexistência de frentes em outras fontes.
    </p>}
    <div className="space-y-2">
      {visible.map(({item,module,linked,latest,checkpoints})=><article key={item.id} className="rounded-md border p-3 space-y-3">
        <div className="flex flex-wrap justify-between items-start gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="font-semibold text-sm">{item.code} · {item.title}</p>
            <p className="text-xs text-muted-foreground">{module?.title||"Módulo não vinculado no recorte"} · {item.kind==="frente"?"Frente":"Subfrente"}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{item.status.replaceAll("_"," ")}</Badge>
            <Badge variant="outline">Prioridade {item.priority}</Badge>
            <Badge variant="outline">Prova {item.evidence_state.replaceAll("_"," ")}</Badge>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-2 text-xs">
          <p><strong>Responsável declarado:</strong> {text(item.specialist)} (não certifica mandato)</p>
          <p><strong>Próxima ação:</strong> {text(item.next_action)}</p>
          <p><strong>Bloqueio:</strong> {text(item.blocker)}</p>
          <p><strong>Última alteração M3:</strong> {when(item.updated_at)}</p>
          <p><strong>Último evento carregado:</strong> {latest?when(latest.recorded_at)+" · "+latest.event_type:"Não localizado na janela de 200 eventos globais"}</p>
          <p><strong>Dependências cadastradas:</strong> {linked.length?linked.map(({target})=>target?.code||"Alvo não localizado").join(", "):"Nenhuma na leitura (até 500 vínculos globais)"}</p>
        </div>
        {linked.length>0&&<details className="rounded border p-2 text-xs">
          <summary className="font-medium cursor-pointer">Ver dependências e contexto</summary>
          {linked.map(({edge,target})=><div key={edge.id} className="mt-2">
            <p><strong>{target?.code||"Referência sem alvo carregado"}</strong>: {text(edge.description)}</p>
            {target&&<p className="text-muted-foreground">Estado do alvo: {target.status.replaceAll("_"," ")}; próxima ação: {text(target.next_action)}.</p>}
          </div>)}
          <p className="mt-2 text-muted-foreground">Vínculo registrado não implica bloqueio automático nem cronograma validado.</p>
        </details>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={()=>onOpenWorkstream(item.id)}>Abrir ficha M3</Button>
          <Button type="button" size="sm" variant="outline"
            aria-expanded={checkpointOpen===item.id}
            onClick={()=>setCheckpointOpen(prev=>prev===item.id?null:item.id)}>
            {checkpointOpen===item.id?"Ocultar checkpoints":"Ver checkpoints M3"}
          </Button>
          <Button type="button" size="sm" variant="outline" aria-expanded={expanded===item.id}
            onClick={()=>setExpanded(prev=>prev===item.id?null:item.id)}>
            {expanded===item.id?"Ocultar provas M4":"Ver provas M4"}
          </Button>
        </div>
        {checkpointOpen===item.id&&<section className="border-t pt-3 space-y-3" aria-label={"Checkpoints registrados de "+item.code}>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Checkpoints administrativos — M3</p>
            <p className="text-xs text-muted-foreground">
              Eventos de criação e alteração da janela global carregada. Não são decisões
              aprovadas, normas vigentes, provas técnicas ou homologação humana.
            </p>
          </div>
          {checkpoints.length===0&&<p className="text-xs text-muted-foreground">
            Nenhum evento encontrado na janela global de 200 registros. Histórico anterior pode existir.
          </p>}
          {checkpoints.map(event=>{
            const summary=summarizeDevelopmentCheckpoint(event);
            return <div key={event.id} className="rounded-md border p-3 space-y-2 text-xs">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold">{summary.label}</p>
                <span className="text-muted-foreground">{when(event.recorded_at)}</span>
              </div>
              <p className="text-muted-foreground">
                Autoria registrada: {event.actor_auth_uid
                  ? "ID autenticado "+event.actor_auth_uid.slice(0,8)+"…"
                  : "não identificada no evento"}
              </p>
              {summary.changes.length>0?<dl className="grid gap-2">
                {summary.changes.map(change=><div key={change.field} className="rounded bg-muted/30 p-2">
                  <dt className="font-medium">{change.field}</dt>
                  {event.event_type==="alterado"&&<dd className="text-muted-foreground break-words">Antes: {change.before}</dd>}
                  <dd className="break-words">Depois: {change.after}</dd>
                </div>)}
              </dl>:<p className="text-muted-foreground">
                Sem campos comparáveis neste recorte; não interpretar como ausência de alterações.
              </p>}
              <p className="text-muted-foreground">
                Aprovação humana: não comprovada por este evento. Consultar ato formal e evidências separadamente.
              </p>
            </div>;
          })}
        </section>}
        {expanded===item.id&&<div className="border-t pt-3">
          <NucleoTechnicalEvidence workstreamId={item.id}/>
        </div>}
      </article>)}
    </div>
    <p className="text-xs text-muted-foreground">
      Os eventos exibidos vêm da janela global dos últimos 200 e as dependências de até 500 registros.
      Ausência na janela não confirma ausência no banco. Evidência declarada no M3 não é deploy, readback nem aceite humano.
    </p>
  </section>;
}
