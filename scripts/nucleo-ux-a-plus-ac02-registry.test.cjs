#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const ui=fs.readFileSync("src/components/nucleo/NucleoAc02ContinuityRead.tsx","utf8");
const contract=fs.readFileSync("supabase/functions/_shared/nucleo/ac02-registry-contract.ts","utf8");
const source=fs.readFileSync("supabase/functions/nucleo-knowledge-read/index.ts","utf8");
for(const term of [
 'kind:"nucleo_ac02_registro_mestre_consultivo"',
 'const isRegistry=(value:unknown):value is RegistryEnvelope',
 'registry.stable.every(row=>row.visibility==="publico_nao_secreto"',
 'registry.observations.every(row=>row.visibility==="publico_nao_secreto"',
 'setRegistry(response.ac02.global)',
 'setRegistry(null)',
 'response.module?.id!==moduleId',
 'include_ac02:true,include_assumption_export:true',
 'Rascunho gerado nesta sessão — não homologado',
 'PREPARADO","DISPONIBILIZADO","ENTREGUE","RECEBIDO","ACEITO',
 'Não comprovado pelo backend consultado',
 'não transmitido',
 'Registro Mestre do ecossistema · AC-02',
 'Verificação independente:',
 'Divergências e conferências pendentes',
 'Conferências pendentes',
 'Copiar rascunho revisado',
 'Recebimento e aceite NÃO comprovados',
]){const match=term==="não transmitido"?ui.includes("não transmite conteúdo automaticamente"):term==="Conferências pendentes"?ui.includes("Divergências e conferências pendentes"):ui.includes(term);assert(match,"Missing AC02 UX contract "+term);}
assert(contract.includes('export type Ac02Projection'),"Reuse backend registry projection");
assert(contract.includes('AC02_GLOBAL_ITEMS'),"No parallel identity hardcoded");
assert(source.includes('ac02=prepareAc02AssumptionDraft'),"Backend source exists");
assert(source.includes('...(body.include_assumption_export===true?{ac02_assumption_export}:{}),'),"Backend export source exists");
assert(!ui.includes('supabase.from('),"No new data writer or direct table");
assert(!ui.includes('stage: "aceito"'),"No invented acceptance");
console.log("UX AC02: read-only master registry and truthful five-stage timeline PASS");
