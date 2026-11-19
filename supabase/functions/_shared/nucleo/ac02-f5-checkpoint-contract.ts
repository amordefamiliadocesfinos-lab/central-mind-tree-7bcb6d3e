/** F5/Núcleo: pin único e validado do checkpoint M4 já existente. */
export const CHECKPOINT_EVENT_ID="96415dff-3efb-4b09-8fb3-ac39f113fde4";
export const CHECKPOINT_FRONT_ID="95833fbd-38b5-4a0a-abea-45f74214d533";
export const DECISION_REFERENCE="https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/699#issuecomment-6837285096";
export const CHECKPOINT_REFERENCE="https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/699#issuecomment-7023192928";
export type HistoryEvent={
 id:string;workstream_id:string;event_type:string;recorded_at:string;
 before_state:unknown;after_state:unknown;
};
const obj=(v:unknown):Record<string,unknown>|null=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:null;
export function assessM4Checkpoint(event:HistoryEvent, current:{id:string;code:string;status:string;next_action:string}){
 if(event.id!==CHECKPOINT_EVENT_ID||event.workstream_id!==CHECKPOINT_FRONT_ID||
   event.event_type!=="alterado"||current.id!==CHECKPOINT_FRONT_ID||current.code!=="NUC-M4")
   return null;
 const before=obj(event.before_state),after=obj(event.after_state);
 if(!before||!after||before.id!==CHECKPOINT_FRONT_ID||after.id!==CHECKPOINT_FRONT_ID||
    before.code!=="NUC-M4"||after.code!=="NUC-M4"||
    before.status!=="em_validacao"||after.status!=="em_validacao"||
    typeof before.next_action!=="string"||typeof after.next_action!=="string"||
    !after.next_action.includes("PR #699, comentário #6837285096")||
    current.status!=="em_validacao"||
    typeof current.next_action!=="string"||!current.next_action.includes("PR #699, comentário #6837285096"))
   return null;
 return {
  front_code:"NUC-M4" as const,event_id:event.id,recorded_at:event.recorded_at,
  status_before:"em_validacao" as const,status_after:"em_validacao" as const,
  decision:"Aceite técnico restrito da entrega M4, com ressalvas e sem encerramento operacional.",
  decision_source:DECISION_REFERENCE,checkpoint_source:CHECKPOINT_REFERENCE,
  lesson:"Aceite técnico restrito, estado operacional e vigência documental são decisões distintas; não promover conclusão por inferência.",
  before_action:"Parecer técnico aguardava decisão da Camada Mestre.",
  after_action:"Decisão técnica restrita reconhecida; permanecer em validação, acompanhar somente integrações read-only e não automatizar escrita.",
  current_action:current.next_action,
  learning_state:"historico_verificado_sem_fm_homologado" as const,
 };
}
export function fmVisibility(count:number|null,readError:boolean){
 if(readError||count===null||!Number.isSafeInteger(count)||count<0)return "indeterminado" as const;
 return count===0?"sem_revisao_visivel_sob_rls" as const:"revisao_visivel_sem_assertiva_de_vigencia" as const;
}
