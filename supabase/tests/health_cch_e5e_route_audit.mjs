// CCH E5-E — static alternative-route inventory. No network, DB or real data.
import { readdirSync,readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { join,relative } from 'node:path';

const roots=['supabase/migrations','supabase/functions','src'];
const extensions=new Set(['.sql','.ts','.tsx','.mjs','.js']);
const files=[];
function walk(dir){
 for(const entry of readdirSync(dir,{withFileTypes:true})){
  if(['node_modules','.git','dist','build'].includes(entry.name)) continue;
  const path=join(dir,entry.name);
  if(entry.isDirectory()) walk(path);
  else if([...extensions].some(e=>path.endsWith(e))) files.push(path);
 }
}
for(const root of roots)walk(root);
const matches=[];
const strictFailures=[];
const allowedDefiner=new Set([
 'health_f19_pause_workout',
 'health_f19_resume_workout',
 'health_f19_start_work_interval',
 'health_f19_finish_work_start_rest',
 'health_f19_finish_rest',
 'health_f19_cancel_interval',
 'health_f19_close_open_timers_with_session'
]);
for(const path of files){
 const file=relative('.',path).replaceAll('\\','/');
 const content=readFileSync(path,'utf8');
 if(!/health_workout_events|cch-e5-session-review-v1|health_cch_e5_current_session_review|e5_personalized_review/.test(content))continue;
 const lines=content.split('\n');
 const locations=[];
 for(let i=0;i<lines.length;i++) if(/health_workout_events|cch-e5-session-review-v1|health_cch_e5_current_session_review|e5_personalized_review/.test(lines[i]))
  locations.push({line:i+1,kind:/health_workout_events/.test(lines[i])?'M4 table reference':'E5 contract reference'});
 const className=file.startsWith('supabase/migrations/')?'official migration':
  file.startsWith('supabase/functions/')?'edge function':'client/source';
 const definerNames=[];
 if(file.endsWith('.sql')){
  // Name and body segment extraction on official migrations, preserving exact source.
  const sections=[...content.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-z0-9_]+)\s*\(/ig)];
  for(let i=0;i<sections.length;i++){
   const from=sections[i].index;
   const until=i+1<sections.length?sections[i+1].index:content.length;
   const section=content.slice(from,until);
   if(/SECURITY\s+DEFINER/i.test(section)&&/health_workout_events/i.test(section)){
    const name=sections[i][1];definerNames.push(name);
    if(!allowedDefiner.has(name))strictFailures.push({file,reason:'Unreviewed SECURITY DEFINER M4 reference',function:name});
   }
  }
  if(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW[\s\S]*?health_workout_events/i.test(content))
   strictFailures.push({file,reason:'Potential SQL view exposing M4 events; review required'});
 }
 // No client-side or edge function may directly query E5 notes outside a reviewed contract.
 if((className==='edge function'||className==='client/source')&&/health_workout_events/.test(content))
  strictFailures.push({file,reason:'Direct M4 table use in client/edge; review before enabling E5'});
 matches.push({file,className,locations,securityDefinerM4:definerNames});
}
const report={contract:'CCH E5-E static route inventory v1',scannedFiles:files.length,
 sourceTree:'checkout at workflow HEAD',references:matches,strictFailures,
 residualLimitations:[
 'Static scanning does not prove runtime network/PostgREST security.',
 'Generated SQL strings or concatenated references may evade literal matching.',
 'Known F19 SECURITY DEFINER routines require separate functional review.',
 'Candidate migration and tests are checked in isolated PostgreSQL jobs, not included in this source inventory.'
 ]};
mkdirSync('artifacts',{recursive:true});
writeFileSync('artifacts/cch-e5e-route-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({scannedFiles:files.length,matchedFiles:matches.map(x=>({file:x.file,count:x.locations.length,definer:x.securityDefinerM4})),strictFailures},null,2));
if(strictFailures.length)process.exitCode=1;
