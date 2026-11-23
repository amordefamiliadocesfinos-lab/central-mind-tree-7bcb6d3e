import test from "node:test";
import assert from "node:assert/strict";
import {readE3BoundedPages} from "../.tmp-cch-e3b/e3Pagination.js";

const source=(count)=>Array.from({length:count},(_,i)=>({id:String(i).padStart(6,"0")}));
const fake=(rows,calls=[])=>async(from,to)=>{
 calls.push([from,to]);
 return {data:rows.slice(from,to+1),error:null};
};

test("paginated E3 read joins multiple API pages without losing or duplicating rows",async()=>{
 const calls=[];
 const result=await readE3BoundedPages(fake(source(850),calls),1000);
 assert.equal(result.rows.length,850);
 assert.equal(result.truncated,false);
 assert.equal(new Set(result.rows.map(x=>x.id)).size,850);
 assert.deepEqual(calls,[[0,399],[400,799],[800,1000]]);
});
test("exact page boundary is confirmed by an explicit empty look-ahead",async()=>{
 const calls=[];
 const result=await readE3BoundedPages(fake(source(800),calls),1000);
 assert.equal(result.rows.length,800);
 assert.equal(result.truncated,false);
 assert.deepEqual(calls,[[0,399],[400,799],[800,1000]]);
});
test("the exact configured maximum is complete only after an empty sentinel",async()=>{
 const calls=[];
 const result=await readE3BoundedPages(fake(source(1000),calls),1000);
 assert.equal(result.rows.length,1000);
 assert.equal(result.truncated,false);
 assert.deepEqual(calls.at(-1),[800,1000]);
});
test("one extra row beyond the cap fails closed",async()=>{
 const calls=[];
 const result=await readE3BoundedPages(fake(source(1001),calls),1000);
 assert.equal(result.rows.length,1000);
 assert.equal(result.truncated,true);
 assert.deepEqual(calls.at(-1),[800,1000]);
});
test("session cap 300 detects overflow regardless of default server cap",async()=>{
 const one=await readE3BoundedPages(fake(source(300)),300);
 const two=await readE3BoundedPages(fake(source(301)),300);
 assert.equal(one.truncated,false);
 assert.equal(two.truncated,true);
 assert.equal(two.rows.length,300);
});
test("page errors never become partial successful histories",async()=>{
 let n=0;
 await assert.rejects(()=>readE3BoundedPages(async(from,to)=>{
  n++;
  return n===2?{data:null,error:{message:"RLS refused"}}:
    {data:source(400),error:null};
 },1000),/RLS refused/);
});
test("unexpected null or oversized responses fail rather than silently truncate",async()=>{
 await assert.rejects(()=>readE3BoundedPages(async()=>({data:null,error:null}),100),/indisponível/);
 await assert.rejects(()=>readE3BoundedPages(async()=>({data:source(401),error:null}),1000),
  /excedeu/);
});
test("invalid bounds and page-size over provider cap are refused",async()=>{
 for(const [limit,page] of [[0,400],[100,1001],[NaN,100],[-1,50]]){
  await assert.rejects(()=>readE3BoundedPages(fake([]),limit,page),/inválidos/);
 }
});


const integrity={identity:row=>row.id,ordered:(a,b)=>a.id<b.id};
test("E4 detects offset shift when a new row duplicates an ID across pages",async()=>{
 const rows=source(9);
 let page=0;
 await assert.rejects(()=>readE3BoundedPages(async(from,to)=>{
  page++;
  if(page===1)return {data:rows.slice(from,to+1),error:null};
  const shifted=[{id:"000000"},...rows];
  return {data:shifted.slice(from,to+1),error:null};
 },12,5,integrity),/identificador repetido/);
});
test("E4 rejects an out-of-order row from a concurrent edit",async()=>{
 const rows=source(9);let page=0;
 await assert.rejects(()=>readE3BoundedPages(async(from,to)=>{
  page++;
  const data=rows.slice(from,to+1);
  if(page===2)data[0]={id:"000002"};
  return {data,error:null};
 },12,5,integrity),/identificador repetido|ordem das páginas/);
});
test("E4 stable records pass identity and order validation",async()=>{
 const result=await readE3BoundedPages(fake(source(8)),10,3,integrity);
 assert.equal(result.truncated,false);assert.equal(result.rows.length,8);
});
test("E4 rejects absent identity instead of treating it as complete history",async()=>{
 await assert.rejects(()=>readE3BoundedPages(fake([{id:""}]),10,3,integrity),
  /identificador repetido ou ausente/);
});


test("E4 revalidation detects a deletion that skips an ID without duplicate or order drift",async()=>{
 const original=source(9),changed=original.filter(x=>x.id!=="000001");
 let calls=0;
 const stable={...integrity,revalidatePages:true};
 await assert.rejects(()=>readE3BoundedPages(async(from,to)=>{
  calls++;
  // Initial pages are sorted and internally valid but deletion before offset
  // after first page makes the full observed sequence skip an ID.
  const data=(calls<=1?original:changed).slice(from,to+1);
  return {data,error:null};
 },12,5,stable),/dados mudaram durante a leitura/);
});
test("E4 revalidation detects a changed value under the same stable ID",async()=>{
 const original=source(8).map(x=>({...x,load:80}));
 let scan=0;
 await assert.rejects(()=>readE3BoundedPages(async(from,to)=>{
  scan++;
  const rows=original.slice(from,to+1).map(x=>({...x}));
  if(scan>2)rows.forEach(x=>{x.load=82;});
  return {data:rows,error:null};
 },10,5,{...integrity,revalidatePages:true}),/dados mudaram durante a leitura/);
});
test("E4 stable multiple pages pass revalidation and do not truncate",async()=>{
 const calls=[];
 const result=await readE3BoundedPages(fake(source(9),calls),12,4,
  {...integrity,revalidatePages:true});
 assert.equal(result.truncated,false);
 assert.deepEqual(result.rows,source(9));
 assert.ok(calls.length>3);
});
test("E4 a single page needs no second scan for cross-page drift",async()=>{
 const calls=[];
 const result=await readE3BoundedPages(fake(source(3),calls),10,4,
  {...integrity,revalidatePages:true});
 assert.deepEqual(result.rows,source(3));
 assert.equal(calls.length,1);
});
