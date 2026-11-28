import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestCategory} from './categorySuggestion.ts';
const categories=[{id:'f',name:'Fornecedores',type:'pagar',is_active:true},{id:'t',name:'TRANSPORTE',type:'pagar',is_active:true},{id:'v',name:'Vendas',type:'receber',is_active:true}];
test('purchase, linked logistics and direct sale suggest existing compatible category',()=>{
 assert.equal(suggestCategory({type:'pagar',purchase_order_id:'p'},categories)?.id,'f');
 assert.equal(suggestCategory({type:'pagar',order_id:'o',notes:'FIN-F17:order-logistics'},categories)?.id,'t');
 assert.equal(suggestCategory({type:'receber',order_id:'o'},categories)?.id,'v');
});
test('ambiguous origins, marketplace, free text and missing category do not suggest',()=>{
 for(const entry of [{type:'pagar',purchase_order_id:'p',order_id:'o'},{type:'receber',order_id:'o',sales_channel:'marketplace'},{type:'receber',order_id:'o',marketplace_account:'Adão'},{type:'pagar',notes:'FIN-F17:order-logistics'},{type:'receber',purchase_order_id:'p'}]) assert.equal(suggestCategory(entry,categories),null);
 assert.equal(suggestCategory({type:'pagar',purchase_order_id:'p'},[]),null);
 assert.equal(suggestCategory({type:'pagar',purchase_order_id:'p'},[...categories,{...categories[0],id:'duplicate'}]),null);
 assert.equal(suggestCategory({type:'pagar',purchase_order_id:'p'},[{...categories[0],is_active:false}]),null);
});
