const assert = require('node:assert/strict');
const { assignSymbols, legendRows, legendPageLayout, textColor } = require('../symbols.js');

const symbols = assignSymbols(447);
assert.equal(symbols.length, 447);
assert.equal(new Set(symbols).size, 447);
assert.equal(textColor([0, 0, 0]), '#ffffff');
assert.equal(textColor([255, 255, 255]), '#211b29');
assert.deepEqual(legendRows(
  [{ code: '310', name: 'Black', rgb: [0, 0, 0] }, { code: 'B5200', name: 'Snow White', rgb: [255, 255, 255] }],
  [100, 0], ['●', '○'],
), [{ code: '310', name: 'Black', rgb: [0, 0, 0], symbol: '●', count: 100 }]);
assert.throws(() => assignSymbols(-1), /non-negative/);
const legendLayout = legendPageLayout(300);
assert.ok(legendLayout.specBottom < legendLayout.legendTop, 'Project specifications must end before the first materials row.');
assert.throws(() => legendPageLayout(0), /positive/);

console.log('pattern symbol tests passed');
