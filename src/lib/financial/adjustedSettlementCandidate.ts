// E1.7 candidate: pure calculation only. No production writer or integration.
export type SettlementInput = {
  direction: 'pagar' | 'receber';
  remainingPrincipal: string;
  principal: string;
  interest?: string;
  penalty?: string;
  discount?: string;
  fee?: string;
  marketplaceFee?: string;
};
function cents(value: string): bigint {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error('Informe valores monetários não negativos com até duas casas decimais.');
  }
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function calculateAdjustedSettlement(input: SettlementInput) {
  if (input.direction !== 'pagar' && input.direction !== 'receber') throw new Error('Tipo inválido.');
  const remaining = cents(input.remainingPrincipal);
  const principal = cents(input.principal);
  const interest = cents(input.interest ?? '0');
  const penalty = cents(input.penalty ?? '0');
  const discount = cents(input.discount ?? '0');
  const fee = cents(input.fee ?? '0');
  const marketplaceFee = cents(input.marketplaceFee ?? '0');
  if (principal <= 0n || principal > remaining) throw new Error('Principal fora do saldo disponível.');
  if (input.direction === 'pagar' && marketplaceFee !== 0n) throw new Error('Taxa marketplace em conta a pagar fora do contrato candidato.');
  if (discount > principal + interest + penalty) throw new Error('Desconto superior ao principal e acréscimos.');
  const adjustments = interest + penalty - discount + (input.direction === 'pagar' ? fee : -fee - marketplaceFee);
  const cash = principal + adjustments;
  if (cash <= 0n) throw new Error('Liquidação sem caixa positivo exige contrato específico.');
  return { principal, interest, penalty, discount, fee, marketplaceFee, adjustments, cash, remainingPrincipal: remaining - principal, fullySettled: remaining === principal };
}
