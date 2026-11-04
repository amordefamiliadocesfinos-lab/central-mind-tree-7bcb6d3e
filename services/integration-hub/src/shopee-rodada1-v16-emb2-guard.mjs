export const EMB2_ACCOUNT_ID='b4027369-5abf-4ac1-ab24-862334fae892';
export const EMB2_PRODUCT_ID='af7fe3c4-863c-4d1f-9fcd-b4ecb92e5322';
export const EMB2_MODELS=Object.freeze({'22694563769|238807035065':'1af56d5f-476a-4645-9182-b420cac5c190',
'22694563769|238807035062':'e8a87c08-77db-4c77-bc53-a512ad40830e',
'22694563769|229443539816':'c8d80c3b-d5ce-4cab-a488-c0e807113e91',
'22694563769|229443539817':'5651be95-eb59-4660-b65a-e5d59f8b4008',
'22694563769|229443539814':'04503e7e-0733-48ab-8d58-8633dd0eb5ca',
'22694563769|229443539819':'cf628cc5-a0df-4edf-8ee3-94d57576f53d',
'22694563769|229443539820':'016bc844-dbb0-4c26-9c42-a53b2a8c157a',
'22694563769|238807035064':'6b15ff8e-828b-4eba-8b38-c5745b9f0c77',
'22694563769|229443539815':'648a887f-bf54-416f-9961-7672fa9ebec9',
'22694563769|238807035059':'47fe2716-1563-4efe-9ce4-ffee4672025d',
'22694563769|238807035060':'58e7c244-a6f8-4bdd-beee-44d3304097b0',
'22694563769|238807035066':'b272869c-a8fd-4708-9cb1-7ac94ea964aa',
'22694563769|238807035061':'8a93c32a-e8fc-40af-9b97-52a4324c60a6',
'22694563769|238807035063':'ab610c76-de63-49f0-b682-92e9253976ed'});
export function emb2PhysicalBlocker(item,components,scope,variantId){
 if(scope?.channelAccountId!==EMB2_ACCOUNT_ID)return 'emb2_account_unverified';
 if(components.length!==1)return 'emb2_composition_invalid';
 const c=components[0],identity=c?.physical_identity;
 if(c?.product_id!==EMB2_PRODUCT_ID || c?.variant_id!==variantId ||
 identity?.active!==true || identity?.unit!=='un' ||
 Number(c?.physical_multiplier)!==1000)return 'emb2_physical_identity_unverified';
 if(!Array.isArray(identity.presentation_factors) ||
 !identity.presentation_factors.some(f=>Number(f)===100))
 return 'emb2_pack100_unverified';
 const q=Number(item?.quantity);
 if(!Number.isSafeInteger(q)||q<1||!Number.isSafeInteger(q*1000)||q*1000>2147483647)
 return 'physical_quantity_invalid';
 return null;
}