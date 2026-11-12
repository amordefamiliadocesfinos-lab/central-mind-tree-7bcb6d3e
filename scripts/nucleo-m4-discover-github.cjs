#!/usr/bin/env node
"use strict";
/**
 * M4: descoberta de candidatos GitHub para triagem. Não atribui frente nem
 * grava dados no Core; jamais converte CI/merge em conclusão do trabalho.
 */
const fs = require("node:fs");
const path = require("node:path");
const ROOT = "amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e";
const API = "https://api.github.com/repos/" + ROOT;
const PREFIX = "https://github.com/" + ROOT + "/";
const KNOWN = require("./nucleo-m4-github-refresh.cjs").BASELINE;
const MAX_PAGES = 3;
const PAGE_SIZE = 100;
function strictUrl(value, kind, id) {
  if (typeof value !== "string") throw new Error("Missing GitHub URL");
  const parsed = new URL(value);
  const stem = kind === "pull_request" ? "pull/" : "actions/runs/";
  if (parsed.origin !== "https://github.com" ||
      parsed.pathname !== "/" + ROOT + "/" + stem + id ||
      parsed.search || parsed.hash || parsed.username || parsed.password)
    throw new Error("Invalid GitHub evidence URL for " + kind + " #" + id);
  return parsed.href;
}
async function get(endpoint, fetchImpl, token) {
  const headers = {"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
  if (token) headers.Authorization = "Bearer " + token;
  const r = await fetchImpl(API + endpoint,{headers});
  if (!r.ok) throw new Error("GitHub HTTP " + r.status + " for " + endpoint);
  const data = await r.json();
  if (!Array.isArray(data)) throw new Error("GitHub listing must be an array");
  return data;
}
async function discover(fetchImpl, token, opts = {}) {
  const pageLimit = opts.pageLimit ?? MAX_PAGES;
  if (!Number.isSafeInteger(pageLimit) || pageLimit < 1 || pageLimit > MAX_PAGES) throw new Error("Unsafe page limit");
  const checkedAt = new Date().toISOString();
  const known = new Map(KNOWN.map(x=>[x.kind + "|" + x.id,x.code]));
  const found = new Map();
  const kinds = [
    {kind:"pull_request",url:"/pulls?state=all&sort=updated&direction=desc&per_page=" + PAGE_SIZE,
      resolve: x=>({id:x.number,status:x.merged_at ? "merged" : x.state,sha:x.merge_commit_sha||null,date:x.updated_at})},
    {kind:"workflow_run",url:"/actions/runs?per_page=" + PAGE_SIZE,
      resolve: x=>({id:x.id,status:x.conclusion||x.status,sha:x.head_sha||null,date:x.updated_at})},
  ];
  let pagesRead=0;
  for (const source of kinds) {
    for (let page=1;page<=pageLimit;page++) {
      const endpoint=source.url+"&page="+page;
      // Actions runs endpoint returns a wrapper {workflow_runs:[]}; read separately.
      const rows = source.kind==="workflow_run" ?
        await getRuns(endpoint,fetchImpl,token) : await get(endpoint,fetchImpl,token);
      pagesRead++;
      for (const item of rows) {
        const v=source.resolve(item);
        if (!Number.isSafeInteger(v.id) || v.id<=0) throw new Error("Invalid GitHub identity");
        const url=strictUrl(item.html_url,source.kind,v.id);
        const key=source.kind+"|"+v.id;
        if(found.has(key)) continue;
        found.set(key,{
          source:"github",kind:source.kind,external_key:String(v.id),
          reference_url:url,title:String(item.title||item.name||source.kind).slice(0,260),
          source_status:v.status||"unknown",source_sha:v.sha,
          source_observed_at:v.date||null,
          proposed_workstream_code:null,
          existing_explicit_mapping:known.get(key)||null,
          classification:known.has(key)?"known_source":"unassigned_candidate",
          requires_human_assignment:true,
        });
      }
      if(rows.length<PAGE_SIZE)break;
    }
  }
  const records=[...found.values()];
  return {
    schema_version:"nucleo-m4-discovery-v1",
    repository:ROOT,checked_at:checkedAt,read_only:true,
    requires_human_review:true,automatic_core_write:false,
    discovery_scope:{page_limit:pageLimit,page_size:PAGE_SIZE,pages_read:pagesRead,
      exhaustive:false,sort:"recent GitHub pull requests and workflow runs"},
    counts:{total:records.length,known:records.filter(r=>r.classification==="known_source").length,
      unassigned:records.filter(r=>r.classification==="unassigned_candidate").length},
    records,
    caveats:["Nenhuma associação automática a uma frente.",
      "A listagem é limitada e não comprova cobertura histórica integral.",
      "PR mesclada ou CI aprovado não constitui homologação do módulo.",
      "Este arquivo não é um manifesto apto a importar ou reconciliar no Core."],
  };
}
async function getRuns(endpoint, fetchImpl, token) {
  const headers={"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
  if(token)headers.Authorization="Bearer "+token;
  const r=await fetchImpl(API+endpoint,{headers});
  if(!r.ok)throw new Error("GitHub HTTP "+r.status+" for "+endpoint);
  const obj=await r.json();
  if(!obj||!Array.isArray(obj.workflow_runs))throw new Error("Malformed GitHub actions listing");
  return obj.workflow_runs;
}
if(require.main===module) {
  discover(global.fetch,process.env.GITHUB_TOKEN).then(report=>{
    const file=process.env.M4_DISCOVERY_OUTPUT || "nucleo-m4-discovery.json";
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,JSON.stringify(report,null,2)+"\n");
    console.log("M4 discovery: "+JSON.stringify(report.counts)+"; read-only/unassigned; pages="+report.discovery_scope.pages_read);
  }).catch(err=>{console.error("M4 discovery blocked:",err.message);process.exitCode=1;});
}
module.exports={discover,strictUrl};
