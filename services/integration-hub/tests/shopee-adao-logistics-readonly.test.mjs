import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaoLogisticsReadOnly } from '../src/shopee-adao-logistics-readonly.mjs';

const SN='261027ABCDEF12';
const create = (overrides={}) => createAdaoLogisticsReadOnly({
  getEnv: name => ({ SHOPEE_LIVE_PARTNER_KEY:'partner-key', SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY:'encryption-key' })[name],
  now:()=>Date.parse('2026-10-26T16:00:00Z'),
  readConnection:async()=>({ok:true,payload:{shop_id:1156446003,partner_id:2047685,
    access_token_ciphertext:'cipher',access_token_expires_at:'2026-10-26T21:00:00Z'}}),
  decrypt:async()=> 'access',
  ...overrides,
});
test('valid scope uses tombstone-gated selection and details of Adão only',async()=>{
  let called=0;
  const run=create({
    selectLive:async({orderSns,readDetails})=>{
      assert.deepEqual(orderSns,[SN]);
      const response=await readDetails({channel_account_id:'b4027369-5abf-4ac1-ab24-862334fae892',
        shop_id:1156446003,order_sns:orderSns});
      return response;
    },
    readOrderDetail:async p=>{
      called++;
      assert.deepEqual(p.orderSnList,[SN]);
      assert.deepEqual(p.responseOptionalFields,['package_list','shipping_carrier','invoice_data']);
      return {response:{ok:true},payload:{error:'',response:{order_list:[{order_sn:SN}]}}};
    },
  });
  assert.equal((await run([SN])).ok,true);
  assert.equal(called,1);
});
test('expired token blocks detail without refresh',async()=>{
  let called=0;
  const run=create({
    readConnection:async()=>({ok:true,payload:{shop_id:1156446003,partner_id:2047685,
      access_token_expires_at:'2026-10-25T10:00:00Z'}}),
    decrypt:async()=>{called++;throw Error('decrypt forbidden')},
    readOrderDetail:async()=>{called++;throw Error('Shopee forbidden')},
    selectLive:async({readDetails})=>readDetails({channel_account_id:'b4027369-5abf-4ac1-ab24-862334fae892',
      shop_id:1156446003,order_sns:[SN]}),
  });
  assert.equal((await run([SN])).code,'access_token_expired_no_refresh');
  assert.equal(called,0);
});
test('cannot read wrong account or duplicate scope',async()=>{
  const run=create({selectLive:async({readDetails})=>readDetails({
    channel_account_id:'wrong',shop_id:1156446003,order_sns:[SN]})});
  assert.equal((await run([SN])).code,'identity_mismatch');
  assert.equal((await run([SN,SN])).code,'invalid_order_scope');
});
