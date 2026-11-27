#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const src=fs.readFileSync("src/components/nucleo/NucleoDevelopmentCenter.tsx","utf8");
const must=[
  'const [lastReadAt,setLastReadAt] = useState<string|null>(null)',
  'setLastReadAt(new Date().toISOString())',
  'setLastReadAt(null)',
  'Última consulta nesta sessão:',
  'lastReadAt ? new Date(lastReadAt).toLocaleString("pt-BR") : "não verificada"',
  'Explorar árvore completa de módulos e frentes',
  '<details className="rounded-2xl border border-[#dce5f1]',
  'grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5',
  'grid grid-cols-2 gap-2 sm:grid-cols-3',
  'aria-label="Foco do acompanhamento"',
  'Limpar foco',
  'onClick={()=>setExpandedEvidenceFor(current=>current===selected.id?null:selected.id)}'
];
for(const term of must)assert(src.includes(term),"DIN-06: "+term);
assert.equal(src.includes('Mostrar todas as situações</Button>'),false,"No duplicate situation notice");
assert.equal(src.split('Explorar árvore completa de módulos e frentes').length-1,1);
// The tree wrapper must preserve the original guarded selection and then focus its detail.
for(const node of ["mod","front","sub"]){
  assert(src.includes("onClick={() => openTreeItem("+node+".id)}"),"Hierarchy selection preserved: "+node);
}
assert(src.includes('items.filter(i => i.parent_id === mod.id).map(front =>'),"Module-to-front relationship preserved");
assert(src.includes('items.filter(i => i.parent_id === front.id).map(sub =>'),"Front-to-subfront relationship preserved");
const treeHandler=src.slice(src.indexOf("const openTreeItem ="),src.indexOf("const addItem ="));
assert.match(treeHandler,/if \(!choose\(id\)\) return;/,"Guarded original selection preserved");
assert.match(treeHandler,/detail\?\.focus\(\{preventScroll:true\}\)/,"Focus only after successful selection");
assert(src.includes('<NucleoSupervisionPanel'),"Original supervision preserved");
assert(src.includes('NucleoExecutiveDevelopment'),"Original executive preserved");
assert.equal(src.split('<NucleoModuleKnowledge ').length-1,1,"One existing FM writer for governance only");
assert(src.includes('items.filter(item=>item.kind==="modulo"&&item.code==="NUC").map(module=>'),"Use the actual NUC root, never an operational duplicate");
assert(src.includes('moduleId={module.id} moduleCode={module.code}'),"Preserve Core module identity");
assert(src.includes('if(nucKnowledgeDraft.current.dirty||nucKnowledgeDraft.current.busy)'),"M3 refresh cannot unmount a pending governance draft");
assert(src.includes('onDraftStateChange={reportNucKnowledgeDraft}'),"Use the existing FM draft guard");
console.log("UX-DIN-06: provenance, compact navigation, responsive grids and original hierarchy PASS");
