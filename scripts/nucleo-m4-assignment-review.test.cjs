#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const {review}=require("./nucleo-m4-assignment-review.cjs");
const root="https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/";
const candidate=(id,state="merged")=>({kind:"pull_request",external_key:String(id),
  reference_url:root+"pull/"+id,title:"PR "+id,source_status:state,
  source_sha:"a".repeat(40),classification:"unassigned_candidate"});
const discovery={schema_version:"nucleo-m4-discovery-v1",
  repository:"amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e",
  checked_at:"2026-11-12T14:00:00Z",read_only:true,automatic_core_write:false,
  records:[candidate(636),candidate(631),{...candidate(622),classification:"known_source"}]};
const approve={kind:"pull_request",external_key:"636",decision:"approve",workstream_code:"NUC-M4",
 confirmed_source_url:root+"pull/636",reviewer_reference:"review-ticket-M4-636",
 review_note:"Conferida no mapa da M4 e no GitHub."};
const reject={kind:"pull_request",external_key:"631",decision:"reject",review_note:"Pertence ao módulo de saúde, não ao Núcleo."};
const decisions=d=>({schema_version:"nucleo-m4-manual-decisions-v1",decisions:d});
const good=review(discovery,decisions([approve,reject]));
assert.deepEqual(good.counts,{approved:1,rejected:1,unreviewed:0});
assert.equal(good.decisions[0].state,"pending_independent_reconciliation");
assert.equal(good.automatic_core_write,false);
assert.throws(()=>review(discovery,decisions([approve,approve])),/Duplicate decision/);
assert.throws(()=>review(discovery,decisions([{...approve,workstream_code:"HEALTH"}])),/Unknown workstream/);
assert.throws(()=>review(discovery,decisions([{...approve,confirmed_source_url:root+"pull/631"}])),/URL not confirmed/);
assert.throws(()=>review(discovery,decisions([{...approve,external_key:"622",confirmed_source_url:root+"pull/622"}])),/Already mapped/);
assert.throws(()=>review(discovery,decisions([{...approve,external_key:"999",confirmed_source_url:root+"pull/999"}])),/absent from discovery/);
assert.throws(()=>review(discovery,decisions([{...approve,review_note:"short"}])),/substantive note/);
assert.throws(()=>review({...discovery,automatic_core_write:true},decisions([approve])),/Invalid discovery/);
assert.throws(()=>review({...discovery,records:[...discovery.records,candidate(636)]},decisions([approve])),/Duplicate discovery/);
const unapproved={...discovery,records:[candidate(636,"open"),candidate(631)]};
assert.throws(()=>review(unapproved,decisions([approve])),/not in approved technical state/);
console.log("M4 assignment: 10 scenarios PASS; no Core writes and no automatic attribution.");
