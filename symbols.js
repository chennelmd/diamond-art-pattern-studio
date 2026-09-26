(function attachPatternSymbols(root) {
  const BASE_SYMBOLS = [
    '●', '○', '■', '□', '◆', '◇', '▲', '△', '▼', '▽', '★', '☆', '✚', '✖', '✦', '✿',
    '+', '×', '/', '\\', '|', '-', '=', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L',
    'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '2', '3', '4', '5',
    '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'j', 'k', 'm', 'n', 'p', 'q',
    'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '?', '!', '#', '%', '&', '@', ':', ';', '<', '>',
  ];

  function assignSymbols(count) {
    if (!Number.isInteger(count) || count < 0) throw new TypeError('Symbol count must be a non-negative whole number.');
    return Array.from({ length: count }, (_, index) => index < BASE_SYMBOLS.length
      ? BASE_SYMBOLS[index]
      : (index - BASE_SYMBOLS.length).toString(36).toUpperCase().padStart(2, '0'));
  }

  function textColor(rgb) {
    if (!Array.isArray(rgb) || rgb.length < 3) throw new TypeError('An RGB color is required.');
    const luminance = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
    return luminance < 145 ? '#ffffff' : '#211b29';
  }

  function legendRows(assignments, counts, symbols) {
    return assignments.map((color, index) => ({
      ...color,
      symbol: symbols[index],
      count: counts[index] || 0,
    })).filter(row => row.count > 0);
  }

  function legendPageLayout(dpi, specRowCount = 7) {
    if (!Number.isFinite(dpi) || dpi <= 0) throw new TypeError('Legend DPI must be a positive number.');
    if (!Number.isInteger(specRowCount) || specRowCount < 0) throw new TypeError('Specification row count must be a non-negative whole number.');
    const margin = Math.round(.35 * dpi);
    const headerHeight = Math.round(2.05 * dpi);
    const specTop = margin + Math.round(.63 * dpi);
    const specLineHeight = Math.round(.21 * dpi);
    const specBottom = specRowCount ? specTop + (specRowCount - 1) * specLineHeight + Math.round(.1 * dpi) : specTop;
    const legendTop = margin + headerHeight;
    return { margin, headerHeight, specTop, specLineHeight, specBottom, legendTop };
  }

  root.PatternSymbols = { assignSymbols, textColor, legendRows, legendPageLayout };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PatternSymbols;
})(typeof globalThis !== 'undefined' ? globalThis : window);
