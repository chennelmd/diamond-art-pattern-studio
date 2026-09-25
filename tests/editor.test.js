const assert = require('assert');
const { changeCell, applyTransaction, countCells } = require('../editor.js');

const cells = [0, 1, 1, -1];
const transaction = [];
assert.equal(changeCell(cells, 1, 0, transaction), true);
assert.equal(changeCell(cells, 1, 1, transaction), true);
assert.deepEqual(transaction, [{ index: 1, previousValue: 1, nextValue: 1 }]);
assert.equal(changeCell(cells, 3, 0, transaction), true);
assert.deepEqual(cells, [0, 1, 1, 0]);

applyTransaction(cells, transaction, 'undo');
assert.deepEqual(cells, [0, 1, 1, -1]);
applyTransaction(cells, transaction, 'redo');
assert.deepEqual(cells, [0, 1, 1, 0]);
assert.deepEqual(countCells(cells, 2), { counts: [2, 2], occupied: 4, empty: 0 });

assert.equal(changeCell(cells, 99, 0, []), false);
assert.throws(() => changeCell(cells, 0, -2, []), /palette indexes/);
assert.throws(() => applyTransaction(cells, [], 'sideways'), /Direction/);

console.log('pattern editor tests passed');
