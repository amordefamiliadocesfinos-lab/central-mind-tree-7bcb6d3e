import { parseDecimalInput, type ParsedDecimal } from '@/lib/decimal';
import { formatCurrency } from '@/lib/utils';

/** A única regra de entrada monetária usada pelos itens de Pedido e Venda. */
export function parseBrazilianCurrencyInput(value: string): ParsedDecimal | null {
  // O fluxo atual já permite item gratuito; preservamos zero e bloqueamos
  // somente vazio, negativos, NaN e infinitos no momento da confirmação.
  return parseDecimalInput(value, { locale: 'pt-BR', min: 0, maxDecimals: 10 });
}

export function formatBrazilianCurrencyInput(value: number): string {
  return formatCurrency(value, { maxDecimals: 10 });
}
