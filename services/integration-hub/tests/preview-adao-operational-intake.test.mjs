import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ADAO } from '../src/read-adao-orders.mjs';
import { CORE_BRIDGE_URL } from '../src/core-bridge.mjs';
import { previewAdaoOperationalIntake } from '../src/preview-adao-operational-intake.mjs';

const ACCOUNT = 'SHOPEE ADÃO';
const ALF = '62cf9f63-be04-4261-ad11-569028dd1125';
const TRF = '141908ce-a550-47c6-b19a-095cd3ee18e7';
const mixes = [
  '962731b8-d5b8-4fcb-acd9-981965d6bcc4',
  'efeadaea-134f-4e4b-af53-7bfa1a7136f4',
  '38b34351-1ca3-4920-9e1a-acfa936c3328',
  '9318d443-28ac-4a5e-af15-6ea3928d7216',
  '576e93dc-0076-44e2-8570-7e9bca4bdde8',
  '4395896e-833a-494c-a4ce-9784f3f2aa22',
];
const identity = { active: true, unit: 'un', presentation_factors: [30] };
const comp = (product_id,variant_id,physical_multiplier,position) => ({
  product_id,variant_id,physical_multiplier,position,physical_identity: identity,
});
function mapping(itemKey,productId,parts) {
  return {
    id: itemKey,
    marketplace: 'shopee', marketplace_account: ACCOUNT,
    channel_account_id: ADAO.channel_account_id, external_item_key: itemKey,
    product_id: productId, variant_id: parts[0].variant_id,
    physical_multiplier: parts[0].physical_multiplier,
    physical_identity: identity, components: parts,
  };
}
const mappings = [
  mapping('code:SH-001-014|variation:', ALF, [
    comp(ALF,'d89e1dba-ca80-4136-b9f3-225fb80b6dfb',9,0),
    comp(ALF,'e4d756c8-f324-4ac0-b9ff-6adae24f5310',9,1),
  ]),
  mapping('code:SH-001-039|variation:',TRF,mixes.map((v,i)=>comp(TRF,v,5,i))),
];
function snapshot(sn,code,qty,skuId) {
  const title = code==='SH-001-014'
    ? 'Alfajor 60g Caixa com 18 Unidades Amor de Família SH-001-014'
    : 'Trufa 40g Kit 30 Unidades Amor de Família SH-001-039';
  return {
    source:'shopee_open_platform',environment:'live',
    channel_account_id:ADAO.channel_account_id,
    external_entity_type:'order',external_entity_id:sn,
    endpoint:'/api/v2/order/get_order_detail',
    observed_at:'2026-10-23T21:34:10.000Z',
    payload:{response:{order_list:[{
      order_sn:sn,order_status:'PROCESSED',
      create_time:1792788500,total_amount:55,payment_method:'Pix',
      recipient_address:{name:'PRIVATE NAME',phone:'PRIVATE PHONE'},
      item_list:[{
        item_id:skuId,model_id:0,item_name:title,model_name:'',
        item_sku:'',model_sku:'',model_quantity_purchased:qty,
        model_original_price:55,model_discounted_price:55,
      }],
    }]}},
  };
}
const body = {
  status:'ok',action:'shopee.order_intake_batch.read',
  channel_account_id:ADAO.channel_account_id,marketplace_account:ACCOUNT,
  eligible_statuses:['PROCESSED','READY_TO_SHIP'],
  snapshots:[
    snapshot('261023C0CDYM5H','SH-001-014',1,'18599184676'),
    snapshot('261023DJN3D920','SH-001-014',1,'18599184676'),
    snapshot('261024DXMHCM13','SH-001-039',2,'22193668881'),
  ],
  mappings,counts:{selected:3,skipped_existing:0,skipped_status:1,skipped_malformed:0},
};
const secret='fixture-secret-only';
function transport(payload=body) {
  const calls=[];
  const fetchImpl=async (input,init)=>{
    assert.equal(new URL(input).href,CORE_BRIDGE_URL);
    assert.equal(init.method,'POST');
    assert.equal(init.redirect,'error');
    const req=JSON.parse(init.body);
    assert.deepEqual(req,{
      action:'shopee.order_intake_batch.read',
      channel_account_id:ADAO.channel_account_id,limit:5,
    });
    calls.push(req);
    return new Response(JSON.stringify({
      ...payload,request_id:init.headers['X-Integration-Hub-Request-Id'],
    }),{status:200,headers:{'content-type':'application/json'}});
  };
  return {calls,fetchImpl};
}

test('F6-Q.6B: Adão Core preview returns 3 real-shape orders ready, no writes',async()=>{
  const {calls,fetchImpl}=transport();
  const result=await previewAdaoOperationalIntake({
    env:{CORE_BRIDGE_HMAC_SECRET:secret},fetchImpl,
  });
  assert.equal(result.ok,true);
  assert.equal(result.code,'preview_ready');
  assert.equal(result.mode,'preview');
  assert.equal(result.selected,3);
  assert.equal(result.ready,3);
  assert.equal(result.blocked,0);
  assert.equal(result.written,0);
  assert.equal(result.source_counts.skipped_status,1);
  assert.equal(result.results.length,3);
  assert.ok(result.results.every(r=>r.status==='ready' && r.blockers.length===0));
  assert.equal(calls.length,1);
  assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
  assert.equal(JSON.stringify(result).includes(secret),false);
});

test('F6-Q.6B: missing mapping for trufa blocks only its order',async()=>{
  const {fetchImpl}=transport({...body,mappings:[mappings[0]]});
  const result=await previewAdaoOperationalIntake({
    env:{CORE_BRIDGE_HMAC_SECRET:secret},fetchImpl,
  });
  assert.equal(result.ok,true);
  assert.equal(result.ready,2);
  assert.equal(result.blocked,1);
  assert.equal(result.written,0);
  assert.match(result.results[2].blockers[0],/mapping_needs_mapping/);
});

test('F6-Q.6B: invalid physical evidence blocks, rather than writing',async()=>{
  const bad={...mappings[1],components:mappings[1].components.map((c,i)=>
    i===2?{...c,physical_identity:{active:false,unit:'un',presentation_factors:[]}}:c)};
  const {fetchImpl}=transport({...body,mappings:[mappings[0],bad]});
  const result=await previewAdaoOperationalIntake({
    env:{CORE_BRIDGE_HMAC_SECRET:secret},fetchImpl,
  });
  assert.equal(result.ok,true);
  assert.equal(result.ready,2);
  assert.equal(result.blocked,1);
  assert.equal(result.written,0);
  assert.match(result.results[2].blockers[0],/mapping_physical_identity_unverified/);
});

test('F6-Q.6B: wrong account in Core response fails closed',async()=>{
  const {fetchImpl}=transport({...body,marketplace_account:'SHOPEE VIVIANE'});
  const result=await previewAdaoOperationalIntake({
    env:{CORE_BRIDGE_HMAC_SECRET:secret},fetchImpl,
  });
  assert.equal(result.ok,false);
  assert.equal(result.code,'preview_unavailable');
  assert.equal(result.written,0);
});

test('F6-Q.6B: missing Core secret prevents any network call',async()=>{
  let calls=0;
  const result=await previewAdaoOperationalIntake({
    env:{},fetchImpl:async()=>{calls++;throw new Error('forbidden');},
  });
  assert.equal(result.code,'configuration_missing');
  assert.equal(calls,0);
});

test('F6-Q.6B: transport fails closed without retry and cannot leak errors',async()=>{
  let calls=0;
  const result=await previewAdaoOperationalIntake({
    env:{CORE_BRIDGE_HMAC_SECRET:secret},
    fetchImpl:async()=>{calls++;throw new Error('PRIVATE TOKEN URL CUSTOMER');},
  });
  assert.equal(result.ok,false);
  assert.equal(result.written,0);
  assert.equal(calls,1);
  assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
});

test('F6-Q.6B: CLI refuses all modes except exactly --preview-adao',()=>{
  const script=fileURLToPath(new URL('../src/preview-adao-operational-intake.mjs',import.meta.url));
  for(const args of [[],['--commit'],['--preview-adao','--commit']]){
    const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{}});
    assert.equal(r.status,2);
    assert.match(r.stdout,/Usage/);
    assert.equal(r.stderr,'');
  }
});
