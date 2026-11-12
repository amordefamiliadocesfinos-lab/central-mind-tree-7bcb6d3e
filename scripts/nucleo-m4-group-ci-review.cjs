#!/usr/bin/env node
"use strict";
/**
 * Núcleo M4: agrupa CI por workflow para revisão. Não atribui frente, não
 * elimina histórico e não escreve no Core. Uma execução representativa não
 * implica conclusão; origem e SHA precisam ser conferidos novamente.
 */
const fs=require("node:fs");
const SCHEMA="nucleo-m4-ci-consolidation-v1";
function groupRuns(queue,core=[]) {
 if(!queue||queue.schema_version!=="nucleo-m4-prioritized-review-v1"||
    queue.read_only!==true||queue.automatic_core_write!==false||
    !Array.isArray(queue.items)||!Array.isArray(core))throw Error("Invalid input contract");
 const existing=new Set(core.filter(x=>x&&x.source==="github"&&x.kind==="workflow_run")
   .map(x=>String(x.external_key)));
 const groups=new Map();
 for(const item of queue.items) {
  if(item.kind!=="workflow_run"||item.queue!=="revisao_prioritaria")continue;
  if(!/^[0-9]+$/.test(String(item.external_key))||
      item.source_status!=="success"||!item.source_title)throw Error("Invalid CI source");
  const name=item.source_title;
  if(!groups.has(name))groups.set(name,[]);
  groups.get(name).push(item);
 }
 const list=[...groups].map(([name,items])=>{
   items.sort((a,b)=>BigInt(b.external_key)>BigInt(a.external_key)?1:BigInt(b.external_key)<BigInt(a.external_key)?-1:0);
   const ids=items.map(x=>String(x.external_key));
   if(new Set(ids).size!==ids.length)throw Error("Duplicate workflow run ID");
   const representative=items[0];
   return {
     workflow:name,total_runs:items.length,
     representative_id:representative.external_key,
     representative_url:representative.reference_url,
     representative_source_status:representative.source_status,
     representative_in_core:existing.has(String(representative.external_key)),
     runs_in_core:ids.filter(x=>existing.has(x)).length,
     all_run_ids:ids,
     requires_source_review:true,proposed_workstream_code:null,
     core_write_allowed:false,
     caveat:"Representante é a execução mais recente do grupo, não comprova aprovação da frente.",
   };
 }).sort((a,b)=>b.total_runs-a.total_runs||a.workflow.localeCompare(b.workflow));
 const total=list.reduce((sum,g)=>sum+g.total_runs,0);
 return {schema_version:SCHEMA,read_only:true,automatic_core_write:false,
   requires_human_review:true,source_checked_at:queue.source_checked_at,
   groups:list,counts:{workflows:list.length,runs:total,
     known_in_core:list.reduce((s,g)=>s+g.runs_in_core,0),
     representative_candidates:list.filter(g=>!g.representative_in_core).length},
   caveats:["Não suprimir o histórico original: IDs completos preservados em all_run_ids.",
     "A associação com M0–M5 exige decisão e reconciliação independente.",
     "Somente execuções 'success' priorizadas são agrupadas; falhas ficam na fila original.",
     "Nenhum status, evidência ou documento do Núcleo é alterado."],
 };
}
if(require.main===module){
 try{
 const [queueFile,coreFile,outFile]=process.argv.slice(2);
 if(!queueFile||!coreFile||!outFile)throw Error("Usage: group.cjs queue.json core-metadata.json output.json");
 const report=groupRuns(JSON.parse(fs.readFileSync(queueFile,"utf8")),
   JSON.parse(fs.readFileSync(coreFile,"utf8")));
 fs.writeFileSync(outFile,JSON.stringify(report,null,2)+"\n");
 console.log("M4 CI grouped:",JSON.stringify(report.counts),"read-only");
 }catch(e){console.error("M4 grouping blocked:",e.message);process.exitCode=1;}
}
module.exports={groupRuns};
