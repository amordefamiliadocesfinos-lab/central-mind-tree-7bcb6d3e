import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateCommercialSaleLine, selectCommercialSaleLineVariant, type CommercialSaleDraftLine } from './commercialSaleDraft';
import type { CommercialPresentation } from '@/lib/products/commercialPresentation';

const presentation = (variantId: string | null, compositionMode: 'single' | 'composite' = 'single'): CommercialPresentation => ({
  id: 'pres', product_id: 'trufa', variant_id: variantId, composition_mode: compositionMode,
  name: 'Caixa', commercial_unit_label: 'caixa', conversion_factor: 30,
  components: compositionMode === 'composite'
    ? [{ product_id: 'trufa', variant_id: 'brigadeiro', quantity: 30 }] : [],
  is_active: true, notes: null, created_at: '', updated_at: '',
});
const line = (p: CommercialPresentation | null): CommercialSaleDraftLine => ({
  product_id: 'trufa', variant_id: 'brigadeiro', quantity: 90, unit_price: 42,
  commercial_quantity: 3, commercial_presentation: p, _unit_price_text: '42,00',
});

test('CRM e Operações: outro sabor não herda variante ou apresentação vinculada', () => {
  const original = line(presentation('brigadeiro'));
  const rows = [original];
  const result = duplicateCommercialSaleLine(rows, 0);
  assert.equal(result.length, 2);
  assert.strictEqual(result[0], original);
  assert.equal(result[1].variant_id, null);
  assert.equal(result[1].commercial_presentation, null);
  // 3 caixas do sabor anterior NÃO podem virar 3 unidades físicas.
  assert.equal(result[1].commercial_quantity, 1);
  assert.equal(result[1].quantity, 1);
  assert.equal(result[1].unit_price, 42);
  assert.equal(result[1]._unit_price_text, undefined);
  assert.equal(original.variant_id, 'brigadeiro');
  assert.equal(original._unit_price_text, '42,00');
});

test('cópia de unidade direta preserva quantidade comercial de vários sabores', () => {
  const direct = line(null);
  const result = duplicateCommercialSaleLine([direct], 0);
  assert.equal(result[1].commercial_quantity, 3);
  assert.equal(result[1].quantity, 3);
  assert.equal(result[1].commercial_presentation, null);
  assert.equal(result[1].variant_id, null);
});

test('apresentação independente e composição fixa conservam snapshot e quantidade física', () => {
  for (const p of [presentation(null), presentation(null, 'composite')]) {
    const duplicated = duplicateCommercialSaleLine([line(p)], 0)[1];
    assert.strictEqual(duplicated.commercial_presentation, p);
    assert.equal(duplicated.variant_id, null);
    assert.equal(duplicated.commercial_quantity, 3);
    assert.equal(duplicated.quantity, 90);
  }
});

test('sem produto ou linha inválida: não inventa entrada nem muta o array', () => {
  const blank = { ...line(null), product_id: '' };
  const source = [blank];
  assert.deepEqual(duplicateCommercialSaleLine(source, 0), source);
  assert.deepEqual(duplicateCommercialSaleLine(source, 4), source);
  assert.equal(source.length, 1);
});

test('quantidade inválida na origem não propaga lote inválido', () => {
  const invalid = { ...line(null), commercial_quantity: 0 };
  const duplicated = duplicateCommercialSaleLine([invalid], 0)[1];
  assert.equal(duplicated.commercial_quantity, 1);
  assert.equal(duplicated.quantity, 1);
});

test('linha direta duplicada preserva quantidade ao escolher novo sabor', () => {
  const copied = duplicateCommercialSaleLine([line(null)], 0)[1];
  const next = selectCommercialSaleLineVariant(copied, 'beijinho', 1.6);
  assert.equal(next.variant_id, 'beijinho');
  assert.equal(next.commercial_quantity, 3);
  assert.equal(next.quantity, 3);
  assert.equal(next.unit_price, 1.6);
  assert.equal(copied.variant_id, null);
});

test('troca de sabor de apresentação vinculada não transforma caixas em unidades', () => {
  const packed = line(presentation('brigadeiro'));
  const next = selectCommercialSaleLineVariant(packed, 'beijinho', 1.75);
  assert.equal(next.commercial_quantity, 1);
  assert.equal(next.quantity, 1);
  assert.equal(next.commercial_presentation, null);
  assert.equal(next.unit_price, 1.75);
  assert.equal(packed.commercial_quantity, 3);
});

test('preço digitado do sabor anterior não acompanha seleção de nova variante', () => {
  const original = line(null);
  const next = selectCommercialSaleLineVariant(original, 'morango', 0);
  assert.equal(next._unit_price_text, undefined);
  assert.equal(next.unit_price, 0);
  assert.equal(original._unit_price_text, '42,00');
});
