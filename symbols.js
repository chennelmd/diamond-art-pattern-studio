(function attachPatternSymbols(root) {
  const BASE_SYMBOLS = [
    '●', '■', '◆', '▲', '★', '✚', '✖', '✦', '✿',
    '+', '×', '/', '\\', '|', '-', '=', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L',
    'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'X', 'Y', 'Z', '2', '3', '4', '5', '7', '8',
    '?', '!', '#', '%', '&', '@', ':', ';',
  ];
  const TOKEN_CHARACTERS = 'ABCDEFGHJKLNPQRSTUVXYZ234578';

  function generatedToken(index) {
    let length = 2;
    let capacity = TOKEN_CHARACTERS.length ** length;
    while (index >= capacity) {
      index -= capacity;
      length += 1;
      capacity = TOKEN_CHARACTERS.length ** length;
    }
    let token = '';
    for (let position = 0; position < length; position += 1) {
      token = TOKEN_CHARACTERS[index % TOKEN_CHARACTERS.length] + token;
      index = Math.floor(index / TOKEN_CHARACTERS.length);
    }
    return token.padStart(length, TOKEN_CHARACTERS[0]);
  }

  function assignSymbols(count) {
    if (!Number.isInteger(count) || count < 0) throw new TypeError('Symbol count must be a non-negative whole number.');
    return Array.from({ length: count }, (_, index) => index < BASE_SYMBOLS.length
      ? BASE_SYMBOLS[index]
      : generatedToken(index - BASE_SYMBOLS.length));
  }

  function setSymbol(symbols, index, value) {
    if (!Array.isArray(symbols) || !Number.isInteger(index) || index < 0 || index >= symbols.length) throw new TypeError('A valid symbol assignment is required.');
    const symbol = String(value || '').trim();
    if (!symbol) throw new TypeError('Symbol cannot be empty.');
    if (Array.from(symbol).length > 3) throw new TypeError('Symbol must be three characters or fewer.');
    if (symbols.some((assigned, assignedIndex) => assignedIndex !== index && assigned === symbol)) throw new TypeError('That symbol is already assigned to another color.');
    symbols[index] = symbol;
    return symbol;
  }

  function textColor(rgb) {
    if (!Array.isArray(rgb) || rgb.length < 3) throw new TypeError('An RGB color is required.');
    const luminance = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
    return luminance < 145 ? '#ffffff' : '#211b29';
  }

  function legendRows(assignments, counts, symbols, materials = []) {
    return assignments.map((color, index) => ({
      ...color,
      symbol: symbols[index],
      count: counts[index] || 0,
      material: materials[index] || { type: 'standard', label: '' },
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

  root.PatternSymbols = { assignSymbols, setSymbol, textColor, legendRows, legendPageLayout };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PatternSymbols;
})(typeof globalThis !== 'undefined' ? globalThis : window);
