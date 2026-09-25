(function attachGeometry(root) {
  function calculateCropRegion(sourceWidth, sourceHeight, targetRatio, zoom = 1, focusX = 0.5, focusY = 0.5) {
    if (![sourceWidth, sourceHeight, targetRatio, zoom].every(value => Number.isFinite(value) && value > 0)) {
      throw new TypeError('Crop dimensions, ratio, and zoom must be positive numbers.');
    }

    const sourceRatio = sourceWidth / sourceHeight;
    let baseWidth = sourceWidth;
    let baseHeight = sourceHeight;
    if (sourceRatio > targetRatio) baseWidth = sourceHeight * targetRatio;
    if (sourceRatio < targetRatio) baseHeight = sourceWidth / targetRatio;

    const width = baseWidth / zoom;
    const height = baseHeight / zoom;
    const clampedFocusX = Math.min(1, Math.max(0, focusX));
    const clampedFocusY = Math.min(1, Math.max(0, focusY));
    const x = (sourceWidth - width) * clampedFocusX;
    const y = (sourceHeight - height) * clampedFocusY;
    return { x, y, width, height };
  }

  function calculatePrintLayout(widthCm, heightCm, pitchMm, options = {}) {
    if (![widthCm, heightCm, pitchMm].every(value => Number.isFinite(value) && value > 0)) {
      throw new TypeError('Pattern dimensions and drill pitch must be positive numbers.');
    }
    const roundingMode = options.roundingMode || 'round';
    if (!['round', 'floor', 'ceil'].includes(roundingMode)) throw new TypeError('Unsupported cell rounding mode.');
    const dpi = options.dpi === undefined ? 300 : Number(options.dpi);
    if (!Number.isFinite(dpi) || dpi <= 0) throw new TypeError('Export DPI must be a positive number.');

    const roundCells = Math[roundingMode];
    const columns = Math.max(1, roundCells(widthCm * 10 / pitchMm));
    const rows = Math.max(1, roundCells(heightCm * 10 / pitchMm));
    const exactWidthMm = columns * pitchMm;
    const exactHeightMm = rows * pitchMm;
    const exactWidthIn = exactWidthMm / 25.4;
    const exactHeightIn = exactHeightMm / 25.4;
    const labelGutterIn = options.labelGutterIn === undefined ? 0.08 : Number(options.labelGutterIn);
    if (!Number.isFinite(labelGutterIn) || labelGutterIn < 0) throw new TypeError('Label gutter must not be negative.');
    const recommendedWidthIn = Math.ceil(exactWidthIn + labelGutterIn * 2);
    const recommendedHeightIn = Math.ceil(exactHeightIn + labelGutterIn * 2);
    const printWidthIn = options.printWidthIn === undefined ? recommendedWidthIn : Number(options.printWidthIn);
    const printHeightIn = options.printHeightIn === undefined ? recommendedHeightIn : Number(options.printHeightIn);
    if (![printWidthIn, printHeightIn].every(value => Number.isFinite(value) && value > 0)) {
      throw new TypeError('Professional print dimensions must be positive numbers.');
    }
    const marginXIn = (printWidthIn - exactWidthIn) / 2;
    const marginYIn = (printHeightIn - exactHeightIn) / 2;
    return {
      requestedWidthCm: widthCm,
      requestedHeightCm: heightCm,
      columns,
      rows,
      pitchMm,
      exactWidthMm,
      exactHeightMm,
      exactWidthCm: exactWidthMm / 10,
      exactHeightCm: exactHeightMm / 10,
      exactWidthIn,
      exactHeightIn,
      recommendedWidthIn,
      recommendedHeightIn,
      printWidthIn,
      printHeightIn,
      marginXIn,
      marginYIn,
      labelGutterIn,
      dpi,
      canvasWidthPx: Math.round(printWidthIn * dpi),
      canvasHeightPx: Math.round(printHeightIn * dpi),
      activeWidthPx: Math.round(exactWidthIn * dpi),
      activeHeightPx: Math.round(exactHeightIn * dpi),
      compatible: marginXIn >= labelGutterIn && marginYIn >= labelGutterIn,
    };
  }

  function calculateSizeTiers(shortestCells, aspectRatio, pitchMm, stepCells = 20) {
    if (![shortestCells, aspectRatio, pitchMm, stepCells].every(value => Number.isFinite(value) && value > 0)) {
      throw new TypeError('Size-tier inputs must be positive numbers.');
    }
    const baseCells = Math.max(stepCells, Math.round(shortestCells));
    return [-1, 0, 1].map(offset => {
      const shortSide = Math.max(stepCells, baseCells + offset * stepCells);
      const columns = aspectRatio >= 1 ? Math.ceil(shortSide * aspectRatio) : shortSide;
      const rows = aspectRatio >= 1 ? shortSide : Math.ceil(shortSide / aspectRatio);
      return {
        columns,
        rows,
        widthCm: columns * pitchMm / 10,
        heightCm: rows * pitchMm / 10,
      };
    });
  }

  function calculateLabelInterval(cellSize, minimumSpacing = 24) {
    if (![cellSize, minimumSpacing].every(value => Number.isFinite(value) && value > 0)) {
      throw new TypeError('Label spacing inputs must be positive numbers.');
    }
    const minimumInterval = Math.ceil(minimumSpacing / cellSize);
    const magnitude = 10 ** Math.floor(Math.log10(minimumInterval));
    return [1, 2, 5, 10].map(multiplier => multiplier * magnitude).find(value => value >= minimumInterval) || magnitude * 10;
  }

  function calculatePrintLabelMetrics(dpi, marginXIn, marginYIn, cellWidthPx, cellHeightPx) {
    if (![dpi, marginXIn, marginYIn, cellWidthPx, cellHeightPx].every(value => Number.isFinite(value) && value > 0)) {
      throw new TypeError('Print label dimensions must be positive numbers.');
    }
    const desiredFontSize = dpi * 8 / 72;
    const availableFontSize = Math.min(marginXIn * dpi / 2.3, marginYIn * dpi * .55);
    const fontSize = Math.max(dpi * 2.5 / 72, Math.min(desiredFontSize, availableFontSize));
    return {
      fontSize,
      fontSizePt: fontSize * 72 / dpi,
      columnInterval: calculateLabelInterval(cellWidthPx, fontSize * 2.4),
      rowInterval: calculateLabelInterval(cellHeightPx, fontSize * 2.4),
    };
  }

  function calculateLabelPositions(totalCells, interval) {
    if (!Number.isInteger(totalCells) || totalCells < 1 || !Number.isInteger(interval) || interval < 1) {
      throw new TypeError('Label positions require positive whole numbers.');
    }
    const positions = [1];
    for (let cell = interval; cell <= totalCells; cell += interval) {
      if (cell !== 1) positions.push(cell);
    }
    if (positions.at(-1) !== totalCells) positions.push(totalCells);
    return positions;
  }

  root.PatternGeometry = { calculateCropRegion, calculatePrintLayout, calculateSizeTiers, calculateLabelInterval, calculatePrintLabelMetrics, calculateLabelPositions };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PatternGeometry;
})(typeof globalThis !== 'undefined' ? globalThis : window);
