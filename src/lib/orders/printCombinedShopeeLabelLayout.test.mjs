import test from 'node:test';
import assert from 'node:assert/strict';
import { fitOfficialPdfPage } from '../src/lib/orders/printCombinedShopeeLabelLayout.mjs';

test('A4 official page retains dimensions on A4 sheet', () => {
  const p = fitOfficialPdfPage(595, 842, 595, 842);
  assert.equal(p.scale, 1);
  assert.equal(p.width, 595);
  assert.equal(p.height, 842);
});

test('different-sized official pages can fit separate A4 sheets without distortion', () => {
  for (const [w, h] of [[283, 425], [595, 842], [842, 595], [420, 595], [400, 850]]) {
    const p = fitOfficialPdfPage(w, h, 595, 842);
    assert.ok(p.x >= -1e-9 && p.y >= -1e-9);
    assert.ok(p.x + p.width <= 595 + 1e-9);
    assert.ok(p.y + p.height <= 842 + 1e-9);
    assert.ok(Math.abs(p.width / p.height - w / h) < 1e-10);
  }
});

test('invalid page sizes fail closed', () => {
  assert.throws(() => fitOfficialPdfPage(0, 400, 595, 842));
  assert.throws(() => fitOfficialPdfPage(100, Number.NaN, 595, 842));
});
