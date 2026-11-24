const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),cp=require('node:child_process'),ts=require('typescript');
function load(file,mocks={}){const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m,m.exports,name=>mocks[name]);return m.exports;}
const diff=load('src/lib/nucleo/ac01ContentComparison.ts');
function reconstruct(rows,kind){return rows.filter(x=>x.kind!==kind).map(x=>x.text).join('\n');}
for(const [a,b] of [['a\nb\nc','a\nx\nc'],['','abc'],['a\na','a'],['same','same'],['a\n','a'],['á\r\nb','á\nb']]){
 const rows=diff.compareAuthorizedText(a,b);
 assert.equal(reconstruct(rows,'incluido'),a);assert.equal(reconstruct(rows,'removido'),b);
}
assert.throws(()=>diff.compareAuthorizedText('x'.repeat(200001),'a'),/200 KB/);
assert.throws(()=>diff.compareAuthorizedText('\n'.repeat(601),'a'),/600 linhas/);
const model=load('src/lib/nucleo/identityContext.ts');
const id=n=>`${n}0000000-0000-0000-0000-000000000001`;
const now=Date.now();
const ctx={contract:'nucleo_identity_context_v1',authority:'consultivo_sem_mandato',checked_at:new Date(now).toISOString(),valid_until:new Date(now+60000).toISOString(),
 assignment_id:id(1),auth_uid:id(2),module_id:id(3),instance_id:id(4),specialty_id:id(5),specialty_code:'governance',specialty_title:'Governança',front_id:null,responsibility:'primary',general_method_ref:'synthetic://general',local_method_ref:null,provenance_ref:'synthetic://origin',references:[]};
assert(model.isIdentityContext(ctx,id(2),id(3),id(1),now));
for(const mutation of [{auth_uid:id(9)},{module_id:id(9)},{assignment_id:id(9)},{authority:'homologado'},{valid_until:new Date(now-1).toISOString()},{checked_at:'bad'},{references:[{id:id(6),label:'bad',source_ref:'synthetic://bad',contribution_id:id(7),fm_id:id(8),evidence_id:null,event_id:null}]}])
 assert(!model.isIdentityContext({...ctx,...mutation},id(2),id(3),id(1),now));
assert(!model.isIdentityAssignments([{assignment_id:'bad'}]));
const inventory=load('src/lib/nucleo/coverageSourcesV13.ts').default;
assert.equal(new Set(inventory.map(x=>x.moduleCode)).size,10);
for(const source of inventory){
 const original=cp.execFileSync('git',['show',source.commit+':'+source.path],{maxBuffer:10_000_000});
 assert.equal(crypto.createHash('sha256').update(original).digest('hex'),source.sha256);
}
const coverage=load('src/lib/nucleo/coveragePreparation.ts',{'./coverageSourcesV13':{default:inventory}});
async function main(){
 const a=await diff.readComparisonFile(new File(['hello'],'previous.txt'));
 assert.equal(a.sha256,crypto.createHash('sha256').update('hello').digest('hex'));
 assert.equal(a.originVerified,false);
 assert.equal((await diff.readComparisonFile(new File(['hello'],'current.txt'),a.sha256)).originVerified,true);
 await assert.rejects(()=>diff.readComparisonFile(new File(['hello'],'wrong.txt'),'0'.repeat(64)),/diverge/);
 await assert.rejects(()=>diff.readComparisonFile(new File(['binary'],'file.pdf')),/Formato/);
 await assert.rejects(()=>diff.readComparisonFile(new File([new Uint8Array([255])],'invalid.txt')));
 const first=await coverage.prepareCoverageBatch('CRM',id(3),'Papel declarado');
 const again=await coverage.prepareCoverageBatch('CRM',id(3),'Papel declarado');
 assert.deepEqual(first,again,'retry deterministic and no new records');
 assert.notEqual(first.proposals[0].payload.request_id,(await coverage.prepareCoverageBatch('CRM',id(4),'Papel declarado')).proposals[0].payload.request_id);
 assert.equal((await coverage.prepareCoverageBatch('FIN',id(3),'')).proposals[0].payload.specialist_role,null);
 assert(first.proposals.every(x=>!('recorded_by_auth_uid' in x.payload)&&!('authority_state' in x.payload)),'writer preserves authorship and proposal state');
 const map=fs.readFileSync('docs/architecture/MAPA_MESTRE_NUCLEO_2_0_V1_3_AC01_CONHECIMENTO_ESPECIALISTAS_CONGELADO_2026-11-14.txt');
 assert.equal(crypto.createHash('sha256').update(map).digest('hex'),'0da8ec8d44b4ad3ae0009f02d46433a29dff85877a9c923f5843955e2aa08c4f');
 console.log('PASS integrated capabilities: exact text reconstruction/hash/limits, identity fail-closed, 10-module source hashes, deterministic AC-01 requests, original sovereign bytes.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
