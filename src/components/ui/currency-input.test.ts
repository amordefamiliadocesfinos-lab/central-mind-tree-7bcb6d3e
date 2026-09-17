import { formatBrazilianCurrencyInput, parseBrazilianCurrencyInput } from '@/lib/currencyInput';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`CurrencyInput: ${message}`);
}

assert(parseBrazilianCurrencyInput('15')?.number === 15, 'aceita inteiro.');
assert(parseBrazilianCurrencyInput('15,50')?.number === 15.5, 'aceita vírgula decimal.');
assert(parseBrazilianCurrencyInput('1.250,00')?.number === 1250, 'aceita milhar pt-BR.');
assert(parseBrazilianCurrencyInput('') === null, 'vazio permanece inválido até a confirmação.');
assert(parseBrazilianCurrencyInput('-1') === null, 'negativo é bloqueado.');
assert(parseBrazilianCurrencyInput('abc') === null, 'texto inválido é bloqueado.');
assert(parseBrazilianCurrencyInput('0')?.number === 0, 'zero preserva a regra existente.');
assert(formatBrazilianCurrencyInput(1250) === 'R$ 1.250,00', 'formata em reais no blur.');

console.log('currency-input.test: OK');
