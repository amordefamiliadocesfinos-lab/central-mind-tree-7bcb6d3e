import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const surfaces = [
  'src/pages/Operacoes.tsx',
  'src/components/crm/InboxSaleDialog.tsx',
];

test('CRM e Operações: lançamento de Pedido não exige seis colunas horizontais', () => {
  for (const path of surfaces) {
    const source = readFileSync(path, 'utf8');
    const grid = source.match(/<div className="([^"]+)" data-testid="commercial-order-item-grid">/);
    assert.ok(grid, `${path}: grade de itens comerciais não localizada`);
    assert.match(grid[1], /grid-cols-1/);
    assert.match(grid[1], /sm:grid-cols-2/);
    assert.match(grid[1], /min-w-0/);
    assert.doesNotMatch(grid[1], /grid-cols-3|grid-cols-6/);
    assert.match(source, /overflow-y-auto overflow-x-hidden/,
      `${path}: rolagem horizontal do formulário não está protegida`);
    assert.doesNotMatch(source, /min-w-\[10rem\] text-right/,
      `${path}: preço comercial não pode exigir largura mínima que estoure sua coluna`);
  }
});

test('Operações: duplicar sabor permanece visível fora da grade de campos', () => {
  const source = readFileSync('src/pages/Operacoes.tsx', 'utf8');
  assert.match(source, /data-testid="commercial-order-item-actions"/);
  assert.match(source, /Duplicar sabor/);
  assert.match(source, /onClick=\{\(\) => duplicateSaleItemForFlavor\(i\)\}/);
  const gridStart = source.indexOf('data-testid="commercial-order-item-grid"');
  const actionsStart = source.indexOf('data-testid="commercial-order-item-actions"', gridStart);
  const gridEnd = source.lastIndexOf('</div>', actionsStart);
  assert.ok(gridStart >= 0 && actionsStart > gridStart && gridEnd > gridStart,
    'Ações precisam estar após a grade de controles, sem sexta coluna oculta');
  assert.match(source.slice(gridEnd, actionsStart), /<div className="flex min-w-0 flex-wrap/);
});
