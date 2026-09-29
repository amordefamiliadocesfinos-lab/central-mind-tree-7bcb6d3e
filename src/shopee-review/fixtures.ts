export const reviewAccounts = [
  { name: 'Loja Shopee Demonstração PJ', shopId: 'DEMO-PJ-001', status: 'Autorização pendente', scope: 'Pedidos, catálogo e logística' },
  { name: 'Loja Shopee Demonstração CPF', shopId: 'DEMO-CPF-002', status: 'Autorização simulada', scope: 'Tokens independentes por loja' },
];

export const reviewProducts = [
  { name: 'Alfajor 60 g', variation: 'Branco', listing: 'SHOPEE-DEMO-001', conversion: 'Caixa com 18 unidades' },
  { name: 'Trufa 30 g', variation: 'Meio Amargo', listing: 'SHOPEE-DEMO-002', conversion: 'Caixa com 30 unidades' },
  { name: 'Trufa 40 g', variation: 'Misto', listing: 'SHOPEE-DEMO-003', conversion: 'Kit demonstrativo' },
];

export const reviewOrders = [
  { id: 'DEMO-ORDER-1001', buyer: 'Cliente Demonstração', external: 'READY_TO_SHIP', internal: 'Aguardando separação', logistics: 'Coleta simulada' },
  { id: 'DEMO-ORDER-1002', buyer: 'Cliente Demonstração', external: 'SHIPPED', internal: 'Expedido (simulado)', logistics: 'Transportadora demonstrativa' },
];

export const reviewReceivables = [
  { reference: 'DEMO-ORDER-1001', gross: 'R$ 216,00', commission: 'R$ 28,08', discounts: 'R$ 4,00', net: 'R$ 183,92', expected: 'Repasse demonstrativo' },
  { reference: 'DEMO-ORDER-1002', gross: 'R$ 150,00', commission: 'R$ 19,50', discounts: 'R$ 0,00', net: 'R$ 130,50', expected: 'Conciliado (simulado)' },
];

export const reviewAudit = [
  ['Evento externo', 'order.status.changed (payload sintético)'],
  ['Registro bruto', 'Evento deduplicado e armazenado sem PII'],
  ['Projeção interna', 'Pedido demonstrativo atualizado'],
  ['Ação controlada', 'Nenhuma ação física, financeira ou externa executada'],
];
