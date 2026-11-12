import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdaoScopedIntake} from '../src/shopee-adao-automatic-intake.mjs';
import {createAdaoF12CanonicalSliceWriter} from '../src/shopee-adao-f12-canonical-slice-writer.mjs';
import {F12_3_SCOPE} from '../src/shopee-adao-resumable-discovery.mjs';

// Real production canonical normalizer/mapping/projection/contract pipeline;
// all sources and the final persistence are synthetic fakes. No network.
const SN='SYNTHETICF12ADAO1';
const ACCOUNT=F12_3_SCOPE.account;
const MARKET='SHOPEE ADAO';
function rawSnapshot(){
  return {
    source:'shopee_open_platform',environment:'live',
    channel_account_id:ACCOUNT,external_entity_type:'order',
    external_entity_id:SN,endpoint:'/api/v2/order/get_order_detail',
    observed_at:'2026-11-12T18:00:00.000Z',
    created_at:'2026-11-12T18:00:00.000Z',
    payload:{response:{order_list:[{
      order_sn:SN,order_status:'PROCESSED',
      create_time:1794506400,total_amount:20.21,payment_method:'Pix',
      item_list:[{
        item_id:'23298665306',model_id:'0',
        item_name:'Alfajor 60g - Kit com 6 UNI. | SH-002-015',
        model_name:'',item_sku:'',model_sku:'',
        model_quantity_purchased:1,
        model_original_price:20.21,model_discounted_price:20.21,
      }],
    }]}},
  };
}
const mapping={
  id:'ea54687e-cab8-481c-9b6f-cfd692f3c849',
  marketplace:'shopee',marketplace_account:MARKET,
  external_item_key:'code:SH-002-015|variation:',
  product_id:'62cf9f63-be04-4261-ad11-569028dd1125',
  variant_id:'d89e1dba-ca80-4136-b9f3-225fb80b6dfb',
  physical_multiplier:3,channel_account_id:ACCOUNT,
  components:[
    {product_id:'62cf9f63-be04-4261-ad11-569028dd1125',
      variant_id:'d89e1dba-ca80-4136-b9f3-225fb80b6dfb',
      physical_multiplier:3,physical_identity:{active:true,unit:'un',presentation_factors:[3]},position:0},
    {product_id:'62cf9f63-be04-4261-ad11-569028dd1125',
      variant_id:'e4d756c8-f324-4ac0-b9ff-6adae24f5310',
      physical_multiplier:3,physical_identity:{active:true,unit:'un',presentation_factors:[3]},position:1},
  ],
};
function batch(overrides={}){
  return {status:'ok',action:'shopee.order_intake_batch.read',
    channel_account_id:ACCOUNT,marketplace_account:MARKET,
    eligible_statuses:['PROCESSED','READY_TO_SHIP'],
    snapshots:[rawSnapshot()],mappings:[mapping],
    counts:{selected:1,skipped_existing:0,skipped_status:0,skipped_malformed:0},
    ...overrides};
}

test('F12.3 exercises real canonical normalization/mapping/projection/writer with mock Core',async()=>{
  const calls={reads:[],writes:[],acks:0};
  const intake=createAdaoScopedIntake(async (args,opts)=>{
    calls.reads.push({args,opts});return {ok:true,payload:batch()};
  },async (contract,opts)=>{
    calls.writes.push({contract,opts});
    return {ok:true,payload:{order_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',already_registered:false}};
  });
  const run=createAdaoF12CanonicalSliceWriter({
    enabled:true,now:()=>1000,
    resume:async()=>({ok:true,payload:{status:'resumed',
      lease_id:'99999999-9999-4999-8999-999999999999',
      generation:1,staged_pages:[[SN]],completed:true}}),
    intake,
    acknowledge:async()=>{calls.acks++;return {ok:true,payload:{status:'acknowledged',reconciled:1}};},
  });
  const result=await run({commit:true});
  assert.deepEqual(result,{
    ok:true,code:'f12_slice_canonically_reconciled',processed:1,
    written:1,already_registered:0,verified_filtered_by_core:0,completed:true,
  });
  assert.deepEqual(calls.reads,[{
    args:{channel_account_id:ACCOUNT,limit:1,order_sn:SN},
    opts:{timeoutMs:12000},
  }]);
  assert.equal(calls.writes.length,1);
  assert.deepEqual(calls.writes[0].opts,{verifyExisting:true});
  assert.equal(calls.writes[0].contract.order.channelAccountId,ACCOUNT);
  assert.equal(calls.writes[0].contract.order.saleOrigin,'shopee_open_platform');
  assert.equal(calls.writes[0].contract.order.operationalStatus,'todo');
  assert.equal(calls.writes[0].contract.effects.stockAction,null);
  assert.equal(calls.writes[0].contract.effects.financialAction,null);
  assert.equal(calls.acks,1);
});

test('F12.3 mapping failure remains staged and never invokes the canonical writer or ACK',async()=>{
  let writes=0,acks=0;
  const intake=createAdaoScopedIntake(async()=>({ok:true,payload:batch({mappings:[]})}),
    async()=>{writes++;throw Error('mapping failure must not write');});
  const run=createAdaoF12CanonicalSliceWriter({
    enabled:true,now:()=>1000,
    resume:async()=>({ok:true,payload:{status:'resumed',
      lease_id:'99999999-9999-4999-8999-999999999999',
      generation:1,staged_pages:[[SN]],completed:false}}),
    intake,
    acknowledge:async()=>{acks++;throw Error('mapping failure must not ACK');},
  });
  const r=await run({commit:true});
  assert.equal(r.code,'f12_writer_requires_review');
  assert.equal(writes,0);
  assert.equal(acks,0);
});
