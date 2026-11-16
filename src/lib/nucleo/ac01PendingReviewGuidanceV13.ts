/**
 * V1.3 AC-01: orientação de pendências da fila para o escritor JÁ EXISTENTE.
 * Não seleciona automaticamente evento, nem confirma que um evento resolve pendência.
 */
import type {Ac01QueueIssue} from "./ac01ConsolidationQueueV13";
export type ReviewActionKindV13="comentario"|"solicitar_refinamento";
export const AC01_ISSUE_REVIEW_ACTIONS_V13:Readonly<Record<Ac01QueueIssue,{
 action:ReviewActionKindV13;instruction:string;
}>>={
 historico_incompleto:{action:"solicitar_refinamento",instruction:"Conferir cadeia original e solicitar a versão faltante."},
 decisao_pendente:{action:"comentario",instruction:"Consultar o pedido no ciclo decisório existente; comentário não decide o pedido."},
 origem_sem_fm:{action:"solicitar_refinamento",instruction:"Solicitar localização da referência FM; ausência no recorte não prova ausência externa."},
 divergencia_de_origem:{action:"solicitar_refinamento",instruction:"Confrontar as fontes e versões originais antes de propor qualquer vínculo."},
 publicacao_sem_decisao_no_recorte:{action:"comentario",instruction:"Conferir a cadeia de decisão por IDs, sem assumir publicação válida."},
 sem_decisao_aprovada:{action:"comentario",instruction:"Conferir competência e atos existentes; encaminhamento não equivale a aprovação."},
};
export function preparePendingReviewGuidance(issues:readonly Ac01QueueIssue[]){
 return [...new Set(issues)].map(issue=>({
  issue, ...AC01_ISSUE_REVIEW_ACTIONS_V13[issue],resolved:false as const,
 }));
}
