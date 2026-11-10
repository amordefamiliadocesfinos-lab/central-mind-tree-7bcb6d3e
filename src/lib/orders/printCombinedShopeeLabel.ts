/**
 * F6-O.2e.4 — third print option, generated only in the browser.
 * The Shopee PDF in private Storage is NEVER modified or overwritten.
 *
 * pdfjs renders its page at 4 pixels per PDF point (roughly 288 dpi on A4).
 * This print-only raster copy keeps the official geometry unchanged; the
 * original vector PDF remains available through the existing print button.
 * Use the extra page rather than crowding the official codes.
 */
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { supabase } from '@/integrations/supabase/client';
import { createSeparationDisplayEntries } from '@/lib/orders/separationDisplay';
import { fitOfficialPdfPage } from './printCombinedShopeeLabelLayout.mjs';
import type { Order } from '@/hooks/useOrders';
import type { OrderDocument } from '@/hooks/useOrderSeparation';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const SCALE = 4;
// One A4 print sheet per official PDF page, regardless of the original page dimensions.
const A4_WIDTH = Math.round(595.28 * SCALE);
const A4_HEIGHT = Math.round(841.89 * SCALE);
const MARGIN = 32 * SCALE;
const BOTTOM_GAP = 18 * SCALE;
const MIN_AVAILABLE = 72 * SCALE;
const MAX_PAGES = 8;

type PrintLine = { value: string; height: number; font: string; before: number };
type PrintPage = { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D };

function buyerMessage(order: Order): string | null {
  const value = order.marketplace_metadata?.buyer_message;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function formatLines(order: Order): Array<{ value: string; heading?: boolean }> {
  const lines: Array<{ value: string; heading?: boolean }> = [
    { value: 'PEDIDO ' + (order.internal_order_number || order.order_number || order.id.slice(0, 8)), heading: true },
    { value: 'COMPOSIÇÃO INTERNA', heading: true },
  ];
  // Same physical/commercial composition shown in the Separation card.
  for (const group of createSeparationDisplayEntries(order.items ?? [])) {
    lines.push({ value: group.productName, heading: true });
    if (group.presentationName) lines.push({ value: group.presentationName });
    if (group.commercialSummary) lines.push({ value: group.commercialSummary });
    if (group.composition) lines.push({ value: group.composition });
    for (const component of group.components) {
      lines.push({ value: component.label + ': ' + component.quantityText });
    }
    if (group.totalText) lines.push({ value: group.totalText });
  }
  if (!order.items?.length) lines.push({ value: 'Nenhum item informado' });
  const fromShopee = buyerMessage(order);
  if (fromShopee) {
    lines.push({ value: 'OBSERVAÇÃO DO COMPRADOR (SHOPEE)', heading: true });
    lines.push({ value: fromShopee });
  }
  if (order.notes?.trim()) {
    lines.push({ value: 'OBSERVAÇÃO INTERNA DO PEDIDO', heading: true });
    lines.push({ value: order.notes.trim() });
  }
  return lines;
}

function buildTextRows(ctx: CanvasRenderingContext2D, order: Order, maxWidth: number): PrintLine[] {
  const result: PrintLine[] = [];
  for (const section of formatLines(order)) {
    const font = section.heading ? 'bold ' + (12 * SCALE) + 'px Arial' : (10 * SCALE) + 'px Arial';
    const height = section.heading ? 17 * SCALE : 14 * SCALE;
    ctx.font = font;
    const paragraphs = section.value.split(/\r?\n/);
    const before = section.heading ? 8 * SCALE : 0;
    let first = true;
    for (const paragraph of paragraphs) {
      let current = '';
      const words = paragraph.split(/\s+/);
      for (const word of words) {
        if (!word) continue;
        // Handle an unbroken word safely without clipping off the page.
        const pieces: string[] = [];
        let fragment = '';
        for (const char of word) {
          if (fragment && ctx.measureText(fragment + char).width > maxWidth) {
            pieces.push(fragment);
            fragment = char;
          } else fragment += char;
        }
        if (fragment) pieces.push(fragment);
        for (const part of pieces) {
          const trial = current ? current + ' ' + part : part;
          if (current && ctx.measureText(trial).width > maxWidth) {
            result.push({ value: current, height, font, before: first ? before : 0 });
            first = false;
            current = part;
          } else current = trial;
        }
      }
      result.push({ value: current, height, font, before: first ? before : 0 });
      first = false;
    }
  }
  return result;
}

/** Detect last visible ink; never write over the official document. */
function lastInkY(ctx: CanvasRenderingContext2D, width: number, height: number): number {
  const image = ctx.getImageData(0, 0, width, height);
  const { data } = image;
  for (let y = height - 4; y >= 0; y -= 2) {
    for (let x = 4; x < width - 4; x += 4) {
      const offset = (y * width + x) * 4;
      if (data[offset + 3] > 24 && (
        data[offset] < 245 || data[offset + 1] < 245 || data[offset + 2] < 245
      )) return Math.min(height, y + 8);
    }
  }
  return 0;
}

function blankPage(width: number, height: number): PrintPage {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas de impressão indisponível.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  return { canvas, context };
}

function drawRows(
  rows: PrintLine[],
  pages: PrintPage[],
  firstPageStart: number,
  width: number,
  height: number,
  forceNewPage: boolean,
): void {
  const totalHeight = rows.reduce((total, row) => total + row.before + row.height, 0);
  let target = pages[pages.length - 1];
  let y = firstPageStart;
  if (forceNewPage || height - MARGIN - firstPageStart < MIN_AVAILABLE
      || totalHeight > height - MARGIN - firstPageStart) {
    target = blankPage(width, height);
    pages.push(target);
    y = MARGIN;
  }
  for (const row of rows) {
    if (y + row.before + row.height > height - MARGIN) {
      if (pages.length >= MAX_PAGES) throw new Error('Composição excede o limite seguro de páginas.');
      target = blankPage(width, height);
      pages.push(target);
      y = MARGIN;
    }
    y += row.before;
    target.context.font = row.font;
    target.context.fillStyle = '#111';
    target.context.textBaseline = 'top';
    target.context.fillText(row.value, MARGIN, y, width - 2 * MARGIN);
    y += row.height;
  }
}

async function loadOfficialPdf(documentRecord: OrderDocument): Promise<Uint8Array> {
  if (documentRecord.document_type !== 'shipping_label'
    || documentRecord.storage_bucket !== 'shopee-labels'
    || !documentRecord.storage_path
    || documentRecord.mime_type !== 'application/pdf') {
    throw new Error('A impressão combinada requer uma etiqueta oficial Shopee em PDF.');
  }
  const { data, error } = await supabase.storage
    .from(documentRecord.storage_bucket)
    .createSignedUrl(documentRecord.storage_path, 5 * 60);
  if (error || !data?.signedUrl) throw new Error('Sem acesso autenticado à etiqueta oficial.');
  const response = await fetch(data.signedUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error('Falha ao consultar o PDF oficial.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 5 * 1024 * 1024 || bytes.byteLength < 5) {
    throw new Error('Tamanho inesperado do documento de etiqueta.');
  }
  return bytes;
}


function asPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob && blob.size > 0) resolve(blob);
      else reject(new Error('Não foi possível renderizar a página da etiqueta.'));
    }, 'image/png');
  });
}

/**
 * Runs while the Painel tab is foregrounded. In Chrome, a background opener
 * may be throttled while the new tab is active, which previously left it
 * showing "Preparando..." until the operator returned to the Painel.
 *
 * No popup is opened here: the operator sees the result in a Painel dialog
 * and explicitly requests a print tab after all pages are ready.
 */
export async function prepareCombinedShopeeLabel(order: Order, official: OrderDocument): Promise<Blob[]> {
  const bytes = await loadOfficialPdf(official);
  const task = getDocument({ data: bytes });
  try {
    const pdf = await task.promise;
    if (pdf.numPages < 1 || pdf.numPages > 4) throw new Error('Formato de etiqueta não suportado.');

    const pages: PrintPage[] = [];
    let originalLastInk = 0;
    let singlePageFitsA4 = false;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const source = page.getViewport({ scale: 1 });
      const placement = fitOfficialPdfPage(source.width, source.height, 595.28, 841.89);
      const viewport = page.getViewport({ scale: placement.scale * SCALE });
      const printedPage = blankPage(A4_WIDTH, A4_HEIGHT);
      // PDF.js renders to the correct location on an A4 sheet; never stretch
      // barcodes, alter aspect ratio or discard a second official page (DACE).
      await page.render({
        canvas: printedPage.canvas,
        canvasContext: printedPage.context,
        viewport,
        transform: [1, 0, 0, 1, placement.x * SCALE, placement.y * SCALE],
      }).promise;
      pages.push(printedPage);
      if (pdf.numPages === 1 && Math.abs(source.width / source.height - 210 / 297) <= 0.035) {
        singlePageFitsA4 = true;
        originalLastInk = lastInkY(printedPage.context, A4_WIDTH, A4_HEIGHT);
      }
    }

    const rows = buildTextRows(pages[pages.length - 1].context, order, A4_WIDTH - 2 * MARGIN);
    // Preserve Viviane's one-page behavior; multi-page/mixed-size Shopee PDFs
    // always get a dedicated composition page after ALL official pages.
    drawRows(rows, pages, originalLastInk + BOTTOM_GAP, A4_WIDTH, A4_HEIGHT,
      pdf.numPages !== 1 || !singlePageFitsA4);

    // Fully render images before opening ANY new tab. This is the core fix.
    return await Promise.all(pages.map(page => asPngBlob(page.canvas)));
  } finally {
    await task.destroy();
  }
}

/**
 * Runs only when the operator clicks "Abrir impressão" from the ready preview.
 * window.open is synchronous under that click; the new tab receives already
 * prepared image blobs. No background computation and no blank waiting tab.
 *
 * Each new window owns its own object URLs, independent of the Painel preview.
 * The caller records the operator's action after this function successfully
 * opens the complete, already-rendered print window. This matches the
 * existing official-label print flow and avoids relying on the background tab
 * to call React code after window.print() has returned.
 */
export function openPreparedCombinedShopeeLabel(images: Blob[]): void {
  if (!images.length || images.length > MAX_PAGES) throw new Error('Páginas de impressão inválidas.');
  const popup = window.open('about:blank', '_blank');
  if (!popup) throw new Error('Permita pop-ups para abrir a impressão combinada.');

  popup.opener = null;
  const urls: string[] = [];
  try {
    const doc = popup.document;
    doc.open();
    doc.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiqueta Shopee + Composição</title><style>'
      + '@page{size:A4 portrait;margin:0}'
      + 'html,body{margin:0;padding:0;font-family:Arial,sans-serif;background:#e5e7eb}'
      + '.controls{position:sticky;top:0;z-index:10;background:#fff;box-shadow:0 1px 5px #aaa;padding:12px 20px;display:flex;gap:12px;align-items:center;justify-content:center}'
      + 'button{padding:12px 22px;background:#111827;color:white;border:0;border-radius:6px;cursor:pointer;font-weight:600;font-size:15px}'
      + '.sheet{width:210mm;height:297mm;break-after:page;page-break-after:always;overflow:hidden;background:#fff;margin:12px auto;box-shadow:0 1px 6px #aaa}'
      + '.sheet:last-child{break-after:auto;page-break-after:auto}'
      + '.sheet img{display:block;width:210mm;height:297mm;object-fit:fill}'
      + '@media print{html,body{background:#fff}.controls{display:none!important}.sheet{margin:0;box-shadow:none}}'
      + '</style></head><body><div class="controls"><button id="printButton" type="button">Imprimir / Salvar como PDF</button>'
      + '<span>Etiqueta combinada preparada. Confira as páginas antes de imprimir.</span></div><main id="sheets"></main></body></html>');
    doc.close();

    const list = doc.getElementById('sheets');
    const button = doc.getElementById('printButton');
    if (!list || !button) throw new Error('A aba de impressão não foi inicializada.');
    for (const blob of images) {
      const url = URL.createObjectURL(blob);
      urls.push(url);
      const sheet = doc.createElement('section');
      sheet.className = 'sheet';
      const img = doc.createElement('img');
      img.alt = 'Etiqueta oficial Shopee e composição interna';
      img.src = url;
      sheet.appendChild(img);
      list.appendChild(sheet);
    }

    button.addEventListener('click', () => {
      popup.focus();
      popup.print();
    });

    // Chrome fires afterprint when its print/save dialog is dismissed.
    // Close only this script-created print tab, not the operator's Painel tab.
    // A browser that does not fire afterprint simply leaves the normal
    // close-tab fallback; printing still works.
    popup.addEventListener('afterprint', () => { if (!popup.closed) popup.close(); }, { once: true });
    popup.addEventListener('pagehide', () => urls.forEach(url => URL.revokeObjectURL(url)), { once: true });
  } catch (error) {
    urls.forEach(url => URL.revokeObjectURL(url));
    if (!popup.closed) popup.close();
    throw error;
  }
}
