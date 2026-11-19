#!/usr/bin/env node
"use strict";
/**
 * Núcleo 2.0 V1.1 — F2: prova puramente em memória, SEM migração ou
 * persistência. Identificadores abaixo são sintéticos e não são mandatos.
 */
const assert=require("node:assert/strict");
const NUC="NUC",CRM="CRM";
function makeRegistry(){
 const modules=new Set([NUC,CRM]);
 const specialties=new Map();
 const instances=new Map();
 const links=new Map();
 const key=(specialty,module,instance,front)=>[specialty,module??"-",instance,front??"-"].join("|");
 function registerSpecialty(input){
  assert(input&&typeof input.id==="string"&&/^[a-z][a-z0-9-]{2,}$/.test(input.id));
  assert(!specialties.has(input.id),"specialty stable identity is unique");
  assert(input.generalMethod&&input.generalMethod.version&&input.generalMethod.source,"general method requires provenance");
  specialties.set(input.id,structuredClone(input));
 }
 function registerInstance(input){
  assert(input&&input.id&&input.role);
  assert(!instances.has(input.id),"instance identity is unique");
  // An instance in this fixture does not imply a real human identity.
  instances.set(input.id,structuredClone(input));
 }
 function link({specialtyId,moduleCode,instanceId,frontCode=null,role,contextMethod=null,authority="none"}){
  assert(specialties.has(specialtyId),"specialty must exist");
  assert(instances.has(instanceId),"instance must exist");
  assert(moduleCode===null||modules.has(moduleCode),"known module or null context");
  assert(frontCode===null||(moduleCode!==null&&frontCode.startsWith(moduleCode+"-")),"front must belong to module context");
  assert(role==="primary"||role==="collaborator","explicit responsibility required");
  assert(authority==="none","F2 fixture never infers mandate or grants");
  if(contextMethod)assert(contextMethod.source&&contextMethod.version,"context method requires independent provenance");
  const id=key(specialtyId,moduleCode,instanceId,frontCode);
  assert(!links.has(id),"no duplicate associations");
  links.set(id,{specialtyId,moduleCode,instanceId,frontCode,role,
   contextMethod:contextMethod?structuredClone(contextMethod):null,
   authority:"none"});
  return id;
 }
 function assume(oldInstanceId,newInstanceId){
  assert(instances.has(oldInstanceId)&&instances.has(newInstanceId));
  // Only knowledge relations can be considered; runtime identity/mandate never transfers.
  return [...links.values()].filter(v=>v.instanceId===oldInstanceId).map(v=>({
   specialtyId:v.specialtyId,moduleCode:v.moduleCode,frontCode:v.frontCode,
   generalMethod:structuredClone(specialties.get(v.specialtyId).generalMethod),
   contextMethod:v.contextMethod?structuredClone(v.contextMethod):null,
   inheritedSession:false,inheritedMandate:false,inheritedGrant:false,
   successorId:newInstanceId,acceptance:"not_proven",
  }));
 }
 return {modules,specialties,instances,links,registerSpecialty,registerInstance,link,assume};
}
const r=makeRegistry();
r.registerSpecialty({id:"gov-nuc",name:"Governança e Continuidade",generalMethod:{source:"synthetic://map/f2",version:"test-1"}});
r.registerSpecialty({id:"security-review",name:"Revisão de Segurança",generalMethod:{source:"synthetic://method/security",version:"test-1"}});
r.registerSpecialty({id:"ux-review",name:"Revisão UX",generalMethod:{source:"synthetic://method/ux",version:"test-1"}});
for(const [id,role] of [["actor-a","Governança"],["actor-b","Segurança"],["actor-c","UX"],["actor-successor","Sucessor sintético"]]){
 r.registerInstance({id,role,synthetic:true});
}
r.link({specialtyId:"gov-nuc",moduleCode:NUC,instanceId:"actor-a",role:"primary",frontCode:"NUC-M3",contextMethod:{source:"synthetic://nuc/adaptation",version:"test-1"}});
r.link({specialtyId:"security-review",moduleCode:NUC,instanceId:"actor-b",role:"collaborator",frontCode:"NUC-M3"});
r.link({specialtyId:"ux-review",moduleCode:NUC,instanceId:"actor-c",role:"collaborator",frontCode:"NUC-M3"});
r.link({specialtyId:"gov-nuc",moduleCode:CRM,instanceId:"actor-a",role:"primary",frontCode:"CRM-M3",contextMethod:{source:"synthetic://crm/adaptation",version:"test-2"}});
assert.equal(r.modules.size,2,"no modules created for specialists");
assert.equal(new Set([...r.links.values()].filter(x=>x.moduleCode===NUC).map(x=>x.instanceId)).size,3,"three distinct roles/instances in same module");
assert.equal(new Set([...r.links.values()].filter(x=>x.specialtyId==="gov-nuc").map(x=>x.moduleCode)).size,2,"same specialty in two modules");
assert.notDeepEqual([...r.links.values()].find(x=>x.moduleCode===NUC&&x.specialtyId==="gov-nuc").contextMethod,
 [...r.links.values()].find(x=>x.moduleCode===CRM&&x.specialtyId==="gov-nuc").contextMethod,
 "context methods are distinct");
assert.equal(r.specialties.get("gov-nuc").generalMethod.version,"test-1");
assert.throws(()=>r.link({specialtyId:"gov-nuc",moduleCode:NUC,instanceId:"actor-a",role:"primary",frontCode:"NUC-M3"}),/duplicate/);
assert.throws(()=>r.link({specialtyId:"unknown",moduleCode:NUC,instanceId:"actor-b",role:"primary"}),/specialty/);
assert.throws(()=>r.link({specialtyId:"gov-nuc",moduleCode:"FAKE",instanceId:"actor-b",role:"primary"}),/module/);
assert.throws(()=>r.link({specialtyId:"gov-nuc",moduleCode:NUC,instanceId:"actor-b",role:"primary",frontCode:"CRM-M3"}),/front/);
assert.throws(()=>r.link({specialtyId:"gov-nuc",moduleCode:NUC,instanceId:"actor-b",role:"primary",authority:"granted"}),/mandate/);
const succession=r.assume("actor-a","actor-successor");
assert.equal(succession.length,2);
assert(succession.every(x=>x.inheritedSession===false&&x.inheritedMandate===false&&x.inheritedGrant===false&&x.acceptance==="not_proven"));
assert([...r.links.values()].every(x=>x.instanceId!=="actor-successor"),"successor has no implicit link");
console.log("PASS F2 simulated model: 3 instances in 1 module; 1 specialty in 2 modules; method segregation, provenance, uniqueness, negative guards, no mandate inheritance");
