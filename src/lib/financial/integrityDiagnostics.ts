// FIN E1.4–E1.6: exact decimal diagnostics, never a financial writer.
export interface IntegrityEntry {
  id: string; type: string; description: string | null; order_id: string | null;
  value: string; value_paid: string | null; lifecycle_status: string | null;
  is_conciliated: boolean | null;
}
export interface IntegrityMovement { id: string; entry_id: string; account_id: string | null; value: string }
export interface IntegrityAccount { id: string; name: string; initial_balance: string; current_balance: string }
export interface IntegrityOrder { id: string; order_number: string | null; total_value: string | null }

// PostgreSQL numeric::text is read as a string. No conversion through JS Number.
type Decimal = { units: bigint; scale: number };
const pow10 = (n: number) => 10n ** BigInt(n);
function decimal(value: string | null): Decimal {
  if (value === null) return { units: 0n, scale: 0 };
  if (typeof value !== 'string' || !/^-?\d+(\.\d+)?$/.test(value)) throw new Error('Valor decimal não verificável.');
  const [whole, frac = ''] = value.replace(/^-/, '').split('.');
  return { units: BigInt(whole + frac) * (value.startsWith('-') ? -1n : 1n), scale: frac.length };
}
const zero = decimal('0');
function add(a: Decimal, b: Decimal): Decimal {
  const scale = Math.max(a.scale, b.scale);
  return { units: a.units * pow10(scale - a.scale) + b.units * pow10(scale - b.scale), scale };
}
function sub(a: Decimal, b: Decimal): Decimal { return add(a, { ...b, units: -b.units }); }
function cents(a: Decimal): bigint {
  if (a.scale <= 2) return a.units * pow10(2 - a.scale);
  const divisor = pow10(a.scale - 2);
  const abs = a.units < 0n ? -a.units : a.units;
  const rounded = (abs + divisor / 2n) / divisor;
  return a.units < 0n ? -rounded : rounded;
}
function fractional(a: Decimal): boolean {
  return a.scale > 2 && a.units % pow10(a.scale - 2) !== 0n;
}
function raw(a: Decimal): string {
  const digits = (a.units < 0n ? -a.units : a.units).toString().padStart(a.scale + 1, '0');
  return (a.units < 0n ? '-' : '') + (a.scale ? digits.slice(0, -a.scale) + '.' + digits.slice(-a.scale) : digits);
}
function money(a: Decimal): string { return raw({ units: cents(a), scale: 2 }); }
export function analyzeFinancialIntegrity(entries: IntegrityEntry[], movements: IntegrityMovement[], accounts: IntegrityAccount[], orders: IntegrityOrder[]) {
  const entryMap = new Map(entries.map(e => [e.id, e]));
  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const orderMap = new Map(orders.map(o => [o.id, o]));
  const sums = new Map<string, Decimal>();
  const accountSums = new Map<string, Decimal>();
  const counts = new Map<string, number>();
  const fractionalMovements = new Set<string>();
  let unknownMovementLinks = 0;
  for (const m of movements) {
    const v = decimal(m.value);
    const e = entryMap.get(m.entry_id);
    sums.set(m.entry_id, add(sums.get(m.entry_id) || zero, v));
    counts.set(m.entry_id, (counts.get(m.entry_id) || 0) + 1);
    if (fractional(v)) fractionalMovements.add(m.entry_id);
    if (!e || !m.account_id || !accountMap.has(m.account_id) || !['pagar', 'receber'].includes(e.type)) {
      unknownMovementLinks++;
      continue;
    }
    const signed = e.type === 'receber' ? v : sub(zero, v);
    accountSums.set(m.account_id, add(accountSums.get(m.account_id) || zero, signed));
  }
  const entryFindings = entries.map(e => {
    const due = decimal(e.value), paid = decimal(e.value_paid), sum = sums.get(e.id) || zero;
    const residual = sub(due, paid);
    const order = e.order_id ? orderMap.get(e.order_id) : undefined;
    // Compare sale principal only; payable logistics may legitimately differ from order total.
    const orderDifference = e.type === 'receber' && order?.total_value != null && cents(due) !== cents(decimal(order.total_value));
    const fractionalValue = fractional(due) || fractional(paid) || fractionalMovements.has(e.id);
    const subcentOpen = e.lifecycle_status === 'active' && paid.units > 0n && residual.units > 0n && add(residual, decimal('-0.01')).units < 0n;
    const paidMismatch = sub(paid, sum).units !== 0n;
    const above = paid.units >= 0n && residual.units < 0n;
    const cancelledWithMovement = e.lifecycle_status === 'cancelled' && (counts.get(e.id) || 0) > 0;
    const missingOrigin = e.type === 'receber' && !!e.order_id && (!order || order.total_value == null);
    const economic = !!orderDifference || cents(paid) !== cents(sum) || cents(paid) > cents(due) || cancelledWithMovement || missingOrigin;
    const flags = [
      fractionalValue && 'Precisão fracionada',
      subcentOpen && 'Saldo residual subcentavo',
      above && 'Pago acima da obrigação',
      paidMismatch && 'Valor pago ≠ soma de movimentos',
      orderDifference && 'Valor do pedido ≠ obrigação',
      cancelledWithMovement && 'Cancelado com movimento',
      missingOrigin && 'Origem não visível',
      e.is_conciliated && 'Conciliado — revisão protegida',
    ].filter(Boolean) as string[];
    return { id: e.id, description: e.description, orderNumber: order?.order_number, due: e.value, paid: e.value_paid ?? '0', movementSum: raw(sum), residual: raw(residual), orderTotal: order?.total_value, flags, fractionalValue, subcentOpen, above, paidMismatch, economic, requiresReview: e.is_conciliated || economic || paidMismatch, relevant: fractionalValue || subcentOpen || above || paidMismatch || orderDifference || cancelledWithMovement || missingOrigin };
  }).filter(e => e.relevant);
  const accountFindings = accounts.map(a => {
    const expected = add(decimal(a.initial_balance), accountSums.get(a.id) || zero);
    const difference = sub(decimal(a.current_balance), expected);
    return { id: a.id, name: a.name, initial: a.initial_balance, stored: a.current_balance, expected: raw(expected), difference: raw(difference), monetaryDifference: money(difference), hasDifference: difference.units !== 0n };
  });
  return { entryFindings, accountFindings, unknownMovementLinks, counts: { entries: entries.length, movements: movements.length, accounts: accounts.length, orders: orders.length } };
}
