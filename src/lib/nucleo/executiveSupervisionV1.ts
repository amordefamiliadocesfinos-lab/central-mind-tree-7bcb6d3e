import type { DevelopmentWorkstream, Priority } from "./development.types";
import type { SupervisionFinding } from "./supervision";

/** SI05: presentation of the existing findings only. No new risk score or alert. */
const priorityOrder: Record<Priority,number> = {critica:0,alta:1,normal:2,baixa:3};
const priorityLabels: Record<Priority,string> = {critica:"Crítica",alta:"Alta",normal:"Normal",baixa:"Baixa"};

export function findExecutiveWorkstream(code:string,workstreams:readonly DevelopmentWorkstream[]) {
  const matches=workstreams.filter(item=>item.code===code&&item.kind!=="modulo");
  return matches.length===1?matches[0]:undefined;
}

export function executivePriorityLabel(priority:Priority) {
  return Object.prototype.hasOwnProperty.call(priorityLabels,priority)?priorityLabels[priority]:"Não identificada";
}

export function orderExecutiveFindings(findings:readonly SupervisionFinding[],workstreams:readonly DevelopmentWorkstream[]) {
  const rank=(finding:SupervisionFinding)=>{
    const front=findExecutiveWorkstream(finding.workstreamCode,workstreams);
    return front&&Object.prototype.hasOwnProperty.call(priorityOrder,front.priority)?priorityOrder[front.priority]:4;
  };
  return findings.map((finding,index)=>({finding,index,priority:rank(finding)}))
    .sort((a,b)=>Number(a.finding.severity!=="atencao")-Number(b.finding.severity!=="atencao")||
      a.priority-b.priority||a.index-b.index).map(item=>item.finding);
}

export function summarizeExecutiveFindings(findings:readonly SupervisionFinding[]) {
  return {
    attention:findings.filter(finding=>finding.severity==="atencao").length,
    information:findings.filter(finding=>finding.severity==="informativo").length,
    workstreams:new Set(findings.map(finding=>finding.workstreamCode)).size,
  };
}
