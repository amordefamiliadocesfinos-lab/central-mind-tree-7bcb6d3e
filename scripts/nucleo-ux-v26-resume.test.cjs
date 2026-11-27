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
["resumeItem.next_action?.trim()","Real next action"],["attention=items.filter(item=>item.kind!==\"modulo\"&&item.code!==\"NUC\")","Exclude module roots and NUC"],
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
['Limpar foco',"Clear state through unified focus controls"],
['allOperationalVisible.filter(item => item.status === state.key).length',"Unfiltered totals"],
['if (!choose(item.id)) return;',"List cancellation guard"],
['if (!choose(root.id)) return;',"Root guard"],
['setFilter("");\n    setAttentionStatus(null);\n    setModuleFocusId("");\n    setSpecialistFocus("");\n    setWorkspaceView("frentes")',"Resume clears stale status"]
])has(part,why);
// V3/P4: checkpoint from the same bounded M3 event read as the resume card.
for(const [part,why] of [
 ['summarizeDevelopmentCheckpoint',"Reuse existing M3 event summarizer"],
 ['history.find(event=>event.workstream_id===resumeItem.id)',"Match actual chosen resume record"],
 ['Última atualização do trabalho nesta leitura',"User sees checkpoint provenance"],
 ['resumeCheckpointSummary.changes.slice(0,2)',"Bounded readable latest changes"],
 ['Nenhum evento desta frente localizado na janela global de 200 registros',"Explicit absence in bounded history"],
 ['Registro administrativo; não significa aprovação formal ou publicação.',"No implicit authorization"],
])has(part,why);
// UX-3: Atlas continua montado; retorno não sobrescreve filtros nem a ficha FM.
for(const [part,why] of [
 ['const [returnToAtlas,setReturnToAtlas] = useState(false)',"Origin marker only after Atlas selection"],
 ['setReturnToAtlas(true);\n              setWorkspaceView("frentes")',"Atlas handoff is guarded by choose"],
 ['{returnToAtlas&&<Button',"Return is contextual"],
 ['Voltar ao módulo no Atlas',"Explicit return"],
 ['setWorkspaceView("geral");\n                      setAtlasExpanded(true)',"Return to mounted Atlas without recreation"],
 ['id="nucleo-atlas-completo" tabIndex={-1}',"Accessible return focus target"],
 ['atlas?.focus({preventScroll:true})',"Keyboard focus restored"],
])has(part,why);
// UX-3: origem da navegação deve refletir a última seleção aceita.
const chooseSection=s.slice(s.indexOf('  const choose = (id: string): boolean => {'),s.indexOf('  const addItem = async () => {'));
assert(chooseSection.includes('if (id === selectedId) { setReturnToAtlas(false); return true; }'),"Mesmo item reaberto diretamente revoga retorno antigo");
assert(chooseSection.includes('if (saving) {'),"Seleção protegida durante gravação");
assert(chooseSection.includes('if (hasPendingChanges && !window.confirm('),"Proteção para alterações não salvas");
assert(chooseSection.indexOf('    setReturnToAtlas(false);\n    setSelectedId(id);')>chooseSection.indexOf('if (hasPendingChanges && !window.confirm('),"Origem revogada depois da guarda de rascunho");
assert(s.includes('if (!choose(id)) return;\n              setReturnToAtlas(true);'),"Atlas só registra origem após seleção aceita");
console.log("UX V2.7: filters are actionable; unsafe scroll prevented");
console.log("UX V2.6: simple entry, truthful resume, progressive Atlas and contracts");

/* P6 H03-R/H08-R: identity-based deduplication and route-local docking. */
assert(s.includes('resumeItem.id===crmAttention.id'),"Deduplicate by stable ID, not by label");
assert(s.includes('resumeIsCrmAttention')&&s.includes('A próxima ação e o registro integral estão no cartão acima.'),"Same action is presented only in CRM card");
assert(s.includes('<OverviewAction value={crmAttention.next_action||""}/>')&&s.includes('<OverviewAction value={resumeItem.next_action?.trim()||""}/>'),"Reuse literal excerpt for distinct fronts");
assert(s.includes('const excerpt=explicitNextActionExcerpt(value)')&&s.includes('Registro integral e ressalvas')&&s.includes('{value}</p>'),"Keep complete original and limitations");
assert(s.includes('Ver o que mudou')&&s.includes('resumeCheckpointSummary.changes.slice(0,2)'),"Historical text remains expandable");
const globalSearch=fs.readFileSync("src/components/GlobalSearchBar.tsx","utf8");
assert(globalSearch.includes('const dockedInNucleo = /^\\/nucleo\\/?$/.test(pathname);'),"Dock only Núcleo route");
assert(globalSearch.includes('style={dockedInNucleo ? undefined : {')&&globalSearch.includes('relative mx-auto flex w-full'),"In-flow search, not overlay");
assert(globalSearch.includes('!dockedInNucleo && <div')&&globalSearch.includes('fixed z-50 transition-[width]'),"Dragging elsewhere unchanged");
assert(globalSearch.includes('const POSITION_KEY = "pc.searchbar.position"')&&globalSearch.includes('getCrmRouteBlockReason()')&&globalSearch.includes('e.key === "/"'),"Position, navigation protection and shortcut retained");
assert(globalSearch.includes('if (isMobile) return null;'),"Existing mobile policy unchanged");
