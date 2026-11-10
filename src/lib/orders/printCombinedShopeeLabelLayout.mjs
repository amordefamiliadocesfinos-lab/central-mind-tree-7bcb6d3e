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
 * Refuse illegible or overlapping prints instead of adding unexpected sheets.
 */
export function fitCompactCompositionScale(totalHeight, availableHeight) {
  if (![totalHeight, availableHeight].every(v => Number.isFinite(v) && v > 0)) {
    throw new Error('Espaço inválido para composição interna.');
  }
  const scale = Math.min(1, availableHeight / totalHeight);
  if (scale < 0.6) throw new Error('Não há espaço legível para a composição na primeira folha.');
  return scale;
}
