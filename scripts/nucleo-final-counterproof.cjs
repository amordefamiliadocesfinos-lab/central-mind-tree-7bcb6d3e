/** Single command; local app checks by default, optional native disposable DB in CI. */
const fs=require('node:fs'),cp=require('node:child_process');
function run(args){const result=cp.spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});if(result.status!==0)process.exit(result.status??1);}
const tests=fs.readdirSync('scripts').filter(x=>/^nucleo-.*\.test\.cjs$/.test(x)).sort();
let passed=0;const failures=[];
for(const file of tests){
 const result=cp.spawnSync(process.execPath,['-r','./scripts/nucleo-canonical-test-read.cjs','scripts/'+file],{encoding:'utf8',env:process.env});
 if(result.status!==0){console.error(file,result.stdout,result.stderr);failures.push(file);}
 else passed++;
}
console.log(`PASS ${passed} Núcleo contract/regression suites.`);
if(failures.length){console.error('Failed suites:',failures.join(', '));process.exit(1);}
run(['node_modules/typescript/lib/tsc.js','--noEmit','-p','tsconfig.app.json']);
// The existing MCP Vite plugin regenerates this tracked Edge artifact during build.
// Preserve its exact pre-build bytes; verification must not modify other domains.
const generatedMcp='supabase/functions/mcp/index.ts';
const originalMcp=fs.readFileSync(generatedMcp);
const build=cp.spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{stdio:'inherit',env:process.env});
fs.writeFileSync(generatedMcp,originalMcp);
if(build.status!==0)process.exit(build.status??1);
if(process.argv.includes('--native-db'))run(['scripts/nucleo-identity-native-disposable.mjs']);
else console.log('Native PostgreSQL concurrency/RLS: run CI or supply loopback disposable DB with --native-db. No production DB contacted.');
