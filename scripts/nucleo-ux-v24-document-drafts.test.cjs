#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const a=fs.readFileSync("src/components/nucleo/NucleoOperationalAtlas.tsx","utf8");
const k=fs.readFileSync("src/components/nucleo/NucleoModuleKnowledge.tsx","utf8");
const s=fs.readFileSync("src/components/nucleo/NucleoSpecialistContributions.tsx","utf8");
for(const [src,t,reason] of [
[a,'fmDraftState.busy || specialistDraftState.busy',"Blocked during writes"],
[a,'fmDraftState.dirty || specialistDraftState.dirty',"Discard prompt"],
[a,'onDraftStateChange={setSpecialistDraftState}',"Specialist callback"],
[a,'onDraftStateChange={setFmDraftState}',"Ficha Viva callback"],
[k,'const draftDirty=Boolean(title.trim()||body.trim()||source.trim())',"FM editing"],
[s,'const draftBusy=saving||uncertainRef.current',"Uncertain AC01 never discarded"],
[s,'row.authority_state===attempt.authorityState',"AC01 readback preserved by full snapshot"],
[k,'authority_state:"rascunho"',"FM authority preserved"],
[k,'.eq("id",result.data.id).maybeSingle()',"FM readback preserved"],
]){
assert(src.includes(t),reason);}
assert(k.includes('window.addEventListener("beforeunload",warn)'));
assert(s.includes('window.addEventListener("beforeunload",warn)'));
console.log("UX V2.4 document drafts and write guards PASS");
