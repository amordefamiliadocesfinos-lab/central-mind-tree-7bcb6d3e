#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const c=fs.readFileSync("src/components/nucleo/NucleoSpecialistContributions.tsx","utf8");
const g=fs.readFileSync("src/components/nucleo/NucleoAC01DocumentGovernance.tsx","utf8");
for(const id of ["vincular","versoes","comparar","refinar","consolidar","decidir","vigencia","historico"]){
 assert(c.includes('id:"'+id+'"'),"AC01 stage missing "+id);
}
for(const [file,needle,label] of [
 [c,'aria-label="Ciclo documental AC-01 — atalhos"',"Journey entry"],
 [c,'onClick={()=>goToFlow(step)}',"Navigable stages"],
 [c,'setGovernanceTarget({key:step.tab,seq:++targetCounter.current})',"Existing subtab selection"],
 [c,'id="nucleo-ac01-source-form"',"Original source entry"],
 [c,'id="nucleo-ac01-source-versions"',"Version comparison entry"],
 [c,'requestedTab={governanceTarget}',"Consolidation decision history nav"],
 [c,'onClick={()=>void submit()}',"Original proposal writer retained and opt-in"],
 [c,'uncertainRef.current',"Uncertain writes stay blocked"],
 [c,'onDraftStateChange?.({dirty:draftDirty,busy:draftBusy})',"Draft guard preserved"],
 [c,'Comparação limitada a metadados declarados',"No fabricated document diffs"],
 [g,'requestedTab?:{key:Tab;seq:number}|null',"Read-only tab contract"],
 [g,'useEffect(()=>{if(requestedTab)setTab(requestedTab.key);},[requestedTab])',"Requested tab effect"],
 [g,'Prévia de reconciliação canônica — bloqueada',"Publication gate stays shut"],
 [g,'Publicação interna AC-01 não comprova a vigência',"Canonical distinction retained"],
 [g,'nucleo_ac01_authority_grants',"Authority consulted, not changed"],
])assert(file.includes(needle),label);
assert(!/setAuthorityGrant|insertAuthorityGrant|publishCanonically/.test(c),"No new authority writer");
console.log("UX A+ AC01: guided lifecycle reuses source/read-only decisions and preserves draft guards PASS");
