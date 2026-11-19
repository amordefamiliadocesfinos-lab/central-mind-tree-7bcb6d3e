/** CCH E2 — consultative preflight for authenticated read-only review.
 * Only reports observable state; no database access, inference of deploy success or writes.
 */
export type E2PreflightInput={
  versionStatus:string|null;
  activeVersionId:string|null;
  publishedVersionId:string|null;
  advisorSourceVersionId:string|null;
  advisorLoading:boolean;
  advisorError:string|null;
  advisorQuality:"limited"|"partial"|"reviewable"|null;
  trainingLevel:string|null;
};
export type E2Preflight={
  state:"published_read_only"|"draft_evidence_pending"|"draft_review"|"unavailable";
  reason:string;
  canInspectDraft:boolean;
  sourceAligned:boolean;
  publishedWriteProtected:boolean;
  missingEvidence:string[];
};
export function assessE2Preflight(x:E2PreflightInput):E2Preflight {
 const published=x.versionStatus==="published";
 const draft=x.versionStatus==="draft";
 const sourceAligned=!!x.publishedVersionId && !!x.advisorSourceVersionId &&
   x.advisorSourceVersionId===x.publishedVersionId;
 const missingEvidence:string[]=[];
 if(x.advisorLoading)missingEvidence.push("Auditoria em processamento");
 if(x.advisorError)missingEvidence.push("Auditoria indisponível");
 if(!sourceAligned)missingEvidence.push("Origem da auditoria ainda não comprovada");
 if(x.advisorQuality!=="reviewable")missingEvidence.push("Qualidade insuficiente para progressão automática");
 if(published) return {
   state:"published_read_only",reason:"Programa publicado: controles de prescrição E2 ficam indisponíveis até existir um rascunho autorizado.",
   canInspectDraft:false,sourceAligned,publishedWriteProtected:true,missingEvidence
 };
 if(!draft||!x.activeVersionId) return {
   state:"unavailable",reason:"Não há versão M3 acessível para contraprova da E2.",
   canInspectDraft:false,sourceAligned,publishedWriteProtected:false,missingEvidence
 };
 if(missingEvidence.length>0)return {
   state:"draft_evidence_pending",reason:"Rascunho disponível, mas evidências ainda precisam de revisão. Não inferir progressão.",
   canInspectDraft:true,sourceAligned,publishedWriteProtected:false,missingEvidence
 };
 return {state:"draft_review",reason:"Rascunho disponível para revisão consultiva; edição e publicação continuam manuais.",
   canInspectDraft:true,sourceAligned,publishedWriteProtected:false,missingEvidence};
}
