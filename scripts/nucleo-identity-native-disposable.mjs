import fs from 'node:fs';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import {identityBootstrapFiles} from './nucleo-identity-bootstrap.mjs';
if(!['localhost','127.0.0.1'].includes(process.env.PGHOST)||process.env.PGDATABASE!=='nucleo_identity_disposable')
 throw Error('Only explicitly named loopback disposable PostgreSQL is permitted.');
const options={host:process.env.PGHOST,port:Number(process.env.PGPORT??5432),database:process.env.PGDATABASE,
 username:process.env.PGUSER,password:process.env.PGPASSWORD,max:1};
const db=postgres(options);
try{
 await db.unsafe("SET nucleo.identity_candidate_disposable='on'");
 for(const file of [...identityBootstrapFiles,'scripts/nucleo-identity-read.test.sql']){
  await db.unsafe(fs.readFileSync(file,'utf8').replace(/^\\.*$/gm,''));console.log('PASS',file);
 }
 const a=postgres(options),b=postgres(options);
 try{
  const insert=(sql,id)=>sql.begin(async tx=>{
   await tx.unsafe(`INSERT INTO nucleo_identity.assignments
    SELECT '${id}',specialty_id,instance_id,auth_uid,module_id,front_id,'collaborator',local_method_ref,provenance_ref,valid_from,valid_until,closed_at
    FROM nucleo_identity.assignments WHERE id='50000000-0000-0000-0000-000000000004'`);
   await tx`SELECT pg_sleep(0.15)`;
  });
  const results=await Promise.allSettled([insert(a,'50000000-0000-0000-0000-000000000005'),insert(b,'50000000-0000-0000-0000-000000000006')]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.code==='23505').length,1);
  console.log('PASS two concurrent transactions: one identity context, one uniqueness rejection.');
 }finally{await a.end();await b.end();}
}finally{await db.end();}
