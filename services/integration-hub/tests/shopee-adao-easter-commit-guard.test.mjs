import test from 'node:test';
import assert from 'node:assert/strict';
import { shopeeAdaoEasterCommitBlocker, ADAO_CHANNEL_ACCOUNT_ID, ADAO_APPROVED_EASTER_INTAKE_PAIRS } from '../src/shopee-adao-easter-commit-guard.mjs';

const order = (items, channelAccountId=ADAO_CHANNEL_ACCOUNT_ID) => ({channelAccountId,orders:[{items}]});
const regular='1:2';
const easter='23093820401:209185750007,23893322483:179413652092';
const v8Old=[{itemId:'23093820401',modelId:'209185750008'},
  {itemId:'23893322483',modelId:'179413652089'},
  {itemId:'23893322483',modelId:'179413652090'},
  {itemId:'23893322483',modelId:'179413652091'}];

test('without explicit exact pairs Adão remains fail closed',()=>{
 assert.equal(shopeeAdaoEasterCommitBlocker(order([{itemId:'1',modelId:'2'}]),{approvedPairs:'',approvedEasterPairs:''}),'adao_pascoa_exclusion_not_proven');
 assert.equal(shopeeAdaoEasterCommitBlocker(order([{itemId:'1',modelId:'2'}]),{approvedPairs:'1:2,',approvedEasterPairs:''}),'adao_pascoa_exclusion_not_proven');
 assert.equal(shopeeAdaoEasterCommitBlocker(order([{itemId:'1',modelId:'2'}]),{approvedPairs:'1:2',approvedEasterPairs:'bad'}),'adao_pascoa_exclusion_not_proven');
 assert.equal(shopeeAdaoEasterCommitBlocker(order([{itemId:'1',modelId:'2'}]),{approvedPairs:'1:2,1:2',approvedEasterPairs:''}),'adao_pascoa_exclusion_not_proven');
});

test('regular Adão authorization remains independent of Easter',()=>{
 assert.equal(shopeeAdaoEasterCommitBlocker(order([{itemId:'1',modelId:'2'}]),{approvedPairs:regular} ),null);
 assert.equal(shopeeAdaoEasterCommitBlocker(order([{itemId:'1',modelId:'3'}]),{approvedPairs:regular}),'adao_pascoa_offer_not_approved_for_intake');
});

test('Páscoa can be explicitly eligible but never inferred from model or active listing',()=>{
 for(const model of [
   {itemId:'23093820401',modelId:'209185750007'},
   {itemId:'23893322483',modelId:'179413652092'},
 ]){
   assert.equal(shopeeAdaoEasterCommitBlocker(order([model]),{approvedPairs:regular,approvedEasterPairs:easter}),null);
   assert.equal(shopeeAdaoEasterCommitBlocker(order([model]),{approvedPairs:regular,approvedEasterPairs:''}),'adao_pascoa_offer_not_approved_for_intake');
 }
 for(const model of v8Old){
   assert.equal(shopeeAdaoEasterCommitBlocker(order([model]),{approvedPairs:regular,approvedEasterPairs:easter}),'adao_pascoa_offer_not_approved_for_intake');
 }
 assert.equal(shopeeAdaoEasterCommitBlocker(order([{itemId:'23893322483',modelId:'999999999'}]),{approvedEasterPairs:easter}),'adao_pascoa_offer_not_approved_for_intake');
});

test('mixed orders, wrong account and malformed identities are guarded',()=>{
 assert.equal(shopeeAdaoEasterCommitBlocker(order([{itemId:'1',modelId:'2'},{itemId:'23093820401',modelId:'209185750007'}]),{approvedPairs:regular,approvedEasterPairs:easter}),null);
 assert.equal(shopeeAdaoEasterCommitBlocker(order([{itemId:'1',modelId:'2'},{itemId:'23093820401',modelId:'209185750008'}]),{approvedPairs:regular,approvedEasterPairs:easter}),'adao_pascoa_offer_not_approved_for_intake');
 assert.equal(shopeeAdaoEasterCommitBlocker(order([{itemId:'23093820401',modelId:'209185750007'}],'another-account'),{approvedPairs:regular,approvedEasterPairs:easter}),null);
 assert.equal(shopeeAdaoEasterCommitBlocker(order([]),{approvedPairs:regular,approvedEasterPairs:easter}),'adao_pascoa_order_identity_unverified');
 assert.equal(shopeeAdaoEasterCommitBlocker(order([{itemId:'23093820401',modelId:null}]),{approvedEasterPairs:easter}),'adao_pascoa_offer_not_approved_for_intake');
 assert.equal(shopeeAdaoEasterCommitBlocker({channelAccountId:ADAO_CHANNEL_ACCOUNT_ID,orders:[]},{approvedEasterPairs:easter}),'adao_pascoa_order_identity_unverified');
});


test('Páscoa Adão approved 37-pair intake exact authorization includes valid 65g x100',()=>{
 assert.equal(ADAO_APPROVED_EASTER_INTAKE_PAIRS.length,37);
 assert.equal(new Set(ADAO_APPROVED_EASTER_INTAKE_PAIRS).size,37);
 assert.ok(ADAO_APPROVED_EASTER_INTAKE_PAIRS.includes('22298331606:199618170213'));
 assert.equal(new Set(ADAO_APPROVED_EASTER_INTAKE_PAIRS.map(pair=>pair.split(':')[0])).size,15);
 const models=ADAO_APPROVED_EASTER_INTAKE_PAIRS.map(pair=>{
   const [itemId,modelId]=pair.split(':');
   return {itemId,modelId};
 });
 const original=process.env.SHOPEE_ADAO_APPROVED_EASTER_MODEL_PAIRS;
 try{
   delete process.env.SHOPEE_ADAO_APPROVED_EASTER_MODEL_PAIRS;
   assert.equal(shopeeAdaoEasterCommitBlocker(order(models),{approvedPairs:regular}),null);
   for(const historical of v8Old){
     assert.equal(shopeeAdaoEasterCommitBlocker(order([historical]),{approvedPairs:regular}),
       'adao_pascoa_offer_not_approved_for_intake');
   }
   assert.equal(shopeeAdaoEasterCommitBlocker(order([{itemId:'22298331606',modelId:'999999999'}]),
     {approvedPairs:regular}),'adao_pascoa_offer_not_approved_for_intake');
   // Explicit config can still restrict the code allowlist where necessary.
   assert.equal(shopeeAdaoEasterCommitBlocker(order(models),
     {approvedPairs:regular,approvedEasterPairs:''}),'adao_pascoa_offer_not_approved_for_intake');
 }finally{
   if(original===undefined)delete process.env.SHOPEE_ADAO_APPROVED_EASTER_MODEL_PAIRS;
   else process.env.SHOPEE_ADAO_APPROVED_EASTER_MODEL_PAIRS=original;
 }
});
