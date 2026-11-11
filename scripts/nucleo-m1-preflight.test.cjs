#!/usr/bin/env node
/** Regression checks for offline preflight only; never uses real documents. */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {inspect}=require('./nucleo-m1-preflight.cjs');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const make=()=>{
  const raw=JSON.stringify([
    {id:'legacy-a',areaId:'biblioteca',title:'Documento teste',content:'texto A',tags:[],createdAt:'2026-07-08T16:00:00.000Z',updatedAt:'2026-07-08T16:00:00.000Z',versions:[]},
    {id:'legacy-b',areaId:'atlas',title:'Documento teste',content:'texto B',tags:['x'],createdAt:'2026-07-08T16:00:00.000Z',updatedAt:'2026-07-08T16:00:00.000Z',versions:[]}
  ]);
  return {format:'painel-central-nucleo-legacy-backup',schemaVersion:1,exportedAt:'2026-11-11T18:53:36.268Z',pagesKey:'nucleo_painel_central_pages_v3',pagesCount:2,pagesRawSha256:hash(raw),entries:{nucleo_painel_central_pages_v3:raw,nucleo_seed:'1'}};
};
let n=0;
function test(name,fn){fn();n+=1;process.stdout.write('PASS '+name+'\n');}
test('valid original',()=>{const r=inspect(make());assert.equal(r.status,'VALIDATED_NO_IMPORT');assert.equal(r.pagesCount,2);assert.equal(r.flagCount,1);assert.equal(r.repeatedTitles.length,1);assert.equal(r.documents.length,2);});
test('tampered checksum',()=>{const b=make();b.entries.nucleo_painel_central_pages_v3+=' ';assert.throws(()=>inspect(b),/Checksum/);});
test('duplicate id',()=>{const b=make();const a=JSON.parse(b.entries[b.pagesKey]);a[1].id=a[0].id;const raw=JSON.stringify(a);b.entries[b.pagesKey]=raw;b.pagesRawSha256=hash(raw);assert.throws(()=>inspect(b),/duplicado/);});
test('invalid area',()=>{const b=make();const a=JSON.parse(b.entries[b.pagesKey]);a[0].areaId='outra';const raw=JSON.stringify(a);b.entries[b.pagesKey]=raw;b.pagesRawSha256=hash(raw);assert.throws(()=>inspect(b),/Área inválida/);});
test('missing field',()=>{const b=make();const a=JSON.parse(b.entries[b.pagesKey]);delete a[0].versions;const raw=JSON.stringify(a);b.entries[b.pagesKey]=raw;b.pagesRawSha256=hash(raw);assert.throws(()=>inspect(b),/Campos ausentes/);});
test('unexpected non nucleo key',()=>{const b=make();b.entries['secret-other-module']='dont export';assert.throws(()=>inspect(b),/fora do escopo/);});
process.stdout.write('M1 PRE-FLIGHT '+n+' synthetic cases OK\n');
