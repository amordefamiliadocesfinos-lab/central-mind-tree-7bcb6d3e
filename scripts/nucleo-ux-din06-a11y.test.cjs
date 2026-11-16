#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const src=fs.readFileSync("src/components/nucleo/NucleoDevelopmentCenter.tsx","utf8");
const must=[
  'const [lastReadAt,setLastReadAt] = useState<string|null>(null)',
  'setLastReadAt(new Date().toISOString())',
  'setLastReadAt(null)',
  'Última leitura M3 nesta sessão:',
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
assert(src.includes('onClick={() => choose(sub.id)}'),"Original hierarchy navigation preserved");
assert(src.includes('<NucleoSupervisionPanel'),"Original supervision preserved");
assert(src.includes('NucleoExecutiveDevelopment'),"Original executive preserved");
assert(src.includes('NucleoModuleKnowledge')===false,"Not creating a second FM copy");
console.log("UX-DIN-06: provenance, compact navigation, responsive grids and original hierarchy PASS");
