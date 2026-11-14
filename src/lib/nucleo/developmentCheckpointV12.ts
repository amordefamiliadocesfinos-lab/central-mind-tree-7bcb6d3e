import type { DevelopmentEvent } from "./development.types";

/**
 * Núcleo V1.2 — classifica apenas alterações armazenadas em M3.
 * Um evento de auditoria NÃO é decisão homologada nem prova técnica M4.
 * Campos exibidos são exclusivamente os do escopo de desenvolvimento.
 */
const keys = [
  ["title","Título"],["description","Descrição"],["status","Situação"],
  ["priority","Prioridade"],["specialist","Responsável declarado"],
  ["next_action","Próxima ação"],["blocker","Bloqueio"],
  ["acceptance_criteria","Critério de aceite declarado"],
  ["evidence_state","Estado de evidência declarado"],
  ["evidence_note","Nota de evidência declarada"],
] as const;
type Snapshot=Record<string,unknown>|null;
function printed(value:unknown):string {
  if(typeof value!=="string") return value===null?"Não informado": "Não disponível no snapshot";
  const cleaned=value.trim();
  return cleaned?cleaned.slice(0,400):"Não informado";
}
export type ChangeSummary={field:string;before:string;after:string};
export function summarizeDevelopmentCheckpoint(event:Pick<DevelopmentEvent,"event_type"|"before_state"|"after_state">):{
  label:string;changes:ChangeSummary[];hasComparableBefore:boolean;
}{
  const before:Snapshot=event.before_state;
  const after:Snapshot=event.after_state;
  const hasComparableBefore=before!==null && typeof before==="object";
  const changes:ChangeSummary[]=[];
  for(const [key,label] of keys){
    if(!after||!Object.prototype.hasOwnProperty.call(after,key))continue;
    if(event.event_type==="alterado"&&!hasComparableBefore)continue;
    if(event.event_type==="alterado"&&!Object.prototype.hasOwnProperty.call(before,key))continue;
    const next=after[key];
    const previous=hasComparableBefore?before[key]:null;
    if(event.event_type==="alterado"&&previous===next)continue;
    changes.push({field:label,before:event.event_type==="criado"?"Não se aplica":printed(previous),after:printed(next)});
  }
  return {
    label:event.event_type==="criado"?"Criação registrada no M3":"Alteração registrada no M3",
    changes,
    hasComparableBefore,
  };
}
