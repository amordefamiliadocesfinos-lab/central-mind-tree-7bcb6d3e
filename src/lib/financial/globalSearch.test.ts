import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesFinancialSearch,parseSearchAmount} from './globalSearch.ts';
const entry={id:'a',type:'pagar',description:'Aquisição',value:1749.5,value_paid:0,due_date:'2026-10-01',purchase:{internal_purchase_number:'PC-00034',supplier:{name:'Fornecedor São João'}}};
test('searches outside any dashboard date, supplier, purchase and accents',()=>{for(const q of ['PC-00034','sao joao','aquisicao','R$ 1.749,50'])assert.ok(matchesFinancialSearch(entry,q,'all'));assert.equal(matchesFinancialSearch(entry,'PC-00034','receber'),false);});
test('amount parsing and empty query',()=>{assert.equal(parseSearchAmount('1.749,50'),1749.5);assert.equal(parseSearchAmount('1749.50'),1749.5);assert.equal(parseSearchAmount('PC-00034'),null);assert.equal(matchesFinancialSearch(entry,'','all'),false);});
