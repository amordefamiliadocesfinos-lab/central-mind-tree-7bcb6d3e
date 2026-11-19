import test from "node:test";import assert from "node:assert/strict";
import {eligibleMachineLoad} from "../.tmp-health-cch-v8/equipmentEvidence.js";
test("confirmed matching machine proposes only a candidate",()=>assert.equal(eligibleMachineLoad(3,80,80,8,10,2,2.5,true,true),82.5));
test("another machine never inherits load history",()=>assert.equal(eligibleMachineLoad(3,80,80,8,10,2,2.5,false,true),null));
test("missing increment never creates kg",()=>assert.equal(eligibleMachineLoad(3,80,80,8,10,2,null,true,true),null));
test("two exposures do not establish progression",()=>assert.equal(eligibleMachineLoad(2,80,80,8,10,2,2.5,true,true),null));
test("decline or low RIR blocks escalation",()=>{
 assert.equal(eligibleMachineLoad(3,80,80,10,8,2,2.5,true,true),null);
 assert.equal(eligibleMachineLoad(3,80,80,8,10,0,2.5,true,true),null);
});
