/**
 * Projeção exclusiva da UX de Separação.
 * Não altera a identidade física, apresentações, quantidades ou baixas do pedido.
 * Composições pertencem ao mesmo kit SOMENTE se compartilharem commercial_group_id.
 */
export type SeparationSourceItem = {
  id: string;
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  commercial_group_id?: string | null;
  commercial_presentation_id?: string | null;
  commercial_presentation_name?: string | null;
  commercial_unit_label?: string | null;
  commercial_quantity?: number | null;
  commercial_conversion_factor?: number | null;
  physical_unit_label?: string | null;
  notes?: string | null;
  product?: { name: string; unit?: string | null } | null;
  variant?: { variant_name: string; unit?: string | null } | null;
};

export type SeparationDisplayEntry = {
  key: string;
  productName: string;
  presentationName?: string;
  commercialSummary?: string;
  composition?: string;
  components: Array<{ key: string; label: string; quantityText: string }>;
  totalText?: string;
};

const integer = (n: number) => Number.isFinite(n) && Number.isInteger(n);
const numberPt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const physicalUnit = (item: SeparationSourceItem) =>
  item.physical_unit_label || item.variant?.unit || item.product?.unit || 'un';
const formattedPhysical = (item: SeparationSourceItem) =>
  `${numberPt(Number(item.quantity))} ${physicalUnit(item)}`;

/** A embalagem comercial pertence ao pedido; a linha física pertence ao estoque. */
function verifiedPhysicalTotal(item: SeparationSourceItem, commercialQty: number, factor: number) {
  const physical = Number(item.quantity);
  return Number.isFinite(physical) && physical > 0 &&
    Number.isFinite(commercialQty) && commercialQty > 0 &&
    Number.isFinite(factor) && factor > 0 &&
    Math.abs(physical - commercialQty * factor) < 0.000001;
}

function pluralUnit(unit: string, quantity: number) {
  const value = unit.toLocaleLowerCase('pt-BR').trim();
  const plural: Record<string, string> = {
    kit: 'kits', bandeja: 'bandejas', pacote: 'pacotes',
    saco: 'sacos', caixa: 'caixas', unidade: 'unidades', un: 'un',
    display: 'displays', fardo: 'fardos', balde: 'baldes', pote: 'potes',
    frasco: 'frascos', embalagem: 'embalagens', bandejão: 'bandejões',
  };
  return quantity === 1 ? value : (plural[value] || value);
}

/**
 * Legacy Shopee rows may have no commercial snapshot, although their original
 * purchased variation remains in notes. Only infer the display for the known
 * Biscoito physical variants and an explicit "N pacote(s) M uni" Shopee
 * variation. Never infer packs from 44/22 alone or change order quantities.
 */
function biscuitPackagesFromShopeeVariation(item: SeparationSourceItem): string | undefined {
  if (item.product_id !== 'c4580ad6-e53a-4a36-9696-a65f2a95da00'
    || !['fa0814a0-9cd0-4d8a-b01d-2febdd1d7dcc',
          '34188174-5906-4f92-a16d-4e5207f37dd5'].includes(item.variant_id ?? '')
    || !item.notes || !/shopee/i.test(item.notes)) return undefined;
  const variation = item.notes.match(/(?:^|\|)\s*variation\s*:\s*([^|]*)/i)?.[1];
  const packs = variation?.match(/\b(\d+)\s*pacotes?\s*(?:de\s*)?(\d+)\s*(?:uni(?:dades?)?|un(?:idades?)?)\b/i);
  if (!packs) return undefined;
  const packsPerMarketplaceUnit = Number(packs[1]);
  const unitsPerMarketplaceUnit = Number(packs[2]);
  const physicalUnits = Number(item.quantity);
  if (!Number.isSafeInteger(packsPerMarketplaceUnit) || packsPerMarketplaceUnit <= 0 ||
    !Number.isSafeInteger(unitsPerMarketplaceUnit) || unitsPerMarketplaceUnit !== packsPerMarketplaceUnit * 22 ||
    !Number.isSafeInteger(physicalUnits) || physicalUnits <= 0 ||
    physicalUnits % unitsPerMarketplaceUnit !== 0) return undefined;
  const totalPacks = packsPerMarketplaceUnit * (physicalUnits / unitsPerMarketplaceUnit);
  return `${numberPt(totalPacks)} ${pluralUnit('pacote', totalPacks)} de 22 un`;
}

/**
 * Normalização contextual universal e conservadora para linhas externas SEM
 * snapshot comercial. Não utiliza o nome de um Produto Mestre como regra.
 *
 * A origem externa precisa registrar a variação efetivamente comprada. Quando
 * não existir evidência suficiente, preservar somente o saldo físico da linha.
 *
 * Itens de uma composição Shopee nunca herdam aqui a apresentação inteira:
 * para eles é necessário commercial_group_id/snapshot (ou projeção segura
 * em etapa própria da integração), senão haveria "1 kit" em cada componente.
 */
function verifiedMarketplacePresentation(item: SeparationSourceItem, ambiguousExternalGroup: boolean): string | undefined {
  const notes = item.notes ?? '';
  // position=0 is also used on genuine SINGLE-item Shopee imports.
  // Reject multi-line groups, explicit compositions and nonfirst components instead.
  const componentPosition = notes.match(/(?:^|\|)\s*composition_position\s*=\s*(\d+)/i)?.[1];
  if (!/\bshopee\b/i.test(notes) || ambiguousExternalGroup ||
      /composi(?:ç|c)(?:ão|ao)\s*\d+\s*\/\s*\d+/i.test(notes) ||
      (componentPosition != null && Number(componentPosition) > 0)) return undefined;
  const variation = notes.match(/(?:^|\|)\s*variation\s*:\s*([^|]*)/i)?.[1]?.trim();
  if (!variation) return undefined;
  const multiplier = Number(notes.match(/(?:^|\|)\s*physical_multiplier\s*=\s*(\d+(?:\.\d+)?)/i)?.[1] ??
    notes.match(/Multiplicador f[ií]sico\s*:\s*(\d+(?:[,.]\d+)?)/i)?.[1]?.replace(',', '.') ?? NaN);
  const rowPhysical = Number(item.quantity);
  if (!Number.isFinite(rowPhysical) || rowPhysical <= 0) return undefined;
  const fromExternal = Number(notes.match(/(?:^|\|)\s*commercial_quantity\s*=\s*(\d+)/i)?.[1] ??
    notes.match(/Shopee comercial\s*:\s*(\d+)/i)?.[1] ?? NaN);
  // Um multiplicador presente deve concordar com a linha física registrada.
  const externalQty = Number.isSafeInteger(fromExternal) && fromExternal > 0 ? fromExternal :
    Number.isFinite(multiplier) && multiplier > 0 && Number.isSafeInteger(rowPhysical / multiplier)
      ? rowPhysical / multiplier : NaN;
  if (!Number.isSafeInteger(externalQty) || externalQty < 1 ||
      (Number.isFinite(multiplier) && multiplier > 0 && !verifiedPhysicalTotal(item, externalQty, multiplier))) {
    return undefined;
  }

  // Ex.: 2 pacote 44 uni -> 2 pacotes de 22 un; 4 kit 72 uni -> 4 kits de 18 un.
  const pack = variation.match(/\b(\d+)\s*(pacotes?|kits?|bandejas?|caixas?|sacos?|displays?|fardos?)\s*(?:de\s*)?(\d+)\s*(?:uni(?:dades?)?|un(?:idades?)?|und)\b/i);
  if (pack) {
    const listedPacks = Number(pack[1]);
    const totalPerExternal = Number(pack[3]);
    const size = totalPerExternal / listedPacks;
    if (!Number.isSafeInteger(size) || size < 1 ||
      // Quantidade de embalagem física não é quantidade de peças soltas.
      (!['un', 'unidade', 'unidades'].includes(physicalUnit(item).toLowerCase())) ||
      !verifiedPhysicalTotal(item, externalQty, totalPerExternal)) return undefined;
    const totalPacks = listedPacks * externalQty;
    const word = pack[2].toLowerCase().replace(/s$/, '');
    return `${numberPt(totalPacks)} ${pluralUnit(word, totalPacks)} de ${numberPt(size)} un`;
  }

  // Ex.: variation:4 kg, 4000 gramas; legacy 2kg × 2 = 4000g.
  const weight = variation.match(/^(\d+(?:[,.]\d+)?)\s*(kg|g)\b/i);
  if (weight) {
    const size = Number(weight[1].replace(',', '.'));
    const normalizedUnit = weight[2].toLowerCase();
    if (!(size > 0)) return undefined;
    const totalWeight = size * externalQty;
    const expectedGrams = totalWeight * (normalizedUnit === 'kg' ? 1000 : 1);
    const physicalStockUnit = physicalUnit(item).toLowerCase();
    if ((physicalStockUnit === 'g' || (!item.physical_unit_label && !item.variant?.unit && !item.product?.unit && multiplier === size * (normalizedUnit === 'kg' ? 1000 : 1))) &&
        Math.abs(rowPhysical - expectedGrams) < 0.000001) {
      return `${numberPt(totalWeight)} ${normalizedUnit}`;
    }
    // Recipiente físico já embalado: não afirmar disponibilidade em gramas.
    if (['un', 'unidade'].includes(physicalStockUnit) &&
      multiplier === 1 && rowPhysical === externalQty &&
      item.variant?.variant_name && /\b(embalagem|fechad[ao]|lacrad[ao]|saco|balde)\b/i.test(item.variant.variant_name) &&
      new RegExp(String.raw`\b${size}\s*${normalizedUnit}\b`, 'i').test(item.variant.variant_name)) {
      return `${numberPt(externalQty)} ${pluralUnit('embalagem', externalQty)} de ${numberPt(size)} ${normalizedUnit}`;
    }
  }
  return undefined;
}

function singleSummary(item: SeparationSourceItem, ambiguousExternalGroup = false): string | undefined {
  if (item.commercial_quantity == null || !item.commercial_unit_label) {
    return ambiguousExternalGroup ? undefined : biscuitPackagesFromShopeeVariation(item) ?? verifiedMarketplacePresentation(item, false);
  }
  const quantity = Number(item.commercial_quantity);
  const factor = Number(item.commercial_conversion_factor ?? 1);
  if (!(quantity > 0) || !Number.isFinite(quantity) || !Number.isFinite(factor) ||
      !verifiedPhysicalTotal(item, quantity, factor)) return undefined;
  const unit = pluralUnit(item.commercial_unit_label, quantity);
  if (factor > 1 && !['kg', 'g'].includes(item.commercial_unit_label.toLocaleLowerCase('pt-BR'))) {
    return `${numberPt(quantity)} ${unit} de ${numberPt(factor)} ${physicalUnit(item)}`;
  }
  return `${numberPt(quantity)} ${unit}`;
}

function abbreviatedPresentation(name: string | null | undefined) {
  if (!name?.trim()) return 'Apresentação composta';
  return name.includes('—') ? name.split('—').slice(1).join('—').trim() : name.trim();
}

function alfajorColor(name: string) {
  if (/meio amargo|preto/i.test(name)) return 'Preto';
  if (/branco/i.test(name)) return 'Branco';
  return null;
}

function composedGroup(key: string, items: SeparationSourceItem[]): SeparationDisplayEntry {
  const counts = new Map<string, { name: string; count: number }>();
  for (const item of items) {
    const existing = counts.get(item.product_id);
    counts.set(item.product_id, {
      name: item.product?.name || 'Produto',
      count: (existing?.count || 0) + 1,
    });
  }
  const main = [...counts.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  const mainId = main[0];
  const productName = main[1].name;
  const first = items[0];
  const commonQuantity = Number(first.commercial_quantity);
  const reliableCommercial = Number.isSafeInteger(commonQuantity) && commonQuantity > 0
    && Boolean(first.commercial_presentation_id)
    && items.every(item => item.commercial_group_id === first.commercial_group_id
      && item.commercial_presentation_id === first.commercial_presentation_id
      && Number(item.commercial_quantity) === commonQuantity);
  const samePhysicalUnit = items.every(item => physicalUnit(item) === physicalUnit(first));
  const total = items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const totalText = samePhysicalUnit && Number.isFinite(total)
    ? `${numberPt(total)} ${physicalUnit(first)}` : undefined;
  const unit = first.commercial_unit_label || 'kit';
  const commercialSummary = reliableCommercial
    ? `${numberPt(commonQuantity)} ${pluralUnit(unit, commonQuantity)}${totalText ? ` · ${totalText}` : ''}`
    : undefined;

  // A bandeja mista de Alfajor já diz ao separador como MONTAR cada bandeja.
  // Ex.: 3 bandejas — 9 Preto + 9 Branco por bandeja — total 54 un.
  const alfajorMix = reliableCommercial && /alfajor/i.test(productName)
    && unit.toLowerCase() === 'bandeja' && items.length === 2
    && items.every(item => item.product_id === mainId && integer(Number(item.quantity) / commonQuantity)
      && (alfajorColor(item.variant?.variant_name || '') !== null));
  if (alfajorMix) {
    const parts = items
      .map(item => ({ color: alfajorColor(item.variant?.variant_name || '')!, each: Number(item.quantity) / commonQuantity }))
      .sort((a, b) => (a.color === 'Preto' ? -1 : 1) - (b.color === 'Preto' ? -1 : 1));
    if (parts[0].color !== parts[1].color) {
      return {
        key, productName, presentationName: 'Bandeja Mista', commercialSummary,
        composition: `${parts.map(x => `${numberPt(x.each)} ${x.color}`).join(' + ')} por bandeja`,
        components: [], totalText: undefined,
      };
    }
  }

  // CHOCOIM: "Mesclado" é uma variante FÍSICA própria e não faz parte
  // de uma bandeja MISTA comercial (Preto + Branco em unidades separadas).
  // Exibir a montagem por embalagem, sem linhas repetidas 30 + 30 etc.
  const chocoimMixedIds = new Set([
    'c34c0a34-2026-4000-8000-000000000020',
    'c34c0a34-2026-4000-8000-000000000040',
    'c34c0a34-2026-4000-8000-000000000080',
    'c34c0a34-2026-4000-8000-000000000560',
  ]);
  const chocoimMix = reliableCommercial && /chocoim/i.test(productName)
    && chocoimMixedIds.has(first.commercial_presentation_id!)
    && ['bandeja', 'kit', 'caixa'].includes(unit.toLocaleLowerCase('pt-BR'))
    && items.length === 2 && samePhysicalUnit && physicalUnit(first) === 'un'
    && items.every(item => item.product_id === mainId
       && ['3e67edc6-1cb7-463e-8c8e-a50bfb5092f7',
           '66708945-22f3-43bf-b68e-127021448cd8'].includes(item.variant_id ?? '')
       && integer(Number(item.quantity) / commonQuantity))
    && new Set(items.map(item => item.variant_id)).size === 2;

  if (chocoimMix) {
    const eachBlack = Number(items.find(item => item.variant_id ===
      '3e67edc6-1cb7-463e-8c8e-a50bfb5092f7')!.quantity) / commonQuantity;
    const eachWhite = Number(items.find(item => item.variant_id ===
      '66708945-22f3-43bf-b68e-127021448cd8')!.quantity) / commonQuantity;
    if (eachBlack === eachWhite && (eachBlack + eachWhite) * commonQuantity === total) {
      const unitName = unit.toLocaleLowerCase('pt-BR');
      return {
        key, productName,
        presentationName: `${unitName === 'bandeja' ? 'Bandeja Mista' : unitName === 'caixa' ? 'Caixa Mista' : 'Kit Misto'}`,
        commercialSummary,
        composition: `${numberPt(eachBlack)} Preto + ${numberPt(eachWhite)} Branco por ${unitName}`
          + (unitName === 'caixa' && eachBlack + eachWhite === 560 ? ' (28 bandejas de 20)' : ''),
        components: [], totalText: undefined,
      };
    }
  }

  return {
    key, productName,
    presentationName: abbreviatedPresentation(first.commercial_presentation_name),
    commercialSummary,
    components: items.map(item => {
      const physicalName = item.variant?.variant_name || 'Item físico';
      const fromOtherMaster = item.product_id !== mainId ? ` · ${item.product?.name || 'Outro produto'}` : '';
      return { key: item.id, label: physicalName + fromOtherMaster, quantityText: formattedPhysical(item) };
    }),
    totalText: reliableCommercial && totalText ? `Total para separar: ${totalText}` : undefined,
  };
}

function externalMappingGroupKey(item: SeparationSourceItem): string | null {
  // Key exists for import metadata, never inferred from item name/product alone.
  const notes = item.notes ?? '';
  if (!/\bshopee\b/i.test(notes)) return null;
  const mappingId = notes.match(/(?:^|\|)\s*mapping_id\s*=\s*([0-9a-f-]{36})/i)?.[1];
  if (mappingId) return `mapping:${mappingId.toLowerCase()}`;
  const key = notes.match(/(?:^|\|)\s*external_item_key\s*=\s*([^|]*)/i)?.[1]?.trim();
  return key ? `external:${key.toLowerCase()}` : null;
}

export function createSeparationDisplayEntries(items: readonly SeparationSourceItem[]): SeparationDisplayEntry[] {
  // Imported compositions may span different Product Masters: the SAME mapping
  // appearing in multiple physical rows is not automatically multiple kits.
  const externalCounts = new Map<string, number>();
  for (const item of items) {
    const key = externalMappingGroupKey(item);
    if (key) externalCounts.set(key, (externalCounts.get(key) ?? 0) + 1);
  }
  const grouped = new Map<string, SeparationSourceItem[]>();
  for (const item of items) {
    // Never infer a kit from product name, flavor or presentation without an explicit group id.
    const key = item.commercial_group_id ? `composite:${item.commercial_group_id}` : `item:${item.id}`;
    const rows = grouped.get(key) ?? [];
    rows.push(item);
    grouped.set(key, rows);
  }
  return [...grouped.entries()].map(([key, rows]) => {
    if (key.startsWith('composite:') && rows.length > 1) return composedGroup(key, rows);
    const item = rows[0];
    return {
      key, productName: item.product?.name || 'Produto',
      commercialSummary: singleSummary(item, (externalMappingGroupKey(item) != null && (externalCounts.get(externalMappingGroupKey(item)!) ?? 0) > 1)),
      components: [{
        key: item.id, label: item.variant?.variant_name || 'Quantidade física',
        quantityText: formattedPhysical(item),
      }],
    };
  });
}
