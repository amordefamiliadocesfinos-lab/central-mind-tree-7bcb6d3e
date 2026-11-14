/**
 * Núcleo A+ V1.2 — CA-16/18: contrato puro para resposta de leitura autorizada.
 * Não concede permissões, não infere vigência e não executa alterações.
 */
export type SourceRevision = {
  id:string;section_code:string;version_no:number;recorded_at:string;source_reference:string;
};
export type PrImpact = {
  evidence_id:string;number:number;merged_at:string|null;files:string[]|null;
};
export type ReviewSuggestion = {
  revision_id:string;section_code:string;version_no:number;
  pr_numbers:number[];matched_paths:string[];
};
const REPO_PREFIX="https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/main/";
const SOURCE_FILE=/^(src|docs|scripts|supabase)\/[a-zA-Z0-9_./-]+\.(tsx?|jsx?|md|json|sql|txt|ya?ml)$/;
export function explicitSourcePaths(reference:string):string[] {
  const found:string[]=[];
  for(const part of reference.split(";")){
    let path=part.trim();
    if(path.startsWith(REPO_PREFIX))path=path.slice(REPO_PREFIX.length);
    if(!SOURCE_FILE.test(path)||path.split("/").some(p=>p==="."||p===".."))continue;
    if(!found.includes(path))found.push(path);
  }
  return found;
}
export function reviewImpact(
  revisions:SourceRevision[],prs:PrImpact[],complete:boolean,
):{state:"candidatos"|"sem_correspondencia_comprovada"|"indeterminado";suggestions:ReviewSuggestion[];limitations:string[]} {
  const limitations:string[]=[];
  if(!complete){limitations.push("Origem GitHub indisponível, coleta limitada ou falha de consulta.");}
  if(prs.some(p=>!p.merged_at||p.files===null)){
    limitations.push("Ao menos uma PR não possui data de merge e lista de arquivos confirmadas.");
  }
  const suggestions:ReviewSuggestion[]=[];
  for(const revision of revisions){
    const paths=explicitSourcePaths(revision.source_reference);
    const revisionAt=Date.parse(revision.recorded_at);
    if(paths.length===0||!Number.isFinite(revisionAt)){
      limitations.push("Existem seções sem fonte de código explícita ou data comparável.");
      continue;
    }
    const matches=prs.filter(p=>p.merged_at&&p.files&&Number.isFinite(Date.parse(p.merged_at)) &&
      Date.parse(p.merged_at)>revisionAt&&p.files.some(f=>paths.includes(f)));
    if(matches.length){
      suggestions.push({
        revision_id:revision.id,section_code:revision.section_code,version_no:revision.version_no,
        pr_numbers:matches.map(m=>m.number),
        matched_paths:[...new Set(matches.flatMap(m=>(m.files??[]).filter(f=>paths.includes(f))))],
      });
    }
  }
  const uncertain=!complete||prs.length===0||revisions.length===0||prs.some(p=>!p.merged_at||!p.files)||
    revisions.some(r=>explicitSourcePaths(r.source_reference).length===0||!Number.isFinite(Date.parse(r.recorded_at)));
  return {
    state:suggestions.length?"candidatos":uncertain?"indeterminado":"sem_correspondencia_comprovada",
    suggestions,
    limitations:[...new Set(limitations)],
  };
}
export function isRequestedModuleCode(value:unknown):value is string{
  return typeof value==="string"&&/^[A-Z]{3}$/.test(value);
}
export function validPrNumber(value:unknown):number|null{
  const n=typeof value==="string"&&/^\d{1,7}$/.test(value)?Number(value):typeof value==="number"?value:NaN;
  return Number.isSafeInteger(n)&&n>0&&n<10000000?n:null;
}
