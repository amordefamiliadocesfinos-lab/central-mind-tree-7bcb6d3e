import { calculateMrpProductionNeeds } from './useMRP';

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const demand = calculateMrpProductionNeeds([
  {
    product_id: 'master', variant_id: 'banana', quantity: 10,
    product_name: 'Produto mestre', variant_name: 'Banana', product_sku: 'MASTER', variant_sku: 'BANANA',
    unit: 'un', order_reference: 'PED-TESTE-1',
  },
  {
    product_id: 'simple', variant_id: null, quantity: 5,
    product_name: 'Produto simples', variant_name: null, product_sku: 'SIMPLE', variant_sku: null,
    unit: 'un', order_reference: 'PED-TESTE-2',
  },
], [
  { product_id: 'master', variant_id: 'banana', quantity: 4 },
  { product_id: 'simple', variant_id: null, quantity: 5 },
], [
  { product_id: 'master', variant_id: 'banana', target_quantity: 3, status: 'aberto' },
]);

const variantNeed = demand.find(need => need.product_id === 'master');
const simpleNeed = demand.find(need => need.product_id === 'simple');
expect(variantNeed?.variant_id === 'banana', 'MRP deve preservar a variante física na demanda.');
expect(variantNeed?.shortage === 3, 'MRP deve apenas calcular a falta após estoque e OP programada.');
expect(simpleNeed?.variant_id === null && simpleNeed.shortage === 0, 'Produto simples deve manter variante nula e estoque próprio.');
