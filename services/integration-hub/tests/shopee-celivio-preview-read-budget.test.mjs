import test from 'node:test';
import assert from 'node:assert/strict';
import {
 CELIVIO_PREVIEW_BATCH_READ_TIMEOUT_MS,
 createCelivioPreviewBatchReader,createCelivioPreview
} from '../src/shopee-celivio-preview-read-budget.mjs';
import {handleRequest} from '../src/app.mjs';
import {CELIVIO_C4C_ACCOUNT_ID} from '../src/shopee-celivio-c4c-preflight.mjs';

const OTHER='b4027369-5abf-4ac1-ab24-862334fae892';

test('Celivio-only Core read budget is 12 seconds and strictly account-scoped',async()=>{
 const calls=[];
 const reader=createCelivioPreviewBatchReader(async (data,opts)=>{
  calls.push({data,opts});return {ok:false,status:503};
 });
 assert.equal(CELIVIO_PREVIEW_BATCH_READ_TIMEOUT_MS,12000);
 const data={channel_account_id:CELIVIO_C4C_ACCOUNT_ID,limit:5};
 assert.equal((await reader(data)).status,503);
 assert.deepEqual(calls,[{data,opts:{timeoutMs:12000}}]);
 assert.equal((await reader({...data,channel_account_id:OTHER})).status,409);
 assert.equal(calls.length,1);
});

test('Celivio wrapper refuses commit and foreign account before reading Core',async()=>{
 let count=0;
 const run=createCelivioPreview({readBatch:async()=>{
  count++;return {ok:false,status:503};
 }});
 const bad=await run({channelAccountId:CELIVIO_C4C_ACCOUNT_ID,mode:'commit'});
 assert.equal(bad.ok,false);assert.equal(bad.written,0);
 const cross=await run({channelAccountId:OTHER,mode:'preview'});
 assert.equal(cross.ok,false);assert.equal(cross.written,0);
 assert.equal(count,0);
 const good=await run({channelAccountId:CELIVIO_C4C_ACCOUNT_ID,mode:'preview'});
 assert.equal(good.ok,false);assert.equal(good.written,0);
 assert.equal(count,1);
});

test('existing preview route chooses Celivio reader only for Celivio, keeping shared route for other accounts',async()=>{
 const counts={celivio:0,shared:0};
 const response=async account=>handleRequest(
  {path:'/internal/shopee/live/orders/intake/preview',method:'POST'},
  {handleShopeeLive:async()=>null,
   getEnv:key=>key==='SHOPEE_LIVE_CHANNEL_ACCOUNT_ID'?account:undefined,
   runCelivioReadOnlyPreview:async data=>{
    counts.celivio++;
    assert.equal(data.mode,'preview');
    return {ok:true,marketplaceAccount:'SHOPEE CELIVIO',selected:0,ready:0,blocked:0,written:0,results:[]};
   },
   runShopeePreview:async data=>{
    counts.shared++;
    assert.equal(data.mode,'preview');
    return {ok:true,marketplaceAccount:'OTHER',selected:0,ready:0,blocked:0,written:0,results:[]};
   }
  });
 const c=await response(CELIVIO_C4C_ACCOUNT_ID);
 assert.equal(c.status,200);
 assert.equal(JSON.parse(c.body).written,0);
 const o=await response(OTHER);
 assert.equal(o.status,200);
 assert.equal(JSON.parse(o.body).written,0);
 assert.deepEqual(counts,{celivio:1,shared:1});
});
