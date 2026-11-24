const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto'),ts=require('typescript');
function load(file){const mod={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod,mod.exports);return mod.exports;}
const {MODULE_PROVENANCE}=load('src/lib/nucleo/operationalProvenanceV12.ts');
const baseline=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const prefix='https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/main/';
const sources={...MODULE_PROVENANCE,NUC:{sources:[{label:'Continuidade Canônica V1.1',path:prefix+'docs/architecture/MAPA_CONTINUIDADE_CANONICA_ESPECIALISTAS_NUCLEO20_V1_1_CONGELADO_PLANEJAMENTO_2026-11-19.md',authority:'vigente_declarada',note:'Planejamento congelado, sem homologação produtiva.'}]}};
const rows=[];
for(const [moduleCode,entry] of Object.entries(sources))for(const src of entry.sources){
 if(!src.path.startsWith(prefix))throw Error('Untrusted inventory path');
 const path=src.path.slice(prefix.length);
 if(!fs.existsSync(path))throw Error('Missing official source: '+path);
 const bytes=cp.execFileSync('git',['show',baseline+':'+path],{maxBuffer:10_000_000});
 cp.execFileSync('git',['diff','--exit-code','HEAD','--',path],{stdio:'pipe'});
 rows.push({moduleCode,label:src.label,path,commit:baseline,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),authority:src.authority,note:src.note});
}
fs.writeFileSync('src/lib/nucleo/coverageSourcesV13.ts','// Generated from verified Git blobs; no Core write.\nexport default '+JSON.stringify(rows,null,2)+' as const;\n');
console.log(`${rows.length} verified source references, ${new Set(rows.map(x=>x.moduleCode)).size} modules; no Core write.`);
