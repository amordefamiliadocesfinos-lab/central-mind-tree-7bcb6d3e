const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { webcrypto, createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'node_modules/typescript'));
const source = ts.createSourceFile('index.ts', fs.readFileSync(path.join(root, 'supabase/functions/integration-core-bridge/index.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
const names = ['activeChannelAccount', 'labelDocumentLocator', 'executeLabelAction'];
const functions = source.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text)).map(n => n.getText(source)).join('\n');
const js = ts.transpileModule(`const LIVE='live',LABEL_BUCKET='shopee-labels',LABEL_MAX_BYTES=4194304;${functions}`, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const execute = vm.runInNewContext(js+'\nexecuteLabelAction;', {crypto:webcrypto,TextEncoder,Uint8Array});
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\nendobj\n%%EOF\n');
const payload = {action:'shopee.shipping_label.commit',channel_account_id:'pilot',shop_id:123,order_sn:'SYNTHETIC123',package_number:'PK1',sha256:createHash('sha256').update(pdf).digest('hex'),file_size:pdf.length};
function fixture(overrides={}) {
  const rows=[]; const calls=[]; let insertFailure=false;
  const core={from(table){
    const filters={}; let inserted;
    const q={select(){return q;},eq(k,v){filters[k]=v;return q;},limit(){return q;},insert(row){inserted=row;return q;},maybeSingle(){return q;},single(){return q;},then(resolve,reject){
      let result;
      if(table==='channel_accounts')result={data:{id:'pilot',is_active:true},error:null};
      else if(table==='shopee_oauth_connections')result={data:{shop_id:123},error:null};
      else if(table==='orders')result={data:[{id:'canonical-order',order_number:'SYNTHETIC123'}],error:null};
      else if(inserted){calls.push(['insert',inserted]); if(insertFailure)result={error:{code:'temporary'}}; else {const row={id:'doc-1',...inserted};rows.push(row);result={data:row,error:null};}}
      else result={data:rows.filter(row=>Object.entries(filters).every(([k,v])=>row[k]===v)),error:null};
      if(overrides[table])result=overrides[table](result,{inserted,filters});
      return Promise.resolve(result).then(resolve,reject);
    }};return q;
  },storage:{from(bucket){assert.equal(bucket,'shopee-labels');return {
    async createSignedUploadUrl(p){calls.push(['prepare',p]);return {data:{signedUrl:`https://example.invalid/${p}`},error:null};},
    async download(p){calls.push(['download',p]);return {data:new Blob([overrides.bytes??pdf]),error:null};}
  };}}};
  return {core,rows,calls,failInsert(value){insertFailure=value;}};
}
test('Core prepare issues signed upload only for canonical account/shop/order',async()=>{
  const f=fixture();const r=await execute(f.core,{...payload,action:'shopee.shipping_label.prepare'});
  assert.equal(r.status,200);assert.match(r.body.upload_url,/canonical-order\/shopee-[a-f0-9]{64}\.pdf$/);assert.equal(f.rows.length,0);
});
test('Core commit verifies stored PDF/hash and persists private shipping_label metadata only',async()=>{
  const f=fixture();const r=await execute(f.core,payload);assert.equal(r.status,200);
  assert.equal(f.rows.length,1);const row=f.rows[0];assert.equal(row.order_id,'canonical-order');assert.equal(row.document_type,'shipping_label');assert.equal(row.source,'shopee_open_platform');assert.equal(row.file_url,null);assert.equal(row.mime_type,'application/pdf');assert.equal(row.file_size,pdf.length);
});
test('Core sequential commit is idempotent, no second insert/download',async()=>{
  const f=fixture();const first=await execute(f.core,payload);const second=await execute(f.core,payload);
  assert.equal(first.body.document_id,second.body.document_id);assert.equal(second.body.already_exists,true);assert.equal(f.rows.length,1);assert.equal(f.calls.filter(x=>x[0]==='download').length,1);
});
for(const [name,overrides] of [
  ['inactive account',{channel_accounts:()=>({data:{is_active:false},error:null})}],
  ['foreign shop',{shopee_oauth_connections:()=>({data:{shop_id:999},error:null})}],
  ['missing order',{orders:()=>({data:[],error:null})}],
  ['ambiguous order',{orders:()=>({data:[{id:'a'},{id:'b'}],error:null})}],
  ['bad PDF',{bytes:Buffer.from('not-a-pdf-document-at-all')}],
  ['changed PDF',{bytes:Buffer.from('%PDF-1.4\n2 0 obj\nendobj\n%%EOF\n')}],
  ['oversized PDF',{bytes:Buffer.concat([Buffer.from('%PDF-'),Buffer.alloc(4194304)])}],
])test(`Core fails closed: ${name}`,async()=>{const f=fixture(overrides);const r=await execute(f.core,payload);assert.ok(r.status>=400);assert.equal(f.rows.length,0);});
test('Core database failure never reports successful attachment',async()=>{const f=fixture();f.failInsert(true);const r=await execute(f.core,payload);assert.equal(r.status,503);assert.equal(f.rows.length,0);});
test('Core rejects existing locator attached to a different order',async()=>{
  const f=fixture();await execute(f.core,payload);f.rows[0].order_id='different-order';
  const r=await execute(f.core,payload);assert.equal(r.status,409);
});
test('installed Supabase SDK supports signed raw binary PUT with content type',async()=>{
  const {createClient}=require(path.join(root,'node_modules/@supabase/supabase-js'));
  const observed=[];const client=createClient('https://example.invalid','synthetic-key',{auth:{persistSession:false},global:{fetch:async(url,options)=>{
    observed.push({url,options});
    return new Response(JSON.stringify(observed.length===1?{url:'/object/upload/sign/shopee-labels/test.pdf?token=synthetic'}:{Key:'test.pdf'}),{headers:{'content-type':'application/json'}});
  }}});
  const prepared=await client.storage.from('shopee-labels').createSignedUploadUrl('test.pdf');assert.equal(prepared.error,null);
  const uploaded=await client.storage.from('shopee-labels').uploadToSignedUrl('test.pdf',prepared.data.token,pdf,{contentType:'application/pdf'});assert.equal(uploaded.error,null);
  assert.equal(observed[1].options.method,'PUT');assert.equal(new Headers(observed[1].options.headers).get('content-type'),'application/pdf');assert.deepEqual(observed[1].options.body,pdf);
});

