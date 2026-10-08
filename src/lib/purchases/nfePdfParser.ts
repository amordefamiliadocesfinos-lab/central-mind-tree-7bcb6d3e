import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorker;

export interface NfeInstallment {
  number: number;
  due_date: string;
  value: number;
}

export interface NfeItem {
  supplier_code: string;
  description: string;
  ncm: string;
  cfop: string;
  commercial_unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface NfeParsedData {
  invoice_number: string | null;
  series: string | null;
  issue_date: string | null;
  access_key: string | null;
  issuer_name: string | null;
  issuer_document: string | null;
  recipient_name: string | null;
  recipient_document: string | null;
  total_products: number | null;
  freight: number | null;
  discount: number | null;
  total_note: number | null;
  transporter_name: string | null;
  transporter_document: string | null;
  volume_quantity: number | null;
  gross_weight_kg: number | null;
  net_weight_kg: number | null;
  installments: NfeInstallment[];
  items: NfeItem[];
  raw_text: string;
}

type PdfTextItem = {
  str?: string;
  transform?: number[];
};

function parseBrNumber(value: string) {
  const normalized = value
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function toIsoDate(value: string) {
  const [day, month, year] = value.split('/');
  if (!day || !month || !year) return null;
  return year + '-' + month.padStart(2, '0') + '-' + day.padStart(2, '0');
}

function compactDocument(value: string | null | undefined) {
  return (value ?? '').replace(/\D/g, '');
}

function textItemsToLines(items: PdfTextItem[]) {
  const positioned = items
    .map(item => ({
      text: item.str?.trim() ?? '',
      x: item.transform?.[4] ?? 0,
      y: item.transform?.[5] ?? 0,
    }))
    .filter(item => Boolean(item.text))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: Array<{ y: number; cells: Array<{ x: number; text: string }> }> = [];
  const yTolerance = 2.5;

  for (const item of positioned) {
    const lastRow = rows[rows.length - 1];

    if (!lastRow || Math.abs(lastRow.y - item.y) > yTolerance) {
      rows.push({
        y: item.y,
        cells: [{ x: item.x, text: item.text }],
      });
      continue;
    }

    lastRow.cells.push({ x: item.x, text: item.text });
    lastRow.y = (lastRow.y + item.y) / 2;
  }

  return rows
    .map(row =>
      row.cells
        .sort((a, b) => a.x - b.x)
        .map(cell => cell.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

function sectionLines(lines: string[], start: RegExp, end: RegExp) {
  const startIndex = lines.findIndex(line => start.test(line));
  if (startIndex < 0) return [];

  const endRelative = lines
    .slice(startIndex + 1)
    .findIndex(line => end.test(line));

  const endIndex = endRelative < 0
    ? lines.length
    : startIndex + 1 + endRelative;

  return lines.slice(startIndex + 1, endIndex);
}

function firstCnpj(text: string) {
  return text.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/)?.[0] ?? null;
}

function parseItems(lines: string[]): NfeItem[] {
  const source = sectionLines(
    lines,
    /DADOS DOS PRODUTOS\s*\/\s*SERVIÇOS/i,
    /CÁLCULO DO ISSQN|DADOS ADICIONAIS/i,
  );

  const items: NfeItem[] = [];

  for (const line of source) {
    const match = line.match(
      /^(\d{6,14})\s+(.+?)\s+(\d{8})\s+\d+\s+\d+\s+(\d{4})\s+([A-Z]{1,4})\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)(?:\s|$)/i,
    );

    if (!match) continue;

    const quantity = parseBrNumber(match[6]);
    const unitPrice = parseBrNumber(match[7]);
    const totalPrice = parseBrNumber(match[8]);

    if (![quantity, unitPrice, totalPrice].every(Number.isFinite)) continue;

    items.push({
      supplier_code: match[1],
      description: match[2].trim(),
      ncm: match[3],
      cfop: match[4],
      commercial_unit: match[5],
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
    });
  }

  return items;
}

function parseInstallments(lines: string[]): NfeInstallment[] {
  const source = sectionLines(lines, /^FATURA\b/i, /CÁLCULO DO IMPOSTO/i);
  const installments: NfeInstallment[] = [];

  for (const line of source) {
    const match = line.match(/^(\d{1,4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.]+,\d{2})/);
    if (!match) continue;

    const value = parseBrNumber(match[3]);
    const dueDate = toIsoDate(match[2]);

    if (!Number.isFinite(value) || !dueDate) continue;

    installments.push({
      number: Number(match[1]),
      due_date: dueDate,
      value,
    });
  }

  return installments;
}

function parseFreightAndTotals(lines: string[]) {
  const freightHeader = lines.findIndex(
    line => /Valor do Frete/i.test(line) && /Valor Total da Nota/i.test(line),
  );

  const valuesLine = freightHeader >= 0
    ? lines.slice(freightHeader + 1).find(line => /\d+,\d{2}/.test(line))
    : null;

  const numbers = valuesLine?.match(/[\d.]+,\d{2}/g) ?? [];

  return {
    freight: numbers[0] ? parseBrNumber(numbers[0]) : null,
    discount: numbers[2] ? parseBrNumber(numbers[2]) : null,
    total_note: numbers.length
      ? parseBrNumber(numbers[numbers.length - 1])
      : null,
  };
}

function parseVolume(lines: string[]) {
  const start = lines.findIndex(
    line => /Quantidade\s+Espécie/i.test(line) && /Peso Bruto/i.test(line),
  );

  const line = start >= 0
    ? lines.slice(start + 1).find(candidate => /\bVOLUMES?\b/i.test(candidate))
    : null;

  if (!line) {
    return {
      volume_quantity: null,
      gross_weight_kg: null,
      net_weight_kg: null,
    };
  }

  const first = line.match(/^\s*(\d+(?:[.,]\d+)?)\s+/)?.[1];
  const values = line.match(/[\d.]+,\d{3}/g) ?? [];

  return {
    volume_quantity: first ? parseBrNumber(first) : null,
    gross_weight_kg: values.length >= 2
      ? parseBrNumber(values[values.length - 2])
      : null,
    net_weight_kg: values.length >= 1
      ? parseBrNumber(values[values.length - 1])
      : null,
  };
}

export async function parseNfePdf(file: File): Promise<NfeParsedData> {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const allLines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    allLines.push(
      ...textItemsToLines(
        content.items.filter(item => 'str' in item) as PdfTextItem[],
      ),
    );
  }

  const rawText = allLines.join('\n');
  const normalizedText = rawText.replace(/\s+/g, ' ');
  const cnpjs =
    rawText.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g) ?? [];

  const invoiceNumber =
    normalizedText.match(/Nr\.?\s*(\d{3,12})\b/i)?.[1]
    ?? normalizedText.match(/NF-e\s+Nr\.?\s*(\d{3,12})\b/i)?.[1]
    ?? null;

  const series =
    normalizedText.match(/S[ÉE]RIE\s*(\d{1,4})\b/i)?.[1] ?? null;

  const issueDateBr =
    normalizedText.match(/Emiss[aã]o\s*:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1]
    ?? normalizedText.match(/Data da Emiss[aã]o\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1]
    ?? null;

  const issuerName =
    normalizedText.match(/Recebemos de\s+(.+?)\s+os produtos da Nota Fiscal/i)?.[1]?.trim()
    ?? null;

  const recipientName =
    normalizedText.match(/Destinat[aá]rio\s*:\s*(.+?)\s+Valor Total/i)?.[1]?.trim()
    ?? null;

  const accessKeyNearLabel = normalizedText.match(
    /Chave de acesso.{0,160}?((?:\d{4}\s*){11})/i,
  )?.[1];

  const accessKeyFallback = rawText
    .match(/(?:\d{4}\s*){11}/g)
    ?.map(candidate => candidate.replace(/\D/g, ''))
    .find(candidate => candidate.length === 44);

  const accessKey = (accessKeyNearLabel ?? accessKeyFallback ?? '')
    .replace(/\D/g, '') || null;

  const topTotal =
    normalizedText.match(/Valor Total\s*:\s*R\$\s*([\d.]+,\d{2})/i)?.[1];

  const totalProductsHeader = allLines.findIndex(
    line => /Valor Total dos Produtos/i.test(line),
  );

  const totalProductsLine = totalProductsHeader >= 0
    ? allLines.slice(totalProductsHeader + 1).find(line => /\d+,\d{2}/.test(line))
    : null;

  const totalProductsNumbers =
    totalProductsLine?.match(/[\d.]+,\d{2}/g) ?? [];

  const freightTotals = parseFreightAndTotals(allLines);

  const transporterSection = sectionLines(
    allLines,
    /TRANSPORTADOR\s*\/\s*VOLUMES TRANSPORTADOS/i,
    /DADOS DOS PRODUTOS\s*\/\s*SERVIÇOS/i,
  );

  const transporterName =
    transporterSection.find(
      line =>
        !/Nome\s*\/\s*Raz[aã]o Social|Frete por conta|Endere[cç]o|Munic[ií]pio|Quantidade|Esp[eé]cie|ANTT/i.test(line)
        && /[A-Z]{4,}/.test(line),
    ) ?? null;

  const transporterDocument =
    transporterSection.map(firstCnpj).find(Boolean) ?? null;

  const volumes = parseVolume(allLines);

  return {
    invoice_number: invoiceNumber,
    series,
    issue_date: issueDateBr ? toIsoDate(issueDateBr) : null,
    access_key: accessKey,
    issuer_name: issuerName,
    issuer_document: cnpjs[0] ?? null,
    recipient_name: recipientName,
    recipient_document: cnpjs[1] ?? null,
    total_products: totalProductsNumbers.length
      ? parseBrNumber(totalProductsNumbers[totalProductsNumbers.length - 1])
      : null,
    freight: freightTotals.freight,
    discount: freightTotals.discount,
    total_note: topTotal
      ? parseBrNumber(topTotal)
      : freightTotals.total_note,
    transporter_name: transporterName,
    transporter_document: transporterDocument,
    volume_quantity: volumes.volume_quantity,
    gross_weight_kg: volumes.gross_weight_kg,
    net_weight_kg: volumes.net_weight_kg,
    installments: parseInstallments(allLines),
    items: parseItems(allLines),
    raw_text: rawText,
  };
}

export function compactTaxDocument(value: string | null | undefined) {
  return compactDocument(value);
}
