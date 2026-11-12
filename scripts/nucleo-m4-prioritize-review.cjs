#!/usr/bin/env node
"use strict";
/**
 * M4: fila de REVISÃO de candidatos GitHub. NÃO atribui frente, NÃO aprova,
 * NÃO grava no Core; o catálogo de descoberta original permanece íntegro.
 */
const fs=require("node:fs");
const knownKinds=new Set(["pull_request","workflow_run"]);
const REPO="amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e";
function isNucleoLabel(text) {
  return /(?:^|[^a-zà-ÿ])n[uú]cleo(?:[^a-zà-ÿ]|$)|(?:^|[^a-z])nucleo(?:[^a-z]|$)/i.test(text||"");
}
function rank(discovery,existing=[]) {
  if(!discovery||discovery.schema_version!=="nucleo-m4-discovery-v1"||
     discovery.repository!==REPO||discovery.read_only!==true||
     discovery.automatic_core_write!==false||!Array.isArray(discovery.records)||
     !Array.isArray(existing))throw Error("Invalid discovery/core metadata contract");
  const accounted=new Set();
  for(const e of existing) {
    if(e&&e.source==="github"&&knownKinds.has(e.kind)&&e.external_key)
      accounted.add(e.kind+"|"+String(e.external_key));
  }
  const seen=new Set(),items=[];
  for(const r of discovery.records) {
    if(!r||r.source!=="github"||!knownKinds.has(r.kind)||
       !/^[0-9]+$/.test(String(r.external_key||""))||
       !r.reference_url||!r.title)throw Error("Invalid discovery candidate");
    const key=r.kind+"|"+r.external_key;
    if(seen.has(key))throw Error("Duplicate source identity: "+key);seen.add(key);
    const already=accounted.has(key);
    const explicit=isNucleoLabel(r.title)||isNucleoLabel(r.kind==="workflow_run"?(r.head_branch||""):"");
    const signals=[];
    if(isNucleoLabel(r.title))signals.push("titulo_cita_nucleo");
    if(isNucleoLabel(r.head_branch||""))signals.push("branch_cita_nucleo");
    if(r.existing_explicit_mapping)signals.push("lista_conhecida");
    if(already)signals.push("identidade_ja_no_core");
    let queue,priority;
    if(already||r.classification==="known_source") {queue="ja_conhecida";priority=0;}
    else if(!explicit) {queue="fora_da_triagem_prioritaria";priority=0;}
    else if(r.kind==="pull_request"&&r.source_status!=="merged"||
            r.kind==="workflow_run"&&r.source_status!=="success") {
      queue="revisao_de_pendencia_ou_falha";priority=1;
    } else {queue="revisao_prioritaria";priority=2;}
    items.push({
      kind:r.kind,external_key:String(r.external_key),reference_url:r.reference_url,
      source_title:r.title,source_status:r.source_status,
      signals,queue,priority,
      proposed_workstream_code:null,approval:null,
      requires_source_confirmation:true,requires_human_assignment:true,
      core_write_allowed:false,
    });
  }
  items.sort((a,b)=>b.priority-a.priority||
    a.kind.localeCompare(b.kind)||
    Number(b.external_key)-Number(a.external_key));
  const counts={
    total:items.length,
    review_priority:items.filter(x=>x.queue==="revisao_prioritaria").length,
    pending_or_failed:items.filter(x=>x.queue==="revisao_de_pendencia_ou_falha").length,
    already_known:items.filter(x=>x.queue==="ja_conhecida").length,
    outside_priority:items.filter(x=>x.queue==="fora_da_triagem_prioritaria").length,
  };
  return {schema_version:"nucleo-m4-prioritized-review-v1",
    source_checked_at:discovery.checked_at,repository:REPO,
    read_only:true,automatic_core_write:false,requires_human_review:true,
    source_is_partial:true,ranking_is_not_authorization:true,
    counts,items,
    caveats:[
      "Sinal textual serve APENAS para priorizar revisão; jamais atribui frente.",
      "Falha, PR aberta, PR fechada sem merge e origem ambígua não são entregas aprovadas.",
      "Registros fora da prioridade não foram descartados nem declarados irrelevantes.",
      "O catálogo não é um inventário histórico integral; não altera o Core.",
    ],
  };
}
if(require.main===module) {
 try{
  const [discoveryFile,existingFile,outFile]=process.argv.slice(2);
  if(!discoveryFile||!existingFile||!outFile)
    throw Error("Usage: rank.cjs discovery.json existing-metadata.json review-queue.json");
  const output=rank(
    JSON.parse(fs.readFileSync(discoveryFile,"utf8")),
    JSON.parse(fs.readFileSync(existingFile,"utf8"))
  );
  fs.writeFileSync(outFile,JSON.stringify(output,null,2)+"\n");
  console.log("Núcleo M4 priorização (sem atribuição): "+JSON.stringify(output.counts));
 }catch(e){console.error("M4 priority review blocked:",e.message);process.exitCode=1;}
}
module.exports={rank,isNucleoLabel};
