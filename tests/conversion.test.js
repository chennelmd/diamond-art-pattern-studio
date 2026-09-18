const assert = require('node:assert/strict');
const { buildAdaptivePalette } = require('../conversion.js');

function pixels(colors) {
  return new Uint8ClampedArray(colors.flatMap(color => [...color, 255]));
}

const flatArtwork = pixels([
  [240, 20, 20], [240, 20, 20], [20, 40, 220], [20, 40, 220],
]);
assert.deepEqual(
  buildAdaptivePalette(flatArtwork, () => true, 8),
  [[240, 20, 20], [20, 40, 220]],
  'Exact illustration colors should remain unchanged when they fit the limit.',
);

const gradient = pixels(Array.from({ length: 256 }, (_, value) => [value, value, value]));
const reduced = buildAdaptivePalette(gradient, () => true, 8);
assert.equal(reduced.length, 8);
assert.ok(reduced[0][0] < reduced.at(-1)[0] || reduced[0][0] > reduced.at(-1)[0]);
assert.ok(new Set(reduced.map(color => color[0])).size === 8, 'A gradient should use the full adaptive palette.');

const repeated = buildAdaptivePalette(gradient, () => true, 8);
assert.deepEqual(repeated, reduced, 'Adaptive reduction must be deterministic.');

console.log('adaptive color conversion tests passed');
