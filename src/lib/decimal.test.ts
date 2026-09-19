import { parseDecimalInput } from './decimal';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`decimal.test: ${message}`);
}

const parsePtBr = (value: string) => parseDecimalInput(value, { min: 0, maxDecimals: 10, locale: 'pt-BR' });

assert(parsePtBr('8742')?.number === 8742, '8742 deve permanecer 8742.');
assert(parsePtBr('8.742')?.number === 8742, '8.742 deve ser interpretado como milhar pt-BR.');
assert(parsePtBr('8,742')?.number === 8.742, '8,742 deve ser interpretado como decimal pt-BR.');
assert(parsePtBr('8.742,50')?.number === 8742.5, '8.742,50 deve ser interpretado como 8742.50.');

console.log('decimal.test: OK');
