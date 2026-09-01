import * as XLSX from 'xlsx';
import { PRODUCT_CATALOG_HEADERS, toCatalogRows, type CatalogProduct, type CatalogVariant, type ProductCatalogRow } from '@/lib/productCatalogImport';

export const PRODUCT_CATALOG_SHEET = 'Catalogo';
const OPTIONAL_UNIVERSAL_HEADERS = new Set(['familia', 'modo_variacao', 'comprado', 'fabricado', 'intermediario']);

export function downloadProductCatalogXlsx(products: CatalogProduct[], variants: CatalogVariant[]) {
  const rows = toCatalogRows(products, variants);
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...PRODUCT_CATALOG_HEADERS], skipHeader: false });
  worksheet['!cols'] = PRODUCT_CATALOG_HEADERS.map(header => ({ wch: Math.max(14, Math.min(28, header.length + 4)) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, PRODUCT_CATALOG_SHEET);
  const output = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'catalogo-produtos-variacoes.xlsx'; anchor.click(); URL.revokeObjectURL(url);
}

export async function parseProductCatalogXlsx(file: File): Promise<ProductCatalogRow[]> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Selecione um arquivo XLSX exportado pelo Catálogo.');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  const worksheet = workbook.Sheets[PRODUCT_CATALOG_SHEET] || workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) throw new Error('O arquivo não possui uma aba para importar.');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '', raw: false });
  if (!rows.length) throw new Error('O arquivo não possui linhas para importar.');
  const headers = Object.keys(rows[0]);
  const missing = PRODUCT_CATALOG_HEADERS.filter(header => !headers.includes(header) && !OPTIONAL_UNIVERSAL_HEADERS.has(header));
  if (missing.length) throw new Error(`Arquivo incompatível: faltam colunas obrigatórias (${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}).`);
  return rows.map(source => Object.fromEntries(PRODUCT_CATALOG_HEADERS.map(header => [header, String(source[header] ?? '')])) as unknown as ProductCatalogRow).map((row, index) => ({ ...row, rowNumber: index + 2 }));
}
