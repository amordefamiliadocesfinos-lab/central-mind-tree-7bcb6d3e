import test from 'node:test';
import assert from 'node:assert/strict';
import { expandCommercialOrderItem, getOrderItemLineTotal } from './commercialOrderItem';
import type { CommercialPresentation } from '../products/commercialPresentation';
const a={id:'a',unit:'un',variation_mode:'variacoes_fisicas',is_active:true};
const t30={id:'t30',unit:'un',variation_mode:'variacoes_fisicas',is_active:true};
const t40={id:'t40',unit:'un',variation_mode:'variacoes_fisicas',is_active:true};
const variants=[{id:'branco',product_id:'a',unit:'un',is_active:true},{id:'amargo',product_id:'a',unit:'un',is_active:true},...['brg','mor','mar','bei','lep'].map(id=>({id,product_id:'t30',unit:'un',is_active:true})),{id:'amd',product_id:'t40',unit:'un',is_active:true}];
const catalog={products:[a,t30,t40],variants};
const make=(pid:string,total:number,components:{product_id:string;variant_id:string;quantity:number}[]):CommercialPresentation=>({id:'kit',product_id:pid,variant_id:null,name:'Kit',commercial_unit_label:'kit',composition_mode:'composite',components,conversion_factor:total,is_active:true,notes:null,created_at:'',updated_at:''});
const alf=make('a',36,[{product_id:'a',variant_id:'branco',quantity:18},{product_id:'a',variant_id:'amargo',quantity:18}]);
const mix=make('t30',30,[...['brg','mor','mar','bei','lep'].map(variant_id=>({product_id:'t30',variant_id,quantity:5})),{product_id:'t40',variant_id:'amd',quantity:5}]);
const expand=(product:typeof a,qty:number,price:number,p:CommercialPresentation)=>expandCommercialOrderItem(product,null,qty,price,p,undefined,catalog);
test('Alfajor 36 misto: 1 e 2 apresentações, conservação de centavos',()=>{
 for(const qty of [1,2]){
 const rows=expand(a,qty,19.99,alf);
 assert.deepEqual(rows.map(x=>[x.variant_id,x.quantity]),[['branco',18*qty],['amargo',18*qty]]);
 assert.equal(Math.round(rows.reduce((sum,x)=>sum+getOrderItemLineTotal(x),0)*100),1999*qty);
 }
});
test('Trufa 30 mix inclui Amendoim da Trufa 40, soma 30/60 e conserva centavos',()=>{
 for(const qty of [1,2]){
 const rows=expand(t30,qty,17.17,mix);
 assert.equal(rows.length,6);
 assert.equal(rows.reduce((sum,x)=>sum+x.quantity,0),qty*30);
 assert.deepEqual(rows.find(x=>x.variant_id==='amd')&&[rows.find(x=>x.variant_id==='amd')!.product_id,rows.find(x=>x.variant_id==='amd')!.quantity],['t40',5*qty]);
 assert.equal(Math.round(rows.reduce((sum,x)=>sum+getOrderItemLineTotal(x),0)*100),1717*qty);
 }
});
test('rejeita produto, variante, composição e quantidade inválidos',()=>{
 assert.throws(()=>expand(t30,1,10,make('t30',30,[{product_id:'invalid',variant_id:'amd',quantity:30}])),/inexistente/);
 assert.throws(()=>expand(t30,1,10,make('t30',30,[{product_id:'t30',variant_id:'amd',quantity:30}])),/Variante física/);
 assert.throws(()=>expand(t30,1,10,make('t30',29,[{product_id:'t40',variant_id:'amd',quantity:30}])),/soma física/);
 assert.throws(()=>expand(t30,1,10,make('t30',30,[{product_id:'t40',variant_id:'amd',quantity:15},{product_id:'t40',variant_id:'amd',quantity:15}])),/duplicado/);
 assert.throws(()=>expandCommercialOrderItem(t30,null,1,10,mix),/Catálogo físico/);
 assert.throws(()=>expand(t30,0,10,mix),/Quantidade comercial/);
});
test('somente cálculo: não toca nem muta catálogo físico',()=>{
 const before=JSON.stringify(catalog);expand(t30,2,10,mix);assert.equal(JSON.stringify(catalog),before);
});

test('cada expansão de Mix mantém apresentação original e grupo único compartilhado',()=>{
 const first=expand(t30,2,17.17,mix);
 const second=expand(t30,1,17.17,mix);
 assert.equal(new Set(first.map(x=>x.commercial_presentation_id)).size,1);
 assert.equal(first[0].commercial_presentation_id,'kit');
 assert.equal(new Set(first.map(x=>x.commercial_group_id)).size,1);
 assert.ok(first[0].commercial_group_id);
 assert.notEqual(first[0].commercial_group_id,second[0].commercial_group_id);
 assert.deepEqual(first.map(x=>x.product_id).filter(x=>x==='t40'),['t40']);
 assert.equal(first.reduce((sum,x)=>sum+x.quantity,0),60);
});


test('BA3: caixa original é uma unidade física cx, não 880 biscoitos', () => {
  const biscuit = { id: 'biscuit', unit: 'un', variation_mode: 'variacoes_fisicas', is_active: true };
  const sealedBox = { id: 'biscuit-box-chocolate', product_id: 'biscuit', unit: 'cx', is_active: true };
  const presentation: CommercialPresentation = {
    id: 'ba3', product_id: biscuit.id, variant_id: sealedBox.id,
    name: 'Caixa fechada 8 kg', commercial_unit_label: 'caixa',
    conversion_factor: 1, composition_mode: 'single', is_active: true,
    notes: '8 kg nominais; quantidade interna aproximada', created_at: '', updated_at: '',
  };
  const [item] = expandCommercialOrderItem(biscuit, sealedBox, 2, 270, presentation);
  assert.equal(item.quantity, 2);
  assert.equal(item.physical_unit_label, 'cx');
  assert.equal(item.commercial_quantity, 2);
  assert.equal(item.commercial_unit_label, 'caixa');
  assert.equal(getOrderItemLineTotal(item), 540);
  assert.equal(item.variant_id, sealedBox.id);
  assert.equal(item.commercial_presentation_id, 'ba3');
});

test('BA1: pacote permanece em 22 unidades físicas, sem afetar variante cx', () => {
  const biscuit = { id: 'biscuit', unit: 'un', variation_mode: 'variacoes_fisicas', is_active: true };
  const single = { id: 'biscuit-unit-traditional', product_id: biscuit.id, unit: 'un', is_active: true };
  const presentation: CommercialPresentation = {
    id: 'ba1', product_id: biscuit.id, variant_id: single.id,
    name: 'Pacote 22 un', commercial_unit_label: 'pacote', conversion_factor: 22,
    composition_mode: 'single', is_active: true, notes: null, created_at: '', updated_at: '',
  };
  const [item] = expandCommercialOrderItem(biscuit, single, 16, 7.5, presentation);
  assert.equal(item.quantity, 352);
  assert.equal(item.physical_unit_label, 'un');
  assert.equal(item.variant_id, single.id);
  assert.equal(getOrderItemLineTotal(item), 120);
});
