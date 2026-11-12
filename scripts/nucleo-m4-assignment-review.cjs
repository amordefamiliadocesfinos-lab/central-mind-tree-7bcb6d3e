#!/usr/bin/env node
"use strict";
/**
 * M4 triagem: aplica DECISÕES EXPLÍCITAS do revisor sobre candidatos descobertos.
 * Este script apenas emite plano de atribuição, não manifesto de importação e
 * nunca usa API/credenciais do Core, GitHub ou Supabase.
 */
const fs=require("node:fs");
const ROOT="amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e";
const allowed=new Set(["NUC-M0","NUC-M1","NUC-M2","NUC-M3","NUC-M4","NUC-M5"]);
function review(discovery,decisions) {
 if(!discovery||discovery.schema_version!=="nucleo-m4-discovery-v1"||
    discovery.repository!==ROOT||discovery.read_only!==true||
    discovery.automatic_core_write!==false||!Array.isArray(discovery.records))
   throw Error("Invalid discovery source");
 if(!decisions||decisions.schema_version!=="nucleo-m4-manual-decisions-v1"||
    !Array.isArray(decisions.decisions))throw Error("Invalid review decisions");
 const source=new Map();
 for(const r of discovery.records) {
  const id=r.kind+"|"+r.external_key;
  if(source.has(id))throw Error("Duplicate discovery identity");
  source.set(id,r);
 }
 const seen=new Set(),out=[];
 for(const d of decisions.decisions) {
  if(!d||!["approve","reject"].includes(d.decision)||
     !["pull_request","workflow_run"].includes(d.kind)||
     !/^[0-9]+$/.test(String(d.external_key||""))||
     typeof d.review_note!=="string"||d.review_note.trim().length<12)
    throw Error("Decision requires kind, numeric ID and substantive note");
  const key=d.kind+"|"+d.external_key;
  if(seen.has(key))throw Error("Duplicate decision"); seen.add(key);
  const item=source.get(key);
  if(!item)throw Error("Decision absent from discovery");
  if(item.classification!=="unassigned_candidate")throw Error("Already mapped: cannot reassign here");
  if(d.decision==="approve" && !allowed.has(d.workstream_code))throw Error("Unknown workstream code");
  if(d.decision==="approve" && (!d.confirmed_source_url || d.confirmed_source_url!==item.reference_url))
    throw Error("Original URL not confirmed");
  if(d.decision==="approve" && !["merged","success"].includes(item.source_status))
    throw Error("Source not in approved technical state");
  if(d.decision==="approve" && typeof d.reviewer_reference!=="string")
    throw Error("Missing auditable reviewer reference");
  out.push({
   source:"github",kind:item.kind,external_key:String(item.external_key),
   source_url:item.reference_url,title:item.title,
   source_status:item.source_status,source_sha:item.source_sha,
   decision:d.decision,proposed_workstream_code:d.decision==="approve"?d.workstream_code:null,
   reviewer_reference:d.reviewer_reference||null,review_note:d.review_note,
   state:"pending_independent_reconciliation",
  });
 }
 return {schema_version:"nucleo-m4-assignment-review-v1",source_checked_at:discovery.checked_at,
  read_only:true,automatic_core_write:false,requires_human_review:true,
  decisions:out,counts:{approved:out.filter(x=>x.decision==="approve").length,
   rejected:out.filter(x=>x.decision==="reject").length,
   unreviewed:discovery.records.filter(r=>r.classification==="unassigned_candidate").length-out.length},
  caveat:"Decision metadata is not proof of authority. Validate reviewer outside this script, then run independent reconciliation; never auto-import.",
 };
}
if(require.main===module) {
 try {
  const [a,b,c]=process.argv.slice(2);
  if(!a||!b||!c)throw Error("Usage: review.cjs discovery.json decisions.json review-plan.json");
  const result=review(JSON.parse(fs.readFileSync(a,"utf8")),JSON.parse(fs.readFileSync(b,"utf8")));
  fs.writeFileSync(c,JSON.stringify(result,null,2)+"\n");
  console.log("M4 assignment review:",JSON.stringify(result.counts),"read-only");
 }catch(e){console.error("Assignment blocked:",e.message);process.exitCode=1;}
}
module.exports={review};
