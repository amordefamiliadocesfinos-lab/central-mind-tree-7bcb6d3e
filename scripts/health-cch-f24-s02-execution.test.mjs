import test from "node:test";
import assert from "node:assert/strict";
import {assessF24ExecutionSignal as assess} from "../src/modules/health/cch/executionEvidence.ts";
const row=(id,patch={})=>({id,status:"completed",set_type:"working",reps:7,rir:1,load_value:40,load_unit:"kg",...patch});
test("two measured sets below rep range, priority over RIR",()=>assert.equal(assess([row("a"),row("b")],8,2),"below_reps"));
test("reps in range but RIR below target",()=>assert.equal(assess([row("a",{reps:9}),row("b",{reps:10})],8,2),"below_rir"));
test("no unsupported signal with changing weight, unit, duplicate, missing measurement or only one set",()=>{
 for(const rows of [[row("a"),row("a")],[row("a"),row("b",{load_unit:"lb"})],[row("a"),row("b",{load_value:50})],[row("a"),row("b",{load_value:null})],[row("a"),row("b",{status:"planned"})],[row("a"),row("b",{set_type:"warmup"})],[row("a",{reps:null,rir:null}),row("b")]])assert.equal(assess(rows,8,2),null);
});
test("in range and no explicit target do not generate an alert",()=>{
 assert.equal(assess([row("a",{reps:8,rir:2}),row("b",{reps:10,rir:3})],8,2),null);
 assert.equal(assess([row("a"),row("b")],null,null),null);
});
