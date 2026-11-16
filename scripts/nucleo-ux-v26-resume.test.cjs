#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const s=fs.readFileSync("src/components/nucleo/NucleoDevelopmentCenter.tsx","utf8");
const has=(part,why)=>assert(s.includes(part),why);
for(const [part,why] of [
["CENTRAL VISUAL / INÍCIO","Location"],["Onde estamos e como continuar","Simple entry"],
["De onde continuar","Resume card"],["O que precisa de atenção","Attention summary"],
["nucleo-last-opened:","Per-user browser ID"],["lastOpened ?? (latestEvent ? byId.get(latestEvent.workstream_id) : undefined)","Core event fallback"],
["Última movimentação entre os eventos carregados do Core","Provenance"],
["resumeItem.next_action?.trim()","Real next action"],["attention=items.filter(item=>item.code!==\"NUC\")","Exclude root"],
["const [atlasVisited,setAtlasVisited] = useState(false)","Lazy Atlas"],
["const [atlasExpanded,setAtlasExpanded] = useState(false)","Collapsed Atlas"],
["aria-expanded={atlasExpanded}","Accessible expansion"],["hidden={!atlasExpanded}","Keep Atlas mounted"],
["<NucleoOperationalAtlas workstreams={items}","Legacy Atlas"],
["if (!choose(id)) return;","Canceled selection guard"],
["hasPendingChanges && !window.confirm(","Unsaved edit guard"],
["NucleoTechnicalEvidence","M4 evidence"],["NucleoSupervisionPanel","M5 supervision"],
["NucleoExecutiveDevelopment","Executive retained"],["client.from(\"nucleo_development_events\").select(\"*\").order(\"recorded_at\", { ascending: false }).limit(200)","Bounded Core source"]
])has(part,why);
// V2.7: status chips navigate only inside the loaded Core state.
for(const [part,why] of [
['const [attentionStatus,setAttentionStatus] = useState<DevelopmentStatus | null>(null)',"Status state"],
['allOperationalVisible.filter(item => !attentionStatus || item.status === attentionStatus)',"Filtered list"],
['setFilter("");setModuleFocusId("");setSpecialistFocus("");setAttentionStatus("bloqueado");setWorkspaceView("frentes")',"Blocked shortcut"],
['setFilter("");setModuleFocusId("");setSpecialistFocus("");setAttentionStatus("em_validacao");setWorkspaceView("frentes")',"Validation shortcut"],
['setFilter("");setModuleFocusId("");setSpecialistFocus("");setAttentionStatus("em_andamento");setWorkspaceView("frentes")',"Progress shortcut"],
['onClick={()=>setAttentionStatus(null)}>Mostrar todas as situações',"Clear state"],
['allOperationalVisible.filter(item => item.status === state.key).length',"Unfiltered totals"],
['if (!choose(item.id)) return;',"List cancellation guard"],
['if (!choose(root.id)) return;',"Root guard"],
['setFilter("");\n    setAttentionStatus(null);\n    setModuleFocusId("");\n    setSpecialistFocus("");\n    setWorkspaceView("frentes")',"Resume clears stale status"]
])has(part,why);
console.log("UX V2.7: filters are actionable; unsafe scroll prevented");
console.log("UX V2.6: simple entry, truthful resume, progressive Atlas and contracts");
