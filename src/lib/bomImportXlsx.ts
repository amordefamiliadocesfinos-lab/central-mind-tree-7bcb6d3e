import * as XLSX from 'xlsx';
import { BOM_IMPORT_HEADERS, type BomImportRow } from '@/lib/bomImport';

export async function parseBomImportXlsx(file: File): Promise<BomImportRow[]> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Selecione um arquivo XLSX de BOM.');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('O arquivo não possui uma aba para importar.');
  const source = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  if (!source.length) throw new Error('O arquivo não possui linhas para importar.');
  const headers = Object.keys(source[0]);
  const missing = BOM_IMPORT_HEADERS.filter(header => !headers.includes(header));
  if (missing.length) throw new Error(`Arquivo incompatível: faltam colunas obrigatórias (${missing.join(', ')}).`);
  return source.map((row, index) => ({
    ...(Object.fromEntries(BOM_IMPORT_HEADERS.map(header => [header, String(row[header] ?? '')])) as Record<(typeof BOM_IMPORT_HEADERS)[number], string>),
    unidade: String(row.unidade ?? row.unit ?? ''),
    rowNumber: index + 2,
  }));
}
