export declare function fitOfficialPdfPage(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): { scale: number; width: number; height: number; x: number; y: number };

export declare function fitCompactCompositionScale(totalHeight: number, availableHeight: number): number;

export declare function planCombinedCompositionPages(args: {
  officialPageCount: number;
  rows: Array<{ height: number; before: number }>;
  firstPageAvailableHeight: number;
  printableHeight: number;
  maxPages?: number;
  minCompactScale?: number;
}): {
  compactScale: number | null;
  compositionPages: number[][];
  totalPages: number;
};
