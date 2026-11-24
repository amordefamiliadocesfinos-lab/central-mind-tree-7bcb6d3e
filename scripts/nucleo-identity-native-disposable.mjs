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
  if(file.endsWith('/nucleo_identity_read_candidate.sql')){
   // Reproduce the observed public-schema function defaults only, after legacy
   // bootstrap; never touch the hosted project's roles or global privileges.
   await db.unsafe(`CREATE ROLE sandbox_exec NOLOGIN;
    CREATE ROLE sandbox_exec_xkskyutmtlhivvpfxkjg NOLOGIN;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS
     TO anon,authenticated,service_role,sandbox_exec_xkskyutmtlhivvpfxkjg;`);
  }
  await db.unsafe(fs.readFileSync(file,'utf8').replace(/^\\.*$/gm,''));console.log('PASS',file);
 }
 const acl=await db.unsafe(`SELECT rolname,
   has_schema_privilege(rolname,'nucleo_identity','USAGE') AS schema_use,
   has_function_privilege(rolname,'public.nucleo_identity_context_read(uuid)','EXECUTE') AS context_exec,
   has_function_privilege(rolname,'public.nucleo_identity_assignments_read(uuid)','EXECUTE') AS list_exec
   FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role','sandbox_exec','sandbox_exec_xkskyutmtlhivvpfxkjg')`);
 assert.equal(acl.length,5);
 for(const row of acl){
  const expected=row.rolname==='authenticated';
  assert.equal(row.schema_use,expected,row.rolname);
  assert.equal(row.context_exec,expected,row.rolname);
  assert.equal(row.list_exec,expected,row.rolname);
 }
 console.log('PASS candidate ACLs with cloud-like default EXECUTE grants: authenticated only; no legacy ACL changes.');
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
