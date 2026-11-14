#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const a=fs.readFileSync("src/components/nucleo/NucleoOperationalAtlas.tsx","utf8");
const f=fs.readFileSync("src/components/nucleo/NucleoModuleKnowledge.tsx","utf8");
const c=fs.readFileSync("src/components/nucleo/NucleoSpecialistContributions.tsx","utf8");
function has(s,t,m){assert(s.includes(t),m)}
for(const x of ["overview","module","operation"])has(a,'aria-pressed={level==="'+x+'"}',"Atlas aria-pressed: "+x);
has(a,"grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center","Mobile nav");
has(a,"min-h-11 w-full max-w-full min-w-0 whitespace-normal break-words","Long name");
has(a,"Nenhum módulo corresponde à busca atual.","Filtered empty");
has(f,'error ? "Core: leitura indisponível"',"Read error must not claim zero");
has(f,'"Core: sem registro neste recorte"',"Zero only in successful recorte");
has(f,"min-[380px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5","320/390 responsivity");
has(f,'disabled={saving||loading||Boolean(error)}',"FM CTA read guard");
has(f,'role="alert" className="rounded-md border border-destructive/40',"FM alert");
has(c,'{reading&&<p role="status"',"AC01 reading");
has(c,'{readError&&<p role="alert"',"AC01 failure");
has(c,'{rows.length===0&&<p role="status"',"AC01 no rows after read");
has(c,"min-h-11 w-full whitespace-normal sm:w-auto","Mobile action");
has(c,'disabled={saving||reading||Boolean(readError)}',"Prevent form entry without read");
has(c,'className="break-all">Origem:',"Long reference");
has(c,'disabled={reading||Boolean(readError)||saving||uncertainRef.current}',"AC01 original gate");
has(c,'check.data.authority_state!==(parent?"em_evolucao":"proposta")',"AC01 original authority");
has(f,'authority_state:"rascunho"',"FM original authority");
has(f,'.eq("id",result.data.id).maybeSingle()',"FM readback");
console.log("UX-A5: responsividade, estados, acesso e contratos preservados");
