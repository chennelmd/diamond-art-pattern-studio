(function attachEditor(root) {
  function changeCell(cells, index, nextValue, transaction) {
    if (!Array.isArray(cells) || !Number.isInteger(index) || index < 0 || index >= cells.length) return false;
    if (!Number.isInteger(nextValue) || nextValue < -1) throw new TypeError('Cell values must be palette indexes or -1.');
    const previousValue = cells[index];
    if (previousValue === nextValue) return false;
    const existing = transaction.find(change => change.index === index);
    if (existing) existing.nextValue = nextValue;
    else transaction.push({ index, previousValue, nextValue });
    cells[index] = nextValue;
    return true;
  }

  function applyTransaction(cells, transaction, direction = 'redo') {
    if (!['undo', 'redo'].includes(direction)) throw new TypeError('Direction must be undo or redo.');
    transaction.forEach(change => { cells[change.index] = direction === 'undo' ? change.previousValue : change.nextValue; });
  }

  function countCells(cells, paletteSize) {
    const counts = Array.from({ length: paletteSize }, () => 0);
    let occupied = 0;
    cells.forEach(value => {
      if (value < 0) return;
      if (value < counts.length) counts[value] += 1;
      occupied += 1;
    });
    return { counts, occupied, empty: cells.length - occupied };
  }

  root.PatternEditor = { changeCell, applyTransaction, countCells };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PatternEditor;
})(typeof globalThis !== 'undefined' ? globalThis : window);
