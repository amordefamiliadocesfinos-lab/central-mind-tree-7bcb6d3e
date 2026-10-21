// Runs only against the disposable CI PostgreSQL service, never the Core.
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const flags = ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-Atc'];
const account = '8a8ad166-0317-4597-8be6-e43fb46b4d1b';
const query = sql => execFileSync('psql', [...flags, sql], { encoding: 'utf8' });
query('UPDATE public.shopee_cycle_state SET halted_code=NULL,lease_id=NULL,lease_expires_at=NULL,candidate_order_sn=NULL');
const invoke = async sql => {
  const { stdout } = await exec('psql', [...flags, sql]);
  return JSON.parse(stdout.split('\n').find(s => s.startsWith('{')));
};
const leases = await Promise.all([1, 2].map(() => invoke(`BEGIN; SELECT pg_sleep(0.2); SELECT public.acquire_shopee_cycle('${account}'); COMMIT;`)));
assert.deepEqual(leases.map(l => l.status).sort(), ['acquired', 'busy']);
// Independent sessions race the existing permanent document UNIQUE constraint.
query('TRUNCATE public.shopee_shipping_document_attempts');
const claims = await Promise.all([1, 2].map(() => invoke(`BEGIN; SELECT pg_sleep(0.2);
  SELECT public.claim_shopee_shipping_document('${account}',531736366,'SYNTHETIC001','SYNTHETICPKG','NORMAL_AIR_WAYBILL',repeat('a',64)); COMMIT;`)));
assert.deepEqual(claims.map(l => l.status).sort(), ['already_claimed', 'claimed']);
assert.equal(claims.filter(l => l.fresh === true).length, 1);
assert.equal(query('SELECT count(*) FROM public.shopee_shipping_document_attempts').trim(), '1');
console.log('PASS two independent PostgreSQL sessions: one worker lease and one fresh document claim');
