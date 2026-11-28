import type { DevelopmentWorkstream } from "./development.types";

/** SI01: documentary guidance, never an M3 dependency, alert or proof of execution.
 * Source: Quatro Blocos V1.0, SI02/SI03; U03/U05 checkpoints #7176022438/#7176360875.
 * Module links are resolved only against the current authorized snapshot.
 */
const issue="https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/1037#issuecomment-";
const journeys = [
  {key:"purchase",codes:["OPE","FIN"],title:"Da necessidade de compra ao financeiro",sequence:"Planejamento de compras → compra → obrigação → movimento financeiro",next:"Conferir uma compra existente e distinguir recebimento, obrigação, pagamento e conciliação. Origem do planejamento só quando registrada.",source:issue+"7176022438"},
  {key:"campaign",codes:["DIG","CRM"],title:"Da campanha ao relacionamento com clientes",sequence:"Campanha → identificação da origem → relacionamento → resultado registrado",next:"Conferir identidade e origem de uma campanha existente. Nome parecido ou envio não comprova atribuição de venda.",source:issue+"7176022438"},
  {key:"capture",codes:["CAP"],title:"Da captura à próxima ação",sequence:"Captura → decisão → planejamento ou foco, quando pertinente",next:"Conferir o vínculo existente entre captura e tarefa. Uma captura também pode ser referência ou arquivada.",source:issue+"7176360875"},
  {key:"routine",codes:["ROT"],title:"Da rotina ao planejamento e foco",sequence:"Recorrência → rotina; trabalho estruturante → planejamento; próxima ação relevante → foco",next:"Conferir uma rotina legítima e sua origem, sem exigir tarefa para cada bloco.",source:issue+"7176360875"},
  {key:"assistant",codes:["ASS"],title:"Da sugestão à decisão e ao resultado",sequence:"Sugestão → decisão autorizada → execução, se aplicável → histórico",next:"Consultar a origem, a decisão e o resultado separadamente. Aprovar pode executar uma ação; não usar como simulação.",source:issue+"7176360875"},
] as const;
type Root = Pick<DevelopmentWorkstream,"id"|"code"|"title"|"kind">;
export function documentedJourneys(workstreams:readonly Root[],focusModuleId?:string) {
  const roots=workstreams.filter(w=>w.kind==="modulo");
  if(focusModuleId&&!roots.some(w=>w.id===focusModuleId))return [];
  return journeys.flatMap(journey=>{
    const groups=journey.codes.map(code=>roots.filter(w=>w.code===code));
    // Never fabricate an absent target or select between ambiguous roots.
    if(groups.some(group=>group.length!==1))return [];
    const modules=groups.map(group=>group[0]);
    if(focusModuleId&&!modules.some(w=>w.id===focusModuleId))return [];
    return [{...journey,modules}];
  });
}
