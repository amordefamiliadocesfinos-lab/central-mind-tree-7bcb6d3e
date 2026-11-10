export declare function fitOfficialPdfPage(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): { scale: number; width: number; height: number; x: number; y: number };

export declare function fitCompactCompositionScale(totalHeight: number, availableHeight: number): number;
