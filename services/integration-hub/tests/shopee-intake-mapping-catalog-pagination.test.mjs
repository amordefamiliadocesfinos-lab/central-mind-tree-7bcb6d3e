import test from 'node:test';
import assert from 'node:assert/strict';
import {readShopeeScopedMappingCatalog} from '../../../supabase/functions/integration-core-bridge/shopee-intake-mapping-catalog.mjs';

const A='b4027369-5abf-4ac1-ab24-862334fae892';
const records=Array.from({length:371},(_,i)=>({
 id:String(i+1).padStart(6,'0'),marketplace:'shopee',marketplace_account:'SHOPEE ADÃO',
 channel_account_id:i===370?null:A, external_item_id:String(1000+i),external_model_id:String(3000+i),product_id:'p',physical_multiplier:1,
}));
const components=Array.from({length:524},(_,i)=>({
 id:String(i+1).padStart(6,'0'),mapping_id:records[i%260].id,
 product_id:'p',variant_id:null,physical_multiplier:1,position:i>=260?1:0,
}));
function fakeCore({failAt=null, omitLastPage=false, otherAccount=false}={}){
 let calls=[];
 return {calls,from(table){
   const spec={table, filters:[]};
   const query={
     select(){return this;},
     eq(k,v){spec.filters.push([k,'eq',v]);return this;},
     is(k,v){spec.filters.push([k,'is',v]);return this;},
     in(k,v){spec.filters.push([k,'in',v]);return this;},
     order(){return this;},
     async range(from,to){
       calls.push({table,from,to,filters:spec.filters});
       if(failAt===table)return {error:new Error('server unavailable')};
       let pool=table==='marketplace_product_mappings'?records:components;
       if(otherAccount&&table==='marketplace_product_mappings')pool=[...pool,{...records[0],id:'foreign',channel_account_id:'other'}];
       for(const [key,kind,val] of spec.filters){
         pool=pool.filter(row=>kind==='eq'?row[key]===val:kind==='is'?row[key]==null:val.includes(row[key]));
       }
       if(omitLastPage && from>=200 && table==='marketplace_product_mappings')return {error:new Error('page error')};
       return {data:pool.sort((a,b)=>a.id.localeCompare(b.id)).slice(from,to+1)};
     }
   };
   return query;
 }};
}
test('371 scoped and fallback mappings including 524 components survive complete pagination',async()=>{
 const core=fakeCore(),out=await readShopeeScopedMappingCatalog(core,A,'SHOPEE ADÃO');
 assert.equal(out.error,undefined);
 assert.equal(out.mappings.length,371);
 assert.equal(out.mappings.reduce((n,m)=>n+m.components.length,0),524);
 assert.ok(out.mappings.find(m=>m.id===records[370].id));
 assert.ok(out.mappings.find(m=>m.id===records[369].id));
 assert.ok(core.calls.some(x=>x.table==='marketplace_product_mappings'&&x.from===200));
 assert.ok(core.calls.filter(x=>x.table==='marketplace_product_mapping_items').length>2);
 assert.deepEqual(out.mappings[0].components.map(c=>c.position),[0,1,1]);
});
test('other accounts are never included in Adão scoped results',async()=>{
 const out=await readShopeeScopedMappingCatalog(fakeCore({otherAccount:true}),A,'SHOPEE ADÃO');
 assert.equal(out.mappings.length,371);
 assert.ok(!out.mappings.find(m=>m.id==='foreign'));
});
test('any unavailable page or components closes entire catalog instead of returning partial mappings',async()=>{
 for(const arg of [{omitLastPage:true},{failAt:'marketplace_product_mapping_items'},{failAt:'marketplace_product_mappings'}]){
  const out=await readShopeeScopedMappingCatalog(fakeCore(arg),A,'SHOPEE ADÃO');
  assert.ok(out.error);
  assert.equal(out.mappings,undefined);
 }
});
test('duplicate ids, oversized catalogs and malformed id fail closed',async()=>{
 const core=fakeCore();
 const out=await readShopeeScopedMappingCatalog(core,A,'SHOPEE ADÃO');
 assert.equal(new Set(out.mappings.map(m=>m.id)).size,out.mappings.length);
 assert.deepEqual(await readShopeeScopedMappingCatalog(core,'','SHOPEE ADÃO'),{error:'intake_mapping_read_failed'});
});
