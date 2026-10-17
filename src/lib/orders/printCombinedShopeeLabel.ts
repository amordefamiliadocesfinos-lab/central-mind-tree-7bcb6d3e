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
import { formatCommercialQuantity } from '@/lib/orders/commercialOrderItem';
import type { Order } from '@/hooks/useOrders';
import type { OrderDocument } from '@/hooks/useOrderSeparation';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const SCALE = 4;
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
  for (const item of order.items ?? []) {
    const product = item.product?.name ?? 'Produto';
    const variant = item.variant?.variant_name;
    lines.push({ value: formatCommercialQuantity(item) + ' · ' + product + (variant ? ' — ' + variant : '') });
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

function openPrintWindow(): Window {
  // Called synchronously from the button click, before awaiting the private PDF.
  const target = window.open('about:blank', '_blank');
  if (!target) throw new Error('Permita pop-ups para abrir a impressão combinada.');
  target.opener = null;
  target.document.open();
  target.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Preparando etiqueta combinada</title></head><body><p>Preparando etiqueta e composição interna...</p></body></html>');
  target.document.close();
  return target;
}

function asPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob && blob.size > 0) resolve(blob);
      else reject(new Error('Não foi possível gerar a página de impressão.'));
    }, 'image/png');
  });
}

/**
 * Resolve ONLY when every preview image is decoded and actually present
 * in the pop-up. The previous fire-and-forget image callbacks incorrectly
 * reported success while the operator still saw "Preparando...".
 *
 * Explicit print button remains available even when automatic printing is
 * blocked after an asynchronous browser task.
 */
async function showPrintPages(target: Window, pages: PrintPage[], onPrintRequested: () => Promise<void>): Promise<void> {
  if (target.closed) throw new Error('A aba de impressão foi fechada.');
  const urls: string[] = [];
  try {
    for (const page of pages) {
      const image = await asPngBlob(page.canvas);
      urls.push(URL.createObjectURL(image));
    }
    if (target.closed) throw new Error('A aba de impressão foi fechada.');

    const doc = target.document;
    doc.open();
    doc.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiqueta Shopee + Composição</title><style>'
      + '@page{size:A4 portrait;margin:0}'
      + 'html,body{margin:0;padding:0;font-family:Arial,sans-serif;background:#e5e7eb}'
      + '.controls{position:sticky;top:0;z-index:10;background:#fff;box-shadow:0 1px 5px #aaa;padding:12px 20px;display:flex;gap:12px;align-items:center;justify-content:center}'
      + 'button{padding:12px 22px;background:#111827;color:white;border:0;border-radius:6px;cursor:pointer;font-weight:600;font-size:15px}'
      + 'button:disabled{opacity:.5;cursor:wait}'
      + '.sheet{width:210mm;height:297mm;break-after:page;page-break-after:always;overflow:hidden;background:#fff;margin:12px auto;box-shadow:0 1px 6px #aaa}'
      + '.sheet:last-child{break-after:auto;page-break-after:auto}'
      + '.sheet img{display:block;width:210mm;height:297mm;object-fit:fill}'
      + '@media print{html,body{background:#fff}.controls{display:none!important}.sheet{margin:0;box-shadow:none}}'
      + '</style></head><body><div class="controls"><button id="printButton" disabled>Preparando...</button>'
      + '<span id="loadStatus" role="status">Carregando as páginas...</span></div><main id="sheets"></main></body></html>');
    doc.close();

    const button = doc.getElementById('printButton') as HTMLButtonElement | null;
    const status = doc.getElementById('loadStatus');
    const list = doc.getElementById('sheets');
    if (!button || !status || !list) throw new Error('Não foi possível iniciar a aba de impressão.');

    const images: HTMLImageElement[] = [];
    for (const url of urls) {
      const sheet = doc.createElement('section');
      sheet.className = 'sheet';
      const img = doc.createElement('img');
      img.alt = 'Etiqueta Shopee oficial com composição interna';
      img.src = url;
      sheet.appendChild(img);
      list.appendChild(sheet);
      images.push(img);
    }

    let deadline: number | null = null;
    try {
      await Promise.race([
        Promise.all(images.map(img => img.decode())),
        new Promise<never>((_, reject) => {
          deadline = window.setTimeout(
            () => reject(new Error('A visualização demorou demais para carregar. Tente novamente.')),
            20000,
          );
        }),
      ]);
    } finally {
      if (deadline !== null) window.clearTimeout(deadline);
    }
    if (target.closed || !images.every(img => img.complete && img.naturalWidth > 0)) {
      throw new Error('Falha ao exibir a etiqueta combinada.');
    }

    button.disabled = false;
    button.textContent = 'Imprimir / Salvar como PDF';
    status.textContent = 'Documento combinado pronto para visualização.';
    button.addEventListener('click', () => {
      target.print();
      // Register the operational print event only when the operator actually
      // chooses to print, never when they merely open the preview.
      void onPrintRequested().catch(() => {
        if (!target.closed) status.textContent = 'Visualização aberta, mas o registro da impressão falhou.';
      });
    });
    target.addEventListener('pagehide', () => urls.forEach(url => URL.revokeObjectURL(url)), { once: true });
    target.focus();
  } catch (error) {
    urls.forEach(url => URL.revokeObjectURL(url));
    if (!target.closed) {
      // Leave a visible error in the operator's new tab, rather than a
      // misleading success toast or a permanently blank "Preparando..." tab.
      target.document.body.textContent = 'Não foi possível gerar a impressão combinada. '
        + (error instanceof Error ? error.message : 'Erro inesperado.')
        + ' A etiqueta oficial continua disponível no Painel Central.';
    }
    throw error;
  }
}

/**
 * Called from a user click, opening a blank popup before the first await.
 * The only printable change is in the new temporary copy, not in Storage.
 */
export async function printCombinedShopeeLabel(
  order: Order,
  official: OrderDocument,
  onPrintRequested: () => Promise<void>,
): Promise<void> {
  const popup = openPrintWindow();
  try {
    const bytes = await loadOfficialPdf(official);
    const task = getDocument({ data: bytes });
    const pdf = await task.promise;
    if (pdf.numPages < 1 || pdf.numPages > 4) throw new Error('Formato de etiqueta não suportado.');

    const pages: PrintPage[] = [];
    let width = 0;
    let height = 0;
    let originalLastInk = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: SCALE });
      // This pilot is A4. Other layouts need an explicit print-specific adapter.
      if (Math.abs(viewport.width / viewport.height - 210 / 297) > 0.035) {
        throw new Error('A impressão combinada ainda não suporta esse formato de etiqueta. Use a impressão oficial.');
      }
      if (i === 1) { width = Math.round(viewport.width); height = Math.round(viewport.height); }
      if (Math.abs(viewport.width - width) > 3 || Math.abs(viewport.height - height) > 3) {
        throw new Error('Documento com páginas de dimensões diferentes.');
      }
      const printedPage = blankPage(width, height);
      await page.render({ canvas: printedPage.canvas, canvasContext: printedPage.context, viewport }).promise;
      originalLastInk = lastInkY(printedPage.context, width, height);
      pages.push(printedPage);
    }
    const rows = buildTextRows(pages[pages.length - 1].context, order, width - 2 * MARGIN);
    drawRows(rows, pages, originalLastInk + BOTTOM_GAP, width, height, pdf.numPages !== 1);
    await showPrintPages(popup, pages, onPrintRequested);
    await task.destroy();
  } catch (err) {
    // Do not auto-close: the operator needs to see why composition failed.
    if (!popup.closed && popup.document.body.textContent?.includes('Preparando etiqueta')) {
      popup.document.body.textContent = 'Falha ao preparar a etiqueta combinada. A etiqueta oficial não foi modificada.';
    }
    throw err;
  }
}
