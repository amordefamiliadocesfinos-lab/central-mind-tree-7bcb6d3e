import test from 'node:test';
import assert from 'node:assert/strict';
import {createShopeeControlledAutoIntake} from '../src/shopee-order-auto-intake.mjs';
import {R2_ORIGINAL_MODELS,R2_ADAO_ACCOUNT_ID} from '../src/shopee-r2-original-p4-contract.mjs';

function fixture([key, contract], q = 2) {
 const [item_id, model_id] = key.split('|');
 const order_sn = 'P4-FIXTURE-'+model_id;
 const snapshot = {
   source:'shopee_open_platform',environment:'live',
   channel_account_id:R2_ADAO_ACCOUNT_ID, external_entity_type:'order',
   external_entity_id:order_sn, endpoint:'/api/v2/order/get_order_detail',
   observed_at:'2026-11-05T15:00:00.000Z',created_at:'2026-11-05T15:00:00.000Z',
   payload:{response:{order_list:[{order_sn,order_status:'PROCESSED',create_time:1793880000,
    total_amount:30,payment_method:'Pix',item_list:[{
      item_id,model_id,item_name:'Official original',model_name:'',
      model_quantity_purchased:q, model_original_price:15,model_discounted_price:15,
      item_sku:'',model_sku:''
    }]}]}}
 };
 const mapping={
   id:'mapping-'+model_id,marketplace:'shopee',marketplace_account:'SHOPEE ADÃO',
   channel_account_id:R2_ADAO_ACCOUNT_ID,external_item_id:item_id,external_model_id:model_id,
   external_item_key:'official:item:'+item_id+'|model:'+model_id,
   product_id:contract.productId,variant_id:null,physical_multiplier:contract.modelGrams,
   components:[{product_id:contract.productId,variant_id:null,physical_multiplier:contract.modelGrams,
      physical_identity:{active:true,unit:'g',presentation_factors:[contract.presentationFactor]}}]
 };
 const batch={snapshots:[snapshot],mappings:[mapping],marketplace_account:'SHOPEE ADÃO',counts:{selected:1}};
 return {snapshot,mapping,batch,order_sn};
}

test('P4 exact-target COMMIT can reach only the canonical order writer for all seven; no stock effect in request',async()=>{
 for(const entry of Object.entries(R2_ORIGINAL_MODELS)){
   const {batch,order_sn}=fixture(entry), writes=[];
   const run=createShopeeControlledAutoIntake({
     readBatch:async()=>({ok:true,status:200,payload:batch}),
     persistOrder:async c=>{writes.push(c);return {ok:true,status:200,payload:{order_id:'synthetic',separation_id:'synthetic'}}}
   });
   const result=await run({channelAccountId:R2_ADAO_ACCOUNT_ID,limit:1,mode:'commit',expectedOrderSn:order_sn});
   assert.equal(result.selected,1,entry[0]);
   assert.equal(result.ready,1,entry[0]);
   assert.equal(result.written,1,entry[0]);
   assert.equal(writes.length,1,entry[0]);
   const c=writes[0], line=c.items[0], contract=entry[1];
   assert.equal(c.effects.stockAction,null);
   assert.equal(c.effects.productionOrderAction,null);
   assert.equal(c.effects.separationAction,'create_todo_record_with_order');
   assert.equal(line.commercialPresentationId,contract.presentationId);
   assert.equal(line.commercialQuantity,2*contract.unitsPerOffer);
   assert.equal(line.physicalMultiplier,contract.presentationFactor);
   assert.equal(line.quantity,2*contract.modelGrams);
   assert.ok(Math.abs(line.commercialQuantity*line.unitPrice-30)<0.000001);
 }
});

test('P4 broad commit remains blocked for seven, but targeted preview always stays read-only',async()=>{
 for(const entry of Object.entries(R2_ORIGINAL_MODELS)){
   const {batch,order_sn}=fixture(entry);
   const writes=[];
   const run=createShopeeControlledAutoIntake({
      readBatch:async()=>({ok:true,status:200,payload:batch}),
      persistOrder:async c=>{writes.push(c);throw Error('must not persist')}
   });
   const broad=await run({channelAccountId:R2_ADAO_ACCOUNT_ID,mode:'commit',limit:1});
   assert.equal(broad.written,0);
   assert.deepEqual(broad.results[0].blockers,['r2_original_requires_exact_commit_target']);
   const preview=await run({channelAccountId:R2_ADAO_ACCOUNT_ID,mode:'preview',limit:1,expectedOrderSn:order_sn});
   assert.equal(preview.ready,1);
   assert.equal(preview.written,0);
   assert.equal(writes.length,0);
 }
});

test('P4 mismatched official Model or wrong catalog physical contract is never authorized to write',async()=>{
 const entry=Object.entries(R2_ORIGINAL_MODELS)[0];
 for(const mutate of [
   x=>x.batch.snapshots[0].payload.response.order_list[0].item_list[0].model_id='unknown',
   x=>x.batch.mappings[0].components[0].physical_identity.active=false,
   x=>x.batch.mappings[0].components[0].physical_multiplier=1,
 ]) {
   const f=fixture(entry),writes=[];
   mutate(f);
   const run=createShopeeControlledAutoIntake({
     readBatch:async()=>({ok:true,status:200,payload:f.batch}),
     persistOrder:async c=>{writes.push(c);throw Error('must not persist')}
   });
   const result=await run({channelAccountId:R2_ADAO_ACCOUNT_ID,limit:1,mode:'commit',expectedOrderSn:f.order_sn});
   assert.equal(result.written,0);
   assert.equal(result.blocked,1);
   assert.equal(writes.length,0);
 }
});
