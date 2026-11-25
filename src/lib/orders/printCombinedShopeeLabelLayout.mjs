/** Print-only placement of each official page on an A4 sheet without cropping/stretching.
 * Physical document bytes are untouched. PDF page sizes may differ by Shopee account.
 */
export function fitOfficialPdfPage(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const values = [sourceWidth, sourceHeight, targetWidth, targetHeight];
  if (values.some(value => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Dimensões inválidas para impressão da etiqueta.');
  }
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    scale,
    width,
    height,
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
  };
}

/** Resize only the internal picking text; official PDF artwork is never changed.
 * Refuse illegible or overlapping placements; callers may use extra sheets.
 */
export function fitCompactCompositionScale(totalHeight, availableHeight) {
  if (![totalHeight, availableHeight].every(v => Number.isFinite(v) && v > 0)) {
    throw new Error('Espaço inválido para composição interna.');
  }
  const scale = Math.min(1, availableHeight / totalHeight);
  if (scale < 0.6) throw new Error('Não há espaço legível para a composição na primeira folha.');
  return scale;
}

/**
 * Conservative, pure page plan: only merge content with a single official page
 * when all text fits at the previously approved minimum scale. Otherwise keep
 * ALL official pages untouched and paginate composition at normal text size.
 * heights are measured in the same unit as printableHeight.
 */
export function planCombinedCompositionPages({
  officialPageCount, rows, firstPageAvailableHeight, printableHeight,
  maxPages = 8, minCompactScale = 0.6,
}) {
  if (!Number.isInteger(officialPageCount) || officialPageCount < 1
    || !Number.isInteger(maxPages) || maxPages < officialPageCount
    || !Array.isArray(rows) || rows.length === 0
    || !Number.isFinite(printableHeight) || printableHeight <= 0
    || !Number.isFinite(firstPageAvailableHeight)
    || !Number.isFinite(minCompactScale) || minCompactScale <= 0 || minCompactScale > 1) {
    throw new Error('Plano de paginação da composição inválido.');
  }
  const heights = rows.map(row => Number(row.height) + Number(row.before || 0));
  if (heights.some(height => !Number.isFinite(height) || height <= 0)) {
    throw new Error('Alturas de composição inválidas.');
  }
  const total = heights.reduce((sum, value) => sum + value, 0);
  const compactScale = firstPageAvailableHeight > 0
    ? Math.min(1, firstPageAvailableHeight / total) : 0;
  if (officialPageCount === 1 && compactScale >= minCompactScale) {
    return { compactScale, compositionPages: [], totalPages: 1 };
  }
  const compositionPages = [];
  let pageRows = [];
  let used = 0;
  for (let index = 0; index < rows.length; index++) {
    const height = heights[index];
    if (height > printableHeight) throw new Error('Linha de composição excede a página.');
    if (pageRows.length && used + height > printableHeight) {
      compositionPages.push(pageRows);
      pageRows = [];
      used = 0;
    }
    pageRows.push(index);
    used += height;
  }
  if (pageRows.length) compositionPages.push(pageRows);
  const totalPages = officialPageCount + compositionPages.length;
  if (totalPages > maxPages) {
    throw new Error('Composição excede o limite seguro de páginas de impressão.');
  }
  return { compactScale: null, compositionPages, totalPages };
}
