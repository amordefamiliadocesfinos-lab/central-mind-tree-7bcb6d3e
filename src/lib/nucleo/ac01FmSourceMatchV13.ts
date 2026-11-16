/**
 * Núcleo V1.3 AC-01 ↔ FM: comparação exclusivamente declarativa de localizadores.
 * Não há foreign key entre contribuição e revisão FM: jamais inferir vínculo
 * persistido, identidade de conteúdo, publicação ou autoridade de mera igualdade.
 */
export type Ac01FmSourceMatch="localizador_identico"|"localizador_divergente"|"referencia_insuficiente";
export type Ac01FmCandidate=Readonly<{
 id:string;module_id:string;section_code:string;version_no:number;
 source_reference:string;authority_state:string;
}>;
export function compareAc01FmSource(
 contribution:{module_id:string;source_locator:string},
 fm:Ac01FmCandidate,
):Ac01FmSourceMatch{
 if(contribution.module_id!==fm.module_id)return "localizador_divergente";
 const locator=contribution.source_locator.trim();
 if(!locator||!fm.source_reference.trim())return "referencia_insuficiente";
 // O campo FM usa texto com fontes separadas por ';'. Comparação é exata,
 // sem normalizar caminhos, URL, case ou versões, que podem ter semântica diferente.
 const declared=fm.source_reference.split(";").map(v=>v.trim()).filter(Boolean);
 return declared.includes(locator)?"localizador_identico":"localizador_divergente";
}
export function assessAc01FmCandidates(
 contribution:{module_id:string;source_locator:string},
 candidates:readonly Ac01FmCandidate[],
):ReadonlyArray<{fm:Ac01FmCandidate;match:Ac01FmSourceMatch}>{
 return candidates.filter(fm=>fm.module_id===contribution.module_id).map(fm=>({
  fm,match:compareAc01FmSource(contribution,fm),
 }));
}
