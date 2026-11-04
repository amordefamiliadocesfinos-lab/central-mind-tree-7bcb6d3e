import { getVerifiedDirectTrufflePrices, type CrmCommercialPriceRow } from './commercialPriceContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('CRM preço comercial vivo: ' + message);
}

const row = (name: string, price: number | string | null, overrides: Array<number | string | null> = []): CrmCommercialPriceRow => ({
  name, price, is_active: true, deleted_at: null,
  variants: overrides.map(price_override => ({ is_active: true, price_override })),
});

function run() {
  const thirty = 'TRUFA ARTESANAL 30G';
  const forty = 'TRUFA ARTESANAL 40G';
  const priced = [row(thirty, 1.15, [null, null]), row(forty, '1.35', [null])];
  const result = getVerifiedDirectTrufflePrices(priced);
  assert(result?.includes('30g: R$ 1,15'), 'deve respeitar centavos e distinguir 30g');
  assert(result?.includes('40g: R$ 1,35'), 'deve distinguir a linha 40g');
  assert(getVerifiedDirectTrufflePrices([row(thirty, null), row(forty, 1.35)]) === null, 'preço ausente não pode ser inferido');
  assert(getVerifiedDirectTrufflePrices([row(thirty, 1.15, [1.20]), row(forty, 1.35)]) === null, 'preço específico conflitante bloqueia preço genérico');
  assert(getVerifiedDirectTrufflePrices([row(thirty, 1.15), row(thirty, 1.15), row(forty, 1.35)]) === null, 'cadastro duplicado bloqueia preço');
  assert(getVerifiedDirectTrufflePrices([row(thirty, 1.15), row(forty, 1.35), row('EMBALAGEM PARA TRUFA', 0.12)]) === result, 'embalagem não pode contaminar a oferta');
  const inactive = row(thirty, 1.15); inactive.is_active = false;
  assert(getVerifiedDirectTrufflePrices([inactive, row(forty, 1.35)]) === null, 'produto inativo não pode ser anunciado');
  assert(getVerifiedDirectTrufflePrices([row(thirty, null, [1.15, 1.15]), row(forty, null, [1.35])]) !== null, 'sobrescritas unânimes podem compor preço');
}

run();
