export interface ParsedDecimal {
  /** Normalized for DB/JS: decimal separator '.' and no thousand separators */
  normalized: string;
  /** Numeric version (may have floating point precision limits) */
  number: number;
}

export type DecimalInputLocale = 'auto' | 'pt-BR';

function normalizePtBrDecimal(s: string): string {
  const sign = s.startsWith('-') ? '-' : '';
  let unsigned = s.replace(/^[+-]/, '');

  // Keep only digits and separators before deciding their meaning.
  unsigned = unsigned.replace(/[^0-9.,]/g, '');

  const lastComma = unsigned.lastIndexOf(',');
  const lastDot = unsigned.lastIndexOf('.');

  if (lastComma !== -1) {
    // In pt-BR, comma is the decimal separator. Dots are thousands separators.
    const integerPart = unsigned.slice(0, lastComma).replace(/[.,]/g, '');
    const decimalPart = unsigned.slice(lastComma + 1).replace(/[.,]/g, '');
    unsigned = decimalPart ? `${integerPart}.${decimalPart}` : `${integerPart}.`;
  } else if (lastDot !== -1) {
    // A dot followed by exactly 3 digits is interpreted as a pt-BR thousands
    // separator (8.742 => 8742). Other single-dot forms remain compatible
    // with decimal-dot input (379.10 => 379.10).
    const ptBrThousands = /^\d{1,3}(?:\.\d{3})+$/;
    if (ptBrThousands.test(unsigned)) {
      unsigned = unsigned.replace(/\./g, '');
    } else {
      const parts = unsigned.split('.');
      unsigned = parts[0] + (parts.length > 1 ? `.${parts.slice(1).join('')}` : '');
    }
  }

  return sign + unsigned;
}

export function normalizeDecimalInput(
  raw: string,
  opts?: { locale?: DecimalInputLocale },
): string {
  let s = (raw ?? '').trim();
  if (!s) return '';

  // Remove spaces
  s = s.replace(/\s+/g, '');

  if (opts?.locale === 'pt-BR') {
    return normalizePtBrDecimal(s);
  }

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  // Decide decimal separator and strip thousands.
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // pt-BR like 1.234,56
      s = s.replace(/\./g, '');
      s = s.replace(',', '.');
    } else {
      // en-US like 1,234.56
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    // Only comma => treat as decimal
    s = s.replace(/\./g, '');
    s = s.replace(',', '.');
  } else {
    // Only dot or none => remove stray commas
    s = s.replace(/,/g, '');
  }

  // Keep sign, digits, and a single dot.
  const sign = s.startsWith('-') ? '-' : '';
  s = s.replace(/^[+-]/, '');
  s = s.replace(/[^0-9.]/g, '');

  const parts = s.split('.');
  if (parts.length > 1) {
    s = parts[0] + '.' + parts.slice(1).join(''); // merge extra dots
  }

  return sign + s;
}

export function parseDecimalInput(
  raw: string,
  opts?: {
    min?: number;
    maxDecimals?: number;
    allowNegative?: boolean;
    locale?: DecimalInputLocale;
  }
): ParsedDecimal | null {
  const normalized = normalizeDecimalInput(raw, { locale: opts?.locale });
  if (!normalized || normalized === '-' || normalized === '.') return null;

  // Trim decimals without rounding (if maxDecimals provided)
  let normalizedLimited = normalized;
  if (typeof opts?.maxDecimals === 'number' && normalized.includes('.')) {
    const [intPart, decPart = ''] = normalized.split('.');
    if (decPart.length > opts.maxDecimals) {
      normalizedLimited = `${intPart}.${decPart.slice(0, opts.maxDecimals)}`;
    }
  }

  const num = Number(normalizedLimited);
  if (!Number.isFinite(num)) return null;

  if (opts?.allowNegative !== true && num < 0) return null;
  if (typeof opts?.min === 'number' && num < opts.min) return null;

  return { normalized: normalizedLimited, number: num };
}
