// Runs only against the disposable CI PostgreSQL service, never the Core.
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const flags = ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t'];
const account = '8a8ad166-0317-4597-8be6-e43fb46b4d1b';
const query = sql => execFileSync('psql', [...flags, '-c', sql], { encoding: 'utf8' });
query('UPDATE public.shopee_cycle_state SET halted_code=NULL,lease_id=NULL,lease_expires_at=NULL,candidate_order_sn=NULL');
const invoke = async sql => {
  // Separate -c arguments preserve each SELECT result. Keep the transaction
  // open briefly so the second independent session actually waits on its lock.
  const { stdout } = await exec('psql', [...flags, '-c', 'BEGIN', '-c', sql,
    '-c', 'SELECT pg_sleep(0.2)', '-c', 'COMMIT']);
  return JSON.parse(stdout.split('\n').map(s => s.trim()).find(s => s.startsWith('{')));
};
const leases = await Promise.all([1, 2].map(() => invoke(`SELECT public.acquire_shopee_cycle('${account}')`)));
assert.deepEqual(leases.map(l => l.status).sort(), ['acquired', 'busy']);
// Independent sessions race the existing permanent document UNIQUE constraint.
query('TRUNCATE public.shopee_shipping_document_attempts');
const claims = await Promise.all([1, 2].map(() => invoke(
  `SELECT public.claim_shopee_shipping_document('${account}',531736366,'SYNTHETIC001','SYNTHETICPKG','NORMAL_AIR_WAYBILL',repeat('a',64))`)));
assert.deepEqual(claims.map(l => l.status).sort(), ['already_claimed', 'claimed']);
assert.equal(claims.filter(l => l.fresh === true).length, 1);
assert.equal(query('SELECT count(*) FROM public.shopee_shipping_document_attempts').trim(), '1');
console.log('PASS two independent PostgreSQL sessions: one worker lease and one fresh document claim');
