import test from 'node:test';
import assert from 'node:assert/strict';
import { fitOfficialPdfPage, fitCompactCompositionScale, planCombinedCompositionPages } from './printCombinedShopeeLabelLayout.mjs';

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

test('combined printing fits composition in remaining first-page space', () => {
  assert.equal(fitCompactCompositionScale(300, 300), 1);
  assert.equal(fitCompactCompositionScale(400, 300), 0.75);
  assert.equal(fitCompactCompositionScale(500, 300), 0.6);
  assert.throws(() => fitCompactCompositionScale(800, 200), /legível/);
  assert.throws(() => fitCompactCompositionScale(100, 0));
});

const rows = heights => heights.map(height => ({ height, before: 0 }));
test('compact: single official page plus composition stays on one sheet', () => {
  const p = planCombinedCompositionPages({
    officialPageCount: 1, rows: rows([150, 150]), firstPageAvailableHeight: 300, printableHeight: 700,
  });
  assert.equal(p.totalPages, 1);
  assert.equal(p.compactScale, 1);
  assert.deepEqual(p.compositionPages, []);
});
test('extensive label: next sheet instead of illegible cramped text', () => {
  const p = planCombinedCompositionPages({
    officialPageCount: 1, rows: rows([150, 150]), firstPageAvailableHeight: 50, printableHeight: 700,
  });
  assert.equal(p.totalPages, 2);
  assert.equal(p.compactScale, null);
  assert.deepEqual(p.compositionPages, [[0, 1]]);
});
test('multiple official PDF pages are all retained ahead of composition', () => {
  const p = planCombinedCompositionPages({
    officialPageCount: 3, rows: rows([100, 100]), firstPageAvailableHeight: 800, printableHeight: 700,
  });
  assert.equal(p.totalPages, 4);
  assert.equal(p.compactScale, null);
  assert.deepEqual(p.compositionPages, [[0, 1]]);
});
test('many composition rows are paginated in their original order, without truncation', () => {
  const input = rows(Array.from({ length: 43 }, () => 100));
  const p = planCombinedCompositionPages({
    officialPageCount: 1, rows: input, firstPageAvailableHeight: 20, printableHeight: 650,
    maxPages: 16,
  });
  assert.equal(p.totalPages, 9);
  assert.equal(p.compositionPages.flat().length, input.length);
  assert.deepEqual(p.compositionPages.flat(), input.map((_, index) => index));
});
test('long observations count their wrapping lines, margins and heading gaps', () => {
  const input = [
    { height: 110, before: 30 }, { height: 110, before: 0 },
    { height: 110, before: 30 }, { height: 110, before: 0 },
  ];
  const p = planCombinedCompositionPages({
    officialPageCount: 1, rows: input, firstPageAvailableHeight: 20, printableHeight: 250,
  });
  assert.deepEqual(p.compositionPages, [[0, 1], [2, 3]]);
});
test('boundary scale = 0.6 is legible, below 0.6 uses additional sheet', () => {
  const p = planCombinedCompositionPages({
    officialPageCount: 1, rows: rows([500]), firstPageAvailableHeight: 300, printableHeight: 700,
  });
  assert.equal(p.compactScale, 0.6);
  const q = planCombinedCompositionPages({
    officialPageCount: 1, rows: rows([500]), firstPageAvailableHeight: 299, printableHeight: 700,
  });
  assert.equal(q.totalPages, 2);
});
test('oversize row and unsafe page limit fail, never crop silently', () => {
  assert.throws(() => planCombinedCompositionPages({
    officialPageCount: 1, rows: rows([710]), firstPageAvailableHeight: 0, printableHeight: 700,
  }), /excede/);
  assert.throws(() => planCombinedCompositionPages({
    officialPageCount: 3, rows: rows([500, 500, 500]), firstPageAvailableHeight: 0, printableHeight: 700,
    maxPages: 4,
  }), /limite seguro/);
});
