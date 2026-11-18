import test from 'node:test';
import assert from 'node:assert/strict';
import { HANDOFF_TTL_MS, newHandoffTicket, hashHandoffTicket, validHandoffIdentity, validateHandoffConsumeResult } from './shopee-oauth-universal-handoff.mjs';

const account = 'd26c7a30-aa4a-4441-8012-600d70453689';

test('handoff ticket is opaque, random and only its hash is used for lookup', () => {
  const a = newHandoffTicket();
  const b = newHandoffTicket();
  assert.match(a, /^[a-zA-Z0-9_-]{43}$/);
  assert.notEqual(a, b);
  assert.match(hashHandoffTicket(a), /^[a-f0-9]{64}$/);
  assert.notEqual(hashHandoffTicket(a), hashHandoffTicket(b));
  assert.equal(HANDOFF_TTL_MS, 90000);
});

test('malformed ticket fails closed', () => {
  for (const v of [null, undefined, '', 'x', 5, 'a'.repeat(44), 'a'.repeat(43) + '.']) {
    assert.equal(hashHandoffTicket(v), null);
  }
});

test('consumed backend-bound identity can be accepted only with trusted partner', () => {
  const payload = { channel_account_id: account, partner_id: 2047685 };
  assert.deepEqual(validHandoffIdentity(payload), payload);
  assert.deepEqual(validateHandoffConsumeResult({ ok: true, payload }), payload);
  assert.equal(validateHandoffConsumeResult({ ok: false, payload }), null);
});

test('spoofed, missing or unapproved destination fails closed', () => {
  for (const payload of [
    null, {}, [], { channel_account_id: 'celivio', partner_id: 2047685 },
    { channel_account_id: account, partner_id: 0 },
    { channel_account_id: account, partner_id: 9999 },
  ]) {
    assert.equal(validHandoffIdentity(payload), null);
  }
});
