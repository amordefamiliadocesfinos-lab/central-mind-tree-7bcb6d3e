import { getOfficialWhatsappPriceQuote, type CrmCommercialPriceRow } from './commercialPriceContext';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error('Tabela WhatsApp CRM: ' + message);
}
const unitQty = [[1, 20], [21, 200], [201, 500], [501, 1000], [1001, 2000], [2001, null]];
const bandejaQty = [[1, 1], [2, 10], [11, 25], [26, 50], [51, 100], [101, null]];
const products = [
  ['TRUFA ARTESANAL 30G', 'unit', [1.40, 1.30, 1.25, 1.20, 1.15, 1.10]],
  ['TRUFA ARTESANAL 40G', 'unit', [1.60, 1.50, 1.45, 1.40, 1.35, 1.30]],
  ['CHOCOIM ARTESANAL 34G AMENDOIM - EMBALAGEM FLOWPACK', 'unit', [1.40, 1.30, 1.25, 1.20, 1.15, 1.10]],
  ['ALFAJOR ARTESANAL 60G DOCE DE LEITE', 'bandeja', [35, 32, 31, 30, 29, 27.5]],
  ['Caseirinho Artesanal 32g Amendoim – Cobertura de Chocolate Variado', 'bandeja', [35, 32, 31, 30, 29, 27.5]],
  ['Pé de Moça Artesanal 35g Amendoim – Embalagem Flowpack', 'bandeja', [35, 32, 31, 30, 29, 27.5]],
  ['Torrão Artesanal 70g Amendoim – Embalagem Flowpack', 'bandeja', [35, 32, 31, 30, 29, 27.5]],
] as const;
const rows: CrmCommercialPriceRow[] = products.map(([name, unit, prices]) => ({
  name, is_active: true, deleted_at: null,
  attributes: { crm_direct_whatsapp_price_table: {
    version: 1, channel: 'whatsapp_direto', approved_on: '2026-11-04',
    valid_from: '2026-11-04', valid_until: null, unit,
    prices: prices.map((price_brl, index) => ({
      level: index ? 'atacado_' + index : 'varejo',
      min_qty: (unit === 'unit' ? unitQty : bandejaQty)[index][0]!,
      max_qty: (unit === 'unit' ? unitQty : bandejaQty)[index][1],
      price_brl,
    })),
  } },
}));

function run() {
  const today = '2026-11-04';
  assert(getOfficialWhatsappPriceQuote(rows, 'Qual o valor das trufas e sabores?', today)?.includes('30g: R$ 1,40'), 'Eduarda deve receber varejo 30g');
  assert(getOfficialWhatsappPriceQuote(rows, 'Qual o valor das trufas e sabores?', today)?.includes('40g: R$ 1,60'), 'Eduarda deve receber varejo 40g');
  assert(getOfficialWhatsappPriceQuote(rows, 'Quero 60 trufas', today)?.includes('30g: R$ 1,30'), '60 unidades deve corresponder ao Atacado 1');
  assert(getOfficialWhatsappPriceQuote(rows, 'Quero 2001 trufas', today)?.includes('40g: R$ 1,30'), '2001 unidades deve corresponder ao Atacado 5');
  assert(getOfficialWhatsappPriceQuote(rows, 'Quanto custa 26 bandejas de alfajor?', today)?.includes('R$ 30,00 por bandeja'), 'alfajor 26 bandejas deve usar Atacado 3');
  assert(getOfficialWhatsappPriceQuote(rows, 'Qual o valor do pé de moça?', today)?.includes('R$ 35,00 por bandeja'), 'bandeja varejo 35');
  assert(getOfficialWhatsappPriceQuote(rows, 'Quanto custa o Chocoim?', today)?.includes('R$ 1,40 por unidade'), 'Chocoim varejo');
  assert(getOfficialWhatsappPriceQuote(rows, 'Quanto custa o Torrão?', today)?.includes('R$ 35,00 por bandeja'), 'Torrão varejo');
  assert(getOfficialWhatsappPriceQuote(rows, 'Quanto custa a trufa 30g?', '2026-11-03') === null, 'não citar preço antes da vigência');
  assert(getOfficialWhatsappPriceQuote(rows.filter(r => r.name !== 'TRUFA ARTESANAL 40G'), 'Qual o preço das trufas?', today) === null, 'sem ambos os produtos não deve usar preço parcial como total');
  assert(getOfficialWhatsappPriceQuote([...rows, rows[0]], 'Qual o valor das trufas?', today) === null, 'produto duplicado deve bloquear');
  const wrong = structuredClone(rows);
  wrong[0].attributes!.crm_direct_whatsapp_price_table!.prices[1].min_qty = 23;
  assert(getOfficialWhatsappPriceQuote(wrong, 'Qual o preço da trufa 30g?', today) === null, 'faixas com lacunas bloqueadas');
}
run();
