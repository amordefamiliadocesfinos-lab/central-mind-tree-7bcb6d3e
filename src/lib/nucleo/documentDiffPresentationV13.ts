/** UX-A4: numeração de apresentação, sem modificar o diff AC-01. */
import type { DiffLineV13 } from "./documentDiffV13";
export type NumberedDiffLineV13=DiffLineV13&{beforeLine:number|null;afterLine:number|null};
export function numberDocumentDiffLinesV13(lines:readonly DiffLineV13[]):NumberedDiffLineV13[]{
  let before=0,after=0;
  return lines.map(row=>({
    kind:row.kind,value:row.value,
    beforeLine:row.kind==="incluido"?null:++before,
    afterLine:row.kind==="removido"?null:++after,
  }));
}
