import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path=fileURLToPath(new URL('../../../docs/operations/jornada-sku-v13/sku-v13-168-models-core-projection.json',import.meta.url));
const projection=JSON.parse(readFileSync(path,'utf8'));
const rows=projection.rows;

test('Jornada SKU 168: 4 contas x 42 models, 42 SKUs sem colisao semantica',()=>{
  assert.equal(rows.length,168);
  assert.equal(new Set(rows.map(r=>r.channel_account_id+'|'+r.item_id+'|'+r.model_id)).size,168);
  assert.equal(new Set(rows.map(r=>r.mapping_id)).size,168);
  assert.equal(new Set(rows.map(r=>r.canonical_sku)).size,42);
  for(const code of new Set(rows.map(r=>r.canonical_sku))){
    const subset=rows.filter(r=>r.canonical_sku===code);
    assert.equal(subset.length,4,code);
    assert.equal(new Set(subset.map(r=>r.channel_account_id)).size,4,code);
  }
  for(const account of new Set(rows.map(r=>r.channel_account_id))){
    assert.equal(rows.filter(r=>r.channel_account_id===account).length,42);
  }
});
test('Jornada SKU 168: conserva Item/Model e nao escreve observacao ou estado publicado',()=>{
  for(const r of rows){
    assert.equal(r.official_key,`official:item:${r.item_id}|model:${r.model_id}`);
    assert.equal(r.observation_kind,'UNKNOWN');
    assert.equal(r.observed_sku,null);
    assert.equal(r.publication_allowed,false);
    assert.ok(['PLANEJADO','BLOQUEADO_LOCAL'].includes(r.reconciliation_status));
    assert.match(r.canonical_sku,/^AF-TRF(30|40)-KT-(030|060|120)-(AMD|BEI|BRG|LEP|MAR|MOR|MX)$/);
    const qty=r.physical_components.reduce((s,c)=>s+c.quantity,0);
    assert.equal(qty,r.commercial_quantity);
    assert.equal(Number(r.canonical_sku.split('-')[3]),qty);
    assert.equal(r.canonical_sku.startsWith('AF-TRF30')? 'T30-2':'T40-2',r.architecture);
  }
});
test('24 T30-2 fisicamente excepcionais: seis por conta e status bloqueado',()=>{
  const exceptions=rows.filter(r=>r.reconciliation_status==='BLOQUEADO_LOCAL');
  assert.equal(exceptions.length,24);
  assert.equal(new Set(exceptions.map(r=>r.channel_account_id)).size,4);
  for(const ac of new Set(rows.map(r=>r.channel_account_id))){
    assert.equal(exceptions.filter(r=>r.channel_account_id===ac).length,6);
  }
  for(const r of rows){
    const mismatched=r.architecture==='T30-2'
      && r.physical_components.some(c=>c.sku==='TRF-ART-040-M');
    assert.equal(r.reconciliation_status==='BLOQUEADO_LOCAL',mismatched);
  }
});
test('piloto Celivio exato preservado e fisicamente consistente',()=>{
  const p=rows.find(r=>r.channel_account_id==='d26c7a30-aa4a-4441-8012-600d70453689'
    && r.item_id==='23094148715' && r.model_id==='129843489972');
  assert.ok(p);
  assert.equal(p.mapping_id,'980cb680-5296-4342-b83d-4e09584a3fe0');
  assert.equal(p.canonical_sku,'AF-TRF30-KT-030-BRG');
  assert.equal(p.reconciliation_status,'PLANEJADO');
  assert.equal(p.physical_components.length,1);
  assert.equal(p.physical_components[0].variant_sku,'TRF-ART-030-BRG');
});
