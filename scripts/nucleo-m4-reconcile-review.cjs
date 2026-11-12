#!/usr/bin/env node
"use strict";
/**
 * Núcleo M4: plano offline de reconciliação. Jamais escreve no Core.
 * Input 1: manifesto oficial GitHub (read-only).
 * Input 2: exportação mínima das evidências M4 já existentes no Core.
 * Output: candidatos novos, já registrados, divergências e bloqueios.
 */
const fs = require("node:fs");
const ROOT = "amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e";
const allowedKinds = new Set(["pull_request","workflow_run","commit"]);
const allowedCodes = new Set(["NUC-M0","NUC-M1","NUC-M2","NUC-M3","NUC-M4","NUC-M5"]);
const official = "https://github.com/" + ROOT + "/";
function checkUrl(url,kind,key) {
  const u = new URL(url);
  if (u.origin !== "https://github.com" || u.search || u.hash || !u.pathname.startsWith("/" + ROOT + "/")) {
    throw new Error("Invalid official URL");
  }
  const part = kind === "pull_request" ? "pull" : kind === "workflow_run" ? "actions/runs" : "commit";
  const path = "/" + ROOT + "/" + part + "/" + encodeURIComponent(key);
  if (u.pathname !== path) throw new Error("ID/URL mismatch");
  return u.href;
}
function identity(row) {
  return [row.workstream_code || row.code,row.source,row.kind,String(row.external_key)].join("|");
}
function sourceState(item) {
  if (item.kind === "pull_request") return item.source_status === "merged";
  if (item.kind === "workflow_run") return item.source_status === "success";
  return item.verified_at_source === true;
}
function snapshotValue(row) {
  const s = row.snapshot && typeof row.snapshot === "object" ? row.snapshot : {};
  return s.merge_commit_sha || s.merge_sha || s.source_sha || s.head_sha || s.conclusion || (s.merged === true ? "merged" : null);
}
function sourceValue(item) {
  return item.source_sha || item.source_status || null;
}
function reconcile(manifest,existing) {
  if (!manifest || manifest.schema_version !== "nucleo-m4-refresh-manifest-v1" ||
      manifest.read_only !== true || manifest.requires_human_review !== true ||
      manifest.repository !== ROOT || !Array.isArray(manifest.records)) throw new Error("Untrusted manifest contract");
  if (!Array.isArray(existing)) throw new Error("Existing evidence must be an array");
  const indexed = new Map();
  const ownership = new Map();
  for (const row of existing) {
    if (!row || row.source !== "github" || !allowedKinds.has(row.kind) ||
        !allowedCodes.has(row.workstream_code || row.code) || !row.external_key) continue;
    const id = identity(row);
    const globalId = [row.source,row.kind,String(row.external_key)].join("|");
    if (!ownership.has(globalId)) ownership.set(globalId,new Set());
    ownership.get(globalId).add(row.workstream_code || row.code);
    if (!indexed.has(id)) indexed.set(id, []);
    indexed.get(id).push(row);
  }
  const seen = new Set();
  const plan = {schema_version:"nucleo-m4-reconciliation-review-v1",read_only:true,
    requires_human_review:true,checked_at:manifest.checked_at,
    counters:{existing:0,new:0,divergent:0,blocked:0},proposals:[]};
  for (const item of manifest.records) {
    if (!item || item.source !== "github" || !allowedKinds.has(item.kind) ||
        !allowedCodes.has(item.workstream_code) || !/^[0-9a-f]{40}$/.test(String(item.source_sha||"")) &&
        item.kind === "commit") throw new Error("Unknown source mapping or kind");
    if (!/^[0-9]+$/.test(String(item.external_key)) && item.kind !== "commit")
      throw new Error("Invalid GitHub numeric identity");
    checkUrl(item.reference_url,item.kind,String(item.external_key));
    const key=identity(item);
    if (seen.has(key)) throw new Error("Duplicate identity in source manifest: "+key);
    seen.add(key);
    const rows=indexed.get(key)||[];
    const verified=sourceState(item) && item.verified_at_source === true;
    let classification,reason;
    const otherOwner=(ownership.get([item.source,item.kind,String(item.external_key)].join("|"))||new Set());
    const crossFront=Array.from(otherOwner).some(code=>code!==item.workstream_code);
    if (crossFront) {
      classification="blocked";reason="Referência já vinculada a outra frente; revisão humana obrigatória";
    } else if (!verified) {
      classification="blocked";reason="Estado da fonte não aprovado: requer investigação, nunca gravar automaticamente";
    } else if (rows.length===0) {
      classification="new";reason="Referência nova; revisar vínculo com a frente e a evidência original";
    } else {
      const known=rows.filter(r=>r.observed_state==="verificado");
      const mismatch=known.some(r=>{
        const v=snapshotValue(r);
        const current=sourceValue(item);
        // Snapshots históricos podem não ter SHA. Não afirmar divergência sem comparação válida.
        return v && current && /^[0-9a-f]{40}$/.test(v) && /^[0-9a-f]{40}$/.test(current) && v!==current;
      });
      classification=mismatch ? "divergent" : "existing";
      reason=mismatch ? "SHA confirmado difere do snapshot histórico: investigação obrigatória" :
        "Identidade já vinculada; não criar linha repetida sem mudança comprovada";
    }
    plan.counters[classification]++;
    plan.proposals.push({workstream_code:item.workstream_code,source:"github",kind:item.kind,
      external_key:String(item.external_key),reference_url:item.reference_url,
      source_status:item.source_status,source_sha:item.source_sha||null,
      classification,reason,read_only:true});
  }
  plan.requires_stop=plan.counters.divergent>0||plan.counters.blocked>0;
  return plan;
}
if(require.main===module) {
  try{
    const [manifestFile,coreFile,outputFile]=process.argv.slice(2);
    if(!manifestFile||!coreFile||!outputFile) throw new Error("Usage: node reconcile.cjs manifest.json core-metadata.json proposal.json");
    const manifest=JSON.parse(fs.readFileSync(manifestFile,"utf8"));
    const core=JSON.parse(fs.readFileSync(coreFile,"utf8"));
    const proposal=reconcile(manifest,core);
    fs.writeFileSync(outputFile,JSON.stringify(proposal,null,2)+"\n");
    console.log("M4 reconciliation dry-run:",JSON.stringify(proposal.counters),"requires_stop="+proposal.requires_stop);
    if(proposal.requires_stop) process.exitCode=2;
  }catch(e){console.error("M4 reconciliation blocked:",e.message);process.exitCode=1;}
}
module.exports={reconcile};
