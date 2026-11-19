#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {NUC,ROLE,SPEC,mayReadContext}=require("./nucleo-f1-read-scope-model.cjs");
const identity={authUid:"actor-A",anonymous:false,sessionActive:true,now:"2026-11-19T21:00:00Z"};
const assignment={authUid:"actor-A",moduleId:NUC,specialtyId:SPEC,role:ROLE,action:"read_context",active:true,revokedAt:null,validFrom:"2026-11-18T00:00:00Z",validUntil:null};
const context={identity,grants:[],assignments:[assignment],moduleId:NUC,specialtyId:SPEC,role:ROLE};
assert.equal(mayReadContext(context),true,"read_context assignment grants only matching specialist context");
assert.equal(mayReadContext({...context,assignments:[]}),false,"no assignment fails closed");
assert.equal(mayReadContext({...context,identity:{...identity,authUid:"actor-B"}}),false,"user isolation");
assert.equal(mayReadContext({...context,moduleId:"CRM"}),false,"cross module");
assert.equal(mayReadContext({...context,specialtyId:"security-review"}),false,"cross specialty");
assert.equal(mayReadContext({...context,role:"Admin"}),false,"cross role");
assert.equal(mayReadContext({...context,identity:{...identity,anonymous:true}}),false,"anonymous auth is not authorization");
assert.equal(mayReadContext({...context,identity:{...identity,sessionActive:false}}),false,"revoked session");
assert.equal(mayReadContext({...context,assignments:[{...assignment,active:false}]}),false,"inactive");
assert.equal(mayReadContext({...context,assignments:[{...assignment,revokedAt:"2026-11-19T20:00:00Z"}]}),false,"revoked assignment");
assert.equal(mayReadContext({...context,assignments:[{...assignment,validUntil:"2026-11-19T20:00:00Z"}]}),false,"expired");
assert.equal(mayReadContext({...context,assignments:[{...assignment,validFrom:"2026-11-20T00:00:00Z"}]}),false,"future-dated");
assert.equal(mayReadContext({...context,assignments:[{...assignment,action:"write_document"}]}),false,"write is never read");
assert.equal(mayReadContext({...context,grants:[{authUid:"actor-A",capability:"nucleo_manage",active:true,revokedAt:null}],assignments:[]}),true,"existing owner remains compatible");
assert.equal(mayReadContext({...context,grants:[{authUid:"actor-B",capability:"nucleo_manage",active:true,revokedAt:null}],assignments:[]}),false,"admin role not inherited");
// Existing production endpoint must not be silently relaxed in F1 research.
const live=fs.readFileSync("supabase/functions/nucleo-ac02-context-read/index.ts","utf8");
assert.match(live,/\.eq\("capability","nucleo_manage"\)/);
assert.match(live,/\.auth\.getUser\(token\)/);
assert.doesNotMatch(live,/SUPABASE_SERVICE_ROLE/);
console.log("PASS F1 isolated authorization matrix (15 cases): no production RLS/grant changes");
