import fs from 'node:fs';
import {identityBootstrapFiles} from './nucleo-identity-bootstrap.mjs';
// Local PG-WASM only, with no network connection string. Native PostgreSQL is CI proof.
const {PGlite}=await import('../.identity-lab/node_modules/@electric-sql/pglite/dist/index.js');
const db=new PGlite();
try{
 await db.exec("SET nucleo.identity_candidate_disposable='on'");
 for(const file of [...identityBootstrapFiles,'scripts/nucleo-identity-read.test.sql']){
  console.log('Running',file);
  const source=fs.readFileSync(file,'utf8').replace(/^\\.*$/gm,'');
  await db.exec(source);
 }
 console.log('PASS: real migrations, candidate RLS and focused negative tests in disposable PostgreSQL WASM.');
}finally{await db.close();}
