export type VariantAttributes = Record<string, string>;

export function parseVariantAttributes(value: string): VariantAttributes {
  return value
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<VariantAttributes>((attributes, item) => {
      const [key, ...valueParts] = item.split('=');
      const normalizedKey = key?.trim();
      const normalizedValue = valueParts.join('=').trim();

      if (normalizedKey && normalizedValue) attributes[normalizedKey] = normalizedValue;
      return attributes;
    }, {});
}

export function formatVariantAttributes(attributes: Record<string, unknown> | null | undefined): string {
  if (!attributes) return '';

  return Object.entries(attributes)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('; ');
}

export function getVariantValue(override: number | null | undefined, masterValue: number | null | undefined): number | null {
  return override ?? masterValue ?? null;
}

export function getVariantUnit(override: string | null | undefined, masterUnit: string | null | undefined): string {
  return override || masterUnit || 'un';
}

type PhysicalUnitProduct = { unit?: string | null } | null | undefined;
type PhysicalUnitVariant = { unit?: string | null } | null | undefined;

/** Unidade canônica da identidade física: variante quando definida, senão Produto Mestre. */
export function getPhysicalIdentityUnit(product: PhysicalUnitProduct, variant?: PhysicalUnitVariant): string {
  return getVariantUnit(variant?.unit, product?.unit);
}
