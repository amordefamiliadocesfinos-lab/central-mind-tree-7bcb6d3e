import { SHOPEE_TRUFAS_ADAO_REFERENCE_20261029 as REFERENCE } from './shopee-trufas-adao-reference-20261029.mjs';
import { previewTrufasMappings } from './shopee-trufas-reconciliation-preview.mjs';
const T30='183c7829-8537-439c-9a90-1a762766c089';
const T40='141908ce-a550-47c6-b19a-095cd3ee18e7';
const PHYSICAL=Object.freeze({
 T30:Object.freeze({BRG:'398f0e5a-1528-40f9-a1d5-2d829f7abca5',MOR:'246dd145-f1fd-4455-b0d2-5539c38832c0',MAR:'f9dffd70-ac95-4be6-a0fc-b54a6f1893ce',BEI:'be8245fd-16aa-45ff-a83a-c12986a63847',LEP:'f6f051bd-0272-4e71-9694-1084b87598f4'}),
 T40:Object.freeze({BRG:'962731b8-d5b8-4fcb-acd9-981965d6bcc4',MOR:'4395896e-833a-494c-a4ce-9784f3f2aa22',MAR:'576e93dc-0076-44e2-8570-7e9bca4bdde8',BEI:'38b34351-1ca3-4920-9e1a-acfa936c3328',LEP:'9318d443-28ac-4a5e-af15-6ea3928d7216'})
});
const AMD='efeadaea-134f-4e4b-af53-7bfa1a7136f4';
const FLAVORS=['BRG','AMD','MOR','MAR','BEI','LEP'];
function component(family,flavor,quantity){
 const amendoim=flavor==='AMD';
 return {product_id:amendoim?T40:family==='T30'?T30:T40,
  variant_id:amendoim?AMD:PHYSICAL[family][flavor],
  physical_multiplier:quantity,flavor};
}
export function expectedTrufasComponents(reference=REFERENCE) {
 if (!Array.isArray(reference)) throw new TypeError('reference must be array');
 return reference.map(row=>{
  const {family,kind,qty,flavor,item_id,model_id}=row;
  if (!['T30','T40'].includes(family)||!['DG','KT','AT','CX'].includes(kind)
   ||!Number.isSafeInteger(qty)||qty<1||!FLAVORS.includes(flavor)&&flavor!=='MX') throw new TypeError('invalid reference');
  let quantities;
  if(kind==='DG') quantities=FLAVORS.map(f=>[f,family==='T30'&&['BRG','AMD'].includes(f)?2:1]);
  else if(flavor==='MX') {
   if(qty%6!==0) throw new TypeError('invalid mix factor');
   quantities=FLAVORS.map(f=>[f,qty/6]);
  } else quantities=[[flavor,qty]];
  const components=quantities.map(([f,q])=>component(family,f,q));
  if(components.reduce((s,c)=>s+c.physical_multiplier,0)!==qty) throw new TypeError('physical sum mismatch');
  return {family,item_id,model_id,kind,qty,flavor,components};
 });
}
function fingerprint(c){return String(c.product_id)+'|'+String(c.variant_id);}
export function validateTrufasPhysicalMappings(mappings,accountId,reference=REFERENCE){
 const identity=previewTrufasMappings(reference,mappings,accountId);
 const expected=expectedTrufasComponents(reference);
 const rows=identity.rows.map((row,i)=>{
  if(row.status!=='present_unverified') return {...row,physicalStatus:'not_checked'};
  const m=mappings.find(x=>x.marketplace==='shopee'&&x.channel_account_id===accountId
   &&String(x.external_item_id)===row.itemId&&String(x.external_model_id)===row.modelId);
  const actual=Array.isArray(m.components)&&m.components.length>0
   ?m.components:[{product_id:m.product_id,variant_id:m.variant_id,physical_multiplier:m.physical_multiplier}];
  const want=expected[i].components;
  const actualMap=new Map();
  for(const c of actual){const key=fingerprint(c);if(actualMap.has(key))return {...row,physicalStatus:'duplicate_component'};actualMap.set(key,Number(c.physical_multiplier));}
  const correct=actualMap.size===want.length&&want.every(c=>actualMap.get(fingerprint(c))===c.physical_multiplier);
  return {...row,physicalStatus:correct?'matched':'mismatch'};
 });
 return {...identity,rows,physicalMatched:rows.filter(r=>r.physicalStatus==='matched').length,
  physicalMismatches:rows.filter(r=>['mismatch','duplicate_component'].includes(r.physicalStatus)).length};
}
