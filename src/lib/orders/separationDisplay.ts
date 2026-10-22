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
  product?: { name: string } | null;
  variant?: { variant_name: string } | null;
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
const formattedPhysical = (item: SeparationSourceItem) =>
  `${numberPt(Number(item.quantity))} ${item.physical_unit_label || 'un'}`;

function pluralUnit(unit: string, quantity: number) {
  const value = unit.toLocaleLowerCase('pt-BR').trim();
  const plural: Record<string, string> = {
    kit: 'kits', bandeja: 'bandejas', pacote: 'pacotes',
    saco: 'sacos', caixa: 'caixas', unidade: 'unidades', un: 'un',
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
  const variation = item.notes.match(/(?:^|\\|)\\s*variation\\s*:\\s*([^|]*)/i)?.[1];
  const packs = variation?.match(/\\b(\\d+)\\s*pacotes?\\s*(?:de\\s*)?(\\d+)\\s*(?:uni(?:dades?)?|un(?:idades?)?)\\b/i);
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

function singleSummary(item: SeparationSourceItem): string | undefined {
  if (item.commercial_quantity == null || !item.commercial_unit_label) {
    return biscuitPackagesFromShopeeVariation(item);
  }
  const quantity = Number(item.commercial_quantity);
  const factor = Number(item.commercial_conversion_factor ?? 1);
  if (!(quantity > 0) || !Number.isFinite(quantity) || !Number.isFinite(factor)) return undefined;
  const unit = pluralUnit(item.commercial_unit_label, quantity);
  if (factor > 1 && !['kg', 'g'].includes(item.commercial_unit_label.toLocaleLowerCase('pt-BR'))) {
    return `${numberPt(quantity)} ${unit} de ${numberPt(factor)} ${item.physical_unit_label || 'un'}`;
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
  const samePhysicalUnit = items.every(item => (item.physical_unit_label || 'un') === (first.physical_unit_label || 'un'));
  const total = items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const totalText = samePhysicalUnit && Number.isFinite(total)
    ? `${numberPt(total)} ${first.physical_unit_label || 'un'}` : undefined;
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

export function createSeparationDisplayEntries(items: readonly SeparationSourceItem[]): SeparationDisplayEntry[] {
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
      commercialSummary: singleSummary(item),
      components: [{
        key: item.id, label: item.variant?.variant_name || 'Quantidade física',
        quantityText: formattedPhysical(item),
      }],
    };
  });
}
