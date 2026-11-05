import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validateDirectPriceTable, resolveDirectPriceReference,
  resolveDirectSalePriceAdvice, resolveUnconfiguredSpecialCondition,
} from '../src/lib/operations/commercialPricing.ts';

const tiers = [
  {level:'varejo',min_qty:1,max_qty:1,price_brl:35},
  {level:'atacado_1',min_qty:2,max_qty:10,price_brl:32},
  {level:'atacado_2',min_qty:11,max_qty:25,price_brl:31},
  {level:'atacado_3',min_qty:26,max_qty:50,price_brl:30},
  {level:'atacado_4',min_qty:51,max_qty:100,price_brl:29},
  {level:'atacado_5',min_qty:101,max_qty:null,price_brl:27.50},
];
const alfajor = { id:'alfajor',name:'ALFAJOR ARTESANAL 60G DOCE DE LEITE' };
const row = {name:alfajor.name,is_active:true,deleted_at:null,attributes:{
  crm_direct_whatsapp_price_table: {
    version:1, channel:'whatsapp_direto',valid_from:'2026-11-04',
    valid_until:null,approved_on:'2026-11-04',unit:'bandeja', prices:tiers,
  },
}};
const line = (qty,unit='bandeja',factor=18) => ({
  product_id:alfajor.id, commercial_quantity:qty,
  commercial_presentation:unit===null?null:{commercial_unit_label:unit,conversion_factor:factor},
});

test('Wilian: 10 + 10 bandejas uses 20 commercial bandejas and R$31', () => {
  const rows=[row],items=[line(10),line(10)];
  const quote=resolveDirectSalePriceAdvice(rows,alfajor,items[0],items,'2026-11-05');
  assert.equal(quote?.quantity,20);
  assert.equal(quote?.unit,'bandeja');
  assert.equal(quote?.unitPrice,31);
  assert.equal(quote?.tier,'atacado_2');
  assert.equal(quote?.source,'products.attributes.crm_direct_whatsapp_price_table');
});
test('do not price loose unit or incorrect 12-item tray as 18-item bandeja', () => {
  const rows=[row];
  assert.equal(resolveDirectSalePriceAdvice(rows,alfajor,line(18,'un',1),[line(18,'un',1)],'2026-11-05'),null);
  assert.equal(resolveDirectSalePriceAdvice(rows,alfajor,line(1,'bandeja',12),[line(1,'bandeja',12)],'2026-11-05'),null);
});
test('tier count excludes another product and mismatched presentation', () => {
  const items=[line(10),line(10),line(200,'un',1),{...line(9),product_id:'other'}];
  assert.equal(resolveDirectSalePriceAdvice([row],alfajor,items[0],items,'2026-11-05')?.quantity,20);
});
test('Flávio: 5438 trufas official reference 1.30, without changing negotiated price', () => {
  const trufaTable={...row.attributes.crm_direct_whatsapp_price_table,
    unit:'unit',prices:[
      {level:'varejo',min_qty:1,max_qty:20,price_brl:1.6},
      {level:'atacado_1',min_qty:21,max_qty:200,price_brl:1.5},
      {level:'atacado_2',min_qty:201,max_qty:500,price_brl:1.45},
      {level:'atacado_3',min_qty:501,max_qty:1000,price_brl:1.4},
      {level:'atacado_4',min_qty:1001,max_qty:2000,price_brl:1.35},
      {level:'atacado_5',min_qty:2001,max_qty:null,price_brl:1.3},
    ]};
  const product={id:'trufa',name:'TRUFA ARTESANAL 40G'};
  const lines=[{product_id:'trufa',commercial_quantity:5438,commercial_presentation:null}];
  const quote=resolveDirectSalePriceAdvice([{...row,name:product.name,attributes:{crm_direct_whatsapp_price_table:trufaTable}}],
    product,lines[0],lines,'2026-11-05');
  assert.equal(quote?.unitPrice,1.3);
  assert.equal(quote?.requiresConfirmation,false);
  assert.equal(lines[0].commercial_quantity,5438);
});
test('invalid/out-of-term/overlapping/expired pricing fails closed', () => {
  const table=row.attributes.crm_direct_whatsapp_price_table;
  assert.equal(validateDirectPriceTable({...table,valid_until:'2026-11-04'},20,'2026-11-05'),null);
  assert.equal(validateDirectPriceTable({...table,channel:'marketplace'},20,'2026-11-05'),null);
  assert.equal(validateDirectPriceTable({...table,prices:[...tiers.slice(0,2),{...tiers[2],min_qty:10},...tiers.slice(3)]},20,'2026-11-05'),null);
  assert.equal(validateDirectPriceTable(table,0,'2026-11-05'),null);
  assert.equal(resolveDirectPriceReference([{...row,is_active:false}],alfajor.name,20,'2026-11-05'),null);
  assert.equal(resolveDirectPriceReference([row,row],alfajor.name,20,'2026-11-05'),null);
});
test('client-specific terms are not fabricated',() => {
  assert.deepEqual(resolveUnconfiguredSpecialCondition(),{kind:'not_configured'});
});
